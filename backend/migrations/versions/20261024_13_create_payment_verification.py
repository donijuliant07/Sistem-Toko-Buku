"""Verifikasi pembayaran manual: bukti transfer dan jejak keputusan admin.

Revision ID: 20261024_13
Revises: 20261020_12
Create Date: 2026-10-24

Perubahan
---------
1. `payments`: kolom `verified_by`, `verified_at`, `rejection_reason`,
   `updated_at`, dan `current_proof_id` (bukti yang sedang dinilai).
2. `payment_proofs`: satu baris per unggahan, disimpan di bucket privat
   `payment-proofs`. Bukti lama tidak dihapus saat user mengunggah ulang —
   status-nya menjadi `superseded` sehingga riwayat tetap utuh.
3. Unique index parsial `uq_payment_proofs_one_pending`: paling banyak satu
   bukti `pending` per pembayaran. Ini pengaman konkurensi untuk unggah ganda;
   service tetap memakai compare-and-set (`UPDATE ... WHERE status='pending'`).
4. `payment_audit_logs`: jejak semua aksi (unggah, approve, reject). Tanpa FK
   ke `auth.users` agar penghapusan akun tidak menghapus jejak audit.

Status `payments.status` **tidak** diubah kosakata CHECK-nya; API menerjemahkan
`pending/success/failed` menjadi `pending|under_review/paid/rejected`
(lihat `app/services/payment_service.py`).

Bucket `payment-proofs` (privat) dibuat terpisah lewat SQL Editor / Dashboard,
bukan oleh migrasi ini — lihat `docs/MANUAL-PAYMENT.md`.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "20261024_13"
down_revision = "20261020_12"
branch_labels = None
depends_on = None

_AUDIT_ACTIONS = (
    "proof_submitted",
    "proof_resubmitted",
    "payment_approved",
    "payment_rejected",
    "payment_expired",
)
_ACTOR_ROLES = ("user", "admin", "system")
_ACTION_SQL = ", ".join(f"'{value}'" for value in _AUDIT_ACTIONS)
_ROLE_SQL = ", ".join(f"'{value}'" for value in _ACTOR_ROLES)


def upgrade() -> None:
    # 1. Kolom keputusan di `payments`. IF NOT EXISTS menjaga migrasi tetap
    #    aman bila kolom pernah ditambahkan manual di SQL Editor.
    op.execute(sa.text(
        "ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS verified_by uuid"
    ))
    op.execute(sa.text(
        "ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS verified_at timestamptz"
    ))
    op.execute(sa.text(
        "ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS rejection_reason text"
    ))
    op.execute(sa.text(
        "ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now()"
    ))
    op.execute(sa.text(
        "ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS current_proof_id uuid"
    ))
    op.execute(sa.text("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conname = 'ck_payments_rejection_reason_len'
                  AND conrelid = 'public.payments'::regclass
            ) THEN
                ALTER TABLE public.payments
                    ADD CONSTRAINT ck_payments_rejection_reason_len
                    CHECK (rejection_reason IS NULL OR char_length(rejection_reason) BETWEEN 10 AND 500);
            END IF;
        END
        $$
    """))

    # 2. Bukti pembayaran.
    op.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS public.payment_proofs (
            id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            payment_id        uuid NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
            order_id          uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
            storage_path      text NOT NULL,
            original_filename varchar(255),
            content_type      text NOT NULL,
            file_size         bigint NOT NULL,
            status            text NOT NULL DEFAULT 'pending',
            uploaded_by       uuid,
            uploaded_at       timestamptz NOT NULL DEFAULT now(),
            reviewed_by       uuid,
            reviewed_at       timestamptz,
            review_note       text,
            CONSTRAINT ck_payment_proofs_status
                CHECK (status IN ('pending', 'approved', 'rejected', 'superseded')),
            CONSTRAINT ck_payment_proofs_size CHECK (file_size > 0),
            CONSTRAINT uq_payment_proofs_path UNIQUE (storage_path)
        )
    """))
    # Satu bukti `pending` per pembayaran = kunci konkurensi unggah ganda.
    op.execute(sa.text(
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_proofs_one_pending "
        "ON public.payment_proofs (payment_id) WHERE status = 'pending'"
    ))
    op.execute(sa.text(
        "CREATE INDEX IF NOT EXISTS ix_payment_proofs_payment "
        "ON public.payment_proofs (payment_id, uploaded_at DESC)"
    ))
    op.execute(sa.text(
        "CREATE INDEX IF NOT EXISTS ix_payment_proofs_status "
        "ON public.payment_proofs (status) WHERE status = 'pending'"
    ))

    # FK `current_proof_id` baru bisa dibuat setelah tabel bukti ada. SET NULL
    # supaya penghapusan baris bukti tidak mengunci pembayaran.
    op.execute(sa.text("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conname = 'payments_current_proof_id_fkey'
                  AND conrelid = 'public.payments'::regclass
            ) THEN
                ALTER TABLE public.payments
                    ADD CONSTRAINT payments_current_proof_id_fkey
                    FOREIGN KEY (current_proof_id)
                    REFERENCES public.payment_proofs(id) ON DELETE SET NULL;
            END IF;
        END
        $$
    """))

    # 3. Audit. Tanpa FK ke auth.users: riwayat keputusan harus bertahan.
    op.execute(sa.text(f"""
        CREATE TABLE IF NOT EXISTS public.payment_audit_logs (
            id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            payment_id uuid REFERENCES public.payments(id) ON DELETE CASCADE,
            order_id   uuid,
            proof_id   uuid,
            action     text NOT NULL,
            actor_id   uuid,
            actor_role text NOT NULL DEFAULT 'system',
            details    jsonb NOT NULL DEFAULT '{{}}'::jsonb,
            created_at timestamptz NOT NULL DEFAULT now(),
            CONSTRAINT ck_payment_audit_action CHECK (action IN ({_ACTION_SQL})),
            CONSTRAINT ck_payment_audit_actor_role CHECK (actor_role IN ({_ROLE_SQL}))
        )
    """))
    op.execute(sa.text(
        "CREATE INDEX IF NOT EXISTS ix_payment_audit_logs_payment "
        "ON public.payment_audit_logs (payment_id, created_at DESC)"
    ))

    # 4. RLS: browser tidak pernah membaca tabel ini langsung (isinya path
    #    Storage dan alasan penolakan). Tulis-baca hanya lewat service role,
    #    yang menembus RLS. Policy admin dibatasi untuk kalau-kalau frontend
    #    nanti memakai anon key untuk daftar pembayaran.
    op.execute(sa.text("ALTER TABLE public.payment_proofs ENABLE ROW LEVEL SECURITY"))
    op.execute(sa.text("ALTER TABLE public.payment_audit_logs ENABLE ROW LEVEL SECURITY"))
    op.execute(sa.text("DROP POLICY IF EXISTS payment_proofs_owner_read ON public.payment_proofs"))
    op.execute(sa.text("""
        CREATE POLICY payment_proofs_owner_read
        ON public.payment_proofs FOR SELECT TO authenticated
        USING (
            public.is_admin()
            OR EXISTS (
                SELECT 1 FROM public.orders o
                WHERE o.id = payment_proofs.order_id AND o.user_id = (SELECT auth.uid())
            )
        )
    """))
    op.execute(sa.text("DROP POLICY IF EXISTS payment_audit_logs_admin_read ON public.payment_audit_logs"))
    op.execute(sa.text("""
        CREATE POLICY payment_audit_logs_admin_read
        ON public.payment_audit_logs FOR SELECT TO authenticated
        USING (public.is_admin())
    """))


def downgrade() -> None:
    """Hapus objek verifikasi pembayaran. Bukti di Storage tidak ikut dihapus."""
    op.execute(sa.text("DROP POLICY IF EXISTS payment_audit_logs_admin_read ON public.payment_audit_logs"))
    op.execute(sa.text("DROP POLICY IF EXISTS payment_proofs_owner_read ON public.payment_proofs"))
    op.execute(sa.text("DROP TABLE IF EXISTS public.payment_audit_logs"))
    op.execute(sa.text(
        "ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_current_proof_id_fkey"
    ))
    op.execute(sa.text("DROP TABLE IF EXISTS public.payment_proofs"))
    op.execute(sa.text(
        "ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS ck_payments_rejection_reason_len"
    ))
    for column in (
        "current_proof_id",
        "updated_at",
        "rejection_reason",
        "verified_at",
        "verified_by",
    ):
        op.execute(sa.text(f"ALTER TABLE public.payments DROP COLUMN IF EXISTS {column}"))
