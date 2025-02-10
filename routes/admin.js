const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/AuthMiddleWare");
const uploadFields = require("../middleware/fileUpload");
const {
  createAbsensi,
  getAbsensi,
  getDetailAbsensi,
  updateAbsensi,
  generateAbsensi,
  sendAbsensi,
} = require("../controllers/attendanceController");
const {
  cabangPermintaanMagang,
  getPermintaanMagangById,
} = require("../controllers/internshipRequestController");

router.use(verifyToken(2));
router.get("/intern", cabangPermintaanMagang);
router.get("/intern/:id", getPermintaanMagangById);
router.post("/absensi", createAbsensi);
router.get("/absensi", getAbsensi);
router.get("/absensi/:bulan/:tahun", getDetailAbsensi);
router.patch("/absensi/:id", updateAbsensi);
router.post("/absensi/:bulan/:tahun/print", generateAbsensi);
router.post("/absensi/:bulan/:tahun/upload", uploadFields, sendAbsensi);

module.exports = router;
