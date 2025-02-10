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




const getSelesai = async (req, res) => {
  try {
    // First update status to 7 for completed internships
    const currentDate = new Date();
    await Permintaan.update(
      { statusId: 7 },
      {
        where: {
          tanggalSelesai: {
            [Op.lt]: currentDate,
          },
          statusId: 4, // Only update if current status is 4 (active)
        },
      }
    );

    // Then get all data with status 7
    const permintaan = await Permintaan.findAll({
      where: {
        statusId: 7,
      },
      include: [
        {
          model: Users,
          include: [
            {
              model: Mahasiswa,
              attributes: ["name", "nim", "no_hp", "alamat"],
              required: false,
            },
            {
              model: Siswa,
              attributes: ["name", "nisn", "no_hp", "alamat"],
              required: false,
            },
          ],
          attributes: ["email"],
        },
        {
          model: PerguruanTinggi,
          attributes: ["id", "name"],
        },
        {
          model: Prodi,
          attributes: ["id", "name"],
        },
        {
          model: Smk,
          attributes: ["id", "name"],
        },
        {
          model: UnitKerja,
          as: "UnitKerjaPenempatan",
          attributes: ["id", "name"],
        },
        {
          model: Dokumen,
          required: false,
          attributes: ["url"],
        },
      ],
      attributes: ["id", "type", "tanggalMulai", "tanggalSelesai", "createdAt"],
    });

    return res.status(200).json(permintaan);
  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
      error: error.message,
    });
  }
};

const getDetailSelesai = async (req, res) => {
  try {
    const { id } = req.params;

    // Ensure the id is parsed as an integer
    const permintaanId = parseInt(id, 10);

    if (isNaN(permintaanId)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid ID format",
      });
    }

    const permintaan = await Permintaan.findByPk(permintaanId, {
      include: [
        {
          model: Users,
          include: [
            {
              model: Mahasiswa,
              attributes: ["name", "nim", "no_hp", "alamat"],
              required: false,
            },
            {
              model: Siswa,
              attributes: ["name", "nisn", "no_hp", "alamat"],
              required: false,
            },
          ],
          attributes: ["email"],
        },
        {
          model: PerguruanTinggi,
          attributes: ["id", "name"],
        },
        {
          model: Prodi,
          attributes: ["id", "name"],
        },
        {
          model: Smk,
          attributes: ["id", "name"],
        },
        {
          model: UnitKerja,
          as: "UnitKerjaPenempatan",
          attributes: ["id", "name"],
        },
        {
          model: Dokumen,
          required: false,
          attributes: ["id", "url", "tipeDokumenId"],
          where: {
            permintaanId: {
              [Op.eq]: permintaanId, // Ensure permintaanId is an integer
            },
          },
        },
      ],
      attributes: ["id", "type", "tanggalMulai", "tanggalSelesai", "createdAt"],
    });

    if (!permintaan) {
      return res.status(404).json({
        status: "error",
        message: "Data not found",
      });
    }

    // Ensure the documents array exists even if empty
    const responseData = {
      ...permintaan.toJSON(),
      Dokumens: permintaan.Dokumens || [],
    };

    return res.status(200).json(responseData);
  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
      error: error.message,
    });
  }
};

const getMulaiMagang = async (_, res) => {
  try {
    const data = await Permintaan.findAll({
      where: {
        statusId: 4,
      },
      include: [
        {
          model: Users,
          include: [
            {
              model: Mahasiswa,
              attributes: ["name", "nim"],
              required: false,
            },
            {
              model: Siswa,
              attributes: ["name", "nisn"],
              required: false,
            },
          ],
        },
        {
          model: UnitKerja,
          as: "UnitKerjaPenempatan",
          attributes: ["name"],
        },
      ],
      attributes: ["id", "tanggalMulai", "tanggalSelesai"], // Added id to attributes
    });

    // Format the response data
    const formattedData = data.map((item) => ({
      id: item.id, // Added id to response
      nama:
        item.User?.Mahasiswas?.[0]?.name ||
        item.User?.Siswas?.[0]?.name ||
        null,
      id_number:
        item.User?.Mahasiswas?.[0]?.nim || item.User?.Siswas?.[0]?.nisn || null,
      tempat_magang: item.UnitKerjaPenempatan?.name || null,
      tanggal_mulai: item.tanggalMulai,
      tanggal_selesai: item.tanggalSelesai,
    }));

    return res.status(200).json(formattedData);
  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
      error: error.message,
    });
  }
};

const editWaktuSelesaiPesertaMagang = async (req, res) => {
  try {
    const { id } = req.params;
    const { tanggalSelesai } = req.body;

    const permintaan = await Permintaan.findOne({
      where: {
        id: id,
        statusId: 4,
      },
    });

    if (!permintaan) {
      return res.status(404).json({
        status: "error",
        message: "Data not found or cannot be edited (must have status 4)",
      });
    }

    permintaan.tanggalSelesai = tanggalSelesai;
    await permintaan.save();

    return res.status(200).json({
      status: "success",
      message: "Data updated successfully",
      data: permintaan,
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
  getSelesai,
  getDetailSelesai,
  getMulaiMagang,
  editWaktuSelesaiPesertaMagang,
};
