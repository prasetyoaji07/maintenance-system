const express = require("express");
const db = require("../db");
const { verifyToken, requireRole } = require("../middleware/auth");
const { LAPORAN } = require("../middleware/roles");

const router = express.Router();

const BULAN_VALID = /^(\d{4})-(0[1-9]|1[0-2])$/;
const SELISIH_WIB_MS = 7 * 60 * 60 * 1000;
const PESAN_BULAN = "bulan harus berformat TTTT-BB, misalnya 2026-09";

function formatUtc(date) {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

// Awal bulan menurut WIB, dikembalikan sebagai Date UTC.
// bulan0 boleh 12 (artinya Januari tahun berikutnya).
function awalBulanUtc(tahun, bulan0) {
  return new Date(Date.UTC(tahun, bulan0, 1) - SELISIH_WIB_MS);
}

// Bulan ini menurut WIB, bentuk "TTTT-BB"
function bulanIniWIB() {
  return new Date(Date.now() + SELISIH_WIB_MS).toISOString().slice(0, 7);
}

function angkaAtauNull(n) {
  return n === null || n === undefined ? null : Number(n);
}

// GET /laporan/bulanan?bulan=2026-10 -> laporan satu bulan (menurut WIB):
// ringkasan, tiket yang selesai di bulan itu (kerusakan dan PM) beserta part
// yang dipakai, dan penambahan stok. Hanya role maintenance.
router.get("/bulanan", verifyToken, requireRole(...LAPORAN), async (req, res) => {
  const bulan = req.query.bulan === undefined ? bulanIniWIB() : String(req.query.bulan);
  const cocok = BULAN_VALID.exec(bulan);
  if (!cocok || Number(cocok[1]) < 2000) {
    return res.status(400).json({ error: PESAN_BULAN });
  }

  const tahun = Number(cocok[1]);
  const bulan0 = Number(cocok[2]) - 1;
  const awal = formatUtc(awalBulanUtc(tahun, bulan0));
  const akhir = formatUtc(awalBulanUtc(tahun, bulan0 + 1));

  try {
    const [tiketRows] = await db.query(
      `SELECT t.id, t.jenis_tiket, t.mesin_id, m.nama AS mesin_nama, t.keluhan, t.status,
              tk.nama AS teknisi, t.created_at, t.diproses_at, t.selesai_at,
              CASE WHEN t.jenis_tiket = 'pm' THEN NULL
                   ELSE TIMESTAMPDIFF(MINUTE, t.created_at, t.selesai_at) END AS downtime_menit,
              CASE WHEN t.diproses_at IS NULL THEN NULL
                   ELSE TIMESTAMPDIFF(MINUTE, t.diproses_at, t.selesai_at) END AS durasi_pengerjaan_menit
       FROM tiket_kerusakan t
       JOIN mesin m ON m.id = t.mesin_id
       LEFT JOIN users tk ON tk.id = t.teknisi_id
       WHERE t.status = 'selesai' AND t.selesai_at >= ? AND t.selesai_at < ?
       ORDER BY t.selesai_at, t.id`,
      [awal, akhir]
    );

    // Part yang benar-benar dipakai, dikelompokkan per tiket
    const perTiket = new Map();
    const ids = tiketRows.map((t) => t.id);
    if (ids.length > 0) {
      const [part] = await db.query(
        `SELECT tp.tiket_id, sp.nama AS part, tp.qty_dipakai, sp.satuan
         FROM tiket_part tp
         JOIN spare_parts sp ON sp.id = tp.part_id
         WHERE tp.status = 'dipakai' AND tp.tiket_id IN (?)
         ORDER BY tp.id`,
        [ids]
      );
      for (const p of part) {
        if (!perTiket.has(p.tiket_id)) perTiket.set(p.tiket_id, []);
        perTiket.get(p.tiket_id).push({
          part: p.part,
          qty_dipakai: Number(p.qty_dipakai),
          satuan: p.satuan,
        });
      }
    }

    const tiket = tiketRows.map((t) => ({
      ...t,
      downtime_menit: angkaAtauNull(t.downtime_menit),
      durasi_pengerjaan_menit: angkaAtauNull(t.durasi_pengerjaan_menit),
      parts: perTiket.get(t.id) || [],
    }));

    const [stokRows] = await db.query(
      `SELECT r.id, sp.part_number, sp.nama AS part, sp.satuan,
              r.qty_tambah, r.stok_sebelum, r.stok_sesudah, r.created_at,
              u.nama AS supervisor
       FROM riwayat_stok r
       JOIN spare_parts sp ON sp.id = r.part_id
       JOIN users u ON u.id = r.supervisor_id
       WHERE r.created_at >= ? AND r.created_at < ?
       ORDER BY r.created_at, r.id`,
      [awal, akhir]
    );

    // Ringkasan: downtime dan MTTR hanya dari tiket kerusakan (keputusan PM)
    const kerusakan = tiket.filter((t) => t.jenis_tiket === "kerusakan");
    const totalDowntime = kerusakan.reduce((s, t) => s + (t.downtime_menit || 0), 0);
    const denganMttr = kerusakan.filter((t) => t.durasi_pengerjaan_menit !== null);
    const mttr =
      denganMttr.length > 0
        ? denganMttr.reduce((s, t) => s + t.durasi_pengerjaan_menit, 0) / denganMttr.length
        : 0;

    res.json({
      bulan,
      ringkasan: {
        jumlah_tiket_kerusakan: kerusakan.length,
        jumlah_tiket_pm: tiket.length - kerusakan.length,
        total_downtime_menit: totalDowntime,
        mttr_menit: mttr,
        jumlah_penambahan_stok: stokRows.length,
      },
      tiket,
      penambahan_stok: stokRows.map((r) => ({
        ...r,
        qty_tambah: Number(r.qty_tambah),
        stok_sebelum: Number(r.stok_sebelum),
        stok_sesudah: Number(r.stok_sesudah),
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Gagal mengambil laporan bulanan" });
  }
});

module.exports = router;