require("dotenv").config();
const { Users, Roles, Karyawan, UnitKerja } = require("../models/index");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const rateLimit = require("express-rate-limit");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const { log } = require("console");

// const loginLimiter = rateLimit({
//   windowMs: 15 * 60 * 1000,
//   max: 5,
//   message:
//     "Too many login attempts from this IP, please try again after 15 minutes",
// });

const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await Users.findOne({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    if (!user.isVerified) {
      return res
        .status(401)
        .json({ error: "Please verify your email before logging in" });
    }

    // Validate password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Create JWT token
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.roleId },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );
    const refreshToken = jwt.sign(
      { id: user.id, email: user.email, role: user.roleId },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // Save refresh token to database
    user.refreshToken = refreshToken;
    await user.save();

    // Separate response for admin and regular user
    const role = await Roles.findOne({ where: { id: user.roleId } });
    if (role.name === "SuperAdmin") {
      return res.status(200).json({
        error: false,
        message: "Admin login successful",
        token,
        refreshToken,
        user: {
          id: user.id,
          email: user.email,
          role: role.name,
        },
      });
    } else if (role.name === "User") {
      return res.status(200).json({
        error: false,
        message: "User login successful",
        token,
        refreshToken,
        user: {
          id: user.id,
          email: user.email,
          role: role.name,
        },
      });
    } else if (role.name === "Admin") {
      const karyawan = await Karyawan.findOne({
        where: { userId: user.id },
        include: {
          model: UnitKerja,
          attributes: ["id", "name"],
        },
      });
      console.log(karyawan);

      return res.status(200).json({
        error: false,
        message: "Admin login successful",
        token,
        refreshToken,
        user: {
          id: user.id,
          email: user.email,
          role: role.name,
          UnitKerja: karyawan.UnitKerja.name,
        },
      });
    } else {
      return res.status(403).json({ error: "Access denied" });
    }
  } catch (error) {
    console.error("Error in login:", error.message || error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

const register = async (req, res) => {
  const { email, password } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await Users.create({
      email,
      password: hashedPassword,
      roleId: 1,
    });

    console.log(req.body);

    const token = crypto.randomBytes(32).toString("hex");
    const verificationLink = `${req.protocol}://${req.get(
      "host"
    )}/auth/verify-email?token=${token}`;
    user.emailVerificationToken = token;
    await user.save();

    // HTML template untuk email
    const htmlTemplate = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Verifikasi Email</title>
          <style>
            .container {
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
              font-family: Arial, sans-serif;
            }
            .header {
              background-color: #3e93e2;
              color: white;
              padding: 20px;
              text-align: center;
              border-radius: 5px 5px 0 0;
            }
            .content {
              background-color: #ffffff;
              padding: 20px;
              border: 1px solid #e5e7eb;
              border-radius: 0 0 5px 5px;
            }
            .button {
              display: inline-block;
              padding: 12px 24px;
              text-decoration: none;
              background-color: #ffffff; /* Changed to white */
              color: #3e93e2; /* Changed text color to blue for contrast */
              border-radius: 5px;
              border: 2px solid #3e93e2; /* Added border */
              margin: 20px 0;
            }
            
            .footer {
              margin-top: 20px;
              text-align: center;
              color: #6B7280;
              font-size: 14px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Verifikasi Email Anda</h1>
            </div>
            <div class="content">
              <h2>Halo ${email},</h2>
              <p>Terima kasih telah mendaftar. Untuk menyelesaikan proses pendaftaran, silakan verifikasi email Anda dengan mengklik tombol di bawah ini:</p>
              <div style="text-align: center;">
                <a href="${verificationLink}" class="button">Verifikasi Email</a>
              </div>
              <p>Atau salin dan tempel link berikut di browser Anda:</p>
              <p>${verificationLink}</p>
              <p>Jika Anda tidak merasa mendaftar di layanan kami, Anda dapat mengabaikan email ini.</p>
            </div>
            <div class="footer">
              <p>Email ini dikirim secara otomatis, mohon tidak membalas email ini.</p>
              <p>&copy; ${new Date().getFullYear()} Nagari Intern. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Verifikasi Email",
      html: htmlTemplate, // Menggunakan HTML template
      text: `Silakan verifikasi email Anda dengan mengklik link berikut: ${verificationLink}`, // Fallback text untuk email client yang tidak mendukung HTML
    };

    await transporter.sendMail(mailOptions);
    res.status(201).json({
      message:
        "User registered. Please check your email to verify your account.",
    });
  } catch (error) {
    console.error("Error in register:", error.message || error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const verifyEmail = async (req, res) => {
  const { token } = req.query;

  try {
    const user = await Users.findOne({
      where: { emailVerificationToken: token },
    });

    if (!user) {
      return res.status(400).render('EmailVerificationError', {
        error: "Token verifikasi tidak valid atau sudah kadaluarsa"
      });
    }

    user.isVerified = true;
    user.emailVerificationToken = null;
    await user.save();

    // Render the success page instead of sending JSON
    return res.render('EmailVerified');

  } catch (error) {
    console.error("Error in email verification:", error.message || error);
    return res.status(500).render('EmailVerificationError', {
      error: "Terjadi kesalahan saat memverifikasi email"
    });
  }
};
module.exports = {
  login,
  // loginLimiter,
  register,
  verifyEmail,
};
