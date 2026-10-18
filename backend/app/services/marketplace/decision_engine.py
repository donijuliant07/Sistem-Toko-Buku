"""Mesin keputusan akhir (Final Decision Engine) perbandingan harga.

Menghubungkan:
1. Validasi aturan deterministik Python.
2. Analisis statistik distribusi harga pasar.
3. Analisis lanjutan AI (AI Price Validator).
4. Pemisahan penawaran menjadi valid_offers, review_offers, dan rejected_offers.
5. Menjaga agar harga dan atribut sumber asli tidak pernah dimodifikasi.
"""

from __future__ import annotations

import logging
from decimal import Decimal
from typing import Any
from uuid import UUID

import httpx

from app.schemas.price_validation import (
    AIValidationResult,
    AIValidationStatus,
    PriceAssessment,
    PriceStatistics,
    ProductMatchStatus,
    ValidatedMarketplaceQuote,
    ValidationStatus,
)
from app.services.marketplace.ai_price_validator import AIPriceValidator
from app.services.marketplace.deterministic_validator import (
    calculate_price_statistics,
    evaluate_candidate_deterministically,
    validate_basic_data,
)

logger = logging.getLogger(__name__)


def _to_decimal(val: Any) -> Decimal:
    return val if isinstance(val, Decimal) else Decimal(str(val))


