const express = require("express");
const db = require("../db");

const router = express.Router();

// ---------- Fungsi bantu ----------

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

// Menjalankan pekerjaan dalam satu transaksi (rollback otomatis kalau gagal)
async function transaksi(res, kerja, kodeSukses = 200) {
  let conn;
  try {
    conn = await db.getConnection();
    await conn.beginTransaction();
    const hasil = await kerja(conn);
    await conn.commit();
    res.status(kodeSukses).json(hasil);
  } catch (err) {
    if (conn) await conn.rollback().catch(() => {});
    res.status(err.status || 500).json({ error: err.message });
  } finally {
    if (conn) conn.release();
  }
}

// Mengunci baris tiket supaya dua aksi bersamaan tidak saling menimpa
async function kunciTiket(conn, id) {
  const [rows] = await conn.query(
    "SELECT id, mesin_id, teknisi_id, status FROM tiket_kerusakan WHERE id = ? FOR UPDATE",
    [id]
  );
  if (rows.length === 0) throw tolak(404, "Tiket tidak ditemukan");
  return rows[0];
}

// Memastikan user ada dan berperan sesuai
async function pastikanRole(conn, userId, role, namaField) {
  const [rows] = await conn.query("SELECT role FROM users WHERE id = ?", [userId]);
  if (rows.length === 0 || rows[0].role !== role) {
    throw tolak(400, `${namaField} harus milik user dengan role ${role}`);
  }
}

// ---------- Lapor kerusakan dan daftar tiket ----------

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

