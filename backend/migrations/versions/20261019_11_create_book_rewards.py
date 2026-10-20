"""Book Rewards: ulasan, moderasi komunitas, ledger poin, rules, dan generasi AI.

Revision ID: 20261019_11
Revises: 20261019_10
Create Date: 2026-10-19

Latar belakang
--------------
Fitur Book Rewards membutuhkan:

- **Sumber aktivitas yang sah**: tabel `reviews` (fitur ulasan belum ada) dan
  kolom moderasi/reply di `chat_messages` + tabel tanda "membantu"
  (`chat_message_helpful_marks`).
- **Ledger poin** `point_transactions` + saldo `profiles.points`. Saldo hanya
  berubah lewat RPC `apply_point_transaction`, yang menulis keduanya dalam satu
  transaksi (kunci baris profil, cek saldo, cap harian, idempotency).
- **Konfigurasi** `reward_rules` (key-value bertipe & ber-CHECK) + audit.
- **Generasi AI** `ai_review_generations` supaya penukaran poin, hasil, dan
  refund dapat diaudit dan dibuka ulang tanpa biaya kedua.

Keamanan
--------
- RLS aktif di semua tabel baru. Policy yang dibuat **hanya SELECT** (milik
  sendiri; admin melihat semua). Tidak ada policy tulis: seluruh penulisan
  lewat backend (`service_role`).
- RPC `apply_point_transaction` dicabut dari `PUBLIC`/`anon`/`authenticated`
  dan hanya diberikan ke `service_role`.
- Trigger `prevent_points_tampering` menolak perubahan `profiles.points` dari
  browser. RPC membuka jalur resmi lewat `SET LOCAL app.rewards_rpc`.
- Trigger `guard_reward_rules_write` menolak UPDATE/DELETE `reward_rules`
  kecuali service menyalakan `app.rewards_rules_ok` (mencegah perubahan rules
  tanpa audit).

Kompatibilitas data lama
------------------------
- Semua kolom NOT NULL baru punya `DEFAULT`, jadi baris lama aman.
- CHECK pada kolom baru ditambahkan setelah `DEFAULT` terisi.
- Tidak ada tabel/kolom/data lama yang dihapus. `downgrade()` hanya menghapus
  objek yang dibuat di sini.

Penerapan
---------
Diterapkan ke live DB pada 2026-10-19 (`alembic current` → `20261019_11`).
Jalankan dari `backend/`::

    uv run alembic upgrade 20261019_11

Catatan: rantai alembic dari revisi 04 tidak dapat membangun DB kosong (lihat
memori proyek); live DB adalah acuan.

Riwayat: versi awal migrasi ini memakai `IN (('pending', ...))` (record, bukan
daftar) pada dua CHECK status sehingga gagal dengan `text = record`; diperbaiki
sebelum penerapan yang berhasil.
"""

import sqlalchemy as sa
from alembic import op

revision = "20261019_11"
down_revision = "20261019_10"
branch_labels = None
depends_on = None

_REVIEW_STATUSES = "'pending', 'approved', 'rejected', 'rewarded'"
_MODERATION_STATUSES = "'none', 'pending', 'approved', 'rejected'"
_TRANSACTION_TYPES = (
    "'purchase_reward', 'review_reward', 'community_reward', "
    "'ai_redemption', 'refund', 'order_reversal', 'admin_adjustment'"
)
_SOURCE_TYPES = "'order', 'review', 'chat_message', 'ai_generation', 'admin'"
_ACTIVITY_TYPES = "'review', 'community_contribution', 'helpful_answer'"
_ACTIVITY_SOURCE_TYPES = "'review', 'chat_message'"
_ACTIVITY_STATUSES = "'pending', 'approved', 'rejected', 'rewarded'"
_ACCESS_METHODS = "'free', 'purchase_eligibility', 'points'"
_GENERATION_STATUSES = "'pending', 'success', 'failed'"
_SPOILER_LEVELS = "'no_spoiler', 'low', 'medium', 'heavy'"

