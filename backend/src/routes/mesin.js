const express = require("express");
const db = require("../db");

const router = express.Router();

// GET /mesin -> semua mesin
router.get("/", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT id, nama, lokasi, status FROM mesin ORDER BY id");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;