
const express = require("express");
const db = require("../db");
const { verifyToken, requireRole } = require("../middleware/auth");
const { TTD_SURAT } = require("../middleware/roles");

const router = express.Router();

// GET /tiket/menunggu-ttd
// Antrean surat yang menunggu tanda tangan.
// Role dan divisi dibaca ulang dari database.
router.get(
  "/menunggu-ttd",
  verifyToken,
  requireRole(...TTD_SURAT),
  async (req, res) => {
    try {
      const [user] = await db.query(
        "SELECT role, divisi FROM users WHERE id = ?",
        [req.user.id]
      );

      if (user.length === 0 || !TTD_SURAT.includes(user[0].role)) {
        return res.status(403).json({ error: "Role tidak diizinkan" });
      }

      const { role, divisi } = user[0];

      let filterSlot = "";
      if (role === "foreman_divisi") {
        filterSlot = " AND t.ttd_foreman_oleh IS NULL";
      }
      if (role === "spv_divisi") {
        filterSlot = " AND t.ttd_spv_oleh IS NULL";
      }

      const sql =
        "SELECT t.id, m.nama AS mesin, m.`line` AS line_mesin, m.divisi, t.keluhan, " +
        "t.laporan_leader, t.laporan_installer, t.laporan_permasalahan, " +
        "u.nama AS pelapor, t.created_at, " +
        "t.ttd_foreman_oleh, t.ttd_foreman_at, t.ttd_spv_oleh, t.ttd_spv_at " +
        "FROM tiket_kerusakan t " +
        "JOIN mesin m ON m.id = t.mesin_id " +
        "JOIN users u ON u.id = t.operator_id " +
        "WHERE t.status = 'menunggu_ttd' AND m.divisi = ?" +
        filterSlot +
        " ORDER BY t.created_at, t.id";

      const [rows] = await db.query(sql, [divisi]);

      return res.json(
        rows.map((r) => ({
          id: r.id,
          mesin: r.mesin,
          line: r.line_mesin,
          divisi: r.divisi,
          keluhan: r.keluhan,
          laporan_leader: r.laporan_leader,
          laporan_installer: r.laporan_installer,
          laporan_permasalahan: r.laporan_permasalahan,
          pelapor: r.pelapor,
          created_at: r.created_at,
          foreman_sudah: r.ttd_foreman_oleh !== null,
          foreman_oleh: r.ttd_foreman_oleh,
          foreman_at: r.ttd_foreman_at,
          spv_sudah: r.ttd_spv_oleh !== null,
          spv_oleh: r.ttd_spv_oleh,
          spv_at: r.ttd_spv_at,
        }))
      );
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Terjadi kesalahan server" });
    }
  }
);

/**
 * POST /tiket/:id/ttd
 *
 * Body:
 * {
 *   sebagai: "foreman" | "spv",
 *   ttd: "data:image/png;base64,...",
 *   penanda_tangan_id: 123 // wajib untuk mode installer
 * }
 *
 * Mode installer:
 * installer memilih penanda tangan dari divisi yang sama.
 *
 * Mode langsung:
 * foreman/spv menandatangani slot sesuai rolenya sendiri.
 */
