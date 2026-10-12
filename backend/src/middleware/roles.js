// Kelompok role untuk requireRole(...). Satu tempat, supaya nambah role
// baru nanti tidak perlu mengubah banyak file.

const LAPOR_KERUSAKAN = ["operator", "leader_divisi"];
const TEKNISI = ["teknisi", "mekanik_mtnc"];
const SUPERVISOR = ["supervisor", "spv_mtnc"];
const LIHAT_PM = ["teknisi", "mekanik_mtnc", "supervisor", "spv_mtnc"];

module.exports = { LAPOR_KERUSAKAN, TEKNISI, SUPERVISOR, LIHAT_PM };