
const express = require("express");
const db = require("../db");
const { verifyToken } = require("../middleware/auth");

const router = express.Router();

const LEADER = "leader_divisi";
const INSTALLER = "installer_divisi";

async function ambilUser(connection, id) {
  const [rows] = await connection.query(
    "SELECT id, nama, role, divisi FROM users WHERE id = ?",
    [id]
  );
  return rows[0];
}

// POST /tiket/alur-divisi/lapor
// Pelaporan kerusakan oleh Leader Divisi
router.post("/alur-divisi/lapor", verifyToken, async (req, res) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const user = await ambilUser(connection, req.user.id);

    if (!user || user.role !== LEADER) {
      await connection.rollback();
      return res.status(403).json({ error: "Khusus Leader Divisi." });
    }

    const mesinId = Number(req.body.mesin_id);
    const keluhan = String(req.body.keluhan || "").trim();

    if (!Number.isInteger(mesinId) || mesinId <= 0 || !keluhan) {
      await connection.rollback();
      return res.status(400).json({
        error: "Mesin dan keluhan wajib diisi.",
      });
    }

    const [mesinRows] = await connection.query(
      "SELECT id, divisi FROM mesin WHERE id = ? FOR UPDATE",
      [mesinId]
    );

    const mesin = mesinRows[0];

    if (!mesin) {
      await connection.rollback();
      return res.status(404).json({ error: "Mesin tidak ditemukan." });
    }

    if (!user.divisi || mesin.divisi !== user.divisi) {
      await connection.rollback();
      return res.status(403).json({
        error: "Mesin harus berasal dari divisi Leader.",
      });
    }

    const [hasil] = await connection.query(
      `INSERT INTO tiket_kerusakan
       (mesin_id, operator_id, keluhan, status)
       VALUES (?, ?, ?, 'ditangani_leader')`,
      [mesinId, user.id, keluhan]
    );

    await connection.query(
      "UPDATE mesin SET status = 'rusak' WHERE id = ?",
      [mesinId]
    );

    await connection.commit();

    res.status(201).json({
      message: "Laporan berhasil dibuat.",
      id: hasil.insertId,
      status: "ditangani_leader",
    });
  } catch (err) {
    await connection.rollback();
    console.error("Laporan alur divisi:", err);
    res.status(500).json({ error: "Gagal membuat laporan." });
  } finally {
    connection.release();
  }
});

// GET /tiket/alur-divisi
// Leader dan Installer hanya melihat tiket di divisinya
router.get("/alur-divisi", verifyToken, async (req, res) => {
  try {
    const user = await ambilUser(db, req.user.id);

    if (!user || ![LEADER, INSTALLER].includes(user.role)) {
      return res.status(403).json({ error: "Akses ditolak." });
    }

    if (!user.divisi) {
      return res.json([]);
    }

    const status = user.role === LEADER
      ? "ditangani_leader"
      : "ditangani_installer";

    const [rows] = await db.query(
      `SELECT
         t.id,
         t.mesin_id,
         t.operator_id,
         t.keluhan,
         t.status,
         t.laporan_leader,
         t.laporan_installer,
         t.laporan_permasalahan,
         m.nama AS nama_mesin,
         m.lokasi,
         m.divisi,
         u.nama AS nama_pelapor
       FROM tiket_kerusakan t
       JOIN mesin m ON m.id = t.mesin_id
       LEFT JOIN users u ON u.id = t.operator_id
       WHERE t.status = ? AND m.divisi = ?
       ORDER BY t.id DESC`,
      [status, user.divisi]
    );

    res.json(rows);
  } catch (err) {
    console.error("Daftar alur divisi:", err);
    res.status(500).json({ error: "Gagal mengambil daftar tiket." });
  }
});

// PATCH /tiket/alur-divisi/:id/aksi
// Leader: selesai atau teruskan ke Installer
// Installer: selesai atau teruskan ke tanda tangan
router.patch("/alur-divisi/:id/aksi", verifyToken, async (req, res) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const user = await ambilUser(connection, req.user.id);

    if (!user || ![LEADER, INSTALLER].includes(user.role)) {
      await connection.rollback();
      return res.status(403).json({ error: "Akses ditolak." });
    }

    const id = Number(req.params.id);
    const aksi = String(req.body.aksi || "");
    const laporan = String(req.body.laporan || "").trim();

    if (!Number.isInteger(id) || id <= 0) {
      await connection.rollback();
      return res.status(400).json({ error: "ID tiket tidak valid." });
    }

    const [rows] = await connection.query(
      `SELECT t.id, t.mesin_id, t.keluhan, t.status,
              t.laporan_leader, t.laporan_installer, m.divisi
       FROM tiket_kerusakan t
       JOIN mesin m ON m.id = t.mesin_id
       WHERE t.id = ?
       FOR UPDATE`,
      [id]
    );

    const tiket = rows[0];

    if (!tiket) {
      await connection.rollback();
      return res.status(404).json({ error: "Tiket tidak ditemukan." });
    }

    if (!user.divisi || tiket.divisi !== user.divisi) {
      await connection.rollback();
      return res.status(403).json({ error: "Tiket bukan dari divisi Anda." });
    }

    if (user.role === LEADER) {
      if (tiket.status !== "ditangani_leader") {
        await connection.rollback();
        return res.status(409).json({ error: "Status tiket sudah berubah." });
      }

      if (aksi === "selesai") {
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
      } else if (aksi === "teruskan_installer") {
        if (!laporan) {
          await connection.rollback();
          return res.status(400).json({
            error: "Isi laporan Leader sebelum meneruskan tiket.",
          });
        }

        await connection.query(
          `UPDATE tiket_kerusakan
           SET status = 'ditangani_installer',
               laporan_leader = ?
           WHERE id = ?`,
          [laporan, id]
        );
      } else {
        await connection.rollback();
        return res.status(400).json({ error: "Aksi tidak valid." });
      }
    } else {
      if (tiket.status !== "ditangani_installer") {
        await connection.rollback();
        return res.status(409).json({ error: "Status tiket sudah berubah." });
      }

      if (aksi === "selesai") {
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
      } else if (aksi === "menunggu_ttd") {
        if (!laporan) {
          await connection.rollback();
          return res.status(400).json({
            error: "Isi laporan Installer sebelum meminta tanda tangan.",
          });
        }

        const laporanGabungan = [
          `Keluhan: ${tiket.keluhan}`,
          tiket.laporan_leader
            ? `Laporan Leader: ${tiket.laporan_leader}`
            : "",
          `Laporan Installer: ${laporan}`,
        ].filter(Boolean).join("\n\n");

        await connection.query(
          `UPDATE tiket_kerusakan
           SET status = 'menunggu_ttd',
               laporan_installer = ?,
               laporan_permasalahan = ?
           WHERE id = ?`,
          [laporan, laporanGabungan, id]
        );
      } else {
        await connection.rollback();
        return res.status(400).json({ error: "Aksi tidak valid." });
      }
    }

    await connection.commit();

    res.json({
      message: "Aksi berhasil disimpan.",
      status:
        aksi === "teruskan_installer"
          ? "ditangani_installer"
          : aksi === "menunggu_ttd"
            ? "menunggu_ttd"
            : "selesai",
    });
  } catch (err) {
    await connection.rollback();
    console.error("Aksi alur divisi:", err);
    res.status(500).json({ error: "Gagal memproses tiket." });
  } finally {
    connection.release();
  }
});

module.exports = router;
