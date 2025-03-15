const express = require("express");
const router = express.Router();

const { verifyToken } = require("../middleware/AuthMiddleWare.js");
const uploadFields = require("../middleware/fileUpload.js");
const {
  createAbsensi,
  getAbsensi,
  getDetailAbsensi,
  updateAbsensi,
  generateAbsensi,
  sendAbsensi,
  cabangPermintaanMagang,
  verifyEmailPegawai,
  completedMagang,
  getAdminProfile,
  updateProfile,
  changePassword
} = require("../controllers/AdminCabangController.js");
const {
  getPermintaanMagangById,
} = require("../controllers/SuperAdminController");

router.get("/interns", verifyToken, cabangPermintaanMagang);
router.get("/intern/:id", verifyToken, getPermintaanMagangById);

router.get("/absensi", verifyToken, getAbsensi);
router.get("/absensi/:bulan/:tahun", verifyToken, getDetailAbsensi);
router.get("/verify-email-pegawai", verifyEmailPegawai);
router.get("/profile", verifyToken, getAdminProfile);

router.post("/absensi", verifyToken, createAbsensi);
router.post("/absensi/:bulan/:tahun/print", verifyToken, generateAbsensi);
router.post(
  "/absensi/:bulan/:tahun/upload",
  verifyToken,
  uploadFields,
  sendAbsensi
);

router.patch("/absensi/:id", verifyToken, updateAbsensi);
router.patch("/intern/:id/complete", verifyToken, completedMagang);
router.put("/profile/update", verifyToken, updateProfile);
router.put("/change-password", verifyToken, changePassword);


module.exports = router;
