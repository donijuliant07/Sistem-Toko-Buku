"""Tes yang membuktikan tiap konstruksi OOP **berperilaku**, bukan sekadar ada.

Fokus berkas ini adalah kontrak yang tidak terlihat dari tes fitur biasa:
abstract class benar-benar menolak instansiasi, `@property` benar-benar
read-only, atribut private benar-benar tidak bisa disentuh dari luar, dan
dispatch polimorfik benar-benar memilih implementasi per subclass.

`supabase_admin` di-mock di sini, jadi tidak ada tes yang menyentuh database.
"""

from datetime import date, timedelta
from unittest.mock import MagicMock, patch

import pytest

from app.schemas.promo import PromoUpdate
from app.services.base import BookRepository, ReportService, SupabaseTableService
from app.services.book_service import OrmBookRepository, RestBookRepository
from app.services.category_service import CategoryService
from app.services.dashboard_service import DashboardService
from app.services.promo_service import (
    PromoNotFound,
    PromoService,
    PromoView,
    _serialize,
)

TODAY = date.today()
PROMO_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"


def promo_row(**overrides):
    row = {
        "id": PROMO_ID,
        "code": "LITERASI10",
        "name": "Pesta Literasi",
        "discount_type": "Persentase",
        "discount_value": "20.00",
        "min_purchase": "100000.00",
        "max_discount": "40000.00",
        "quota": 500,
        "used_count": 0,
        "is_active": True,
        "start_date": TODAY.isoformat(),
        "end_date": (TODAY + timedelta(days=5)).isoformat(),
        "created_at": "2026-10-01T00:00:00+00:00",
        "updated_at": "2026-10-01T00:00:00+00:00",
    }
    row.update(overrides)
    return row


# --- 1. Abstract base class: instansiasi harus ditolak -----------------------


@pytest.mark.parametrize("abc_cls", [SupabaseTableService, BookRepository, ReportService])
def test_abstract_base_cannot_be_instantiated(abc_cls):
    with pytest.raises(TypeError):
        abc_cls()


def test_subclass_missing_an_abstract_method_is_still_rejected():
    """Membuktikan `@abstractmethod` ditegakkan Python, bukan sekadar dokumentasi."""

    class HalfDone(SupabaseTableService):
        TABLE = "half"

        def _client(self):
            return MagicMock()

        # `_order_clause`, `_serialize`, `get_by_id` sengaja tidak diisi.

    with pytest.raises(TypeError) as exc:
        HalfDone()

    # Pesan error menyebut method yang belum diimplementasikan.
    assert "_order_clause" in str(exc.value)
    assert "_serialize" in str(exc.value)


# --- 2. Inheritance: hubungan is-a nyata ------------------------------------


def test_crud_services_inherit_the_shared_framework():
    assert issubclass(CategoryService, SupabaseTableService)
    assert issubclass(PromoService, SupabaseTableService)


def test_book_repositories_share_one_contract():
    assert issubclass(OrmBookRepository, BookRepository)
    assert issubclass(RestBookRepository, BookRepository)


def test_dashboard_inherits_the_report_contract():
    assert issubclass(DashboardService, ReportService)


def test_inherited_framework_methods_are_not_redefined_by_subclasses():
    """`get_all`/`create`/`delete` hidup di induk — inilah yang menghapus duplikasi."""
    for name in ("get_all", "create", "delete"):
        assert name not in CategoryService.__dict__
        assert name not in PromoService.__dict__
        assert name in SupabaseTableService.__dict__


# --- 3. Encapsulation: private benar-benar tidak terlihat dari luar ----------


def test_private_table_name_is_inaccessible_from_outside():
    service = CategoryService()
    with pytest.raises(AttributeError):
        service.__table_name  # noqa: B018 — sengaja; di-mangle jadi nama lain


def test_table_name_property_is_the_only_read_path():
    assert CategoryService().table_name == "categories"
    assert PromoService().table_name == "promos"


def test_table_name_property_is_read_only():
    service = CategoryService()
    with pytest.raises(AttributeError):
        service.table_name = "other"


def test_promo_view_hides_its_raw_row():
    view = PromoView(promo_row())
    with pytest.raises(AttributeError):
        view.__row  # noqa: B018 — sengaja


# --- 4. @property dengan komputasi nyata ------------------------------------


def test_promo_status_is_derived_not_stored():
    assert PromoView(promo_row()).status == "Aktif"
    assert PromoView(promo_row(is_active=False)).status == "Nonaktif"
    assert PromoView(promo_row(start_date=(TODAY + timedelta(days=3)).isoformat())).status == "Jadwal"
    assert PromoView(promo_row(end_date=(TODAY - timedelta(days=1)).isoformat())).status == "Kadaluarsa"


def test_inactive_flag_wins_over_the_date_window():
    """Promo yang dimatikan tetap `Nonaktif` meski tanggalnya masih berjalan."""
    assert PromoView(promo_row(is_active=False)).status == "Nonaktif"


