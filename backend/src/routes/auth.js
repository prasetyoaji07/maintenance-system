const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const db = require("../db");

const router = express.Router();

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: "Email dan password wajib diisi" });
    }

    const [rows] = await db.query(
      "SELECT id, nama, role, password_hash FROM users WHERE email = ?",
      [email]
    );
    const user = rows[0];
    const cocok = user && user.password_hash
      ? await bcrypt.compare(password, user.password_hash)
      : false;

    if (!cocok) {
      return res.status(401).json({ error: "Email atau password salah" });
    }

    const payload = { id: user.id, nama: user.nama, role: user.role };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "8h" });
    res.json({ token, user: payload });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Terjadi kesalahan server" });
  }
});

module.exports = router;