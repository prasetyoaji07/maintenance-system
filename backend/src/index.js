const express = require("express");
const cors = require("cors");
require("dotenv").config();

const mesinRouter = require("./routes/mesin");
const dashboardRouter = require("./routes/dashboard");

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Server Maintenance jalan!");
});

app.use("/mesin", mesinRouter);
app.use("/dashboard", dashboardRouter);

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);
});