// GET /tiket/:id -> satu tiket lengkap dengan daftar part-nya
router.get("/:id", async (req, res) => {
  const id = angka(req.params.id);
  if (!id) return res.status(400).json({ error: "id tiket tidak valid" });

  try {
    const [tiket] = await db.query(
      `SELECT t.id, t.mesin_id, m.nama AS mesin, t.keluhan, t.status,
              t.operator_id, u.nama AS operator,
              t.teknisi_id, tk.nama AS teknisi,
              t.created_at, t.diproses_at, t.selesai_at
       FROM tiket_kerusakan t
       JOIN mesin m ON m.id = t.mesin_id
       JOIN users u ON u.id = t.operator_id
       LEFT JOIN users tk ON tk.id = t.teknisi_id
       WHERE t.id = ?`,
      [id]
    );
    if (tiket.length === 0) return res.status(404).json({ error: "Tiket tidak ditemukan" });

    const [parts] = await db.query(
      `SELECT tp.id, tp.part_id, sp.nama AS part, tp.qty_dipakai, tp.status
       FROM tiket_part tp
       JOIN spare_parts sp ON sp.id = tp.part_id
       WHERE tp.tiket_id = ?
       ORDER BY tp.id`,
      [id]
    );

    res.json({ ...tiket[0], parts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------- Alur status tiket ----------

// PATCH /tiket/:id/terima -> teknisi menerima tiket (pending -> diproses)
// Body: { "teknisi_id": 2 }
router.patch("/:id/terima", (req, res) => {
  const id = angka(req.params.id);
  const teknisiId = angka(req.body?.teknisi_id);
  if (!id || !teknisiId) {
    return res.status(400).json({ error: "id tiket dan teknisi_id wajib berupa angka" });
  }

  transaksi(res, async (conn) => {
    const tiket = await kunciTiket(conn, id);
    await pastikanRole(conn, teknisiId, "teknisi", "teknisi_id");
    if (tiket.status !== "pending") {
      throw tolak(409, `Tiket berstatus ${tiket.status}, hanya tiket pending yang bisa diterima`);
    }

    await conn.query(
      "UPDATE tiket_kerusakan SET status = 'diproses', teknisi_id = ?, diproses_at = NOW() WHERE id = ?",
      [teknisiId, id]
    );
    await conn.query("UPDATE mesin SET status = 'maintenance' WHERE id = ?", [tiket.mesin_id]);

    return { id, status: "diproses", teknisi_id: teknisiId };
  });
});

// POST /tiket/:id/part -> teknisi memakai spare part
// Body: { "teknisi_id": 2, "part_id": 1, "qty": 2 }
// Stok cukup: stok berkurang, tiket tetap diproses.
// Stok kurang: stok tidak berubah, permintaan dicatat, tiket jadi menunggu_approval.
router.post("/:id/part", (req, res) => {
  const id = angka(req.params.id);
  const teknisiId = angka(req.body?.teknisi_id);
  const partId = angka(req.body?.part_id);
  const qty = angka(req.body?.qty);
  if (!id || !teknisiId || !partId || !qty) {
    return res.status(400).json({ error: "teknisi_id, part_id, dan qty wajib berupa angka lebih dari 0" });
  }

  transaksi(
    res,
    async (conn) => {
      const tiket = await kunciTiket(conn, id);
      await pastikanRole(conn, teknisiId, "teknisi", "teknisi_id");
      if (tiket.status !== "diproses") {
        throw tolak(409, `Tiket berstatus ${tiket.status}, part hanya bisa dipakai pada tiket diproses`);
      }
      if (tiket.teknisi_id !== teknisiId) {
        throw tolak(403, "Tiket ini ditangani teknisi lain");
      }

      const [part] = await conn.query(
        "SELECT id, nama, stok FROM spare_parts WHERE id = ? FOR UPDATE",
        [partId]
      );
      if (part.length === 0) throw tolak(400, "Spare part tidak ditemukan");

      if (part[0].stok >= qty) {
        await conn.query("UPDATE spare_parts SET stok = stok - ? WHERE id = ?", [qty, partId]);
        await conn.query(
          "INSERT INTO tiket_part (tiket_id, part_id, qty_dipakai, status) VALUES (?, ?, ?, 'dipakai')",
          [id, partId, qty]
        );
        return {
          tiket_id: id,
          part: part[0].nama,
          qty,
          status_part: "dipakai",
          status_tiket: "diproses",
          stok_sisa: part[0].stok - qty,
        };
      }

      await conn.query(
        "INSERT INTO tiket_part (tiket_id, part_id, qty_dipakai, status) VALUES (?, ?, ?, 'menunggu_approval')",
        [id, partId, qty]
      );
      await conn.query("UPDATE tiket_kerusakan SET status = 'menunggu_approval' WHERE id = ?", [id]);
      return {
        tiket_id: id,
        part: part[0].nama,
        qty,
        status_part: "menunggu_approval",
        status_tiket: "menunggu_approval",
        stok_tersedia: part[0].stok,
      };
    },
    201
  );
});

// PATCH /tiket/:id/setujui -> supervisor menyetujui pembelian part
// Body: { "supervisor_id": 3 }
router.patch("/:id/setujui", (req, res) => {
  const id = angka(req.params.id);
  const supervisorId = angka(req.body?.supervisor_id);
  if (!id || !supervisorId) {
    return res.status(400).json({ error: "id tiket dan supervisor_id wajib berupa angka" });
  }

  transaksi(res, async (conn) => {
    const tiket = await kunciTiket(conn, id);
    await pastikanRole(conn, supervisorId, "supervisor", "supervisor_id");
    if (tiket.status !== "menunggu_approval") {
      throw tolak(409, `Tiket berstatus ${tiket.status}, tidak ada yang perlu disetujui`);
    }

    const [hasil] = await conn.query(
      "UPDATE tiket_part SET status = 'disetujui' WHERE tiket_id = ? AND status = 'menunggu_approval'",
      [id]
    );
    if (hasil.affectedRows === 0) {
      throw tolak(409, "Tidak ada permintaan part yang menunggu persetujuan");
    }

    return { id, status: "menunggu_approval", part_disetujui: hasil.affectedRows };
  });
});

// PATCH /tiket/:id/lanjut -> teknisi melanjutkan setelah stok ditambah
// Body: { "teknisi_id": 2 }
router.patch("/:id/lanjut", (req, res) => {
  const id = angka(req.params.id);
  const teknisiId = angka(req.body?.teknisi_id);
  if (!id || !teknisiId) {
    return res.status(400).json({ error: "id tiket dan teknisi_id wajib berupa angka" });
  }

  transaksi(res, async (conn) => {
    const tiket = await kunciTiket(conn, id);
    await pastikanRole(conn, teknisiId, "teknisi", "teknisi_id");
    if (tiket.status !== "menunggu_approval") {
      throw tolak(409, `Tiket berstatus ${tiket.status}, hanya tiket menunggu_approval yang bisa dilanjutkan`);
    }
    if (tiket.teknisi_id !== teknisiId) {
      throw tolak(403, "Tiket ini ditangani teknisi lain");
    }

    const [antrean] = await conn.query(
      "SELECT part_id, qty_dipakai, status FROM tiket_part WHERE tiket_id = ? AND status <> 'dipakai'",
      [id]
    );
    if (antrean.some((r) => r.status === "menunggu_approval")) {
      throw tolak(409, "Permintaan part belum disetujui supervisor");
    }
    if (antrean.length === 0) {
      throw tolak(409, "Tidak ada part yang menunggu untuk dipakai");
    }

    // Total kebutuhan per part (satu part bisa diminta lebih dari sekali)
    const total = new Map();
    for (const r of antrean) {
      total.set(r.part_id, (total.get(r.part_id) || 0) + r.qty_dipakai);
    }

    // Urutkan id supaya penguncian baris selalu searah
    const urut = [...total.keys()].sort((a, b) => a - b);
    for (const partId of urut) {
      const butuh = total.get(partId);
      const [part] = await conn.query(
        "SELECT nama, stok FROM spare_parts WHERE id = ? FOR UPDATE",
        [partId]
      );
      if (part[0].stok < butuh) {
        throw tolak(409, `Stok ${part[0].nama} belum cukup (stok ${part[0].stok}, butuh ${butuh})`);
      }
      await conn.query("UPDATE spare_parts SET stok = stok - ? WHERE id = ?", [butuh, partId]);
    }

    await conn.query(
      "UPDATE tiket_part SET status = 'dipakai' WHERE tiket_id = ? AND status = 'disetujui'",
      [id]
    );
    await conn.query("UPDATE tiket_kerusakan SET status = 'diproses' WHERE id = ?", [id]);

    return { id, status: "diproses" };
  });
});

// PATCH /tiket/:id/selesai -> teknisi menyelesaikan perbaikan (diproses -> selesai)
// Body: { "teknisi_id": 2 }
router.patch("/:id/selesai", (req, res) => {
  const id = angka(req.params.id);
  const teknisiId = angka(req.body?.teknisi_id);
  if (!id || !teknisiId) {
    return res.status(400).json({ error: "id tiket dan teknisi_id wajib berupa angka" });
  }

  transaksi(res, async (conn) => {
    const tiket = await kunciTiket(conn, id);
    await pastikanRole(conn, teknisiId, "teknisi", "teknisi_id");
    if (tiket.status !== "diproses") {
      throw tolak(409, `Tiket berstatus ${tiket.status}, hanya tiket diproses yang bisa diselesaikan`);
    }
    if (tiket.teknisi_id !== teknisiId) {
      throw tolak(403, "Tiket ini ditangani teknisi lain");
    }

    await conn.query(
      "UPDATE tiket_kerusakan SET status = 'selesai', selesai_at = NOW() WHERE id = ?",
      [id]
    );
    await conn.query("UPDATE mesin SET status = 'jalan' WHERE id = ?", [tiket.mesin_id]);

    return { id, status: "selesai" };
  });
});

module.exports = router;