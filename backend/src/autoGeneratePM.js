const db = require("./db");

const INTERVAL_MS = 60 * 60 * 1000; // 1 jam

// Tanggal hari ini menurut WIB (UTC+7), bentuk "YYYY-MM-DD".
// Dihitung di JavaScript karena koneksi database memakai UTC.
function hariIniWIB() {
  return new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

// Membuat tiket PM untuk jadwal aktif yang sudah jatuh tempo
// dan belum punya tiket PM terbuka. Fungsi ini tidak pernah melempar error.
async function generatePM() {
  let conn;
  let dibuat = 0;
  try {
    const hariIni = hariIniWIB();
    conn = await db.getConnection();

    const [jadwal] = await conn.query(
      `SELECT j.id, j.mesin_id, j.nama_tugas, j.dibuat_oleh, m.nama AS mesin_nama
       FROM pm_jadwal j
       JOIN mesin m ON m.id = j.mesin_id
       WHERE j.aktif = 1 AND j.jatuh_tempo_berikutnya <= ?
       ORDER BY j.id`,
      [hariIni]
    );

    for (const j of jadwal) {
      try {
        await conn.beginTransaction();

        // Kunci baris jadwal, lalu baca ulang tanggalnya sebagai teks
        const [kunci] = await conn.query(
          `SELECT DATE_FORMAT(jatuh_tempo_berikutnya, '%Y-%m-%d') AS jatuh_tempo
           FROM pm_jadwal
           WHERE id = ? AND aktif = 1 AND jatuh_tempo_berikutnya <= ?
           FOR UPDATE`,
          [j.id, hariIni]
        );
        if (kunci.length === 0) {
          await conn.rollback();
          continue;
        }

        const [terbuka] = await conn.query(
          `SELECT id FROM tiket_kerusakan
           WHERE pm_jadwal_id = ? AND jenis_tiket = 'pm' AND status <> 'selesai'
           LIMIT 1`,
          [j.id]
        );
        if (terbuka.length > 0) {
          await conn.rollback();
          continue;
        }

        await conn.query(
          `INSERT INTO tiket_kerusakan
             (mesin_id, operator_id, keluhan, jenis_tiket, pm_jadwal_id, jatuh_tempo)
           VALUES (?, ?, ?, 'pm', ?, ?)`,
          [j.mesin_id, j.dibuat_oleh, `[PM] ${j.nama_tugas} - ${j.mesin_nama}`, j.id, kunci[0].jatuh_tempo]
        );
        await conn.commit();
        dibuat++;
      } catch (err) {
        await conn.rollback().catch(() => {});
        // ER_DUP_ENTRY = tiket untuk jadwal dan tanggal ini sudah ada, aman dilewati
        if (err.code !== "ER_DUP_ENTRY") {
          console.error(`[PM] Gagal membuat tiket untuk jadwal ${j.id}:`, err.message);
        }
      }
    }

    if (dibuat > 0) console.log(`[PM] ${dibuat} tiket PM dibuat`);
  } catch (err) {
    console.error("[PM] Gagal menjalankan job:", err.message);
  } finally {
    if (conn) conn.release();
  }
  return dibuat;
}

// Mencegah dua putaran berjalan bersamaan
let sedangJalan = false;
async function putaran() {
  if (sedangJalan) return;
  sedangJalan = true;
  try {
    await generatePM();
  } finally {
    sedangJalan = false;
  }
}

// Jalan sekali saat backend start, lalu tiap 1 jam
function jalankanAutoGeneratePM() {
  putaran();
  setInterval(putaran, INTERVAL_MS);
}

module.exports = { jalankanAutoGeneratePM, generatePM };