const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/AuthMiddleWare");
const {
  createPermintaanMagangMahasiswa,
  createPermintaanMagangSiswa,
  getMyPermintaanMagang,

  rejectStatusPermintaanMagang,
} = require("../controllers/internshipRequestController");
const uploadFields = require("../middleware/fileUpload");
const {
  sendSuratPernyataan,
  downloadTemplateSiswa,
  downloadTemplateInstitusi,
  downloadSuratBalasan,
} = require("../controllers/documentController");

router.use(verifyToken(1));
router.get("/my-intern", getMyPermintaanMagang);
router.get("/download-surat-balasan", downloadSuratBalasan);
router.get("/intern/download-template/siswa", downloadTemplateSiswa);
router.get("/intern/download-template/institusi", downloadTemplateInstitusi);

router.post("/intern/siswa", uploadFields, createPermintaanMagangSiswa);
router.post("/intern/mahasiswa", uploadFields, createPermintaanMagangMahasiswa);
router.post("/intern/send-surat-pernyataan", uploadFields, sendSuratPernyataan);
router.post("/my-intern/reject", rejectStatusPermintaanMagang);

module.exports = router;
