# Video Studio by Mengetik.id

Mesin aplikasi **Video Studio** untuk halaman https://www.mengetik.id/p/video-studio.html

- Edit video online gratis langsung dari browser, sampai 4K.
- Semua proses (impor, color grading, ekspor) berjalan di perangkat pengguna. Tidak ada file yang diunggah ke server.

## Isi repository

| File | Fungsi |
|---|---|
| `video-studio-1.0.3.js` | Mesin aplikasi versi terbaru (dimuat oleh halaman Blogger lewat jsDelivr) |
| `video-studio-1.0.0.js` s/d `1.0.2.js` | Versi sebelumnya (boleh tetap disimpan) |
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

Saat ini hanya satu file yang perlu ada di folder ini:

| Nama di aplikasi | Nama file | Lisensi |
|---|---|---|
| Obrazec | `obrazec.otf` | Free for Personal and Commercial Use |

Font koleksi lain (Fraunces, Shrikhand, Teko, Bungee, Lobster, Anton, Pinyon Script, Junicode) berlisensi SIL OFL dan dimuat otomatis, jadi tidak perlu diunggah.

Proyek lama yang memakai Thunder, Elanor, Nighty, Creme Espana, Harmony, Resist Sans, Shrimp, atau Tropikal otomatis diganti ke padanannya (font lama tersebut hanya berlisensi pemakaian pribadi).

**Penting:** sebelum menambah font baru ke folder ini, pastikan lisensinya mengizinkan pemakaian komersial dan web embedding.
