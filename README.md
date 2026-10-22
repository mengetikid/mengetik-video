# Video Studio by Mengetik.id

Mesin aplikasi **Video Studio** untuk halaman https://www.mengetik.id/p/video-studio.html

- Edit video online gratis langsung dari browser, sampai 4K.
- Semua proses (impor, color grading, ekspor) berjalan di perangkat pengguna. Tidak ada file yang diunggah ke server.

## Isi repository

| File | Fungsi |
|---|---|
| `video-studio-1.0.1.js` | Mesin aplikasi versi terbaru (dimuat oleh halaman Blogger lewat jsDelivr) |
| `video-studio-1.0.0.js` | Versi sebelumnya (boleh tetap disimpan) |
| `fonts/` | Font koleksi tambahan (opsional, lihat di bawah) |

## Cara update versi

1. Unggah file mesin versi baru, misalnya `video-studio-1.1.0.js`, ke repository ini.
2. Ganti kode di halaman Blogger dengan kode halaman versi baru.

Nama file yang berbeda setiap versi membuat pengguna langsung mendapat versi terbaru, tanpa menunggu cache jsDelivr.

## Pustaka pihak ketiga

Dimuat dari jsDelivr saat dibutuhkan:

- [mp4box.js](https://github.com/gpac/mp4box.js) (BSD-3-Clause): membaca file MP4/MOV secara bertahap.
- [mp4-muxer](https://github.com/Vanilagy/mp4-muxer) (MIT): menyusun file MP4 hasil ekspor.

## Folder `fonts/` (font koleksi tambahan)

Unggah file font ke folder `fonts/` dengan nama persis seperti di bawah. Ekstensi boleh `.woff2`, `.woff`, `.ttf`, atau `.otf`.

| Nama di aplikasi | Nama file |
|---|---|
| Thunder | `thunder` |
| Harmony Serif | `harmony` |
| Resist Sans | `resist-sans` |
| Shrimp | `shrimp` |
| Tropikal | `tropikal` |
| Obrazec | `obrazec` |
| Creme Espana | `creme-espana` |
| Elanor | `elanor` |
| Nighty | `nighty` |

Contoh nama lengkap: `thunder.otf` atau `resist-sans.ttf`.

Junicode Bold Condensed (lisensi SIL OFL) sudah dimuat otomatis, jadi tidak perlu diunggah.

**Penting:** unggah hanya font yang lisensinya mengizinkan dipakai/dibagikan di website (web embedding). Banyak font "free" hanya gratis untuk pemakaian pribadi.