router.post(
  "/:id/ttd",
  verifyToken,
  requireRole(...TTD_SURAT),
  async (req, res) => {
    let conn;

    try {
      const id = Number(req.params.id);
      const { sebagai, ttd, penanda_tangan_id } = req.body;

      if (!Number.isSafeInteger(id) || id <= 0) {
        return res.status(400).json({ error: "ID tiket tidak valid" });
      }

      if (!["foreman", "spv"].includes(sebagai)) {
        return res.status(400).json({
          error: "Jenis tanda tangan tidak valid",
        });
      }

      // 1. Validasi format, tipe data, dan panjang Base64.
      const prefixPng = "data:image/png;base64,";

      if (
        typeof ttd !== "string" ||
        ttd.length <= prefixPng.length ||
        ttd.length > 1000000 ||
        !/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(ttd)
      ) {
        return res.status(400).json({
          error: "Format tanda tangan harus berupa PNG Base64 yang valid",
        });
      }

      // 2. Decode Base64 dan periksa signature PNG.
      const base64Gambar = ttd.slice(prefixPng.length);
      const bufferGambar = Buffer.from(base64Gambar, "base64");

      const signaturePng = Buffer.from([
        0x89, 0x50, 0x4e, 0x47,
        0x0d, 0x0a, 0x1a, 0x0a,
      ]);

      if (
        bufferGambar.length < 8 ||
        !bufferGambar.subarray(0, 8).equals(signaturePng)
      ) {
        return res.status(400).json({
          error: "Data tanda tangan bukan gambar PNG yang valid",
        });
      }

      // 3. Mulai transaksi setelah validasi input selesai.
      conn = await db.getConnection();
      await conn.beginTransaction();

      // Ambil identitas aktual pengirim dari database.
      const [pengirimRows] = await conn.query(
        "SELECT id, nama, role, divisi FROM users WHERE id = ?",
        [req.user.id]
      );

      if (pengirimRows.length === 0) {
        const err = new Error("Pengguna tidak ditemukan");
        err.status = 403;
        throw err;
      }

      const pengirim = pengirimRows[0];
      const installerMode = pengirim.role === "installer_divisi";

      if (
        !installerMode &&
        !["foreman_divisi", "spv_divisi"].includes(pengirim.role)
      ) {
        const err = new Error("Role tidak diizinkan");
        err.status = 403;
        throw err;
      }

      // Pengguna langsung hanya boleh mengisi slot sesuai rolenya.
      if (
        !installerMode &&
        ((sebagai === "foreman" &&
          pengirim.role !== "foreman_divisi") ||
          (sebagai === "spv" && pengirim.role !== "spv_divisi"))
      ) {
        const err = new Error(
          "Role tidak sesuai dengan slot tanda tangan"
        );
        err.status = 403;
        throw err;
      }

      // Kunci tiket agar tanda tangan bersamaan tidak saling menimpa.
      const [tiketRows] = await conn.query(
        `SELECT
           t.id,
           t.status,
           t.ttd_foreman_oleh,
           t.ttd_spv_oleh,
           m.divisi
         FROM tiket_kerusakan t
         JOIN mesin m ON m.id = t.mesin_id
         WHERE t.id = ?
         FOR UPDATE`,
        [id]
      );

      if (tiketRows.length === 0) {
        const err = new Error("Tiket tidak ditemukan");
        err.status = 404;
        throw err;
      }

      const tiket = tiketRows[0];

      if (tiket.status !== "menunggu_ttd") {
        const err = new Error(
          "Tiket tidak sedang menunggu tanda tangan"
        );
        err.status = 409;
        throw err;
      }

      if (tiket.divisi !== pengirim.divisi) {
        const err = new Error("Tiket berada di divisi lain");
        err.status = 403;
        throw err;
      }

      // Tentukan penanda tangan berdasarkan mode.
      let penandaTangan;

      if (installerMode) {
        const signerId = Number(penanda_tangan_id);

        if (!Number.isSafeInteger(signerId) || signerId <= 0) {
          const err = new Error("Pilih penanda tangan yang valid");
          err.status = 400;
          throw err;
        }

        const [signerRows] = await conn.query(
          "SELECT id, nama, role, divisi FROM users WHERE id = ?",
          [signerId]
        );

        if (signerRows.length === 0) {
          const err = new Error("Penanda tangan tidak ditemukan");
          err.status = 400;
          throw err;
        }

        penandaTangan = signerRows[0];

        const roleYangDiharapkan =
          sebagai === "foreman" ? "foreman_divisi" : "spv_divisi";

        if (
          penandaTangan.role !== roleYangDiharapkan ||
          penandaTangan.divisi !== tiket.divisi
        ) {
          const err = new Error(
            "Penanda tangan harus memiliki role dan divisi yang sesuai"
          );
          err.status = 403;
          throw err;
        }
      } else {
        penandaTangan = pengirim;
      }

      // Jangan menimpa tanda tangan yang sudah tersimpan.
      const slotSudahTerisi =
        sebagai === "foreman"
          ? tiket.ttd_foreman_oleh !== null
          : tiket.ttd_spv_oleh !== null;

      if (slotSudahTerisi) {
        const err = new Error("Slot tanda tangan sudah terisi");
        err.status = 409;
        throw err;
      }

      // Simpan nama penanda tangan, waktu, gambar, dan identitas pengirim.
      if (sebagai === "foreman") {
        await conn.query(
          `UPDATE tiket_kerusakan
           SET ttd_foreman_oleh = ?,
               ttd_foreman_at = NOW(),
               ttd_foreman_ttd = ?,
               ttd_foreman_via = ?
           WHERE id = ?`,
          [
            penandaTangan.nama,
            ttd,
            installerMode ? pengirim.id : null,
            id,
          ]
        );
      } else {
        await conn.query(
          `UPDATE tiket_kerusakan
           SET ttd_spv_oleh = ?,
               ttd_spv_at = NOW(),
               ttd_spv_ttd = ?,
               ttd_spv_via = ?
           WHERE id = ?`,
          [
            penandaTangan.nama,
            ttd,
            installerMode ? pengirim.id : null,
            id,
          ]
        );
      }

      // Lanjutkan status hanya setelah kedua tanda tangan tersedia.
      const foremanSudah =
        sebagai === "foreman" || tiket.ttd_foreman_oleh !== null;

      const spvSudah =
        sebagai === "spv" || tiket.ttd_spv_oleh !== null;

      let status = "menunggu_ttd";

      if (foremanSudah && spvSudah) {
        await conn.query(
          `UPDATE tiket_kerusakan
           SET status = 'menunggu_assign_spv_mtnc'
           WHERE id = ?`,
          [id]
        );

        status = "menunggu_assign_spv_mtnc";
      }

      await conn.commit();

      return res.json({
        message: "Tanda tangan berhasil disimpan",
        id,
        sebagai,
        status,
      });
    } catch (err) {
      if (conn) {
        await conn.rollback().catch(() => {});
      }

      if (err.status) {
        return res.status(err.status).json({ error: err.message });
      }

      console.error("Gagal menyimpan tanda tangan:", err.message);

      return res.status(500).json({
        error: "Terjadi kesalahan server saat menyimpan tanda tangan",
      });
    } finally {
      if (conn) conn.release();
    }
  }
);

module.exports = router;
