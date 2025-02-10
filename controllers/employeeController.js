const {
  UnitKerja,
  Permintaan,
  PerguruanTinggi,

  Prodi,
  Jurusan,
  Users,
  Mahasiswa,
  Siswa,
  Karyawan,
  Kehadiran,
  Status,
  RekapKehadiran,
  Dokumen,
  Smk,
  Jadwal,
} = require("../models/index");

const { Op } = require("sequelize");
const fs = require("fs");
const { where } = require("sequelize");

const PizZip = require("pizzip");
const Docxtemplater = require("docxtemplater");
const path = require("path");

const sequelize = require("sequelize");
const libre = require("libreoffice-convert");
const util = require("util");
const convert = util.promisify(libre.convert);
const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");
const { get } = require("http");
const ejs = require("ejs");

const createAccountPegawaiCabang = async (req, res) => {
  try {
    const { email, unitKerjaId } = req.body;

    // Generate random password
    const generatePassword = () => {
      const chars =
        "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
      let password = "";
      for (let i = 0; i < 8; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return password;
    };

    const password = generatePassword();
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await Users.create({
      email,
      password: hashedPassword,
      roleId: 2,
    });

    await Karyawan.create({
      userId: user.id,
      unitKerjaId,
    });

    const unitKerja = await UnitKerja.findByPk(unitKerjaId);
    if (!unitKerja) {
      throw new Error("Unit kerja not found");
    }

    const verificationLink = `${req.protocol}://${req.get(
      "host"
    )}/verify-email-pegawai?token=${user.id}`;
    const logoUrl =
      "https://upload.wikimedia.org/wikipedia/commons/d/db/Bank_Nagari.svg";

    // Render email template
    const templatePath = path.join(
      __dirname,
      "../public/template/AccountCreatedMail.ejs"
    );
    const emailTemplate = await ejs.renderFile(templatePath, {
      email,
      password,
      verificationLink,
      logoUrl,
    });

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: `"Bank Nagari Admin" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Verifikasi Akun Admin Bank Nagari",
      html: emailTemplate,
    };

    await transporter.sendMail(mailOptions);

    return res.status(201).json({
      status: "success",
      message:
        "Account created successfully. Credentials have been sent to the email.",
      data: {
        email: user.email,
        role: user.role,
        unitKerja: unitKerja.name,
      },
    });
  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
      error: error.message,
    });
  }
};

const verifyEmailPegawai = async (req, res) => {
  try {
    const { token } = req.query;

    const user = await Users.findByPk(token);

    if (!user) {
      return res.status(400).render("EmailVerificationError", {
        error: "Token verifikasi tidak valid atau sudah kadaluarsa",
      });
    }

    if (user.isVerified) {
      return res.status(400).render("EmailVerificationError", {
        error: "Email sudah diverifikasi sebelumnya",
      });
    }

    user.isVerified = true;
    await user.save();

    // Render the success page
    return res.render("EmailVerifiedCabang");
  } catch (error) {
    console.error("Error in email verification:", error);
    return res.status(500).render("EmailVerificationError", {
      error: "Terjadi kesalahan saat memverifikasi email",
    });
  }
};

const getAccountPegawai = async (req, res) => {
  try {
    const karyawan = await Karyawan.findAll({
      include: [
        {
          model: Users,
          where: {
            roleId: 2,
          },
        },
        {
          model: UnitKerja,
        },
      ],
    });
    return res.status(200).json({
      status: "success",
      data: karyawan,
    });
  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
      error: error.message,
    });
  }
};

const editPasswordPegawai = async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;

    // Add password validation
    if (!password || password.length < 6) {
      return res.status(400).json({
        status: "error",
        message: "Password must be at least 6 characters long",
      });
    }

    // Check if password contains at least one number
    if (!/\d/.test(password)) {
      return res.status(400).json({
        status: "error",
        message: "Password must contain at least one number",
      });
    }

    const user = await Users.findByPk(id);
    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "User not found",
      });
    }

    // Use the same bcrypt settings as in the login process
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Update the password
    user.password = hashedPassword;
    await user.save();

    // Logo URL for email template
    const logoUrl =
      "https://upload.wikimedia.org/wikipedia/commons/d/db/Bank_Nagari.svg";

    // Render email template
    const templatePath = path.join(
      __dirname,
      "../public/template/ResetPassword.ejs"
    );
    const emailTemplate = await ejs.renderFile(templatePath, {
      password,
      logoUrl,
    });

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: `"Bank Nagari Admin" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: "Password Updated Successfully - Bank Nagari",
      html: emailTemplate,
    };

    await transporter.sendMail(mailOptions);

    return res.status(200).json({
      status: "success",
      message: "Password updated successfully and notification email sent",
    });
  } catch (error) {
    console.error("Error updating password:", error);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
};

module.exports = {
  createAccountPegawaiCabang,
  verifyEmailPegawai,
  getAccountPegawai,
  editPasswordPegawai,
};
