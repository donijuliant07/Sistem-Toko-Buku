"""Business logic dan aturan bisnis.

Service adalah satu-satunya tempat aturan bisnis ditegakkan — layer API tidak
boleh mempercayai angka yang datang dari klien (harga, stok, ongkir, peran).
Sebagian besar service bersifat stateless dan tipis: menerjemahkan DTO ke
operasi tabel Supabase. Token otorisasi (`require_admin`/`require_user`) tetap
diperiksa di layer API, bukan di sini.

Catatan bentuk class: tiap service didefinisikan sebagai class berisi
`@staticmethod` semata sebagai pengelompokan namespace (pola "class stateless").
Ia tidak menyimpan state, jadi semua method murni fungsi atas tabel.
"""
