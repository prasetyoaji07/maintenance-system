const express = require("express");
const db = require("../db");
const { verifyToken, requireRole } = require("../middleware/auth");

const router = express.Router();
router.use(verifyToken);

const SELISIH_WIB_MS = 7 * 60 * 60 * 1000;
const INTERVAL_MAKS = 3650;

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

// Tanggal "YYYY-MM-DD" yang benar-benar ada di kalender, atau null
function tanggal(nilai) {
  const s = String(nilai ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(s + "T00:00:00Z");
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s ? null : s;
}

// Hari ini menurut WIB sebagai "YYYY-MM-DD" (database UTC, jadi tidak memakai CURDATE())
function hariIniWib() {
  return new Date(Date.now() + SELISIH_WIB_MS).toISOString().slice(0, 10);
}

const SELECT_JADWAL = `
  SELECT j.id, j.mesin_id, m.nama AS mesin_nama, j.nama_tugas, j.interval_hari,
         DATE_FORMAT(j.jatuh_tempo_berikutnya, '%Y-%m-%d') AS jatuh_tempo_berikutnya,
         j.aktif, j.dibuat_oleh, u.nama AS dibuat_oleh_nama, j.created_at
  FROM pm_jadwal j
  JOIN mesin m ON m.id = j.mesin_id
  JOIN users u ON u.id = j.dibuat_oleh`;

function bentuk(r, hariIni) {
  const aktif = Boolean(r.aktif);
  return {
    ...r,
    aktif,
    terlambat: aktif && r.jatuh_tempo_berikutnya < hariIni,
  };
}

// Membaca satu jadwal; melempar 404 kalau tidak ada
async function ambilJadwal(id) {
  const [rows] = await db.query(`${SELECT_JADWAL} WHERE j.id = ?`, [id]);
  if (rows.length === 0) throw tolak(404, "Jadwal PM tidak ditemukan");
  return bentuk(rows[0], hariIniWib());
}

function kirimError(res, err) {
  if (!err.status) console.error(err);
  res.status(err.status || 500).json({
    error: err.status ? err.message : "Terjadi kesalahan server",
  });
}

// GET /pm -> daftar jadwal PM (teknisi dan supervisor, hanya baca)
router.get("/", requireRole("teknisi", "supervisor"), async (req, res) => {
  try {
    const [rows] = await db.query(
      `${SELECT_JADWAL} ORDER BY j.aktif DESC, j.jatuh_tempo_berikutnya, j.id`
    );
    const hariIni = hariIniWib();
    res.json(rows.map((r) => bentuk(r, hariIni)));
  } catch (err) {
    kirimError(res, err);
  }
});

// POST /pm -> supervisor membuat jadwal
// Body: { "mesin_id": 1, "nama_tugas": "Ganti oli", "interval_hari": 90, "jatuh_tempo_berikutnya": "2026-11-01" }
router.post("/", requireRole("supervisor"), async (req, res) => {
  try {
    const mesinId = angka(req.body?.mesin_id);
    const nama = String(req.body?.nama_tugas ?? "").trim();
    const interval = angka(req.body?.interval_hari);
    const jatuhTempo = tanggal(req.body?.jatuh_tempo_berikutnya);

    if (!mesinId) throw tolak(400, "mesin_id wajib berupa angka lebih dari 0");
    if (!nama || nama.length > 150) throw tolak(400, "nama_tugas wajib diisi, maksimal 150 karakter");
    if (!interval || interval > INTERVAL_MAKS) {
      throw tolak(400, `interval_hari harus bilangan bulat 1 sampai ${INTERVAL_MAKS}`);
    }
    if (!jatuhTempo) throw tolak(400, "jatuh_tempo_berikutnya harus tanggal valid berformat YYYY-MM-DD");

    const [mesin] = await db.query("SELECT id FROM mesin WHERE id = ?", [mesinId]);
    if (mesin.length === 0) throw tolak(404, "Mesin tidak ditemukan");

    // dibuat_oleh selalu dari token, dan harus supervisor yang benar-benar ada di database
    const [user] = await db.query("SELECT role FROM users WHERE id = ?", [req.user.id]);
    if (user.length === 0 || user[0].role !== "supervisor") {
      throw tolak(403, "Hanya supervisor yang boleh membuat jadwal PM");
    }

    const [hasil] = await db.query(
      `INSERT INTO pm_jadwal (mesin_id, nama_tugas, interval_hari, jatuh_tempo_berikutnya, dibuat_oleh)
       VALUES (?, ?, ?, ?, ?)`,
      [mesinId, nama, interval, jatuhTempo, req.user.id]
    );
    res.status(201).json(await ambilJadwal(hasil.insertId));
  } catch (err) {
    kirimError(res, err);
  }
});

// PATCH /pm/:id -> supervisor mengubah jadwal (tanpa DELETE; nonaktifkan lewat aktif = false)
// Body (boleh sebagian): { "nama_tugas", "interval_hari", "jatuh_tempo_berikutnya", "aktif" }
router.patch("/:id", requireRole("supervisor"), async (req, res) => {
  try {
    const id = angka(req.params.id);
    if (!id) throw tolak(400, "id jadwal tidak valid");

    const b = req.body || {};
    const set = [];
    const nilai = [];

    if (b.nama_tugas !== undefined) {
      const nama = String(b.nama_tugas).trim();
      if (!nama || nama.length > 150) throw tolak(400, "nama_tugas wajib diisi, maksimal 150 karakter");
      set.push("nama_tugas = ?"); nilai.push(nama);
    }
    if (b.interval_hari !== undefined) {
      const interval = angka(b.interval_hari);
      if (!interval || interval > INTERVAL_MAKS) {
        throw tolak(400, `interval_hari harus bilangan bulat 1 sampai ${INTERVAL_MAKS}`);
      }
      set.push("interval_hari = ?"); nilai.push(interval);
    }
    if (b.jatuh_tempo_berikutnya !== undefined) {
      const t = tanggal(b.jatuh_tempo_berikutnya);
      if (!t) throw tolak(400, "jatuh_tempo_berikutnya harus tanggal valid berformat YYYY-MM-DD");
      set.push("jatuh_tempo_berikutnya = ?"); nilai.push(t);
    }
    if (b.aktif !== undefined) {
      if (typeof b.aktif !== "boolean" && b.aktif !== 0 && b.aktif !== 1) {
        throw tolak(400, "aktif harus true atau false");
      }
      set.push("aktif = ?"); nilai.push(b.aktif ? 1 : 0);
    }
    if (set.length === 0) throw tolak(400, "Tidak ada field yang diubah");

    await ambilJadwal(id); // 404 kalau tidak ada
    await db.query(`UPDATE pm_jadwal SET ${set.join(", ")} WHERE id = ?`, [...nilai, id]);
    res.json(await ambilJadwal(id));
  } catch (err) {
    kirimError(res, err);
  }
});

module.exports = router;