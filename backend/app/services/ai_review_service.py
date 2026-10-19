"""Ulasan buku bertenaga AI dengan kontrol tingkat spoiler.

Alur `generate_ai_book_review`:

1. Kembalikan hasil dari cache in-memory bila ada (kunci `book_id:spoiler_level`).
2. Bila `OPENROUTER_API_KEY` tersedia, panggil OpenRouter (model Qwen).
3. Bila tidak ada kunci atau panggilan gagal, susun ulasan dari template aturan
   (`_generate_rule_based_review`) supaya endpoint tetap memberi hasil.

Cache bersifat per-proses dan tidak dibatasi ukuran; cukup untuk demo lokal.
"""

import json
import logging
import os

import httpx

from app.core.config import settings
from app.schemas.ai_review import AIReviewResponse, SpoilerLevel

logger = logging.getLogger(__name__)

# In-memory cache for generated reviews: key = f"{book_id}:{spoiler_level}"
_review_cache: dict[str, AIReviewResponse] = {}


def _generate_rule_based_review(
    book_id: str,
    title: str,
    author: str,
    description: str,
    isbn: str,
    spoiler_level: SpoilerLevel,
) -> AIReviewResponse:
    """
    Fallback ulasan terstruktur berkualitas jika OpenRouter API tidak terjangkau atau tanpa API key.
    """
    clean_desc = (description or "").strip()
    short_desc = clean_desc if clean_desc else f"Buku karya {author} dengan ISBN {isbn}."

    if spoiler_level == SpoilerLevel.NO_SPOILER:
        overview = (
            f"'{title}' merupakan karya dari {author} yang menawarkan pengalaman membaca memikat. "
            f"Buku ini berfokus pada tema eksplorasi naratif yang kaya dengan latar belakang cerita yang kuat. "
            f"Tanpa mengungkap alur cerita, buku ini membangun rasa ingin tahu pembaca sejak bab awal."
        )
        writing_style = (
            f"Gaya penulisan {author} terasa mengalir dan terstruktur dengan rapi. "
            "Pemilihan diksi memikat serta tempo cerita yang seimbang membuat pembaca mudah tenggelam ke dalam setiap halaman."
        )
        characters = (
            "Karakter diperkenalkan dengan kepribadian unik dan dinamika hubungan yang realistis, "
            "memberikan fondasi kuat bagi pembaca untuk terhubung secara emosional tanpa membuka rahasia karakter lebih jauh."
        )
        strengths = [
            "Penyampaian tema yang berbobot dan mudah dipahami",
            "Gaya bahasa dan ritme bercerita yang memikat",
            "World-building dan suasana cerita yang hidup",
        ]
        weaknesses = [
            "Di beberapa bagian awal pembaca membutuhkan sedikit waktu untuk beradaptasi dengan ritme penulisan",
        ]
        who_should_read = (
            f"Sangat direkomendasikan bagi penikmat karya {author} maupun pembaca umum yang mencari bacaan bermutu "
            "dengan eksplorasi tema yang mendalam."
        )
        verdict = (
            f"'{title}' adalah bacaan yang sangat layak dikoleksi. Nilai estetika dan narasi yang dibawakan "
            "menjadikannya rekomendasi utama di katalog toko buku."
        )
        plot_analysis = None
        character_development = None
        ending_analysis = None

    elif spoiler_level == SpoilerLevel.LOW:
        overview = (
            f"'{title}' mengisahkan perjalanan yang berakar dari premis: {short_desc[:250]}... "
            "Buku ini mulai membuka sedikit konflik awal dan memperkenalkan tantangan yang dihadapi tokoh utama."
        )
        writing_style = (
            "Penulis meramu bab-bab pembuka dengan introduksi setting yang kaya. "
            "Pemberian petunjuk-petunjuk kecil (foreshadowing) membuat alur awal terasa berbobot."
        )
        characters = (
            "Tokoh utama menghadapi dilema awal yang memicu pergerakan plot. Motivasi dasar karakter digambarkan jelas "
            "sehingga pembaca memahami latar belakang tindakan mereka."
        )
        strengths = [
            "Premis cerita yang memikat sejak bab-bab pembuka",
            "Pengenalan konflik awal yang memancing rasa penasaran",
            "Karakterisasi awal yang kokoh dan berkesan",
        ]
        weaknesses = [
            "Eksplorasi beberapa subplot awal masih memerlukan kesabaran pembaca",
        ]
        who_should_read = (
            "Pembaca yang menyukai premis dengan latar belakang cerita yang detail dan bertahap."
        )
        verdict = (
            f"Dengan premis yang menarik dan pembangunan konflik awal yang solid, '{title}' menjanjikan petualangan bacaan yang memuaskan."
        )
        plot_analysis = "Konflik awal mulai terbangun saat tantangan pertama muncul, menguji kesiapan tokoh utama dalam menghadapi dinamika cerita."
        character_development = "Karakter mulai mengalami pergeseran sudut pandang seiring peristiwa awal yang terjadi."
        ending_analysis = None

    elif spoiler_level == SpoilerLevel.MEDIUM:
        overview = (
            f"Pada tingkat spoiler medium, '{title}' membawa pembaca ke dalam pergulatan konflik inti: {short_desc}. "
            "Ketegangan antar tokoh dan rintangan utama mulai mencapai titik krusial di pertengahan cerita."
        )
        writing_style = (
            "Tempo cerita meningkat tajam di bagian pertengahan, didukung dialog-dialog intensif yang mempertegas perbedaan prinsip antar tokoh."
        )
        characters = (
            "Hubungan antar karakter mengalami dinamika yang signifikan. Aliansi dan benturan kepentingan memperlihatkan sisi lain dari kepribadian mereka."
        )
        strengths = [
            "Peningkatan tensi cerita dan konflik yang matang di pertengahan buku",
            "Pengembangan relasi dan gesekan antar karakter yang kuat",
            "Keputusan-keputusan krusial yang mengubah arah cerita",
        ]
        weaknesses = [
            "Pergantian fokus antar adegan terkadang berlangsung cepat sehingga membutuhkan fokus tinggi",
        ]
        who_should_read = (
            "Pembaca yang menyukai analisis plot mendalam dan dinamika relasi karakter yang kompleks."
        )
        verdict = (
            f"'{title}' berhasil menjaga intensitas cerita melalui jalinan konflik yang tersusun rapi hingga menjelang babak akhir."
        )
        plot_analysis = "Plot bergerak melalui serangkaian rintangan beruntun yang mempertemukan berbagai kepentingan tokoh dalam satu titik konfrontasi."
        character_development = "Karakter dipaksa keluar dari zona nyaman dan mengambil keputusan sulit yang berdampak pada nasib mereka."
        ending_analysis = None

    else:  # HEAVY SPOILER
        overview = (
            f"Secara menyeluruh, '{title}' membawa pembaca melewati busur cerita lengkap: dari introduksi, eskalasi konflik ({short_desc}), "
            "hingga klimaks dan penyelesaian akhir cerita."
        )
        writing_style = (
            "Penyelesaian cerita diikat dengan gaya penulisan yang emosional dan penutupan benang-benang merah cerita secara tuntas."
        )
        characters = (
            "Transformasi karakter mencapai puncaknya di babak akhir, di mana setiap tokoh menerima konsekuensi dari pilihan-pilihan mereka sepanjang narasi."
        )
        strengths = [
            "Penyelesaian konflik cerita yang menyeluruh dan memuaskan",
            "Konklusi busur perkembangan setiap karakter yang tuntas",
            "Pesan moral dan dampak emosional yang tertinggal setelah bab penutup",
        ]
        weaknesses = [
            "Beberapa detail kecil terselesaikan dengan cepat di bagian epilog",
        ]
        who_should_read = (
            "Pembaca yang telah menyelesaikan buku ini atau pembaca yang ingin memahami analisis menyeluruh termasuk klimaks dan pesan akhir."
        )
        verdict = (
            f"'{title}' memberikan konklusi yang kuat dan berkesan, menegaskan kualitas karya {author} sebagai buku yang patut diperbincangkan."
        )
        plot_analysis = "Seluruh rangkaian plot mencapai klimaks di babak puncak sebelum menemukan titik keseimbangan baru pada penutup kisah."
        character_development = "Evolusi karakter selesai dengan kedewasaan dan konsekuensi nyata atas perjalanan yang dilalui."
        ending_analysis = "Penyelesaian cerita memberikan kejelasan atas nasib para tokoh dan pesan filosofis utama dari keseluruhan narasi."

    return AIReviewResponse(
        book_id=book_id,
        title=title,
        author=author,
        spoiler_level=spoiler_level,
        overview=overview,
        writing_style=writing_style,
        characters=characters,
        strengths=strengths,
        weaknesses=weaknesses,
        who_should_read=who_should_read,
        verdict=verdict,
        plot_analysis=plot_analysis,
        character_development=character_development,
        ending_analysis=ending_analysis,
        cached=False,
    )


