
const express = require("express");
const db = require("../db");
const { verifyToken, requireRole } = require("../middleware/auth");

const router = express.Router();

const SPV_MAINTENANCE = "spv_mtnc";
const MEKANIK_MAINTENANCE = "mekanik_mtnc";

// GET /penugasan-maintenance/antrean
// Daftar tiket yang sudah ditandatangani Foreman dan SPV Divisi.
router.get(
  "/antrean",
  verifyToken,
  requireRole(SPV_MAINTENANCE),
  async (req, res) => {
    try {
      const [rows] = await db.query(
        `SELECT
           t.id,
           t.mesin_id,
           t.keluhan,
           t.laporan_permasalahan,
           t.laporan_leader,
           t.laporan_installer,
           t.status,
           t.created_at,
           t.ttd_foreman_oleh,
           t.ttd_foreman_at,
           t.ttd_spv_oleh,
           t.ttd_spv_at,
           t.ditugaskan_ke,
           m.nama AS nama_mesin,
           m.lokasi,
           m.divisi,
           u.nama AS nama_pelapor
         FROM tiket_kerusakan t
         JOIN mesin m ON m.id = t.mesin_id
         LEFT JOIN users u ON u.id = t.operator_id
         WHERE t.status = 'menunggu_assign_spv_mtnc'
           AND t.ttd_foreman_ttd IS NOT NULL
           AND t.ttd_spv_ttd IS NOT NULL
         ORDER BY t.created_at ASC, t.id ASC`
      );

      res.json(rows);
    } catch (err) {
      console.error("Antrean penugasan maintenance:", err);
      res.status(500).json({
        error: "Gagal mengambil antrean penugasan.",
      });
    }
  }
);

// GET /penugasan-maintenance/mekanik
// Daftar akun yang dapat ditugaskan.
router.get(
  "/mekanik",
  verifyToken,
  requireRole(SPV_MAINTENANCE),
  async (req, res) => {
    try {
      const [rows] = await db.query(
        `SELECT id, nama
         FROM users
         WHERE role = 'mekanik_mtnc'
         ORDER BY nama ASC`
      );

      res.json(rows);
    } catch (err) {
      console.error("Daftar mekanik maintenance:", err);
      res.status(500).json({
        error: "Gagal mengambil daftar mekanik.",
      });
    }
  }
);

// PATCH /penugasan-maintenance/:id/tugaskan
// Body: { "mekanik_id": 123 }
router.patch(
  "/:id/tugaskan",
  verifyToken,
  requireRole(SPV_MAINTENANCE),
  async (req, res) => {
    const id = Number(req.params.id);
    const mekanikId = Number(req.body?.mekanik_id);

    if (!Number.isSafeInteger(id) || id <= 0) {
      return res.status(400).json({
        error: "ID tiket tidak valid.",
      });
    }

    if (!Number.isSafeInteger(mekanikId) || mekanikId <= 0) {
      return res.status(400).json({
        error: "Pilih mekanik yang valid.",
      });
    }

    let connection;

    try {
      connection = await db.getConnection();
      await connection.beginTransaction();

      const [mekanikRows] = await connection.query(
        `SELECT id, nama
         FROM users
         WHERE id = ? AND role = 'mekanik_mtnc'
         FOR UPDATE`,
        [mekanikId]
      );

      const mekanik = mekanikRows[0];

      if (!mekanik) {
        await connection.rollback();
        return res.status(400).json({
          error: "Akun mekanik tidak ditemukan atau rolenya tidak sesuai.",
        });
      }

      const [tiketRows] = await connection.query(
        `SELECT
           id,
           mesin_id,
           status,
           ttd_foreman_ttd,
           ttd_spv_ttd
         FROM tiket_kerusakan
         WHERE id = ?
         FOR UPDATE`,
        [id]
      );

      const tiket = tiketRows[0];

      if (!tiket) {
        await connection.rollback();
        return res.status(404).json({
          error: "Tiket tidak ditemukan.",
        });
      }

      if (tiket.status !== "menunggu_assign_spv_mtnc") {
        await connection.rollback();
        return res.status(409).json({
          error: "Tiket tidak lagi menunggu penugasan SPV Maintenance.",
        });
      }

      if (!tiket.ttd_foreman_ttd || !tiket.ttd_spv_ttd) {
        await connection.rollback();
        return res.status(409).json({
          error: "Tanda tangan Foreman dan SPV Divisi harus lengkap.",
        });
      }

      await connection.query(
        `UPDATE tiket_kerusakan
         SET ditugaskan_ke = ?,
             status = 'diproses_maintenance',
             diproses_at = NOW()
         WHERE id = ?`,
        [mekanikId, id]
      );

      await connection.query(
        "UPDATE mesin SET status = 'maintenance' WHERE id = ?",
        [tiket.mesin_id]
      );

      await connection.commit();

      return res.json({
        message: `Tiket #${id} berhasil ditugaskan kepada ${mekanik.nama}.`,
        id,
        ditugaskan_ke: mekanik.id,
        nama_mekanik: mekanik.nama,
        status: "diproses_maintenance",
      });
    } catch (err) {
      if (connection) {
        await connection.rollback().catch(() => {});
      }

      console.error("Penugasan tiket maintenance:", err);
      return res.status(500).json({
        error: "Gagal menugaskan tiket.",
      });
    } finally {
      if (connection) connection.release();
    }
  }
);


 // GET /penugasan-maintenance/tiket-saya
