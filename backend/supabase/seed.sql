-- Supabase Seed Data: Categories, Products, Promos, Customers

-- 1. Insert Categories
INSERT INTO public.categories (id, name, slug, type, description) VALUES
('c1000000-0000-0000-0000-000000000001', 'Fiksi', 'fiksi', 'Buku', 'Novel, sastra, kumpulan cerpen dan puisi lokal serta terjemahan'),
('c1000000-0000-0000-0000-000000000002', 'Non-Fiksi', 'non-fiksi', 'Buku', 'Biografi, memoar, sejarah, dan jurnalisme investigatif'),
('c1000000-0000-0000-0000-000000000003', 'Pendidikan & Referensi', 'pendidikan-referensi', 'Buku', 'Buku pelajaran sekolah, persiapan UTBK-SNBT, kamus dan ensiklopedia'),
('c1000000-0000-0000-0000-000000000004', 'Bisnis & Keuangan', 'bisnis-keuangan', 'Buku', 'Investasi saham, manajemen, kepemimpinan, dan kewirausahaan'),
('c1000000-0000-0000-0000-000000000005', 'Pengembangan Diri', 'pengembangan-diri', 'Buku', 'Self-improvement, psikologi populer, motivasi, dan kebiasaan positif'),
('c1000000-0000-0000-0000-000000000006', 'Anak-Anak & Remaja', 'anak-anak-remaja', 'Buku', 'Picture book, dongeng nusantara, dan novel remaja populer'),
('c1000000-0000-0000-0000-000000000007', 'Komik & Graphic Novel', 'komik-graphic-novel', 'Buku', 'Manga Jepang, manhwa Korea, komik lokal, dan novel grafis'),
('c1000000-0000-0000-0000-000000000008', 'Agama & Spiritual', 'agama-spiritual', 'Buku', 'Al-Qur''an terjemahan, renungan rohani, dan kajian filsafat spiritual'),
('c1000000-0000-0000-0000-000000000009', 'Alat Tulis & Kantor', 'alat-tulis-kantor', 'Non-Buku', 'Pena premium, notebook dotted, binder, dan peralatan arsip kantor'),
('c1000000-0000-0000-0000-000000000010', 'Aksesori & Merchandise', 'aksesori-merchandise', 'Non-Buku', 'Tote bag kanvas, pembatas buku magnetik, pouch, dan lampu baca LED')
ON CONFLICT (id) DO NOTHING;

-- 2. Insert Products
INSERT INTO public.products (id, title, author, publisher, isbn, category_id, type, language, pages, weight, normal_price, discount_percent, stock, status, description, cover_url, rating) VALUES
('p2000000-0000-0000-0000-000000000001', 'Laut Bercerita', 'Leila S. Chudori', 'Kepustakaan Populer Gramedia (KPG)', '978-602-424-694-5', 'c1000000-0000-0000-0000-000000000001', 'Buku', 'Indonesia', 394, 350, 115000, 15, 42, 'Aktif', 'Novel tentang persahabatan, cinta, keluarga, dan kehilangan para aktivis pada era 1998.', 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=400&auto=format&fit=crop&q=80', 4.88),
('p2000000-0000-0000-0000-000000000002', 'Filosofi Teras', 'Henry Manampiring', 'Penerbit Buku Kompas', '978-602-412-518-9', 'c1000000-0000-0000-0000-000000000005', 'Buku', 'Indonesia', 346, 320, 108000, 10, 18, 'Aktif', 'Penerapan filsafat Stoa kuno untuk memandu generasi muda mengatasi overthinking dan emosi negatif.', 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=400&auto=format&fit=crop&q=80', 4.82),
('p2000000-0000-0000-0000-000000000003', 'Atomic Habits (Edisi Indonesia)', 'James Clear', 'Gramedia Pustaka Utama', '978-602-06-3317-6', 'c1000000-0000-0000-0000-000000000005', 'Buku', 'Indonesia', 356, 340, 128000, 20, 3, 'Aktif', 'Perubahan kecil yang memberikan hasil luar biasa dalam membangun kebiasaan baik dan membuang kebiasaan buruk.', 'https://images.unsplash.com/photo-1589829085413-56de8ae18c73?w=400&auto=format&fit=crop&q=80', 4.91),
('p2000000-0000-0000-0000-000000000004', 'Bumi Manusia (Tetralogi Buru 1)', 'Pramoedya Ananta Toer', 'Lentera Dipantara', '978-979-97312-3-4', 'c1000000-0000-0000-0000-000000000001', 'Buku', 'Indonesia', 538, 480, 145000, 0, 31, 'Aktif', 'Mahakarya sastra Indonesia mengisahkan pergulatan Minke melawan kolonialisme feodal di Hindia Belanda.', 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=400&auto=format&fit=crop&q=80', 4.95),
('p2000000-0000-0000-0000-000000000005', 'The Psychology of Money', 'Morgan Housel', 'Baca', '978-602-6486-57-8', 'c1000000-0000-0000-0000-000000000004', 'Buku', 'Indonesia', 268, 260, 95000, 10, 0, 'Habis', 'Pelajaran abadi mengenai kekayaan, ketamakan, dan kebahagiaan finansial berbasis perilaku manusia.', 'https://images.unsplash.com/photo-1553729459-efe14ef6055d?w=400&auto=format&fit=crop&q=80', 4.80),
('p2000000-0000-0000-0000-000000000006', 'Dotted Journal Notebook A5 Hardcover', 'Voila Stationery', 'Voila Paper Co.', 'SKU-VOILA-NB01', 'c1000000-0000-0000-0000-000000000009', 'Non-Buku', 'Lainnya', 192, 280, 65000, 0, 4, 'Aktif', 'Buku catatan dotted grid 100gsm ramah pena tinta fountain, pita pembatas ganda, dan saku belakang.', 'https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?w=400&auto=format&fit=crop&q=80', 4.70),
('p2000000-0000-0000-0000-000000000007', 'Lampu Baca LED Klip USB Rechargeable', 'Gramedia Essentials', 'Gramedia Living', 'SKU-GRAM-LAMP02', 'c1000000-0000-0000-0000-000000000010', 'Non-Buku', 'Lainnya', 0, 120, 89000, 15, 22, 'Aktif', 'Lampu baca portabel dengan 3 tingkat temperatur warna, baterai tahan hingga 12 jam membaca santai.', 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=400&auto=format&fit=crop&q=80', 4.65)
ON CONFLICT (id) DO NOTHING;

-- 3. Insert Promos
INSERT INTO public.promos (id, code, title, discount_type, discount_value, min_purchase, max_discount, quota, used_count, status, start_date, end_date) VALUES
('m3000000-0000-0000-0000-000000000001', 'GRAMEDIAHEMAT25', 'Diskon Spesial 25% Semua Buku', 'Persentase', 25, 150000, 50000, 500, 142, 'Aktif', NOW() - INTERVAL '7 days', NOW() + INTERVAL '23 days'),
('m3000000-0000-0000-0000-000000000002', 'SNBT2026', 'Potongan Rp30.000 Buku Ujian', 'Nominal', 30000, 200000, 30000, 200, 89, 'Aktif', NOW() - INTERVAL '14 days', NOW() + INTERVAL '16 days'),
('m3000000-0000-0000-0000-000000000003', 'HARBOLNAS50', 'Super Voucher Harbolnas 50%', 'Persentase', 50, 300000, 100000, 100, 0, 'Dijadwalkan', NOW() + INTERVAL '10 days', NOW() + INTERVAL '12 days')
ON CONFLICT (id) DO NOTHING;