class PriceValidationEngine:
    """Orkestrator validasi harga hybrid (deterministik + AI)."""

    def __init__(
        self,
        ai_validator: AIPriceValidator | None = None,
    ) -> None:
        self._ai = ai_validator or AIPriceValidator()

    async def validate_comparison(
        self,
        *,
        book: dict[str, Any],
        raw_quotes: list[dict[str, Any]],
        client: httpx.AsyncClient | None = None,
    ) -> dict[str, Any]:
        """Proses seluruh penawaran hasil scraping melalui alur validasi hybrid."""
        book_id = str(book.get("id", ""))
        target_title = str(book.get("title", "")).strip()
        target_author = book.get("author")
        target_isbn = book.get("isbn")
        store_price = _to_decimal(book.get("price", 0))

        if not raw_quotes:
            return {
                "valid_offers": [],
                "review_offers": [],
                "rejected_offers": [],
                "price_statistics": calculate_price_statistics([]),
                "ai_validation_status": "disabled" if not self._ai.is_configured else "completed",
                "validation_summary": ["Belum ada penawaran untuk divalidasi."],
                "lowest_price": None,
                "highest_price": None,
                "savings": None,
            }

        # ------------------------------------------------------------------
        # Langkah 1: Kumpulkan harga pembanding yang sebanding untuk statistik
        # ------------------------------------------------------------------
        comparable_prices: list[Decimal] = []
        if store_price > 0:
            comparable_prices.append(store_price)
        for quote in raw_quotes:
            is_valid, parsed_price, _ = validate_basic_data(quote)
            if not is_valid or parsed_price is None:
                continue

            # Jalankan evaluasi awal tanpa statistik untuk mengecek bundel/ebook/mismatch
            initial_eval = evaluate_candidate_deterministically(
                quote,
                target_title=target_title,
                target_author=target_author,
                target_isbn=target_isbn,
                stats=None,
            )

            # Hanya gunakan kandidat yang tidak jelas-jelas ditolak untuk acuan statistik
            if not initial_eval.rejection_reasons and initial_eval.match_status != "mismatch":
                comparable_prices.append(parsed_price)

        statistics = calculate_price_statistics(comparable_prices)
        logger.info(
            "Validating prices: book_id=%s, target='%s', candidates=%d, comparable_for_stats=%d, median=%s",
            book_id,
            target_title,
            len(raw_quotes),
            len(comparable_prices),
            statistics.median_price,
        )

        # ------------------------------------------------------------------
        # Langkah 2: Evaluasi deterministik lengkap dengan konteks statistik
        # ------------------------------------------------------------------
        deterministic_results: dict[str, Any] = {}
        ai_candidates: list[dict[str, Any]] = []

        for idx, quote in enumerate(raw_quotes):
            quote_id = f"{quote.get('marketplace', 'm')}_{idx}"
            det_eval = evaluate_candidate_deterministically(
                quote,
                target_title=target_title,
                target_author=target_author,
                target_isbn=target_isbn,
                stats=statistics,
            )
            deterministic_results[quote_id] = det_eval

            # Tentukan apakah kandidat perlu dikirim ke AI
            # Kandidat yang data dasarnya sudah cacat (harga <= 0) tidak perlu membuang token AI
            if det_eval.is_data_valid:
                ai_candidates.append({
                    "offer_id": quote_id,
                    "marketplace": quote.get("marketplace"),
                    "title": quote.get("product_title") or quote.get("title"),
                    "price": quote.get("price"),
                    "seller_name": quote.get("seller_name"),
                    "deviation_percent": det_eval.deviation_percent,
                    "is_used": det_eval.attributes.is_used,
                    "is_preorder": det_eval.attributes.is_preorder,
                    "deterministic_notes": det_eval.rejection_reasons + det_eval.review_reasons,
                })

        # ------------------------------------------------------------------
        # Langkah 3: Analisis AI (jika tersedia dan ada kandidat yang layak)
        # ------------------------------------------------------------------
        ai_result: AIValidationResult
        if self._ai.is_configured and ai_candidates:
            ai_result = await self._ai.validate_offers(
                book_id=book_id,
                target_title=target_title,
                target_author=target_author,
                target_isbn=target_isbn,
                target_store_price=float(store_price),
                candidate_quotes=ai_candidates,
                statistics=statistics,
                client=client,
            )
        elif not self._ai.is_configured:
            ai_result = AIValidationResult(
                status="unavailable",
                warning="AI validator tidak dikonfigurasi.",
            )
        else:
            ai_result = AIValidationResult(
                status="completed",
                assessments={},
            )

        logger.info(
            "AI validation: status=%s, candidates_sent=%d, from_cache=%s, latency_ms=%.1f",
            ai_result.status,
            len(ai_candidates),
            ai_result.from_cache,
            ai_result.latency_ms or 0.0,
        )

        # ------------------------------------------------------------------
        # Langkah 4: Kebijakan Keputusan Akhir Backend
        # ------------------------------------------------------------------
        valid_offers: list[ValidatedMarketplaceQuote] = []
        review_offers: list[ValidatedMarketplaceQuote] = []
        rejected_offers: list[ValidatedMarketplaceQuote] = []

        for idx, quote in enumerate(raw_quotes):
            quote_id = f"{quote.get('marketplace', 'm')}_{idx}"
            det = deterministic_results[quote_id]
            ai_item = ai_result.assessments.get(quote_id)

            # Susun data asli kutipan
            raw_price = _to_decimal(quote.get("price", 0))
            marketplace = str(quote.get("marketplace", ""))
            label = str(quote.get("label") or marketplace)
            product_url = quote.get("product_url")
            product_title = quote.get("product_title") or quote.get("title")
            seller_name = quote.get("seller_name")
            in_stock = quote.get("in_stock")
            source = str(quote.get("source", "search"))
            fetched_at = quote.get("fetched_at")

            reasons: list[str] = []
            final_status: ValidationStatus = "valid"
            match_status: ProductMatchStatus = det.match_status
            price_assessment: PriceAssessment = det.price_assessment
            confidence: float = 1.0
            is_outlier: bool = det.is_outlier
            dev_pct: float | None = det.deviation_percent

            # Aturan 1: Jika data dasar deterministik cacat atau tertolak pasti
            if not det.is_data_valid or det.rejection_reasons:
                final_status = "rejected"
                reasons.extend(det.rejection_reasons)
                confidence = 0.95

            # Aturan 2: Pertimbangkan hasil analisis AI jika tersedia
            if ai_item:
                confidence = round(ai_item.confidence, 2)
                # Tambahkan alasan AI yang relevan
                for r in ai_item.reasons:
                    if r not in reasons:
                        reasons.append(f"[AI] {r}")

                # Jika AI menyimpulkan mismatch atau outlier ekstrem
                if ai_item.product_match == "mismatch":
                    match_status = "mismatch"
                    if final_status != "rejected":
                        final_status = "rejected"
                        reasons.append("[AI] Produk dinilai tidak cocok dengan target.")
                elif ai_item.product_match in ("likely_match", "match") and match_status == "uncertain":
                    # AI membantu memperjelas kecocokan yang agak ambigu
                    match_status = ai_item.product_match

                # Update price assessment jika AI memberikan pandangan lebih spesifik
                if ai_item.price_assessment != "insufficient_data":
                    price_assessment = ai_item.price_assessment

                # Cek rekomendasi status AI
                if ai_item.suggested_status == "rejected" and final_status != "rejected":
                    # Backend hanya menolak jika ada dasar yang jelas
                    if ai_item.product_match == "mismatch" or det.is_outlier:
                        final_status = "rejected"
                    else:
                        final_status = "review"
                        reasons.append("[AI] Disarankan untuk ditinjau lebih lanjut.")
                elif ai_item.suggested_status == "review" and final_status == "valid":
                    final_status = "review"
                    reasons.append("[AI] Memerlukan peninjauan verifikasi.")

            # Aturan 3: Evaluasi deterministik untuk review
            if final_status != "rejected":
                if det.review_reasons:
                    final_status = "review"
                    for r in det.review_reasons:
                        if r not in reasons:
                            reasons.append(r)

                if det.match_status == "uncertain" and final_status == "valid":
                    final_status = "review"
                    reasons.append("Kecocokan produk belum terkonfirmasi sempurna.")

                if det.is_outlier and final_status == "valid":
                    final_status = "review"
                    reasons.append("Indikasi harga anomali / outlier terhadap median pasar.")

            # Jika penawaran valid dan tidak ada alasan penolakan/review
            if final_status == "valid":
                if not reasons:
                    reasons.append("Lolos validasi: produk cocok dan harga wajar.")

            validated_quote = ValidatedMarketplaceQuote(
                marketplace=marketplace,
                label=label,
                price=raw_price,
                currency="IDR",
                product_url=product_url,
                product_title=product_title,
                seller_name=seller_name,
                in_stock=in_stock,
                source=source,
                fetched_at=fetched_at,
                validation_status=final_status,
                match_status=match_status,
                price_assessment=price_assessment,
                confidence=confidence,
                reasons=reasons,
                is_outlier=is_outlier,
                deviation_percent=dev_pct,
                attributes=det.attributes,
            )

            if final_status == "valid":
                valid_offers.append(validated_quote)
            elif final_status == "review":
                review_offers.append(validated_quote)
            else:
                rejected_offers.append(validated_quote)

        # Urutkan berdasarkan harga menaik
        valid_offers.sort(key=lambda x: x.price)
        review_offers.sort(key=lambda x: x.price)
        rejected_offers.sort(key=lambda x: x.price)

        # Hitung harga terbaik dari penawaran yang valid
        # Jika tidak ada penawaran valid tetapi ada penawaran review, gunakan penawaran review untuk fallback
        reference_offers = valid_offers or [q for q in review_offers if q.price_assessment != "extreme_low"]

        lowest_price = reference_offers[0].price if reference_offers else None
        highest_price = reference_offers[-1].price if reference_offers else None
        savings = (store_price - lowest_price) if lowest_price is not None else None

        # Ringkasan validasi
        summary = [
            f"Total kandidat: {len(raw_quotes)}",
            f"Layak dibandingkan (valid): {len(valid_offers)}",
            f"Perlu diperiksa (review): {len(review_offers)}",
            f"Tidak layak / disaring (rejected): {len(rejected_offers)}",
        ]
        if ai_result.status == "completed":
            summary.append("Analisis AI berhasil dijalankan.")
        elif ai_result.status == "unavailable":
            summary.append("Analisis AI tidak tersedia (menggunakan validasi deterministik).")
        elif ai_result.warning:
            summary.append(f"Catatan AI: {ai_result.warning}")

        logger.info(
            "Price validation complete: book_id=%s, valid=%d, review=%d, rejected=%d, lowest=%s",
            book_id,
            len(valid_offers),
            len(review_offers),
            len(rejected_offers),
            lowest_price,
        )

        return {
            "valid_offers": valid_offers,
            "review_offers": review_offers,
            "rejected_offers": rejected_offers,
            "price_statistics": statistics,
            "ai_validation_status": ai_result.status,
            "validation_summary": summary,
            "lowest_price": lowest_price,
            "highest_price": highest_price,
            "savings": savings,
        }
