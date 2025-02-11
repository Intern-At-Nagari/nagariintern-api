const express = require('express');
const router = express.Router();

const { verifyToken } = require('../middleware/AuthMiddleWare.js');
const  uploadFields  = require('../middleware/fileUpload.js');
const  { 
    createAbsensi,
    getAbsensi,
    getDetailAbsensi,
    updateAbsensi,
    generateAbsensi,
    sendAbsensi,
    cabangPermintaanMagang,
    verifyEmailPegawai
 } = require('../controllers/AdminCabangController.js');


router.get('/intern', verifyToken, cabangPermintaanMagang);
router.get('/absensi', verifyToken, getAbsensi)
router.get('/absensi/:bulan/:tahun', verifyToken, getDetailAbsensi)
router.get('/verify-email-pegawai', verifyEmailPegawai);

router.post('/absensi', verifyToken, createAbsensi);
router.post('/absensi/:bulan/:tahun/print', verifyToken, generateAbsensi)
router.post('/absensi/:bulan/:tahun/upload', verifyToken, uploadFields, sendAbsensi)

router.patch('/absensi/:id', verifyToken, updateAbsensi);


module.exports = router;