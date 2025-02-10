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



const calculateAvailableQuota = async () => {
  const unitKerjas = await UnitKerja.findAll();
  const acceptedRequests = await Permintaan.findAll({
    where: {
      statusId: {
        [sequelize.Op.in]: [2, 3, 4],
      },
    },
    attributes: [
      "unitKerjaId",
      "type",
      [sequelize.fn("COUNT", sequelize.col("id")), "count"],
    ],
    group: ["unitKerjaId", "type"],
  });

  return unitKerjas.map((unit) => {
    const mhsCount =
      acceptedRequests
        .find((r) => r.unitKerjaId === unit.id && r.type === "mahasiswa")
        ?.get("count") || 0;

    const siswaCount =
      acceptedRequests
        .find((r) => r.unitKerjaId === unit.id && r.type === "siswa")
        ?.get("count") || 0;

    return {
      ...unit.toJSON(),
      sisaKuotaMhs: Math.max(0, (unit.kuotaMhs || 0) - mhsCount),
      sisaKuotaSiswa: Math.max(0, (unit.kuotaSiswa || 0) - siswaCount),
    };
  });
};


const getAllUnitKerja = async (req, res) => {
  try {
    const unitKerjaWithQuota = await calculateAvailableQuota();
    return res.status(200).json({
      unitKerja: unitKerjaWithQuota,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

const editKuotaUnitKerja = async (req, res) => {
  try {
    const { id } = req.params;
    const { tipe_cabang, kuotaMhs, kuotaSiswa, isCustomQuota } = req.body;

    const unitKerja = await UnitKerja.findByPk(id);
    if (!unitKerja) {
      return res.status(404).json({ error: "Unit kerja tidak ditemukan." });
    }

    let kuota = { kuotaMhs, kuotaSiswa };

    // If not using custom quota, apply preset values based on branch type
    if (!isCustomQuota && tipe_cabang) {
      if (
        !["pusat", "utama", "a", "b", "c", ""].includes(
          tipe_cabang.toLowerCase()
        )
      ) {
        return res.status(400).json({ error: "Tipe cabang tidak valid." });
      }

      switch (tipe_cabang.toLowerCase()) {
        case "pusat":
          kuota = { kuotaMhs: 0, kuotaSiswa: 16 };
          break;
        case "utama":
          kuota = { kuotaMhs: 0, kuotaSiswa: 25 };
          break;
        case "a":
          kuota = { kuotaMhs: 8, kuotaSiswa: 10 };
          break;
        case "b":
          kuota = { kuotaMhs: 3, kuotaSiswa: 8 };
          break;
        case "c":
          kuota = { kuotaMhs: 2, kuotaSiswa: 5 };
          break;
      }
      unitKerja.tipe_cabang = tipe_cabang;
    }
    // If using custom quota, validate the input values
    else if (isCustomQuota) {
      if (kuotaMhs === undefined || kuotaSiswa === undefined) {
        return res
          .status(400)
          .json({ error: "Kuota mahasiswa dan siswa harus diisi." });
      }
      if (kuotaMhs < 0 || kuotaSiswa < 0) {
        return res
          .status(400)
          .json({ error: "Kuota tidak boleh bernilai negatif." });
      }
    }

    unitKerja.kuotaMhs = kuota.kuotaMhs;
    unitKerja.kuotaSiswa = kuota.kuotaSiswa;
    await unitKerja.save();

    const unitKerjaWithQuota = await calculateAvailableQuota();
    return res.status(200).json({
      message: "Unit kerja berhasil diperbarui.",
      unitKerja: unitKerjaWithQuota,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getAllUnitKerja,
  editKuotaUnitKerja,
};
