const express = require('express');
const router = express.Router();
const {
  createPermintaanMagangMahasiswa,
  createPermintaanMagangSiswa,
  getAllPermintaanMagang,
  getPermintaanMagangById,
  getMyPermintaanMagang,
  approveStatusPermintaanMagang,
  sendSuratPernyataan,
  downloadSuratBalasan,
  rejectStatusPermintaanMagang,
  rejectedStatusPermintaanMagang
} = require('../controllers/permintaanMagangController');
const { verifyToken } = require('../middleware/AuthMiddleWare');
const uploadFields = require('../middleware/fileUpload');
const {
  permintaanDiterima,
  detailUnivDiterima,
  detailSmkDiterima,
  univGenerateLetter,
  smkGenerateLetter,
  sendSuratBalasan,
  sendSuratPengantar,
  detailUnivDiverifikasi,
  detailSmkDiverifikasi,
  generateSuratPengantarMhs,
  generateSuratPengantarSiswa,
  getJadwalPendaftaran,
  verifyEmailPegawai,
  generateLampiranRekomenMhs,
  generateLampiranRekomenSiswa,
  findOneJadwalPendaftaran
} = require('../controllers/SuperAdminController');

router.get('/', (req, res) => { res.send('Welcome to the API'); });
router.get('/intern', verifyToken, getAllPermintaanMagang);
router.get('/intern/diterima/univ/:idUniv/:idProdi', detailUnivDiterima)
router.get('/intern/diverifikasi/univ/:idUniv/:idProdi/:unitKerjaId', detailUnivDiverifikasi)
router.get('/intern/diterima/smk/:idSmk', detailSmkDiterima)
router.get('/intern/diverifikasi/smk/:idSmk/:unitKerjaId', detailSmkDiverifikasi)
router.get('/my-intern', verifyToken, getMyPermintaanMagang);
router.get('/intern/:id', getPermintaanMagangById);
router.get('/download-surat-balasan', verifyToken, downloadSuratBalasan);
router.get('/jadwal-pendaftaran', verifyToken, getJadwalPendaftaran);
router.get('/jadwal-curent', verifyToken, findOneJadwalPendaftaran);
router.get('/verify-email-pegawai', verifyEmailPegawai);

router.post('/intern/siswa', verifyToken, uploadFields, createPermintaanMagangSiswa);
router.post('/intern/mahasiswa', verifyToken, uploadFields, createPermintaanMagangMahasiswa);
router.post('/intern/diverifikasi/univ/:idUniv/:idProdi/:unitKerjaId', generateSuratPengantarMhs)
router.post('/intern/diverifikasi/smk/:idSmk/:unitKerjaId', generateSuratPengantarSiswa)
router.post('/intern/diterima/univ/:idUniv/:idProdi', univGenerateLetter)
router.post('/intern/diterima/smk/:idSmk', smkGenerateLetter)
router.post('/intern/send-surat-pernyataan', verifyToken, uploadFields, sendSuratPernyataan);
router.post('/my-intern/reject', verifyToken, rejectStatusPermintaanMagang);
router.post('/intern/send-surat-pengantar', verifyToken, uploadFields, sendSuratPengantar);
router.post('/intern/send-surat-balasan', verifyToken, uploadFields, sendSuratBalasan);
router.post('/generate-lampiran-rekomen-mhs', verifyToken, generateLampiranRekomenMhs);
router.post('/generate-lampiran-rekomen-siswa', verifyToken, generateLampiranRekomenSiswa);

router.patch('/intern/:id/approve', approveStatusPermintaanMagang);
router.patch('/intern/:id/reject', rejectedStatusPermintaanMagang);

module.exports = router;