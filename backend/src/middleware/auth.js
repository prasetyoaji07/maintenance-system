const jwt = require("jsonwebtoken");

function verifyToken(req, res, next) {
  const header = req.headers.authorization || "";
  const [tipe, token] = header.split(" ");
  if (tipe !== "Bearer" || !token) {
    return res.status(401).json({ error: "Token tidak ada" });
  }
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (e) {
    return res.status(401).json({ error: "Token tidak valid atau kedaluwarsa" });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Belum login" });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Role tidak diizinkan" });
    }
    next();
  };
}

module.exports = { verifyToken, requireRole };