async def _call_openrouter_qwen(
    book_id: str,
    title: str,
    author: str,
    description: str,
    isbn: str,
    spoiler_level: SpoilerLevel,
    api_key: str,
) -> AIReviewResponse | None:
    """
    Memanggil API OpenRouter menggunakan model Qwen (Gratis)
    Model: nvidia/nemotron-3-ultra-550b-a55b:free atau qwen/qwen-2-7b-instruct:free
    """
    model_name = os.getenv("OPENROUTER_MODEL", settings.OPENROUTER_MODEL) or "nvidia/nemotron-3-ultra-550b-a55b:free"

    system_prompt = (
        "Anda adalah seorang pengulas buku profesional berbahasa Indonesia. "
        "Tugas Anda adalah membuat ulasan buku yang terstruktur, elegan, mendalam, dan akurat berdasarkan informasi buku yang diberikan.\n\n"
        f"SPOILER LEVEL ATURAN KETAT: {spoiler_level.value.upper()}\n"
        "- no_spoiler: TIDAK BOLEH mengungkap ending, plot twist, kematian karakter, atau rahasia penting cerita.\n"
        "- low: Boleh premis & konflik awal saja.\n"
        "- medium: Boleh beberapa konflik inti & pergulatan pertengahan cerita.\n"
        "- heavy: Boleh mengulas plot lengkap, klimaks, dan ending (bab penutup).\n\n"
        "RESPONS HARUS BERBENTUK JSON MURNI tanpa markdown format ```json dengan struktur berikut:\n"
        "{\n"
        '  "overview": "...",\n'
        '  "writing_style": "...",\n'
        '  "characters": "...",\n'
        '  "strengths": ["...", "...", "..."],\n'
        '  "weaknesses": ["..."],\n'
        '  "who_should_read": "...",\n'
        '  "verdict": "...",\n'
        '  "plot_analysis": "..." (opsional),\n'
        '  "character_development": "..." (opsional),\n'
        '  "ending_analysis": "..." (opsional)\n'
        "}"
    )

    user_prompt = (
        f"Judul Buku: {title}\n"
        f"Penulis: {author}\n"
        f"ISBN: {isbn}\n"
        f"Deskripsi Buku: {description or 'Buku pilihan berkualitas.'}\n"
        f"Tingkat Spoiler yang Diminta: {spoiler_level.value}"
    )

    headers = {
        "Authorization": f"Bearer {api_key}",
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "Sistem Toko Buku Gramedia",
        "Content-Type": "application/json",
    }

    payload = {
        "model": model_name,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.7,
        "max_tokens": 1200,
    }

    try:
        async with httpx.AsyncClient(timeout=25.0) as client:
            res = await client.post("https://openrouter.ai/api/v1/chat/completions", headers=headers, json=payload)
            if res.status_code == 200:
                data = res.json()
                content = data["choices"][0]["message"]["content"].strip()
                content = content.removeprefix("```json")
                content = content.removeprefix("```")
                content = content.removesuffix("```")
                parsed = json.loads(content.strip())

                return AIReviewResponse(
                    book_id=book_id,
                    title=title,
                    author=author,
                    spoiler_level=spoiler_level,
                    overview=parsed.get("overview", ""),
                    writing_style=parsed.get("writing_style", ""),
                    characters=parsed.get("characters", ""),
                    strengths=parsed.get("strengths", ["Ulasan berkualitas"]),
                    weaknesses=parsed.get("weaknesses", ["Tempo narasi"]),
                    who_should_read=parsed.get("who_should_read", ""),
                    verdict=parsed.get("verdict", ""),
                    plot_analysis=parsed.get("plot_analysis"),
                    character_development=parsed.get("character_development"),
                    ending_analysis=parsed.get("ending_analysis"),
                    cached=False,
                )
    except (httpx.HTTPError, KeyError, ValueError) as exc:
        # Model eksternal bisa membalas non-JSON atau field tak terduga; pemanggil
        # lalu memakai ulasan berbasis aturan sebagai fallback.
        logger.warning("Ulasan AI gagal diurai (%s): %s", type(exc).__name__, exc)

    return None


