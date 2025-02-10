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




const createJadwalPendaftaran = async (req, res) => {
  try {
    const { nama, tanggalMulai, tanggalTutup } = req.body;

    // Check for existing permintaan with statusId 1, 2, or 3
    const existingPermintaan = await Permintaan.findOne({
      where: {
        statusId: {
          [Op.in]: [1, 2, 3],
        },
      },
    });

    if (existingPermintaan) {
      return res.status(400).json({
        status: "error",
        message:
          "Tidak dapat membuat jadwal baru karena masih ada permintaan yang sedang diproses",
      });
    }

    // Get the latest jadwal
    const latestJadwal = await Jadwal.findOne({
      order: [["tanggalTutup", "DESC"]],
    });

    // Check if there's a latest jadwal and its tanggalTutup hasn't passed yet
    if (latestJadwal) {
      const now = new Date();
      const lastTutup = new Date(latestJadwal.tanggalTutup);

      if (now < lastTutup) {
        return res.status(400).json({
          status: "error",
          message:
            "Tidak dapat membuat jadwal baru sebelum periode pendaftaran sebelumnya selesai",
        });
      }
    }

    const jadwalPendaftaran = await Jadwal.create({
      nama,
      tanggalMulai,
      tanggalTutup,
    });

    return res.status(201).json({
      status: "success",
      data: jadwalPendaftaran,
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

const editSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    const { nama, tanggalMulai, tanggalTutup } = req.body;

    const jadwal = await Jadwal.findByPk(id);

    if (!jadwal) {
      return res.status(404).json({
        status: "error",
        message: "Jadwal tidak ditemukan",
      });
    }

    jadwal.nama = nama;
    jadwal.tanggalMulai = tanggalMulai;
    jadwal.tanggalTutup = tanggalTutup;

    await jadwal.save();

    return res.status(200).json({
      status: "success",
      data: jadwal,
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

const getJadwalPendaftaran = async (req, res) => {
  try {
    const jadwalPendaftaran = await Jadwal.findAll();
    return res.status(200).json({
      status: "success",
      data: jadwalPendaftaran,
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

const findOneJadwalPendaftaran = async (req, res) => {
  try {
    const currentDate = new Date();

    const jadwalPendaftaran = await Jadwal.findOne({
      where: {
        tanggalMulai: {
          [Op.lte]: currentDate, // less than or equal to current date
        },
        tanggalTutup: {
          [Op.gte]: currentDate, // greater than or equal to current date
        },
      },
    });

    return res.status(200).json({
      status: "success",
      data: jadwalPendaftaran ? [jadwalPendaftaran] : [], // Return as array to maintain consistency
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

module.exports = {
  createJadwalPendaftaran,
  getJadwalPendaftaran,
  findOneJadwalPendaftaran,
  editSchedule,
};
