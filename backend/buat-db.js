const mysql = require("mysql2/promise");
require("dotenv").config();

(async () => {
  let conn;
  try {
    conn = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      ssl: { minVersion: "TLSv1.2", rejectUnauthorized: true },
    });
    await conn.query("CREATE DATABASE IF NOT EXISTS `maintenance`");
    const [rows] = await conn.query("SHOW DATABASES");
    console.log(rows.map((r) => Object.values(r)[0]).join(", "));
  } catch (err) {
    console.error("Gagal:", err.message);
  }
  if (conn) await conn.end();
  process.exit();
})();