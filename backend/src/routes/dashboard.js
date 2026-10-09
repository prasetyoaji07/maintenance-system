const express = require("express");
const pool = require("../db");

const router = express.Router();

const PERIODE_VALID = ["semua", "hari", "minggu", "bulan"];
const BULAN_VALID = /^(\d{4})-(0[1-9]|1[0-2])$/;
const SELISIH_WIB_MS = 7 * 60 * 60 * 1000;

const PESAN_PERIODE = "periode harus salah satu dari: semua, hari, minggu, bulan";
const PESAN_BULAN = "bulan harus berformat TTTT-BB, misalnya 2026-09";

function formatUtc(date) {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

// Awal bulan menurut WIB, dikembalikan sebagai Date UTC.
// bulan0 boleh 12 (artinya Januari tahun berikutnya).
function awalBulanUtc(tahun, bulan0) {
  return new Date(Date.UTC(tahun, bulan0, 1) - SELISIH_WIB_MS);
}

// Mengembalikan batas awal periode sebagai string UTC "YYYY-MM-DD HH:MM:SS",
// atau null untuk "semua". Batas hari/bulan dihitung menurut WIB (UTC+7),
// sedangkan database menyimpan waktu dalam UTC.
function batasAwal(periode) {
  if (periode === "semua") return null;
  const w = new Date(Date.now() + SELISIH_WIB_MS);
  const y = w.getUTCFullYear();
  const m = w.getUTCMonth();
  const d = w.getUTCDate();
  let awalWib;
  if (periode === "hari") awalWib = Date.UTC(y, m, d);
  else if (periode === "minggu") awalWib = Date.UTC(y, m, d - 6);
  else awalWib = Date.UTC(y, m, 1);
  return formatUtc(new Date(awalWib - SELISIH_WIB_MS));
}

// Membaca ?bulan=TTTT-BB atau ?periode=... dan mengembalikan { awal, akhir }
// (string UTC atau null), atau { error } kalau tidak valid.
// Kalau bulan dan periode dikirim bersamaan, bulan yang dipakai.
function bacaRentang(req) {
  const { bulan, periode } = req.query;

  if (bulan !== undefined) {
    const cocok = BULAN_VALID.exec(String(bulan));
    if (!cocok) return { error: PESAN_BULAN };
    const tahun = Number(cocok[1]);
    const bulan0 = Number(cocok[2]) - 1;
    return {
      awal: formatUtc(awalBulanUtc(tahun, bulan0)),
      akhir: formatUtc(awalBulanUtc(tahun, bulan0 + 1)),
    };
  }

  const p = periode === undefined ? "semua" : periode;
  if (!PERIODE_VALID.includes(p)) return { error: PESAN_PERIODE };
  return { awal: batasAwal(p), akhir: null };
}

// Potongan SQL "AND kolom >= ? AND kolom < ?" sesuai rentang.
// "kolom" selalu string tetap dari kode ini, bukan dari input pengguna.
function filterWaktu(kolom, rentang) {
  const sql = [];
  const params = [];
  if (rentang.awal) {
    sql.push(`AND ${kolom} >= ?`);
    params.push(rentang.awal);
  }
  if (rentang.akhir) {
    sql.push(`AND ${kolom} < ?`);
    params.push(rentang.akhir);
  }
  return { sql: sql.join(" "), params };
}

// GET /dashboard/downtime?periode=semua|hari|minggu|bulan  atau  ?bulan=2026-09
// Total downtime per mesin (menit), dihitung dari created_at sampai selesai_at,
// hanya untuk tiket yang sudah selesai dalam rentang. created_at dipakai sebagai
// representasi waktu mulai downtime (keputusan final proyek).
router.get("/downtime", async (req, res) => {
  const rentang = bacaRentang(req);
  if (rentang.error) return res.status(400).json({ error: rentang.error });
  const f = filterWaktu("t.selesai_at", rentang);
  try {
    const [rows] = await pool.query(
      `SELECT
         m.id AS mesin_id,
         m.nama AS mesin_nama,
         COUNT(t.id) AS jumlah_tiket_selesai,
         COALESCE(SUM(TIMESTAMPDIFF(MINUTE, t.created_at, t.selesai_at)), 0) AS total_downtime_menit
       FROM mesin m
       LEFT JOIN tiket_kerusakan t
         ON t.mesin_id = m.id AND t.status = 'selesai'
         ${f.sql}
       GROUP BY m.id, m.nama
       ORDER BY total_downtime_menit DESC`,
      f.params
    );
    res.json(
      rows.map((r) => ({
        ...r,
        jumlah_tiket_selesai: Number(r.jumlah_tiket_selesai),
        total_downtime_menit: Number(r.total_downtime_menit),
      }))
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Gagal mengambil data downtime" });
  }
});

// GET /dashboard/part-terpakai?periode=...  atau  ?bulan=2026-09
// Spare part paling sering dipakai, hanya tiket_part berstatus 'dipakai'.
// Rentang difilter lewat created_at tiket (tiket_part tidak punya kolom waktu).
router.get("/part-terpakai", async (req, res) => {
  const rentang = bacaRentang(req);
  if (rentang.error) return res.status(400).json({ error: rentang.error });
  const f = filterWaktu("t.created_at", rentang);
  try {
    const [rows] = await pool.query(
      `SELECT
         sp.id AS part_id,
         sp.nama AS part_nama,
         sp.satuan,
         SUM(tp.qty_dipakai) AS total_qty_dipakai
       FROM tiket_part tp
       JOIN spare_parts sp ON sp.id = tp.part_id
       JOIN tiket_kerusakan t ON t.id = tp.tiket_id
       WHERE tp.status = 'dipakai'
         ${f.sql}
       GROUP BY sp.id, sp.nama, sp.satuan
       ORDER BY total_qty_dipakai DESC`,
      f.params
    );
    res.json(
      rows.map((r) => ({
        ...r,
        total_qty_dipakai: Number(r.total_qty_dipakai),
      }))
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Gagal mengambil data part terpakai" });
  }
});

// GET /dashboard/mttr?periode=...  atau  ?bulan=2026-09
// Mean Time To Repair: rata-rata waktu dari diproses_at sampai selesai_at,
// hanya tiket yang selesai dalam rentang. Beda dari downtime (dari created_at).
router.get("/mttr", async (req, res) => {
  const rentang = bacaRentang(req);
  if (rentang.error) return res.status(400).json({ error: rentang.error });
  const f = filterWaktu("selesai_at", rentang);
  try {
    const [rows] = await pool.query(
      `SELECT
         COUNT(*) AS jumlah_tiket_selesai,
         COALESCE(AVG(TIMESTAMPDIFF(MINUTE, diproses_at, selesai_at)), 0) AS mttr_menit
       FROM tiket_kerusakan
       WHERE status = 'selesai' AND diproses_at IS NOT NULL AND selesai_at IS NOT NULL
         ${f.sql}`,
      f.params
    );
    res.json({
      jumlah_tiket_selesai: Number(rows[0].jumlah_tiket_selesai),
      mttr_menit: Number(rows[0].mttr_menit),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Gagal mengambil data MTTR" });
  }
});

// GET /dashboard/stok-menipis
// Daftar spare part yang stoknya di bawah batas minimum (kondisi saat ini,
// tidak dipengaruhi periode atau bulan).
router.get("/stok-menipis", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, nama, stok, satuan, minimum_stok
       FROM spare_parts
       WHERE stok < minimum_stok
       ORDER BY (minimum_stok - stok) DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Gagal mengambil data stok menipis" });
  }
});

module.exports = router;