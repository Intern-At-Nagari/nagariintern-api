const express = require('express');
const router = express.Router();
const path = require('path');
const { login, register, verifyEmail } = require('../controllers/AuthController');
const { verifyToken, refreshToken } = require('../middleware/AuthMiddleWare');

// Set base directory for views
router.use((req, res, next) => {
  res.locals.basedir = path.join(__dirname, '../public/template');
  next();
});

// Routes
router.post('/login', login);
router.post('/register', register);
router.post('/refresh-token', refreshToken);
router.get('/protected-route', verifyToken, (req, res) => {
  res.status(200).json({ message: 'This is a protected route' });
});
router.get('/verify-email', verifyEmail);

module.exports = router;