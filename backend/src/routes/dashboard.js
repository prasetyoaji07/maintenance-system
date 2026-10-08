const express = require("express");
const pool = require("../db");

const router = express.Router();

// GET /dashboard/downtime
// Total downtime per mesin (menit), dihitung dari created_at sampai selesai_at,
// hanya untuk tiket yang sudah selesai. created_at dipakai sebagai representasi
// waktu mulai downtime karena sistem belum punya field khusus untuk itu.
router.get("/downtime", async (req, res) => {
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
       GROUP BY m.id, m.nama
       ORDER BY total_downtime_menit DESC`
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

// GET /dashboard/part-terpakai
// Spare part paling sering dipakai, hanya tiket_part berstatus 'dipakai'
// (status 'menunggu_approval' belum benar-benar mengurangi stok).
router.get("/part-terpakai", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT
         sp.id AS part_id,
         sp.nama AS part_nama,
         sp.satuan,
         SUM(tp.qty_dipakai) AS total_qty_dipakai
       FROM tiket_part tp
       JOIN spare_parts sp ON sp.id = tp.part_id
       WHERE tp.status = 'dipakai'
       GROUP BY sp.id, sp.nama, sp.satuan
       ORDER BY total_qty_dipakai DESC`
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

// GET /dashboard/mttr
// Mean Time To Repair: rata-rata waktu dari diproses_at sampai selesai_at,
// hanya tiket yang sudah selesai. Beda dari downtime (yang dihitung dari created_at).
router.get("/mttr", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT
         COUNT(*) AS jumlah_tiket_selesai,
         COALESCE(AVG(TIMESTAMPDIFF(MINUTE, diproses_at, selesai_at)), 0) AS mttr_menit
       FROM tiket_kerusakan
       WHERE status = 'selesai' AND diproses_at IS NOT NULL AND selesai_at IS NOT NULL`
    );
    res.json({
      jumlah_tiket_selesai: rows[0].jumlah_tiket_selesai,
      mttr_menit: Number(rows[0].mttr_menit),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Gagal mengambil data MTTR" });
  }
});

// GET /dashboard/stok-menipis
// Daftar spare part yang stoknya di bawah batas minimum.
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