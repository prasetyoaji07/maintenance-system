const express = require("express");
const db = require("../db");

const router = express.Router();

// GET /mesin -> semua mesin
router.get("/", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT id, nama, lokasi, status FROM mesin ORDER BY id");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /mesin/:id/riwayat -> semua tiket satu mesin, terbaru dulu,
// lengkap dengan operator, teknisi, durasi downtime, dan part yang dipakai
router.get("/:id/riwayat", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: "id mesin tidak valid" });
  }

  try {
    const [mesin] = await db.query(
      "SELECT id, nama, lokasi, status FROM mesin WHERE id = ?",
      [id]
    );
    if (mesin.length === 0) {
      return res.status(404).json({ error: "Mesin tidak ditemukan" });
    }

    const [tiket] = await db.query(
      `SELECT t.id, t.keluhan, t.status,
              u.nama AS operator, tk.nama AS teknisi,
              t.created_at, t.diproses_at, t.selesai_at,
              CASE WHEN t.selesai_at IS NULL THEN NULL
                   ELSE TIMESTAMPDIFF(MINUTE, t.created_at, t.selesai_at) END AS downtime_menit
       FROM tiket_kerusakan t
       JOIN users u ON u.id = t.operator_id
       LEFT JOIN users tk ON tk.id = t.teknisi_id
       WHERE t.mesin_id = ?
       ORDER BY t.created_at DESC, t.id DESC`,
      [id]
    );

    // Part yang benar-benar dipakai, dikelompokkan per tiket
    const [part] = await db.query(
      `SELECT tp.tiket_id, sp.nama AS part, tp.qty_dipakai, sp.satuan
       FROM tiket_part tp
       JOIN spare_parts sp ON sp.id = tp.part_id
       JOIN tiket_kerusakan t ON t.id = tp.tiket_id
       WHERE t.mesin_id = ? AND tp.status = 'dipakai'
       ORDER BY tp.id`,
      [id]
    );

    const perTiket = new Map();
    for (const p of part) {
      if (!perTiket.has(p.tiket_id)) perTiket.set(p.tiket_id, []);
      perTiket.get(p.tiket_id).push({
        part: p.part,
        qty_dipakai: p.qty_dipakai,
        satuan: p.satuan,
      });
    }

    res.json({
      mesin: mesin[0],
      tiket: tiket.map((t) => ({ ...t, parts: perTiket.get(t.id) || [] })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;