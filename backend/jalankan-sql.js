const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");
require("dotenv").config();

(async () => {
  const nama = process.argv[2];
  if (!nama) {
    console.error("Pakai: node jalankan-sql.js schema.sql");
    process.exit(1);
  }
  let conn;
  try {
    const sql = fs.readFileSync(path.join(__dirname, "..", "database", nama), "utf8");
    conn = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,
      ssl: { minVersion: "TLSv1.2", rejectUnauthorized: true },
      multipleStatements: true,
    });
    await conn.query(sql);
    const [t] = await conn.query("SHOW TABLES");
    console.log("Tabel:", t.map((r) => Object.values(r)[0]).join(", "));
  } catch (err) {
    console.error("Gagal:", err.message);
  }
  if (conn) await conn.end();
  process.exit();
})();