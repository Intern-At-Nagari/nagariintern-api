const express = require("express");
const router = express.Router();
const path = require("path");
const {} = require("../middleware/AuthMiddleWare");
const uploadFields = require("../middleware/fileUpload");
const { verifyToken } = require("../middleware/AuthMiddleWare");
// Import controllers
const {
  getAllUnitKerja,
  editKuotaUnitKerja,
} = require("../controllers/unitKerjaController");

const { getRekapAbsensi } = require("../controllers/attendanceController");

const {
  univGenerateLetter,
  smkGenerateLetter,
  sendSuratBalasan,
  sendSuratPengantar,
  generateSuratPengantarMhs,
  generateSuratPengantarSiswa,

  generateLampiranRekomenMhs,
  generateLampiranRekomenSiswa,
} = require("../controllers/documentController");

const {
  createAccountPegawaiCabang,
  getAccountPegawai,
  editPasswordPegawai,
} = require("../controllers/employeeController");

const {
  getSelesai,
  getDetailSelesai,
  getMulaiMagang,
  editWaktuSelesaiPesertaMagang,
} = require("../controllers/internshipProgressController");

const {
  createJadwalPendaftaran,
  editSchedule,
  getJadwalPendaftaran,
} = require("../controllers/scheduleController");

const {
  getDiverifikasi,
  permintaanDiterima,
  detailUnivDiterima,
  detailSmkDiterima,
  detailUnivDiverifikasi,
  detailSmkDiverifikasi,
} = require("../controllers/verificationController");

const { verifyEmailPegawai } = require("../controllers/employeeController");

const { dahsboardData } = require("../controllers/dashboardController");

const {
  getAllPermintaanMagang,
  getPermintaanMagangById,
  approveStatusPermintaanMagang,
  rejectedStatusPermintaanMagang,
} = require("../controllers/internshipRequestController");

const {
  sendSuratPernyataan,
  downloadSuratBalasan,
} = require("../controllers/documentController");

router.use(verifyToken(3));

// Dashboard and Basic Info Routes
router.get("/dashboard", dahsboardData);
router.get("/unit-kerja", getAllUnitKerja);
router.get("/jadwal-pendaftaran", getJadwalPendaftaran);
router.get("/account-pegawai-cabang", getAccountPegawai);
router.get("/verify-email-pegawai", verifyEmailPegawai);

// Internship Management Routes
router.get("/interns", getAllPermintaanMagang);
router.get("/intern/:id", getPermintaanMagangById);
router.get("/interns/diterima", permintaanDiterima);
router.get("/interns/done", getSelesai);
router.get("/intern/done/:id", getDetailSelesai);
router.get("/interns/start", getMulaiMagang);
router.get("/diverifikasi", getDiverifikasi);

// University Related Routes
router.get("/intern/diterima/univ/:idUniv/:idProdi", detailUnivDiterima);
router.get(
  "/intern/diverifikasi/univ/:idUniv/:idProdi/:unitKerjaId",
  detailUnivDiverifikasi
);
router.post("/intern/diterima/univ/:idUniv/:idProdi", univGenerateLetter);
router.post(
  "/intern/diverifikasi/univ/:idUniv/:idProdi/:unitKerjaId",
  generateSuratPengantarMhs
);

// School Related Routes
router.get("/intern/diterima/smk/:idSmk", detailSmkDiterima);
router.get(
  "/intern/diverifikasi/smk/:idSmk/:unitKerjaId",
  detailSmkDiverifikasi
);
router.post("/intern/diterima/smk/:idSmk", smkGenerateLetter);
router.post(
  "/intern/diverifikasi/smk/:idSmk/:unitKerjaId",
  generateSuratPengantarSiswa
);

// Document Management Routes
router.get("/download-surat-balasan", downloadSuratBalasan);
router.post("/intern/send-surat-pernyataan", uploadFields, sendSuratPernyataan);
router.post("/intern/send-surat-balasan", uploadFields, sendSuratBalasan);
router.post("/intern/send-surat-pengantar", uploadFields, sendSuratPengantar);
router.post("/generate-lampiran-rekomen-mhs", generateLampiranRekomenMhs);
router.post("/generate-lampiran-rekomen-siswa", generateLampiranRekomenSiswa);

// Admin Management Routes
router.post("/jadwal-pendaftaran", createJadwalPendaftaran);
router.post("/create-account-pegawai-cabang", createAccountPegawaiCabang);
router.patch("/edit-password-pegawai-cabang/:id", editPasswordPegawai);
router.patch("/unit-kerja/:id", editKuotaUnitKerja);
router.patch("/jadwal-pendaftaran/:id", editSchedule);

// Status Management Routes
router.patch("/intern/:id/approve", approveStatusPermintaanMagang);
router.patch("/intern/:id/reject", rejectedStatusPermintaanMagang);
router.patch("/intern/ongoing/:id", editWaktuSelesaiPesertaMagang);

// Attendance Routes
router.get("/absensi/rekap", getRekapAbsensi);

module.exports = router;
