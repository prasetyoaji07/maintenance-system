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

| Prediksi kebutuhan part (supervisor) | Prediksi per part |
|---|---|
| ![Prediksi](docs/screenshots/prediksi.png) | ![Prediksi per part](docs/screenshots/prediksi-per-part.png) |

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
- Mencari part berdasarkan nomor part atau kategori saat memilih part.
- Dashboard: total downtime per mesin, spare part paling sering dipakai, MTTR (rata-rata waktu perbaikan), dan peringatan stok menipis. Bisa difilter per periode (semua waktu, hari ini, 7 hari terakhir, bulan ini) atau per bulan.
- Riwayat kerusakan per mesin beserta part yang dipakai dan lama downtime.
- Prediksi kebutuhan spare part dengan metode Weighted Moving Average (WMA): backtest otomatis membandingkan jendela 3, 6, dan 12 bulan dan memilih yang galatnya (WAPE) terkecil, lalu memperkirakan kebutuhan bulan berjalan dan status tiap part (aman, menipis, kurang).

## Alur tiket

pending -> diproses -> selesai
|
+-> menunggu_approval (stok part kurang) -> disetujui supervisor -> lanjut


Pemakaian part dan penambahan stok memakai transaksi database dengan penguncian baris (`SELECT ... FOR UPDATE`), sehingga dua permintaan bersamaan tidak membuat stok bernilai salah. Tiket tidak dihapus saat selesai, hanya statusnya yang berubah, supaya riwayat dan laporan tetap utuh.

## Teknologi

- Frontend: React 19, Vite 8, TypeScript, Tailwind CSS 4, Recharts
- Backend: Node.js, Express, mysql2
- Database: MySQL-compatible (dikembangkan di TiDB Cloud Starter)

## Arsitektur

Frontend (React, port 5173) ---> Backend API (Express, port 5001) ---> Database MySQL


## Struktur folder

maintenance-system/
├── backend/ API Express (src/routes per entitas)
├── frontend/ Aplikasi React + TypeScript
├── database/ schema.sql dan seed.sql
└── docs/ screenshot


## Cara menjalankan

Butuh Node.js dan sebuah database MySQL-compatible yang kosong.

1. Buat tabel dan data contoh: jalankan isi `database/schema.sql`, lalu `database/seed.sql` (cukup sekali) pada database tersebut.
2. Backend:

cd backend
copy .env.example .env
npm install
npm run dev

   Isi `backend/.env` dengan data koneksi database Anda. Backend berjalan di `http://localhost:5001`.
3. Frontend (terminal lain):

cd frontend
npm install
npm run dev

   Buka `http://localhost:5173`.

Data contoh: 3 pengguna (Yamal operator, Raphinha teknisi, Flick supervisor), 3 mesin, dan 3 spare part. **[PERLU DICEK — menunggu isi seed.sql]**

## Endpoint API

| Method | Endpoint | Fungsi |
|---|---|---|
| GET | `/mesin` | Daftar mesin |
| GET | `/mesin/:id/riwayat` | Riwayat tiket mesin, part yang dipakai, dan lama downtime |
| GET | `/users` | Daftar pengguna |
| GET | `/spare-parts` | Daftar spare part (nomor part, kategori, stok) |
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
| GET | `/prediksi/part` | Prakiraan kebutuhan tiap part untuk bulan berjalan dengan WMA dan backtest (`?jendela=3\|6\|12`) |

Endpoint downtime, part-terpakai, dan mttr menerima `?periode=semua|hari|minggu|bulan` atau `?bulan=TTTT-BB` (misalnya `2026-10`). Jika keduanya dikirim, `bulan` yang dipakai. Semua error dikembalikan sebagai `{ "error": "..." }`.

## Keterbatasan

- Belum ada login. Peran dipilih lewat dropdown "Login sebagai"; ini sengaja disederhanakan untuk demo.
- Notifikasi hanya lewat polling, beep, dan Notification API. Notifikasi ke Telegram atau WhatsApp menjadi rencana pengembangan.
- Backend belum di-hosting, jadi belum ada link demo.
- Data di database adalah data uji, termasuk riwayat tiket 4 tahun yang dipakai pada fitur prediksi. Galat WAPE pada backtest hanya mengukur seberapa cocok WMA dengan pola data simulasi tersebut, bukan akurasi prediksi pada kondisi nyata.

## Rencana pengembangan

- Jadwal preventive maintenance dengan pengingat otomatis.
- Autentikasi dan otorisasi.

Setelah saya terima isi seed.sql, saya pastikan baris yang ditandai itu, lalu README-nya siap copas utuh.

C:\Users\ASUS\Documents\maintenance-system>git grep -n -w -e Andi -e Budi -e Citra

C:\Users\ASUS\Documents\maintenance-system>

Bagus, git grep -n -w -e Andi -e Budi -e Citra kosong — nama lama sudah benar-benar hilang dari seluruh repo. Langkah 3 di rencana kerja kamu beres untuk bagian itu.

Tapi hasil type database\seed.sql belum ikut tertempel. Tolong jalankan lagi:

type database\seed.sql

Saya masih butuh ini untuk memastikan satu baris yang ditandai [PERLU DICEK] di draf README — apakah data contoh di seed.sql yang ikut di-push memang masih 3 mesin dan 3 spare part, atau sudah berubah. Setelah ini saya pastikan baris itu dan README siap final.

C:\Users\ASUS\Documents\maintenance-system>type database\seed.sql
INSERT INTO users (nama, role) VALUES
  ('Yamal', 'operator'),
  ('Raphinha', 'teknisi'),
  ('Flick', 'supervisor');