async def generate_ai_book_review(
    book_id: str,
    title: str,
    author: str,
    description: str,
    isbn: str,
    spoiler_level: SpoilerLevel,
) -> AIReviewResponse:
    """
    Generate or retrieve cached AI Review for a book with specific spoiler level.
    Integrates OpenRouter Qwen Free model API.
    """
    cache_key = f"{book_id}:{spoiler_level.value}"

    if cache_key in _review_cache:
        cached_item = _review_cache[cache_key].model_copy()
        cached_item.cached = True
        return cached_item

    # 1. Cek OpenRouter API Key
    openrouter_key = os.getenv("OPENROUTER_API_KEY", settings.OPENROUTER_API_KEY)
    if openrouter_key:
        qwen_review = await _call_openrouter_qwen(
            book_id=book_id,
            title=title,
            author=author,
            description=description,
            isbn=isbn,
            spoiler_level=spoiler_level,
            api_key=openrouter_key,
        )
        if qwen_review:
            _review_cache[cache_key] = qwen_review
            return qwen_review

    # 2. High-quality Rule Engine (Fallback)
    review = _generate_rule_based_review(
        book_id=book_id,
        title=title,
        author=author,
        description=description,
        isbn=isbn,
        spoiler_level=spoiler_level,
    )

    # Save to Cache
    _review_cache[cache_key] = review
    return review
