const express = require("express");
const db = require("../db");

const router = express.Router();

// POST /tiket -> operator melapor kerusakan
// Body: { "mesin_id": 1, "operator_id": 1, "keluhan": "Suara kasar dan panas" }
router.post("/", async (req, res) => {
  const { mesin_id, operator_id, keluhan } = req.body;

  if (!mesin_id || !operator_id || !keluhan?.trim()) {
    return res.status(400).json({ error: "mesin_id, operator_id, dan keluhan wajib diisi" });
  }

  let conn;
  try {
    conn = await db.getConnection();
    await conn.beginTransaction();

    const [op] = await conn.query("SELECT role FROM users WHERE id = ?", [operator_id]);
    if (op.length === 0 || op[0].role !== "operator") {
      const err = new Error("operator_id harus milik user dengan role operator");
      err.status = 400;
      throw err;
    }

    // Kunci baris mesin supaya dua laporan bersamaan tidak lolos keduanya
    const [mesin] = await conn.query("SELECT id FROM mesin WHERE id = ? FOR UPDATE", [mesin_id]);
    if (mesin.length === 0) {
      const err = new Error("Mesin tidak ditemukan");
      err.status = 400;
      throw err;
    }

    const [terbuka] = await conn.query(
      "SELECT id FROM tiket_kerusakan WHERE mesin_id = ? AND status <> 'selesai'",
      [mesin_id]
    );
    if (terbuka.length > 0) {
      const err = new Error("Mesin ini sudah punya tiket yang belum selesai (#" + terbuka[0].id + ")");
      err.status = 409;
      throw err;
    }

    const [hasil] = await conn.query(
      "INSERT INTO tiket_kerusakan (mesin_id, operator_id, keluhan) VALUES (?, ?, ?)",
      [mesin_id, operator_id, keluhan.trim()]
    );
    await conn.query("UPDATE mesin SET status = 'rusak' WHERE id = ?", [mesin_id]);

    await conn.commit();
    res.status(201).json({ id: hasil.insertId, mesin_id, status: "pending" });
  } catch (err) {
    if (conn) await conn.rollback();
    res.status(err.status || 500).json({ error: err.message });
  } finally {
    if (conn) conn.release();
  }
});

// GET /tiket -> semua tiket; GET /tiket?status=aktif -> yang belum selesai
router.get("/", async (req, res) => {
  try {
    let sql = `SELECT t.id, t.mesin_id, m.nama AS mesin, t.keluhan, t.status,
                      u.nama AS operator, t.created_at, t.diproses_at, t.selesai_at
               FROM tiket_kerusakan t
               JOIN mesin m ON m.id = t.mesin_id
               JOIN users u ON u.id = t.operator_id`;
    if (req.query.status === "aktif") sql += " WHERE t.status <> 'selesai'";
    sql += " ORDER BY t.created_at DESC, t.id DESC";

    const [rows] = await db.query(sql);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;