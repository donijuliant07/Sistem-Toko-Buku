/**
 * Bentuk item katalog yang dipakai komponen storefront (`ProductCard`,
 * `BookDetailModal`). Berkas ini hanya menyimpan *bentuk data* — seluruh isinya
 * berasal dari `GET /books`; tidak ada produk contoh.
 *
 * Kolom yang tidak ada di backend (`rating`, `soldCount`, `discountPercent`,
 * `badgeLanguage`) sengaja opsional: tanpa sumber datanya, komponen tidak
 * menampilkan apa pun daripada menampilkan angka karangan.
 */
export interface Product {
  id: string;
  title: string;
  authorOrBrand: string;
  price: number;
  originalPrice?: number;
  discountPercent?: number;
  rating?: number;
  soldCount?: number;
  badgeLanguage?: string;
  coverUrl: string;
  category: string;
  type: "book" | "non-book";
  stock: number;
  description?: string;
}

export type CategoryId = string;

export interface CategoryShortcut {
  id: CategoryId;
  name: string;
  icon: string;
  /** Sub-judul kecil di bawah nama kategori (opsional). */
  tag?: string;
  /** Kata kunci yang dicocokkan ke judul/penulis/sinopsis buku — backend belum punya
   * filter kategori, jadi penyaringan dilakukan di sisi katalog yang dimuat. */
  keywords?: string[];
}

export const SEMUA_CATEGORY_ID = "semua";

