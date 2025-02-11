const express = require('express');
const router = express.Router();
const path = require('path');
const { verifyToken } = require('../middleware/AuthMiddleWare');
const uploadFields = require('../middleware/fileUpload');
const {
    getAllUnitKerja,
    editKuotaUnitKerja,
    getDiverifikasi,
    createJadwalPendaftaran,
    editSchedule,
    createAccountPegawaiCabang,
    getAccountPegawai,
    editPasswordPegawai,
    dahsboardData,
    getSelesai,
    getDetailSelesai,
    getMulaiMagang,
    editWaktuSelesaiPesertaMagang,
    getRekapAbsensi,
    detailUnivDiverifikasi,
    detailSmkDiverifikasi,
    permintaanDiterima,
    detailUnivDiterima,
    detailSmkDiterima,
    univGenerateLetter,
    smkGenerateLetter,
    generateSuratPengantarMhs,
    generateSuratPengantarSiswa,
    generateLampiranRekomenMhs,
    generateLampiranRekomenSiswa,
    sendSuratBalasan,
    sendSuratPengantar,
    getAllPermintaanMagang,
    getPermintaanMagangById,
    approveStatusPermintaanMagang,
    rejectedStatusPermintaanMagang
} = require('../controllers/SuperAdminController');


router.get('/unit-kerja', verifyToken, getAllUnitKerja);
router.get('/interns/diverifikasi', verifyToken, getDiverifikasi);
router.get('/account-pegawai-cabang', verifyToken, getAccountPegawai);
router.get('/dashboard', verifyToken, dahsboardData);

router.get('/interns/done', verifyToken, getSelesai);
router.get('/intern/done/:id', verifyToken, getDetailSelesai);
router.get('/absensi/rekap', verifyToken, getRekapAbsensi);
router.get('/interns/start', verifyToken, getMulaiMagang);
router.get('/uploads/:filename', (req, res) => {
    const { filename } = req.params;
    const filePath = path.join(__dirname, '../uploads', filename);
    res.sendFile(filePath);
});
router.get('/intern', verifyToken, getAllPermintaanMagang);
router.get('/interns/diterima', verifyToken, permintaanDiterima)
router.get('/intern/diterima/univ/:idUniv/:idProdi', detailUnivDiterima)
router.get('/intern/diverifikasi/univ/:idUniv/:idProdi/:unitKerjaId', detailUnivDiverifikasi)
router.get('/intern/diterima/smk/:idSmk', detailSmkDiterima)
router.get('/intern/diverifikasi/smk/:idSmk/:unitKerjaId', detailSmkDiverifikasi)
router.get('/intern/:id',verifyToken, getPermintaanMagangById);



router.post('/jadwal-pendaftaran', verifyToken, createJadwalPendaftaran);
router.post('/create-account-pegawai-cabang', verifyToken, createAccountPegawaiCabang);
router.post('/intern/diverifikasi/univ/:idUniv/:idProdi/:unitKerjaId', generateSuratPengantarMhs)
router.post('/intern/diverifikasi/smk/:idSmk/:unitKerjaId', generateSuratPengantarSiswa)
router.post('/intern/diterima/univ/:idUniv/:idProdi', univGenerateLetter)
router.post('/intern/diterima/smk/:idSmk', smkGenerateLetter)
router.post('/intern/send-surat-pengantar', verifyToken, uploadFields, sendSuratPengantar);
router.post('/intern/send-surat-balasan', verifyToken, uploadFields, sendSuratBalasan);
router.post('/generate-lampiran-rekomen-mhs', verifyToken, generateLampiranRekomenMhs);
router.post('/generate-lampiran-rekomen-siswa', verifyToken, generateLampiranRekomenSiswa);



router.patch('/unit-kerja/:id', verifyToken, editKuotaUnitKerja);
router.patch('/edit-password-pegawai-cabang/:id', verifyToken, editPasswordPegawai);
router.patch('/jadwal-pendaftaran/:id', verifyToken, editSchedule);
router.patch('/intern/ongoing/:id', verifyToken, editWaktuSelesaiPesertaMagang);
router.patch('/intern/:id/approve', approveStatusPermintaanMagang);
router.patch('/intern/:id/reject', rejectedStatusPermintaanMagang);



module.exports = router;
