# Sistem Maintenance dan Spare Part

Aplikasi web untuk mengelola tiket kerusakan mesin produksi dan stok spare part. Operator melapor kerusakan, teknisi memperbaiki dan memakai spare part, supervisor menyetujui pemakaian part dan memantau dashboard downtime.

Proyek ini saya bangun berdasarkan pengalaman PKL di bagian Maintenance PT TD Automotive Compressor Indonesia (2019), jadi alurnya mengikuti cara kerja spare part dan perbaikan mesin di lapangan.

## Screenshot

| Lapor kerusakan (operator) | Tiket saya (teknisi) |
|---|---|
| ![Lapor kerusakan](docs/screenshots/lapor-kerusakan.png) | ![Tiket saya](docs/screenshots/tiket-saya.png) |

| Approval dan riwayat stok (supervisor) | Dashboard (supervisor) |
|---|---|
| ![Approval](docs/screenshots/approval.png) | ![Dashboard](docs/screenshots/dashboard.png) |

![Riwayat kerusakan per mesin](docs/screenshots/riwayat.png)

## Fitur

**Operator**
- Melapor kerusakan mesin beserta keluhan.

**Teknisi**
- Menerima tiket, memakai spare part pada tiket, dan menyelesaikan perbaikan.
- Notifikasi tiket baru lewat polling (8 detik), bunyi beep, dan Notification API browser.

**Supervisor**
- Menyetujui pemakaian part saat stok tidak cukup.
- Menambah stok spare part, lengkap dengan riwayat penambahan stok per part.
- Dashboard: total downtime per mesin, spare part paling sering dipakai, MTTR (rata-rata waktu perbaikan), dan peringatan stok menipis. Bisa difilter per periode (semua waktu, hari ini, 7 hari terakhir, bulan ini) atau per bulan.
- Riwayat kerusakan per mesin beserta part yang dipakai dan lama downtime.

## Alur tiket

```
pending -> diproses -> selesai
              |
              +-> menunggu_approval (stok part kurang) -> disetujui supervisor -> lanjut
```

Pemakaian part dan penambahan stok memakai transaksi database dengan penguncian baris (`SELECT ... FOR UPDATE`), sehingga dua permintaan bersamaan tidak membuat stok bernilai salah. Tiket tidak dihapus saat selesai, hanya statusnya yang berubah, supaya riwayat dan laporan tetap utuh.

## Teknologi

- Frontend: React 19, Vite 8, TypeScript, Tailwind CSS 4, Recharts
- Backend: Node.js, Express, mysql2
- Database: MySQL-compatible (dikembangkan di TiDB Cloud Starter)

## Arsitektur

```
Frontend (React, port 5173)  --->  Backend API (Express, port 5001)  --->  Database MySQL
```

## Struktur folder

```
maintenance-system/
├── backend/      API Express (src/routes per entitas)
├── frontend/     Aplikasi React + TypeScript
├── database/     schema.sql dan seed.sql
└── docs/         screenshot
```

## Cara menjalankan

Butuh Node.js dan sebuah database MySQL-compatible yang kosong.

1. Buat tabel dan data contoh: jalankan isi `database/schema.sql`, lalu `database/seed.sql` (cukup sekali) pada database tersebut.
2. Backend:
```
   cd backend
   copy .env.example .env
   npm install
   npm run dev
```
   Isi `backend/.env` dengan data koneksi database Anda. Backend berjalan di `http://localhost:5001`.
3. Frontend (terminal lain):
```
   cd frontend
   npm install
   npm run dev
```
   Buka `http://localhost:5173`.

Data contoh: 3 pengguna (Yamal operator, Raphinha teknisi, Flick supervisor), 3 mesin, dan 3 spare part.

## Endpoint API

| Method | Endpoint | Fungsi |
|---|---|---|
| GET | `/mesin` | Daftar mesin |
| GET | `/mesin/:id/riwayat` | Riwayat tiket mesin, part yang dipakai, dan lama downtime |
| GET | `/users` | Daftar pengguna |
| GET | `/spare-parts` | Daftar spare part dan stok |
| POST | `/spare-parts/:id/stok` | Tambah stok (hanya supervisor) |
| GET | `/spare-parts/:id/riwayat` | Riwayat penambahan stok part |
| GET | `/tiket` | Daftar tiket (`?status=aktif` untuk yang belum selesai) |
| GET | `/tiket/:id` | Detail tiket beserta part |
| POST | `/tiket` | Operator melapor kerusakan |
| PATCH | `/tiket/:id/terima` | Teknisi menerima tiket |
| POST | `/tiket/:id/part` | Menambahkan part ke tiket |
| PATCH | `/tiket/:id/setujui` | Supervisor menyetujui part |
| PATCH | `/tiket/:id/lanjut` | Teknisi melanjutkan setelah stok cukup |
| PATCH | `/tiket/:id/selesai` | Menyelesaikan tiket |
| GET | `/dashboard/downtime` | Total downtime per mesin |
| GET | `/dashboard/part-terpakai` | Spare part paling sering dipakai |
| GET | `/dashboard/mttr` | MTTR dan jumlah tiket selesai |
| GET | `/dashboard/stok-menipis` | Part dengan stok di bawah minimum |

Endpoint downtime, part-terpakai, dan mttr menerima `?periode=semua|hari|minggu|bulan` atau `?bulan=TTTT-BB` (misalnya `2026-10`). Jika keduanya dikirim, `bulan` yang dipakai. Semua error dikembalikan sebagai `{ "error": "..." }`.

## Keterbatasan

- Belum ada login. Peran dipilih lewat dropdown "Login sebagai"; ini sengaja disederhanakan untuk demo.
- Notifikasi hanya lewat polling, beep, dan Notification API. Notifikasi ke Telegram atau WhatsApp menjadi rencana pengembangan.
- Backend belum di-hosting, jadi belum ada link demo.
- Data di database adalah data uji.

## Rencana pengembangan

- Jadwal preventive maintenance dengan pengingat otomatis.
- Prediksi kerusakan berikutnya dengan metode Weighted Moving Average.
- Autentikasi dan otorisasi.