export const CATEGORIES: CategoryShortcut[] = [
  { id: SEMUA_CATEGORY_ID, name: "Semua", icon: "all", keywords: [] },
  {
    id: "buku-anak",
    name: "Buku Anak",
    icon: "book",
    keywords: [
      "anak", "kids", "children", "dongeng", "fabel", "cerita anak", "kancil", "si kancil",
      "bergambar", "cergam", "pangeran cilik", "little prince", "balita", "paud", "dongeng nusantara",
      "mewarnai", "enid blyton", "roald dahl", "kak eka", "kak dwi", "bunda", "dongeng anak", "cerita balita"
    ],
  },
  {
    id: "religi",
    name: "Religi",
    icon: "mosque",
    keywords: [
      "religi", "agama", "spiritual", "spiritualitas", "islam", "islami", "quran", "al-quran",
      "al-qur'an", "tafsir", "hadis", "hadits", "doa", "shalat", "sholat", "puasa", "zakat",
      "haji", "hijrah", "sunnah", "fiqih", "tasawuf", "la tahzan", "riyadhus shalihin", "ihya ulumuddin",
      "quraish shihab", "buya hamka", "hamka", "gus dur", "al-ghazali", "aid al-qarni", "adi hidayat",
      "kristen", "katolik", "alkitab", "injil", "rohani", "renungan", "dakwah"
    ],
  },
  {
    id: "biografi",
    name: "Biografi",
    icon: "user",
    keywords: [
      "biografi", "biography", "autobiografi", "autobiography", "memoar", "memoir", "perjalanan hidup",
      "kisah hidup", "catatan harian", "sejarah hidup", "tokoh", "presiden", "pahlawan", "habibie",
      "ainun", "soekarno", "bung karno", "tan malaka", "bung hatta", "mohammad hatta", "steve jobs",
      "elon musk", "kartini", "nelson mandela", "walter isaacson", "cindy adams", "michelle obama"
    ],
  },
  {
    id: "fiksi-sastra",
    name: "Fiksi & Sastra",
    icon: "feather",
    keywords: [
      "fiksi", "novel", "sastra", "cerita", "prosa", "puisi", "cerpen", "romance", "roman",
      "fantasi", "drama", "thriller", "misteri", "petualangan", "horor", "sci-fi", "distopia",
      "fiksi ilmiah", "laut bercerita", "bumi manusia", "tetralogi buru", "cantik itu luka",
      "lelaki harimau", "gadis kretek", "laskar pelangi", "dilan", "milea", "hujan", "pulang",
      "pergi", "matahari", "bulan", "bintang", "bumi", "perahu kertas", "supernova", "filosofi kopi",
      "negeri 5 menara", "5 cm", "ayat-ayat cinta", "pramoedya", "pram", "leila", "chudori",
      "tere liye", "dee lestari", "eka kurniawan", "andrea hirata", "pidi baiq", "ahmad tohari",
      "ratih kumala", "haruki murakami", "george orwell"
    ],
  },
  {
    id: "self-dev",
    name: "Self-Dev",
    icon: "sparkles",
    keywords: [
      "pengembangan diri", "self-dev", "self dev", "self help", "self-help", "self improvement",
      "motivasi", "kebiasaan", "habit", "habits", "mindset", "produktivitas", "produktif",
      "psikologi", "mental", "overthinking", "emosi", "stoik", "stoikisme", "stoa", "filsafat",
      "filosofi teras", "atomic habits", "berani tidak disukai", "bodo amat", "bicara itu ada seninya",
      "ikigai", "grit", "deep work", "7 habits", "james clear", "henry manampiring", "manampiring",
      "ichiro kishimi", "mark manson", "oh su hyang", "stephen covey", "dale carnegie"
    ],
  },
  {
    id: "bisnis",
    name: "Bisnis",
    icon: "briefcase",
    keywords: [
      "bisnis", "business", "keuangan", "finance", "finansial", "investasi", "investing",
      "investor", "saham", "marketing", "pemasaran", "ekonomi", "uang", "money", "wealth",
      "kekayaan", "manajemen", "startup", "wirausaha", "entrepreneur", "the psychology of money",
      "psychology of money", "rich dad", "poor dad", "zero to one", "intelligent investor",
      "lean startup", "shoe dog", "principles", "cashflow", "morgan housel", "housel",
      "robert kiyosaki", "kiyosaki", "peter thiel", "phil knight", "benjamin graham",
      "warren buffett", "ray dalio", "philip kotler"
    ],
  },
  {
    id: "edukasi",
    name: "Edukasi",
    icon: "graduation",
    keywords: [
      "edukasi", "education", "pelajaran", "pendidikan", "referensi", "sekolah", "kuliah",
      "kampus", "akademik", "belajar", "snbt", "utbk", "ujian", "soal", "tps", "tpa",
      "kamus", "ensiklopedia", "clean code", "clean architecture", "pragmatic programmer",
      "design patterns", "pemrograman", "programming", "coding", "software", "algoritma",
      "struktur data", "komputer", "robert c. martin", "uncle bob", "martin fowler", "andrew hunt"
    ],
  },
  {
    id: "manga",
    name: "Komik & Manga",
    icon: "/images/naruto-icon.jpg",
    keywords: [
      "manga", "komik", "comic", "graphic novel", "novel grafis", "manhwa", "webtoon",
      "vol", "volume", "chapter", "anime", "shonen", "shoujo", "seinen", "naruto", "shippuden",
      "boruto", "one piece", "luffy", "jujutsu kaisen", "gojo", "demon slayer", "kimetsu no yaiba",
      "attack on titan", "shingeki no kyojin", "bleach", "dragon ball", "death note",
      "spy x family", "chainsaw man", "haikyuu", "blue lock", "solo leveling", "doraemon",
      "conan", "si juki", "masashi kishimoto", "kishimoto", "eiichiro oda", "oda",
      "gege akutami", "fujiko", "aoyama"
    ],
  },
];

export const HERO_BANNERS = [
  {
    id: 1,
    imageUrl: "/images/banner-kuning.jpg",
    // Banner promosi belum punya URL tujuan dari backend; `#katalog` membawa
    // pengunjung ke katalog yang memang ada di beranda.
    href: "#katalog",
  },
  {
    id: 2,
    imageUrl: "/images/banner-ungu.jpg",
    href: "#katalog",
  },
  {
    id: 3,
    imageUrl: "/images/banner-hijau.jpg",
    href: "#katalog",
  },
];

export const HERO_SIDE_BANNERS = [
  {
    id: 1,
    type: "video",
    mediaUrl: "/videos/promo-video.mp4",
    href: "#katalog",
  },
  {
    id: 2,
    type: "image",
    mediaUrl: "/images/komunitas-banner.jpg",
    href: "/komunitas",
  },
];