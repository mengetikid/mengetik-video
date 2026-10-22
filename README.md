# Video Studio by Mengetik.id

Mesin aplikasi **Video Studio** untuk halaman https://www.mengetik.id/p/video-studio.html

- Edit video online gratis langsung dari browser, sampai 4K.
- Semua proses (impor, color grading, ekspor) berjalan di perangkat pengguna. Tidak ada file yang diunggah ke server.

## Isi repository

| File | Fungsi |
|---|---|
| `video-studio-1.0.0.js` | Mesin aplikasi versi 1.0.0 (dimuat oleh halaman Blogger lewat jsDelivr) |

## Cara update versi

1. Unggah file mesin versi baru, misalnya `video-studio-1.1.0.js`, ke repository ini.
2. Ganti kode di halaman Blogger dengan kode halaman versi baru.

Nama file yang berbeda setiap versi membuat pengguna langsung mendapat versi terbaru, tanpa menunggu cache jsDelivr.

## Pustaka pihak ketiga

Dimuat dari jsDelivr saat dibutuhkan:

- [mp4box.js](https://github.com/gpac/mp4box.js) (BSD-3-Clause): membaca file MP4/MOV secara bertahap.
- [mp4-muxer](https://github.com/Vanilagy/mp4-muxer) (MIT): menyusun file MP4 hasil ekspor.
