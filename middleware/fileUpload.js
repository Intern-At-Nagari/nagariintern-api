const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/uploads/');
  },
  filename: (req, file, cb) => {
    const fieldname = file.fieldname;
    const fileExtension = path.extname(file.originalname);
    const filename = `${fieldname}-${Date.now()}-${Math.round(Math.random() * 1E9)}${fileExtension}`;
    cb(null, filename);
  }
});

// Perbaikan pada fileFilter untuk throw error yang proper
const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    // Ubah pesan error agar lebih spesifik
    const error = new Error(`File ${file.fieldname} harus berformat PDF`);
    error.code = 'INVALID_FILE_TYPE';
    cb(error, false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { 
    fileSize: 2 * 1024 * 1024 // 2MB
  }
});

const uploadFields = upload.fields([
  { name: 'fileCv', maxCount: 1 },
  { name: 'fileTranskrip', maxCount: 1 },
  { name: 'fileKtp', maxCount: 1 },
  { name: 'fileSuratPengantar', maxCount: 1 },
  { name: 'SuratPengantar', maxCount: 1 },
  { name: 'fileSuratBalasan', maxCount: 1 },
  { name: 'fileSuratPernyataanSiswa', maxCount: 1 },
  { name: 'fileSuratPernyataanWali', maxCount: 1 },
  { name: 'fileTabungan', maxCount: 1 },
  { name: 'fileRekap', maxCount: 1 }
]);

// Middleware untuk handle multer errors
const uploadMiddleware = (req, res, next) => {
  uploadFields(req, res, function (err) {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          status: 'error',
          message: 'Ukuran file terlalu besar. Maksimal 2MB'
        });
      }
      if (err.code === 'INVALID_FILE_TYPE') {
        return res.status(400).json({
          status: 'error',
          message: err.message
        });
      }
      // Handle error lainnya
      return res.status(400).json({
        status: 'error',
        message: err.message || 'Error saat upload file'
      });
    }
    next();
  });
};

module.exports = uploadMiddleware;