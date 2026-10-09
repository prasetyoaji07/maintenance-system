const express = require("express");
const db = require("../db");

const router = express.Router();

// GET /spare-parts -> daftar spare part beserta stok dan minimum stok
router.get("/", async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT id, nama, stok, satuan, minimum_stok FROM spare_parts ORDER BY id"
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;