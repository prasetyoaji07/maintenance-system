const express = require("express");
const db = require("../db");

const router = express.Router();

// Membuat error yang membawa kode HTTP
function tolak(status, pesan) {
  const err = new Error(pesan);
  err.status = status;
  return err;
}

// Angka bulat positif, atau null kalau tidak valid
function angka(nilai) {
  const n = Number(nilai);
  return Number.isInteger(n) && n > 0 ? n : null;
}

// GET /spare-parts -> daftar spare part beserta nomor part, kategori, stok, dan minimum stok
router.get("/", async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT id, part_number, nama, kategori, stok, satuan, minimum_stok FROM spare_parts ORDER BY part_number"
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /spare-parts/:id/stok -> supervisor menambah stok
// Body: { "supervisor_id": 3, "qty": 5 }
router.post("/:id/stok", async (req, res) => {
  const id = angka(req.params.id);
  const supervisorId = angka(req.body?.supervisor_id);
  const qty = angka(req.body?.qty);
  if (!id || !supervisorId || !qty) {
    return res
      .status(400)
      .json({ error: "id part, supervisor_id, dan qty wajib berupa angka lebih dari 0" });
  }

  let conn;
  try {
    conn = await db.getConnection();
    await conn.beginTransaction();

    const [user] = await conn.query("SELECT role FROM users WHERE id = ?", [supervisorId]);
    if (user.length === 0 || user[0].role !== "supervisor") {
      throw tolak(403, "Hanya supervisor yang boleh menambah stok");
    }

    const [part] = await conn.query(
      "SELECT id, nama, stok FROM spare_parts WHERE id = ? FOR UPDATE",
      [id]
    );
    if (part.length === 0) throw tolak(404, "Spare part tidak ditemukan");

    const stokSebelum = part[0].stok;
    const stokSesudah = stokSebelum + qty;

    await conn.query("UPDATE spare_parts SET stok = stok + ? WHERE id = ?", [qty, id]);

    // Catat riwayat penambahan stok dalam transaksi yang sama,
    // supaya tidak mungkin stok berubah tanpa jejak riwayat (atau sebaliknya).
    await conn.query(
      `INSERT INTO riwayat_stok
        (part_id, supervisor_id, qty_tambah, stok_sebelum, stok_sesudah)
       VALUES (?, ?, ?, ?, ?)`,
      [id, supervisorId, qty, stokSebelum, stokSesudah]
    );

    await conn.commit();

    res.json({
      id,
      nama: part[0].nama,
      stok_sebelum: stokSebelum,
      stok_sekarang: stokSesudah,
    });
  } catch (err) {
    if (conn) await conn.rollback().catch(() => {});
    res.status(err.status || 500).json({ error: err.message });
  } finally {
    if (conn) conn.release();
  }
});

// GET /spare-parts/:id/riwayat -> riwayat penambahan stok, terbaru dulu
router.get("/:id/riwayat", async (req, res) => {
  const id = angka(req.params.id);
  if (!id) {
    return res.status(400).json({ error: "id part harus berupa angka lebih dari 0" });
  }

  try {
    const [part] = await db.query("SELECT id FROM spare_parts WHERE id = ?", [id]);
    if (part.length === 0) {
      return res.status(404).json({ error: "Spare part tidak ditemukan" });
    }

    const [rows] = await db.query(
      `SELECT r.id, r.qty_tambah, r.stok_sebelum, r.stok_sesudah, r.created_at,
              u.nama AS supervisor_nama
       FROM riwayat_stok r
       JOIN users u ON u.id = r.supervisor_id
       WHERE r.part_id = ?
       ORDER BY r.created_at DESC, r.id DESC`,
      [id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;