#: (key, nilai awal). Batas atas tervalidasi di API (`RewardRuleUpdate`).
_RULE_DEFAULTS = (
    ("purchase_points_per_10000", 10),
    ("review_points", 20),
    ("community_contribution_points", 5),
    ("community_contribution_daily_cap", 2),
    ("helpful_answer_points", 10),
    ("helpful_answer_daily_cap", 3),
    ("spoiler_medium_points", 100),
    ("spoiler_heavy_points", 300),
    ("spoiler_medium_min_units", 1),
    ("spoiler_heavy_min_units", 3),
    ("helpful_answer_min_marks", 2),
)

_RULE_KEYS_SQL = ", ".join(f"'{key}'" for key, _ in _RULE_DEFAULTS)
_RULE_VALUES_SQL = ", ".join(
    f"('{key}', {value})" for key, value in _RULE_DEFAULTS
)


def upgrade() -> None:
    """Buat skema Book Rewards tanpa mengubah data lama secara destruktif."""
    # ------------------------------------------------------------------
    # 1. Saldo poin di profil
    # ------------------------------------------------------------------
    op.execute(sa.text(
        "ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS points bigint NOT NULL DEFAULT 0"
    ))
    op.execute(sa.text("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'ck_profiles_points_nonnegative'
            ) THEN
                ALTER TABLE public.profiles
                    ADD CONSTRAINT ck_profiles_points_nonnegative CHECK (points >= 0);
            END IF;
        END
        $$
    """))

    # Trigger penjaga: browser (auth.uid() tidak NULL) tidak boleh mengubah
    # saldo. RPC memakai SET LOCAL app.rewards_rpc = 'on' sebagai jalur resmi.
    op.execute(sa.text("""
        CREATE OR REPLACE FUNCTION public.prevent_points_tampering()
        RETURNS trigger
        LANGUAGE plpgsql
        SECURITY DEFINER SET search_path = public
        AS $$
        BEGIN
            IF NEW.points IS DISTINCT FROM OLD.points
               AND (SELECT auth.uid()) IS NOT NULL
               AND coalesce(current_setting('app.rewards_rpc', true), '') <> 'on'
               AND NOT public.is_admin() THEN
                RAISE EXCEPTION 'Perubahan saldo poin tidak diizinkan' USING ERRCODE = '42501';
            END IF;
            RETURN NEW;
        END;
        $$
    """))
    op.execute(sa.text(
        "DROP TRIGGER IF EXISTS trg_prevent_points_tampering ON public.profiles"
    ))
    op.execute(sa.text("""
        CREATE TRIGGER trg_prevent_points_tampering
        BEFORE UPDATE ON public.profiles
        FOR EACH ROW EXECUTE FUNCTION public.prevent_points_tampering()
    """))

    # ------------------------------------------------------------------
    # 2. Ledger poin
    # ------------------------------------------------------------------
    op.execute(sa.text(f"""
        CREATE TABLE IF NOT EXISTS public.point_transactions (
            id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id          uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
            points_delta     integer NOT NULL,
            balance_after    bigint NOT NULL,
            transaction_type text NOT NULL,
            source_type      text NOT NULL,
            source_id        text NOT NULL,
            book_id          uuid REFERENCES public.books(id) ON DELETE SET NULL,
            idempotency_key  text NOT NULL,
            metadata         jsonb NOT NULL DEFAULT '{{}}'::jsonb,
            created_by       uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
            created_at       timestamptz NOT NULL DEFAULT now(),
            CONSTRAINT uq_point_tx_idempotency UNIQUE (idempotency_key),
            CONSTRAINT ck_point_tx_nonzero CHECK (points_delta <> 0),
            CONSTRAINT ck_point_tx_balance CHECK (balance_after >= 0),
            CONSTRAINT ck_point_tx_type CHECK (transaction_type IN ({_TRANSACTION_TYPES})),
            CONSTRAINT ck_point_tx_source CHECK (source_type IN ({_SOURCE_TYPES})),
            CONSTRAINT ck_point_tx_sign CHECK (
                (transaction_type IN ('purchase_reward', 'review_reward', 'community_reward', 'refund')
                    AND points_delta > 0)
             OR (transaction_type IN ('ai_redemption', 'order_reversal') AND points_delta < 0)
             OR (transaction_type = 'admin_adjustment')
            ),
            CONSTRAINT ck_point_tx_adjustment_actor CHECK (
                transaction_type <> 'admin_adjustment' OR created_by IS NOT NULL
            )
        )
    """))
    op.execute(sa.text(
        "CREATE INDEX IF NOT EXISTS ix_point_tx_user_created "
        "ON public.point_transactions (user_id, created_at DESC)"
    ))
    op.execute(sa.text(
        "CREATE INDEX IF NOT EXISTS ix_point_tx_user_type_created "
        "ON public.point_transactions (user_id, transaction_type, created_at DESC)"
    ))
    # Satu reward per sumber per tipe. Partial index per tipe lebih sempit
    # daripada UNIQUE(source_id) global, sehingga satu order tetap boleh punya
    # transaksi pembelian *dan* pembalikannya.
    op.execute(sa.text(
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_point_tx_purchase_per_order "
        "ON public.point_transactions (source_id) WHERE transaction_type = 'purchase_reward'"
    ))
    op.execute(sa.text(
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_point_tx_reversal_per_order "
        "ON public.point_transactions (source_id) WHERE transaction_type = 'order_reversal'"
    ))
    op.execute(sa.text(
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_point_tx_redemption "
        "ON public.point_transactions (source_id) WHERE transaction_type = 'ai_redemption'"
    ))
    op.execute(sa.text(
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_point_tx_refund "
        "ON public.point_transactions (source_id) WHERE transaction_type = 'refund'"
    ))
    op.execute(sa.text(
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_point_tx_community "
        "ON public.point_transactions (user_id, source_type, source_id) "
        "WHERE transaction_type = 'community_reward'"
    ))
    # "Satu reward ulasan per pengguna per buku" — tahan walau ulasannya
    # dihapus lalu dibuat ulang.
    op.execute(sa.text(
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_point_tx_review_per_book "
        "ON public.point_transactions (user_id, book_id) "
        "WHERE transaction_type = 'review_reward' AND book_id IS NOT NULL"
    ))

    # ------------------------------------------------------------------
    # 3. RPC atomik: kunci saldo + tulis ledger
    # ------------------------------------------------------------------
    op.execute(sa.text("""
        CREATE OR REPLACE FUNCTION public.apply_point_transaction(
            p_user uuid,
            p_delta bigint,
            p_type text,
            p_source_type text,
            p_source_id text,
            p_idem text,
            p_metadata jsonb DEFAULT '{}'::jsonb,
            p_created_by uuid DEFAULT NULL,
            p_book_id uuid DEFAULT NULL,
            p_daily_cap integer DEFAULT NULL,
            p_cap_type text DEFAULT NULL
        ) RETURNS public.point_transactions
        LANGUAGE plpgsql
        SECURITY DEFINER SET search_path = public
        AS $$
        DECLARE
            v_balance bigint;
            v_row public.point_transactions;
            v_today date := (now() AT TIME ZONE 'Asia/Jakarta')::date;
        BEGIN
            -- Jalur resmi perubahan saldo; dibaca trigger prevent_points_tampering.
            PERFORM set_config('app.rewards_rpc', 'on', true);

            IF p_delta = 0 THEN
                RAISE EXCEPTION 'INVALID_DELTA' USING ERRCODE = 'P0001';
            END IF;

            -- 1) Idempotensi: key yang sama mengembalikan baris lama, tetapi
            --    hanya bila operasinya memang sama.
            SELECT * INTO v_row FROM public.point_transactions
             WHERE idempotency_key = p_idem;
            IF FOUND THEN
                IF v_row.user_id <> p_user
                   OR v_row.points_delta <> p_delta
                   OR v_row.transaction_type <> p_type THEN
                    RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT' USING ERRCODE = 'P0001';
                END IF;
                RETURN v_row;
            END IF;

            -- 2) Kunci baris profil: request paralel untuk user yang sama
            --    berjalan berurutan, sehingga cap harian dan saldo tidak bisa
            --    dilewati oleh dua request bersamaan.
            SELECT points INTO v_balance FROM public.profiles
             WHERE id = p_user FOR UPDATE;
            IF NOT FOUND THEN
                RAISE EXCEPTION 'PROFILE_NOT_FOUND' USING ERRCODE = 'P0002';
            END IF;

            -- 3) Batas harian memakai waktu server, zona Asia/Jakarta.
            IF p_daily_cap IS NOT NULL AND p_delta > 0 AND p_cap_type IS NOT NULL THEN
                IF (SELECT count(*) FROM public.point_transactions t
                     WHERE t.user_id = p_user
                       AND t.transaction_type = p_cap_type
                       AND (t.created_at AT TIME ZONE 'Asia/Jakarta')::date = v_today
                   ) >= p_daily_cap THEN
                    RAISE EXCEPTION 'DAILY_CAP_REACHED' USING ERRCODE = 'P0003';
                END IF;
            END IF;

            -- 4) Saldo tidak boleh negatif.
            IF v_balance + p_delta < 0 THEN
                RAISE EXCEPTION 'INSUFFICIENT_POINTS' USING ERRCODE = 'P0004';
            END IF;

            -- 5) Ubah saldo dan tulis ledger dalam transaksi yang sama.
            UPDATE public.profiles SET points = points + p_delta WHERE id = p_user;
            INSERT INTO public.point_transactions(
                user_id, points_delta, balance_after, transaction_type,
                source_type, source_id, book_id, idempotency_key, metadata, created_by
            ) VALUES (
                p_user, p_delta, v_balance + p_delta, p_type,
                p_source_type, p_source_id, p_book_id, p_idem, coalesce(p_metadata, '{}'::jsonb),
                p_created_by
            ) RETURNING * INTO v_row;
            RETURN v_row;
        END;
        $$
    """))
    op.execute(sa.text(
        "REVOKE ALL ON FUNCTION public.apply_point_transaction("
        "uuid, bigint, text, text, text, text, jsonb, uuid, uuid, integer, text) "
        "FROM PUBLIC"
    ))
    op.execute(sa.text(
        "DO $$ BEGIN "
        "REVOKE ALL ON FUNCTION public.apply_point_transaction("
        "uuid, bigint, text, text, text, text, jsonb, uuid, uuid, integer, text) "
        "FROM anon, authenticated; "
        "EXCEPTION WHEN undefined_object THEN NULL; END $$"
    ))
    op.execute(sa.text(
        "DO $$ BEGIN "
        "GRANT EXECUTE ON FUNCTION public.apply_point_transaction("
        "uuid, bigint, text, text, text, text, jsonb, uuid, uuid, integer, text) "
        "TO service_role; "
        "EXCEPTION WHEN undefined_object THEN NULL; END $$"
    ))

    # ------------------------------------------------------------------
    # 4. Aktivitas reward (status moderasi ulasan/pesan)
    # ------------------------------------------------------------------
    op.execute(sa.text(f"""
        CREATE TABLE IF NOT EXISTS public.reward_activities (
            id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id          uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
            activity_type    text NOT NULL,
            source_type      text NOT NULL,
            source_id        uuid NOT NULL,
            status           text NOT NULL DEFAULT 'pending',
            points_awarded   integer,
            reviewed_by      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
            reviewed_at      timestamptz,
            approved_at      timestamptz,
            rejection_reason text,
            created_at       timestamptz NOT NULL DEFAULT now(),
            CONSTRAINT uq_reward_activity_source UNIQUE (user_id, activity_type, source_type, source_id),
            CONSTRAINT ck_reward_activity_type CHECK (activity_type IN ({_ACTIVITY_TYPES})),
            CONSTRAINT ck_reward_activity_source CHECK (source_type IN ({_ACTIVITY_SOURCE_TYPES})),
            CONSTRAINT ck_reward_activity_status CHECK (status IN ({_ACTIVITY_STATUSES})),
            CONSTRAINT ck_reward_activity_points CHECK (points_awarded IS NULL OR points_awarded >= 0)
        )
    """))
    op.execute(sa.text(
        "CREATE INDEX IF NOT EXISTS ix_reward_activities_status "
        "ON public.reward_activities (status, created_at)"
    ))

    # ------------------------------------------------------------------
    # 5. Rules + audit
    # ------------------------------------------------------------------
    op.execute(sa.text(f"""
        CREATE TABLE IF NOT EXISTS public.reward_rules (
            key        text PRIMARY KEY,
            value      bigint NOT NULL,
            updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
            updated_at timestamptz NOT NULL DEFAULT now(),
            CONSTRAINT ck_reward_rules_value CHECK (value >= 0),
            CONSTRAINT ck_reward_rules_key CHECK (key IN ({_RULE_KEYS_SQL}))
        )
    """))
    op.execute(sa.text(f"""
        INSERT INTO public.reward_rules (key, value) VALUES {_RULE_VALUES_SQL}
        ON CONFLICT (key) DO NOTHING
    """))
    op.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS public.reward_rules_audit (
            id         bigserial PRIMARY KEY,
            key        text NOT NULL,
            old_value  bigint,
            new_value  bigint,
            changed_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
            changed_at timestamptz NOT NULL DEFAULT now()
        )
    """))
    # Perubahan rules hanya lewat service (yang menulis audit di transaksi yang
    # sama). Tanpa flag, UPDATE/DELETE langsung dari SQL ditolak.
    op.execute(sa.text("""
        CREATE OR REPLACE FUNCTION public.guard_reward_rules_write()
        RETURNS trigger
        LANGUAGE plpgsql
        SECURITY DEFINER SET search_path = public
        AS $$
        BEGIN
            IF coalesce(current_setting('app.rewards_rules_ok', true), '') <> 'on' THEN
                RAISE EXCEPTION 'Perubahan reward rules harus lewat layanan reward'
                    USING ERRCODE = '42501';
            END IF;
            RETURN COALESCE(NEW, OLD);
        END;
        $$
    """))
    op.execute(sa.text(
        "DROP TRIGGER IF EXISTS trg_guard_reward_rules_write ON public.reward_rules"
    ))
    op.execute(sa.text("""
        CREATE TRIGGER trg_guard_reward_rules_write
        BEFORE UPDATE OR DELETE ON public.reward_rules
        FOR EACH ROW EXECUTE FUNCTION public.guard_reward_rules_write()
    """))

    # Satu RPC untuk mengubah beberapa aturan + audit dalam satu transaksi.
    # Diperlukan karena PostgREST menjalankan satu statement per request,
    # sehingga `set_config('app.rewards_rules_ok', ...)` tidak bisa berbagi
    # transaksi dengan UPDATE lewat dua panggilan terpisah.
    op.execute(sa.text("""
        CREATE OR REPLACE FUNCTION public.set_reward_rules(
            p_values jsonb,
            p_actor uuid
        ) RETURNS SETOF public.reward_rules
        LANGUAGE plpgsql
        SECURITY DEFINER SET search_path = public
        AS $$
        DECLARE
            v_key   text;
            v_value bigint;
            v_old   bigint;
        BEGIN
            PERFORM set_config('app.rewards_rules_ok', 'on', true);
            FOR v_key, v_value IN
                SELECT key, value::bigint FROM jsonb_each_text(p_values)
            LOOP
                SELECT value INTO v_old FROM public.reward_rules WHERE key = v_key;
                IF NOT FOUND THEN
                    RAISE EXCEPTION 'UNKNOWN_RULE' USING ERRCODE = 'P0001';
                END IF;
                IF v_value < 0 THEN
                    RAISE EXCEPTION 'INVALID_RULE_VALUE' USING ERRCODE = 'P0001';
                END IF;
                UPDATE public.reward_rules
                   SET value = v_value, updated_by = p_actor, updated_at = now()
                 WHERE key = v_key;
                INSERT INTO public.reward_rules_audit(key, old_value, new_value, changed_by)
                VALUES (v_key, v_old, v_value, p_actor);
            END LOOP;
            RETURN QUERY
                SELECT r.* FROM public.reward_rules r
                 WHERE r.key IN (SELECT jsonb_object_keys(p_values))
                 ORDER BY r.key;
        END;
        $$
    """))
    op.execute(sa.text(
        "REVOKE ALL ON FUNCTION public.set_reward_rules(jsonb, uuid) FROM PUBLIC"
    ))
    op.execute(sa.text(
        "DO $$ BEGIN "
        "REVOKE ALL ON FUNCTION public.set_reward_rules(jsonb, uuid) "
        "FROM anon, authenticated; "
        "EXCEPTION WHEN undefined_object THEN NULL; END $$"
    ))
    op.execute(sa.text(
        "DO $$ BEGIN "
        "GRANT EXECUTE ON FUNCTION public.set_reward_rules(jsonb, uuid) "
        "TO service_role; "
        "EXCEPTION WHEN undefined_object THEN NULL; END $$"
    ))

    # Unit buku yang dibeli dari pesanan selesai. Satu query agar tidak perlu
    # menjumlahkan `order_items` di aplikasi (dan tidak kena batas baris
    # PostgREST saat riwayat pesanan panjang).
    op.execute(sa.text("""
        CREATE OR REPLACE FUNCTION public.reward_units_bought(
            p_user uuid,
            p_book uuid DEFAULT NULL
        ) RETURNS integer
        LANGUAGE sql
        SECURITY DEFINER SET search_path = public
        AS $$
            SELECT coalesce(sum(i.quantity), 0)::integer
              FROM public.orders o
              JOIN public.order_items i ON i.order_id = o.id
             WHERE o.user_id = p_user
               AND o.status = 'completed'
               AND (p_book IS NULL OR i.book_id = p_book)
        $$
    """))
    op.execute(sa.text(
        "REVOKE ALL ON FUNCTION public.reward_units_bought(uuid, uuid) FROM PUBLIC"
    ))
    op.execute(sa.text(
        "DO $$ BEGIN "
        "REVOKE ALL ON FUNCTION public.reward_units_bought(uuid, uuid) "
        "FROM anon, authenticated; "
        "EXCEPTION WHEN undefined_object THEN NULL; END $$"
    ))
    op.execute(sa.text(
        "DO $$ BEGIN "
        "GRANT EXECUTE ON FUNCTION public.reward_units_bought(uuid, uuid) "
        "TO service_role; "
        "EXCEPTION WHEN undefined_object THEN NULL; END $$"
    ))

    # Rekonsiliasi: bandingkan cache `profiles.points` dengan jumlah ledger.
    # Hanya membaca; koreksi tetap lewat penyesuaian admin yang tercatat.
    op.execute(sa.text("""
        CREATE OR REPLACE FUNCTION public.reconcile_reward_points()
        RETURNS TABLE (user_id uuid, cached_points bigint, ledger_points bigint)
        LANGUAGE sql
        SECURITY DEFINER SET search_path = public
        AS $$
            SELECT p.id,
                   p.points,
                   coalesce(sum(t.points_delta), 0)::bigint
              FROM public.profiles p
              LEFT JOIN public.point_transactions t ON t.user_id = p.id
             GROUP BY p.id, p.points
            HAVING p.points <> coalesce(sum(t.points_delta), 0)
        $$
    """))
    op.execute(sa.text(
        "REVOKE ALL ON FUNCTION public.reconcile_reward_points() FROM PUBLIC"
    ))
    op.execute(sa.text(
        "DO $$ BEGIN "
        "REVOKE ALL ON FUNCTION public.reconcile_reward_points() "
        "FROM anon, authenticated; "
        "EXCEPTION WHEN undefined_object THEN NULL; END $$"
    ))
    op.execute(sa.text(
        "DO $$ BEGIN "
        "GRANT EXECUTE ON FUNCTION public.reconcile_reward_points() "
        "TO service_role; "
        "EXCEPTION WHEN undefined_object THEN NULL; END $$"
    ))

    # ------------------------------------------------------------------
    # 6. Ulasan buku
    # ------------------------------------------------------------------
    op.execute(sa.text(f"""
        CREATE TABLE IF NOT EXISTS public.reviews (
            id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id          uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
            book_id          uuid NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
            rating           smallint NOT NULL,
            title            varchar(120),
            body             text NOT NULL,
            status           text NOT NULL DEFAULT 'pending',
            moderated_by     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
            moderated_at     timestamptz,
            rejection_reason varchar(255),
            rewarded_at      timestamptz,
            created_at       timestamptz NOT NULL DEFAULT now(),
            updated_at       timestamptz NOT NULL DEFAULT now(),
            CONSTRAINT uq_reviews_user_book UNIQUE (user_id, book_id),
            CONSTRAINT ck_reviews_rating CHECK (rating BETWEEN 1 AND 5),
            CONSTRAINT ck_reviews_body_len CHECK (char_length(btrim(body)) BETWEEN 20 AND 4000),
            CONSTRAINT ck_reviews_status CHECK (status IN ({_REVIEW_STATUSES}))
        )
    """))
    op.execute(sa.text(
        "CREATE INDEX IF NOT EXISTS ix_reviews_status_created "
        "ON public.reviews (status, created_at)"
    ))
    op.execute(sa.text(
        "CREATE INDEX IF NOT EXISTS ix_reviews_book_visible "
        "ON public.reviews (book_id) WHERE status IN ('approved', 'rewarded')"
    ))

    # ------------------------------------------------------------------
    # 7. Moderasi komunitas + tanda "membantu"
    # ------------------------------------------------------------------
    op.execute(sa.text(
        "ALTER TABLE public.chat_messages "
        "ADD COLUMN IF NOT EXISTS moderation_status text NOT NULL DEFAULT 'none'"
    ))
    op.execute(sa.text(
        "ALTER TABLE public.chat_messages "
        "ADD COLUMN IF NOT EXISTS parent_message_id uuid "
        "REFERENCES public.chat_messages(id) ON DELETE SET NULL"
    ))
    op.execute(sa.text("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint
                 WHERE conname = 'ck_chat_messages_moderation_status'
            ) THEN
                ALTER TABLE public.chat_messages
                    ADD CONSTRAINT ck_chat_messages_moderation_status
                    CHECK (moderation_status IN (""" + _MODERATION_STATUSES + """));
            END IF;
        END
        $$
    """))
    # Balasan tidak boleh menunjuk dirinya sendiri.
    op.execute(sa.text("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint
                 WHERE conname = 'ck_chat_messages_parent_not_self'
            ) THEN
                ALTER TABLE public.chat_messages
                    ADD CONSTRAINT ck_chat_messages_parent_not_self
                    CHECK (parent_message_id IS NULL OR parent_message_id <> id);
            END IF;
        END
        $$
    """))
    op.execute(sa.text(
        "CREATE INDEX IF NOT EXISTS ix_chat_messages_parent "
        "ON public.chat_messages (parent_message_id)"
    ))
    op.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS public.chat_message_helpful_marks (
            message_id uuid NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
            user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
            created_at timestamptz NOT NULL DEFAULT now(),
            CONSTRAINT pk_chat_message_helpful_marks PRIMARY KEY (message_id, user_id)
        )
    """))

    # ------------------------------------------------------------------
    # 8. Generasi AI Book Review
    # ------------------------------------------------------------------
    op.execute(sa.text(f"""
        CREATE TABLE IF NOT EXISTS public.ai_review_generations (
            id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id          uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
            book_id          uuid NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
            spoiler_level    text NOT NULL,
            access_method    text NOT NULL,
            points_spent     integer NOT NULL DEFAULT 0,
            status           text NOT NULL DEFAULT 'pending',
            idempotency_key  text NOT NULL,
            redemption_tx_id uuid REFERENCES public.point_transactions(id) ON DELETE SET NULL,
            refund_tx_id     uuid REFERENCES public.point_transactions(id) ON DELETE SET NULL,
            failure_reason   text,
            result           jsonb,
            provider         text,
            created_at       timestamptz NOT NULL DEFAULT now(),
            started_at       timestamptz,
            completed_at     timestamptz,
            CONSTRAINT ck_ai_gen_level CHECK (spoiler_level IN ({_SPOILER_LEVELS})),
            CONSTRAINT ck_ai_gen_access CHECK (access_method IN ({_ACCESS_METHODS})),
            CONSTRAINT ck_ai_gen_status CHECK (status IN ({_GENERATION_STATUSES})),
            CONSTRAINT ck_ai_gen_points CHECK (points_spent >= 0),
            CONSTRAINT ck_ai_gen_points_shape CHECK (
                (access_method = 'points') = (points_spent > 0)
            ),
            CONSTRAINT ck_ai_gen_refund CHECK (refund_tx_id IS NULL OR status = 'failed')
        )
    """))
    op.execute(sa.text(
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_gen_idempotency "
        "ON public.ai_review_generations (user_id, idempotency_key)"
    ))
    op.execute(sa.text(
        "CREATE INDEX IF NOT EXISTS ix_ai_gen_user_book "
        "ON public.ai_review_generations (user_id, book_id, spoiler_level, created_at DESC)"
    ))
    op.execute(sa.text(
        "CREATE INDEX IF NOT EXISTS ix_ai_gen_stale_pending "
        "ON public.ai_review_generations (started_at) WHERE status = 'pending'"
    ))
    op.execute(sa.text(
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_gen_active_pending "
        "ON public.ai_review_generations (user_id, book_id, spoiler_level) "
        "WHERE status = 'pending'"
    ))

    # ------------------------------------------------------------------
    # 9. RLS — baca milik sendiri (+ admin); tidak ada policy tulis
    # ------------------------------------------------------------------
    for table in (
        "point_transactions",
        "reward_activities",
        "reward_rules",
        "reward_rules_audit",
        "reviews",
        "chat_message_helpful_marks",
        "ai_review_generations",
    ):
        op.execute(sa.text(f"ALTER TABLE public.{table} ENABLE ROW LEVEL SECURITY"))

    # Tabel milik pengguna: baca baris sendiri, atau semua bila admin.
    for table in (
        "point_transactions",
        "reward_activities",
        "reviews",
        "chat_message_helpful_marks",
        "ai_review_generations",
    ):
        op.execute(sa.text(
            f"DROP POLICY IF EXISTS {table}_select_own ON public.{table}"
        ))
        op.execute(sa.text(f"""
            CREATE POLICY {table}_select_own
            ON public.{table} FOR SELECT TO authenticated
            USING (user_id = (SELECT auth.uid()) OR public.is_admin())
        """))

    # Ulasan yang tayang boleh dibaca siapa saja (halaman produk).
    op.execute(sa.text("DROP POLICY IF EXISTS reviews_select_public ON public.reviews"))
    op.execute(sa.text("""
        CREATE POLICY reviews_select_public
        ON public.reviews FOR SELECT TO anon, authenticated
        USING (status IN ('approved', 'rewarded'))
    """))

    # Rules boleh dibaca (biaya poin ditampilkan di UI); audit hanya admin.
    op.execute(sa.text("DROP POLICY IF EXISTS reward_rules_select_all ON public.reward_rules"))
    op.execute(sa.text("""
        CREATE POLICY reward_rules_select_all
        ON public.reward_rules FOR SELECT TO anon, authenticated
        USING (true)
    """))
    op.execute(sa.text(
        "DROP POLICY IF EXISTS reward_rules_audit_select_admin ON public.reward_rules_audit"
    ))
    op.execute(sa.text("""
        CREATE POLICY reward_rules_audit_select_admin
        ON public.reward_rules_audit FOR SELECT TO authenticated
        USING (public.is_admin())
    """))


def downgrade() -> None:
    """Hapus seluruh objek Book Rewards; data lama tidak tersentuh."""
    for table in (
        "ai_review_generations",
        "reward_rules_audit",
        "reward_rules",
        "reward_activities",
        "point_transactions",
        "reviews",
        "chat_message_helpful_marks",
    ):
        op.execute(sa.text(f"DROP TABLE IF EXISTS public.{table}"))

    op.execute(sa.text(
        "DROP INDEX IF EXISTS public.ix_chat_messages_parent"
    ))
    op.execute(sa.text(
        "ALTER TABLE public.chat_messages "
        "DROP CONSTRAINT IF EXISTS ck_chat_messages_parent_not_self"
    ))
    op.execute(sa.text(
        "ALTER TABLE public.chat_messages "
        "DROP CONSTRAINT IF EXISTS ck_chat_messages_moderation_status"
    ))
    op.execute(sa.text(
        "ALTER TABLE public.chat_messages DROP COLUMN IF EXISTS parent_message_id"
    ))
    op.execute(sa.text(
        "ALTER TABLE public.chat_messages DROP COLUMN IF EXISTS moderation_status"
    ))

    op.execute(sa.text("DROP FUNCTION IF EXISTS public.apply_point_transaction("
                       "uuid, bigint, text, text, text, text, jsonb, uuid, uuid, integer, text)"))
    op.execute(sa.text("DROP FUNCTION IF EXISTS public.guard_reward_rules_write()"))
    op.execute(sa.text("DROP FUNCTION IF EXISTS public.reconcile_reward_points()"))
    op.execute(sa.text("DROP FUNCTION IF EXISTS public.reward_units_bought(uuid, uuid)"))
    op.execute(sa.text("DROP FUNCTION IF EXISTS public.set_reward_rules(jsonb, uuid)"))
    op.execute(sa.text(
        "DROP TRIGGER IF EXISTS trg_prevent_points_tampering ON public.profiles"
    ))
    op.execute(sa.text("DROP FUNCTION IF EXISTS public.prevent_points_tampering()"))
    op.execute(sa.text(
        "ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS ck_profiles_points_nonnegative"
    ))
    op.execute(sa.text("ALTER TABLE public.profiles DROP COLUMN IF EXISTS points"))
