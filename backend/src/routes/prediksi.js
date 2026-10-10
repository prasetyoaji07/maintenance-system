const express = require("express");
const pool = require("../db");
const { verifyToken } = require("../middleware/auth");

const router = express.Router();

const SELISIH_WIB_MS = 7 * 60 * 60 * 1000;
const JENDELA_VALID = [3, 6, 12];
const MIN_BULAN_RIWAYAT = 4;

// Kunci bulan "TTTT-BB". bulan0 boleh di luar 0-11 (dinormalkan oleh Date).
function kunciBulan(tahun, bulan0) {
  const d = new Date(Date.UTC(tahun, bulan0, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

// Bulan berjalan menurut WIB
function bulanBerjalanWib() {
  const w = new Date(Date.now() + SELISIH_WIB_MS);
  return { tahun: w.getUTCFullYear(), bulan0: w.getUTCMonth() };
}

// Daftar kunci bulan dari awal sampai akhir (keduanya inklusif), format "TTTT-BB"
function daftarBulan(awal, akhir) {
  const hasil = [];
  let [t, b] = awal.split("-").map(Number);
  let kunci = kunciBulan(t, b - 1);
  while (kunci <= akhir) {
    hasil.push(kunci);
    b += 1;
    kunci = kunciBulan(t, b - 1);
  }
  return hasil;
}

// WMA: rata-rata berbobot dari k nilai sebelum indeks "akhir"; bobot 1..k,
// nilai terbaru berbobot paling besar.
function wma(seri, akhir, k) {
  let jumlah = 0;
  let bobotTotal = 0;
  for (let i = 0; i < k; i++) {
    const bobot = i + 1;
    jumlah += bobot * seri[akhir - k + i];
    bobotTotal += bobot;
  }
  return jumlah / bobotTotal;
}

// Backtest satu jendela terhadap semua seri. WAPE = total |galat| / total aktual.
function backtest(semuaSeri, k) {
  let galat = 0;
  let aktual = 0;
  let uji = 0;
  for (const seri of semuaSeri) {
    for (let i = k; i < seri.length; i++) {
      galat += Math.abs(seri[i] - wma(seri, i, k));
      aktual += seri[i];
      uji += 1;
    }
  }
  return { jendela: k, wape: aktual > 0 ? galat / aktual : null, jumlah_uji: uji };
}

const bulat1 = (n) => Math.round(n * 10) / 10;

// GET /prediksi/part?jendela=3|6|12
// Prakiraan kebutuhan spare part untuk bulan berjalan (WMA), dibandingkan dengan
// stok dan minimum_stok. Tanpa ?jendela, jendela terbaik dipilih lewat backtest.
router.get("/part", verifyToken, async (req, res) => {
  let dipaksa = null;
  if (req.query.jendela !== undefined) {
    dipaksa = Number(req.query.jendela);
    if (!JENDELA_VALID.includes(dipaksa)) {
      return res.status(400).json({ error: "jendela harus salah satu dari: 3, 6, 12" });
    }
  }

  try {
    const [parts] = await pool.query(
      `SELECT id, part_number, nama, kategori, satuan, stok, minimum_stok
       FROM spare_parts ORDER BY part_number`
    );
    const [pakai] = await pool.query(
      `SELECT
         tp.part_id,
         DATE_FORMAT(DATE_ADD(t.created_at, INTERVAL 7 HOUR), '%Y-%m') AS bulan,
         SUM(tp.qty_dipakai) AS total
       FROM tiket_part tp
       JOIN tiket_kerusakan t ON t.id = tp.tiket_id
       WHERE tp.status = 'dipakai'
       GROUP BY tp.part_id, DATE_FORMAT(DATE_ADD(t.created_at, INTERVAL 7 HOUR), '%Y-%m')`
    );

    const { tahun, bulan0 } = bulanBerjalanWib();
    const bulanTarget = kunciBulan(tahun, bulan0);
    const bulanTerakhir = kunciBulan(tahun, bulan0 - 1); // bulan lengkap terakhir

    const bulanAda = pakai.map((r) => r.bulan).filter((b) => b <= bulanTerakhir).sort();
    if (bulanAda.length === 0) {
      return res.json({
        bulan_target: bulanTarget,
        jumlah_bulan_riwayat: 0,
        jendela_terbaik: null,
        jendela_dipakai: null,
        backtest: [],
        prakiraan: [],
        pesan: "Belum ada riwayat pemakaian part yang cukup untuk prakiraan",
      });
    }

    const bulanList = daftarBulan(bulanAda[0], bulanTerakhir);
    const n = bulanList.length;

    // Seri bulanan per part (bulan tanpa pemakaian = 0)
    const seriPerPart = new Map(parts.map((p) => [p.id, new Array(n).fill(0)]));
    for (const r of pakai) {
      const idx = bulanList.indexOf(r.bulan);
      if (idx === -1 || !seriPerPart.has(r.part_id)) continue;
      seriPerPart.get(r.part_id)[idx] += Number(r.total);
    }
    const semuaSeri = [...seriPerPart.values()];

    const hasilBacktest = JENDELA_VALID.filter((k) => n >= k + 1).map((k) =>
      backtest(semuaSeri, k)
    );

    if (n < MIN_BULAN_RIWAYAT || hasilBacktest.length === 0) {
      return res.json({
        bulan_target: bulanTarget,
        bulan_riwayat_awal: bulanList[0],
        bulan_riwayat_akhir: bulanTerakhir,
        jumlah_bulan_riwayat: n,
        jendela_terbaik: null,
        jendela_dipakai: null,
        backtest: [],
        prakiraan: [],
        pesan: `Riwayat baru ${n} bulan, minimal ${MIN_BULAN_RIWAYAT} bulan untuk prakiraan`,
      });
    }

    const kandidat = hasilBacktest.filter((b) => b.wape !== null);
    const terbaik = kandidat.length
      ? kandidat.reduce((a, b) => (b.wape < a.wape ? b : a)).jendela
      : hasilBacktest[0].jendela;

    const dipakai = dipaksa ?? terbaik;
    if (n < dipakai) {
      return res.status(409).json({
        error: `Riwayat baru ${n} bulan, belum cukup untuk jendela ${dipakai} bulan`,
      });
    }

    const prakiraan = parts.map((p) => {
      const seri = seriPerPart.get(p.id);
      const nilai = wma(seri, n, dipakai);
      const bulat = Math.ceil(nilai);
      const butuh = Math.max(0, bulat + p.minimum_stok - p.stok);
      let status = "aman";
      if (p.stok < bulat) status = "kurang";
      else if (p.stok - bulat < p.minimum_stok) status = "menipis";
      return {
        part_id: p.id,
        part_number: p.part_number,
        nama: p.nama,
        kategori: p.kategori,
        satuan: p.satuan,
        stok: p.stok,
        minimum_stok: p.minimum_stok,
        prakiraan_qty: bulat1(nilai),
        kebutuhan_tambahan: butuh,
        status,
      };
    });
    prakiraan.sort(
      (a, b) =>
        b.kebutuhan_tambahan - a.kebutuhan_tambahan ||
        a.part_number.localeCompare(b.part_number)
    );

    res.json({
      bulan_target: bulanTarget,
      bulan_riwayat_awal: bulanList[0],
      bulan_riwayat_akhir: bulanTerakhir,
      jumlah_bulan_riwayat: n,
      jendela_terbaik: terbaik,
      jendela_dipakai: dipakai,
      backtest: hasilBacktest.map((b) => ({
        jendela: b.jendela,
        wape: b.wape === null ? null : Math.round(b.wape * 1000) / 1000,
        jumlah_uji: b.jumlah_uji,
      })),
      prakiraan,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Gagal menghitung prakiraan kebutuhan part" });
  }
});

module.exports = router;