router.get(
  "/tiket-saya",
  verifyToken,
  requireRole(MEKANIK_MAINTENANCE),
  async (req, res) => {
    try {
      const [rows] = await db.query(
        `SELECT
           t.id,
           t.mesin_id,
           t.keluhan,
           t.laporan_permasalahan,
           t.laporan_leader,
           t.laporan_installer,
           t.status,
           t.created_at,
           t.diproses_at,
           t.ditugaskan_ke,
           m.nama AS nama_mesin,
           m.lokasi,
           m.divisi
         FROM tiket_kerusakan t
         JOIN mesin m ON m.id = t.mesin_id
         WHERE t.ditugaskan_ke = ?
           AND t.status = 'diproses_maintenance'
         ORDER BY t.diproses_at ASC, t.id ASC`,
        [req.user.id]
      );

      res.json(rows);
    } catch (err) {
      console.error("Tiket maintenance mekanik:", err);
      res.status(500).json({
        error: "Gagal mengambil tiket maintenance.",
      });
    }
  }
);

// PATCH /penugasan-maintenance/:id/selesai-maintenance
router.patch(
  "/:id/selesai-maintenance",
  verifyToken,
  requireRole(MEKANIK_MAINTENANCE),
  async (req, res) => {
    const id = Number(req.params.id);

    if (!Number.isSafeInteger(id) || id <= 0) {
      return res.status(400).json({
        error: "ID tiket tidak valid.",
      });
    }

    let connection;

    try {
      connection = await db.getConnection();
      await connection.beginTransaction();

      const [rows] = await connection.query(
        `SELECT id, mesin_id, status, ditugaskan_ke
         FROM tiket_kerusakan
         WHERE id = ?
         FOR UPDATE`,
        [id]
      );

      const tiket = rows[0];

      if (!tiket) {
        await connection.rollback();
        return res.status(404).json({
          error: "Tiket tidak ditemukan.",
        });
      }

      if (Number(tiket.ditugaskan_ke) !== Number(req.user.id)) {
        await connection.rollback();
        return res.status(403).json({
          error: "Tiket ini tidak ditugaskan kepada akun Anda.",
        });
      }

      if (tiket.status !== "diproses_maintenance") {
        await connection.rollback();
        return res.status(409).json({
          error: "Tiket tidak sedang diproses maintenance.",
        });
      }

      await connection.query(
        `UPDATE tiket_kerusakan
         SET status = 'selesai', selesai_at = NOW()
         WHERE id = ?`,
        [id]
      );

      await connection.query(
        "UPDATE mesin SET status = 'jalan' WHERE id = ?",
        [tiket.mesin_id]
      );

      await connection.commit();

      return res.json({
        message: `Maintenance tiket #${id} berhasil diselesaikan.`,
        id,
        status: "selesai",
      });
    } catch (err) {
      if (connection) {
        await connection.rollback().catch(() => {});
      }

      console.error("Penyelesaian maintenance:", err);
      return res.status(500).json({
        error: "Gagal menyelesaikan maintenance.",
      });
    } finally {
      if (connection) connection.release();
    }
  }
);

module.exports = router;
