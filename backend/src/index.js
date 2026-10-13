const express = require("express");
const cors = require("cors");
require("dotenv").config();

const mesinRouter = require("./routes/mesin");
const usersRouter = require("./routes/users");
const sparePartsRouter = require("./routes/spareParts");
const tiketRouter = require("./routes/tiket");
const suratRouter = require("./routes/surat");
const dashboardRouter = require("./routes/dashboard");
const prediksiRouter = require("./routes/prediksi");
const pmRouter = require("./routes/pm");
const laporanRouter = require("./routes/laporan");
const { jalankanAutoGeneratePM } = require("./autoGeneratePM");
const alurDivisiRouter = require("./routes/alurDivisi");
const penugasanMaintenanceRouter = require("./routes/penugasanMaintenance");

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use("/auth", require("./routes/auth"));

app.get("/", (req, res) => {
  res.send("Server Maintenance jalan!");
});

app.use("/mesin", mesinRouter);
app.use("/users", usersRouter);
app.use("/spare-parts", sparePartsRouter);
// surat.js harus sebelum tiket.js: router.get("/:id") di tiket.js menangkap semua GET /tiket/xxx
app.use("/penugasan-maintenance", penugasanMaintenanceRouter);
app.use("/tiket", alurDivisiRouter);
app.use("/tiket", suratRouter);
app.use("/tiket", tiketRouter);
app.use("/dashboard", dashboardRouter);
app.use("/prediksi", prediksiRouter);
app.use("/pm", pmRouter);
app.use("/laporan", laporanRouter);

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);
  jalankanAutoGeneratePM();
});