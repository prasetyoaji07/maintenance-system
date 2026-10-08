const express = require("express");
const db = require("../db");

const router = express.Router();

// GET /users -> daftar user untuk dropdown (hanya id, nama, role)
router.get("/", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT id, nama, role FROM users ORDER BY id");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;