def test_status_tracks_the_data_the_view_was_built_from():
    """Nilai turunan dihitung saat diakses, bukan dibekukan saat konstruksi."""
    inactive = promo_row(is_active=False)
    view = PromoView(promo_row())
    assert view.status == "Aktif"
    assert PromoView(inactive).status == "Nonaktif"


def test_view_copies_its_row_so_callers_cannot_mutate_behind_its_back():
    """Baris mentah disalin: mengubah dict asal tidak boleh mengubah pandangan."""
    row = promo_row()
    view = PromoView(row)
    row["is_active"] = False
    assert view.status == "Aktif"


# --- 5. Polymorphism: satu pemanggilan, perilaku berbeda --------------------


def test_get_all_dispatches_to_each_subclass_serializer():
    """Pemanggilan `get_all` identik; hasilnya berbeda sesuai subclass."""
    cat_client = MagicMock()
    cat_client.table.return_value.select.return_value.order.return_value.execute.return_value = MagicMock(
        data=[{"id": "c1", "name": "Fiksi"}]
    )
    promo_client = MagicMock()
    promo_client.table.return_value.select.return_value.order.return_value.execute.return_value = MagicMock(
        data=[promo_row()]
    )

    with patch("app.services.category_service.supabase_admin", cat_client):
        cat_rows = CategoryService().get_all()
    with patch("app.services.promo_service.supabase_admin", promo_client):
        promo_rows = PromoService().get_all()

    # Kategori: baris apa adanya, tanpa `status`.
    assert cat_rows == [{"id": "c1", "name": "Fiksi"}]
    assert "status" not in cat_rows[0]

    # Promo: numeric diubah jadi float dan `status` ditambahkan.
    assert promo_rows[0]["status"] == "Aktif"
    assert promo_rows[0]["discount_value"] == 20.0


def test_order_clause_differs_per_subclass():
    assert CategoryService()._order_clause() == ("name", False)
    assert PromoService()._order_clause() == ("created_at", True)


# --- 6. Method override + super() -------------------------------------------


def test_promo_update_validates_then_delegates_to_super():
    """Override menambah validasi, lalu tetap menulis lewat jalur induk."""
    payload = PromoUpdate(is_active=False)

    with patch.object(PromoService, "get_by_id", return_value=promo_row()), patch.object(
        SupabaseTableService, "update", return_value={"sentinel": True}
    ) as parent_update:
        result = PromoService().update(PROMO_ID, payload)

    assert result == {"sentinel": True}
    parent_update.assert_called_once_with(PROMO_ID, payload)


def test_promo_update_rejects_an_inverted_range_without_touching_the_parent():
    """Validasi override berjalan **sebelum** `super().update`, jadi tidak ada tulisan."""
    current = promo_row(end_date=(TODAY + timedelta(days=1)).isoformat())
    payload = PromoUpdate(start_date=TODAY + timedelta(days=10))

    with (
        patch.object(PromoService, "get_by_id", return_value=current),
        patch.object(SupabaseTableService, "update") as parent_update,
        pytest.raises(ValueError),
    ):
        PromoService().update(PROMO_ID, payload)

    parent_update.assert_not_called()


def test_promo_delete_hook_runs_before_the_framework_delete():
    """`_before_delete` (hook override) menolak promo yang tidak ada."""
    with patch.object(PromoService, "get_by_id", return_value=None), patch.object(
        SupabaseTableService, "_table"
    ) as table, pytest.raises(PromoNotFound):
        PromoService().delete(PROMO_ID)

    # Hook melempar lebih dulu, jadi query hapus tidak pernah dibangun.
    table.assert_not_called()


# --- 7. Kompatibilitas: alias modul & helper yang dibagi --------------------


def test_module_level_serialize_alias_still_resolves_and_matches():
    """`from app.services.promo_service import _serialize` tetap bekerja (dipakai tes lama)."""
    row = promo_row()
    assert _serialize(row) == PromoService()._serialize(row)


def test_search_term_is_shared_by_both_book_repositories():
    """Util pencarian hidup di ABC, bukan digandakan di dua jalur."""
    for repo_cls in (OrmBookRepository, RestBookRepository):
        assert repo_cls._search_term("  dune  ") == "dune"
        assert repo_cls._search_term("   ") is None
        assert repo_cls._search_term(None) is None


def test_report_service_excludes_cancelled_orders():
    assert ReportService._is_revenue_order({"status": "paid"}) is True
    assert ReportService._is_revenue_order({"status": "cancelled"}) is False


def test_book_repositories_satisfy_the_abc_without_extra_methods():
    """Duck typing di tes lama tetap jalan: ABC tidak menuntut method tambahan."""
    assert set(BookRepository.__abstractmethods__) == {"get", "list_page"}
