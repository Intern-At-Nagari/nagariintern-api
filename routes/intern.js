const express = require('express');
const router = express.Router();
const {
  createPermintaanMagangMahasiswa,
  createPermintaanMagangSiswa,
  getMyPermintaanMagang,
  sendSuratPernyataan,
  downloadSuratBalasan,
  rejectStatusPermintaanMagang,
  getJadwalPendaftaran,
  findOneJadwalPendaftaran

} = require('../controllers/InternController');
const { verifyToken } = require('../middleware/AuthMiddleWare');
const uploadFields = require('../middleware/fileUpload');


router.get('/', (req, res) => { res.send('Welcome to the API'); });
router.get('/my-intern', verifyToken, getMyPermintaanMagang);
router.get('/download-surat-balasan', verifyToken, downloadSuratBalasan);
router.get('/jadwal-pendaftaran', verifyToken, getJadwalPendaftaran);
router.get('/jadwal-curent', verifyToken, findOneJadwalPendaftaran);

router.post('/intern/siswa', verifyToken, uploadFields, createPermintaanMagangSiswa);
router.post('/intern/mahasiswa', verifyToken, uploadFields, createPermintaanMagangMahasiswa);
router.post('/intern/send-surat-pernyataan', verifyToken, uploadFields, sendSuratPernyataan);
router.post('/my-intern/reject', verifyToken, rejectStatusPermintaanMagang);



module.exports = router;