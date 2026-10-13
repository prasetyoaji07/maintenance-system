// Kelompok role untuk requireRole(...). Satu tempat, supaya nambah role
// baru nanti tidak perlu mengubah banyak file.

const LAPOR_KERUSAKAN = ["operator", "leader_divisi"];
const TEKNISI = ["teknisi", "mekanik_mtnc"];
const SUPERVISOR = ["supervisor", "spv_mtnc"];
const LIHAT_PM = ["teknisi", "mekanik_mtnc", "supervisor", "spv_mtnc"];
const LAPORAN = [...TEKNISI, ...SUPERVISOR];

// Alur surat digital divisi (grup baru, tidak membuka endpoint lama)
const INSTALLER = ["installer_divisi"];
const FOREMAN = ["foreman_divisi"];
const SPV_DIVISI = ["spv_divisi"];
const TTD_SURAT = [...INSTALLER, ...FOREMAN, ...SPV_DIVISI];

module.exports = {
  LAPOR_KERUSAKAN,
  TEKNISI,
  SUPERVISOR,
  LIHAT_PM,
  LAPORAN,
  INSTALLER,
  FOREMAN,
  SPV_DIVISI,
  TTD_SURAT,
};