INSERT INTO mesin (nama, lokasi) VALUES
  ('Compressor A1', 'Line 1'),
  ('Conveyor B2', 'Line 2'),
  ('Press C3', 'Line 3');

INSERT INTO spare_parts (part_number, nama, kategori, stok, satuan, minimum_stok, harga) VALUES
  ('BRG-6205-01', 'Bearing 6205', 'Bearing', 20, 'pcs', 5, 45000),
  ('VBT-B52-01', 'V-Belt B52', 'Belt', 8, 'pcs', 4, 85000),
  ('OLI-HYD-01', 'Oli hidrolik', 'Oli', 30, 'liter', 10, 60000);
C:\Users\ASUS\Documents\maintenance-system>

Terbukti, seed.sql yang ikut di-push memang masih berisi data dasar: 3 pengguna, 3 mesin, 3 spare part. Baris “Data contoh” di README sudah tepat seperti semula, tidak perlu diubah. 60 part dan 11 mesin itu cuma ada di database kamu sendiri lewat dummy.js/ubah-parts.js, dan itu memang benar tidak disebut di README karena skripnya tidak ikut repo.

README final, siap copas:

markdown
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

| Prediksi kebutuhan part (supervisor) | Prediksi per part |
|---|---|
| ![Prediksi](docs/screenshots/prediksi.png) | ![Prediksi per part](docs/screenshots/prediksi-per-part.png) |

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
- Mencari part berdasarkan nomor part atau kategori saat memilih part.
- Dashboard: total downtime per mesin, spare part paling sering dipakai, MTTR (rata-rata waktu perbaikan), dan peringatan stok menipis. Bisa difilter per periode (semua waktu, hari ini, 7 hari terakhir, bulan ini) atau per bulan.
- Riwayat kerusakan per mesin beserta part yang dipakai dan lama downtime.
- Prediksi kebutuhan spare part dengan metode Weighted Moving Average (WMA): backtest otomatis membandingkan jendela 3, 6, dan 12 bulan dan memilih yang galatnya (WAPE) terkecil, lalu memperkirakan kebutuhan bulan berjalan dan status tiap part (aman, menipis, kurang).

## Alur tiket

pending -> diproses -> selesai
|
+-> menunggu_approval (stok part kurang) -> disetujui supervisor -> lanjut


Pemakaian part dan penambahan stok memakai transaksi database dengan penguncian baris (`SELECT ... FOR UPDATE`), sehingga dua permintaan bersamaan tidak membuat stok bernilai salah. Tiket tidak dihapus saat selesai, hanya statusnya yang berubah, supaya riwayat dan laporan tetap utuh.

## Teknologi

- Frontend: React 19, Vite 8, TypeScript, Tailwind CSS 4, Recharts
- Backend: Node.js, Express, mysql2
- Database: MySQL-compatible (dikembangkan di TiDB Cloud Starter)

## Arsitektur

Frontend (React, port 5173) ---> Backend API (Express, port 5001) ---> Database MySQL


## Struktur folder

maintenance-system/
├── backend/ API Express (src/routes per entitas)
├── frontend/ Aplikasi React + TypeScript
├── database/ schema.sql dan seed.sql
└── docs/ screenshot


## Cara menjalankan

Butuh Node.js dan sebuah database MySQL-compatible yang kosong.

1. Buat tabel dan data contoh: jalankan isi `database/schema.sql`, lalu `database/seed.sql` (cukup sekali) pada database tersebut.
2. Backend:

cd backend
copy .env.example .env
npm install
npm run dev

   Isi `backend/.env` dengan data koneksi database Anda. Backend berjalan di `http://localhost:5001`.
3. Frontend (terminal lain):

cd frontend
npm install
npm run dev

   Buka `http://localhost:5173`.

Data contoh: 3 pengguna (Yamal operator, Raphinha teknisi, Flick supervisor), 3 mesin, dan 3 spare part.

## Endpoint API

| Method | Endpoint | Fungsi |
|---|---|---|
| GET | `/mesin` | Daftar mesin |
| GET | `/mesin/:id/riwayat` | Riwayat tiket mesin, part yang dipakai, dan lama downtime |
| GET | `/users` | Daftar pengguna |
| GET | `/spare-parts` | Daftar spare part (nomor part, kategori, stok) |
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
| GET | `/prediksi/part` | Prakiraan kebutuhan tiap part untuk bulan berjalan dengan WMA dan backtest (`?jendela=3\|6\|12`) |

Endpoint downtime, part-terpakai, dan mttr menerima `?periode=semua|hari|minggu|bulan` atau `?bulan=TTTT-BB` (misalnya `2026-10`). Jika keduanya dikirim, `bulan` yang dipakai. Semua error dikembalikan sebagai `{ "error": "..." }`.

## Keterbatasan

- Belum ada login. Peran dipilih lewat dropdown "Login sebagai"; ini sengaja disederhanakan untuk demo.
- Notifikasi hanya lewat polling, beep, dan Notification API. Notifikasi ke Telegram atau WhatsApp menjadi rencana pengembangan.
- Backend belum di-hosting, jadi belum ada link demo.
- Data di database adalah data uji, termasuk riwayat tiket 4 tahun yang dipakai pada fitur prediksi. Galat WAPE pada backtest hanya mengukur seberapa cocok WMA dengan pola data simulasi tersebut, bukan akurasi prediksi pada kondisi nyata.

## Rencana pengembangan

- Jadwal preventive maintenance dengan pengingat otomatis.
- Autentikasi dan otorisasi.