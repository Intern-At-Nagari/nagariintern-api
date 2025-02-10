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

const permintaanDiterima = async (req, res) => {
  try {
    console.log("Fetching data for accepted requests...");
    const universitiesData = await PerguruanTinggi.findAll({
      include: [
        {
          model: Permintaan,
          where: {
            type: "mahasiswa",
            statusId: 1,
            penempatan: {
              [sequelize.Op.not]: null,
            },
          },
          include: [
            {
              model: Prodi,
              attributes: ["id", "name"],
            },
            {
              model: Users,
              include: [
                {
                  model: Mahasiswa,
                  attributes: ["name"],
                },
              ],
            },
            {
              model: UnitKerja,
              as: "UnitKerjaPenempatan",
              attributes: ["name"],
            },
          ],
          required: true,
          attributes: ["tanggalMulai", "tanggalSelesai"],
        },
      ],
      attributes: ["id", "name"],
    });

    // Query for schools data with student names
    const schoolsData = await Smk.findAll({
      include: [
        {
          model: Permintaan,
          where: {
            type: "siswa",
            statusId: 1,
            penempatan: {
              [sequelize.Op.not]: null,
            },
          },
          include: [
            {
              model: Users,
              include: [
                {
                  model: Siswa,
                  attributes: ["name"],
                },
              ],
            },
            {
              model: UnitKerja,
              as: "UnitKerjaPenempatan",
              attributes: ["name"],
            },
          ],
          required: true,
          attributes: ["tanggalMulai", "tanggalSelesai"],
        },
      ],
      attributes: ["id", "name"],
    });

    if (!universitiesData.length && !schoolsData.length) {
      return res.status(404).json({
        message: "Data tidak ditemukan",
      });
    }

    // Helper function to format date
    const formatDate = (dateStr) => {
      const date = new Date(dateStr);
      const day = date.getDate();
      const months = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ];
      return `${day} ${months[date.getMonth()]}`;
    };

    // Format universities data
    const formattedUniversitiesData = universitiesData.map((univ) => {
      const prodiMap = new Map();

      univ.Permintaans.forEach((permintaan) => {
        const prodiId = permintaan.Prodi.id;
        const prodiName = permintaan.Prodi.name;
        const studentName = permintaan.User?.Mahasiswas?.[0]?.name || "Unknown";
        const penempatan = permintaan.UnitKerjaPenempatan?.name || "Unknown";
        const periode = `${formatDate(permintaan.tanggalMulai)} - ${formatDate(
          permintaan.tanggalSelesai
        )}`;

        if (!prodiMap.has(prodiId)) {
          prodiMap.set(prodiId, {
            id_prodi: prodiId,
            nama_prodi: prodiName,
            total_diterima: 0,
            mahasiswa: [],
          });
        }

        const prodiData = prodiMap.get(prodiId);
        prodiData.total_diterima++;
        prodiData.mahasiswa.push({
          nama: studentName,
          penempatan: penempatan,
          periode: periode,
        });
      });

      return {
        id_univ: univ.id,
        nama_institusi: univ.name,
        prodi: Array.from(prodiMap.values()),
      };
    });

    // Format schools data
    const formattedSchoolsData = schoolsData.map((school) => ({
      id_smk: school.id,
      nama_institusi: school.name,
      total_diterima: school.Permintaans.length,
      siswa: school.Permintaans.map((permintaan) => ({
        nama: permintaan.User?.Siswas?.[0]?.name || "Unknown",
        penempatan: permintaan.UnitKerjaPenempatan?.name || "Unknown",
        periode: `${formatDate(permintaan.tanggalMulai)} - ${formatDate(
          permintaan.tanggalSelesai
        )}`,
      })),
    }));

    return res.status(200).json({
      universities: formattedUniversitiesData,
      schools: formattedSchoolsData,
    });
  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({
      message: "Terjadi kesalahan pada server.",
      error: error.message,
    });
  }
};

const detailUnivDiterima = async (req, res) => {
  try {
    const { idUniv, idProdi } = req.params;
    const universitiesDetail = await Permintaan.findAll({
      where: {
        type: "mahasiswa",
        statusId: 1,
        ptId: idUniv,
        prodiId: idProdi,
        penempatan: {
          [sequelize.Op.not]: null,
        },
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
          ],
          attributes: ["email"],
          required: false,
        },
        {
          model: PerguruanTinggi,
          attributes: ["name"],
        },
        {
          model: Prodi,
          attributes: ["name"],
        },
        {
          model: UnitKerja,
          as: "UnitKerjaPenempatan",
          attributes: ["name"],
        },
      ],
      attributes: ["id", "tanggalMulai", "tanggalSelesai", "createdAt"],
    });
    const formattedUniversities = universitiesDetail.map((item) => ({
      id: item.id,
      nama_peserta: item.User?.Mahasiswas?.[0]?.name ?? null,
      nim: item.User?.Mahasiswas?.[0]?.nim ?? null,
      email: item.User?.email ?? null,
      no_hp: item.User?.Mahasiswas?.[0]?.no_hp ?? null,
      alamat: item.User?.Mahasiswas?.[0]?.alamat ?? null,
      institusi: item.PerguruanTinggi?.name ?? null,
      program_studi: item.Prodi?.name ?? null,
      unit_kerja: item.UnitKerjaPenempatan?.name ?? null,
      tanggal_mulai: item.tanggalMulai,
      tanggal_selesai: item.tanggalSelesai,
      tanggal_daftar: item.createdAt,
    }));
    return res.status(200).json(formattedUniversities);
  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
      error: error.message,
    });
  }
};

const getDiverifikasi = async (req, res) => {
  try {
    const permintaanData = await Permintaan.findAll({
      where: {
        statusId: {
          [sequelize.Op.in]: [2, 3],
        },
        penempatan: {
          [sequelize.Op.not]: null,
        },
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
          where: {
            tipeDokumenId: {
              [sequelize.Op.in]: [6, 7],
            },
          },
          required: false,
          attributes: ["url"],
        },
      ],
      attributes: ["id", "type", "tanggalMulai", "tanggalSelesai", "createdAt"],
      distinct: true,
    });

    const result = {
      mahasiswa: {
        institusi: "",
        prodi: "",
        totalPeserta: 0,
        unitKerja: "",
        dataMhs: [],
      },
      siswa: {
        institusi: "",
        totalPeserta: 0,
        unitKerja: "",
        dataSiswa: [],
      },
    };

    const processedNims = new Set();
    const processedNisns = new Set();

    permintaanData.forEach((data) => {
      const cleanData = {
        ...data.dataValues,
        User: data.User
          ? {
              email: data.User.email,
              Mahasiswas:
                data.type === "mahasiswa" ? data.User.Mahasiswas : undefined,
              Siswas: data.type === "siswa" ? data.User.Siswas : undefined,
            }
          : null,
        Dokumens: data.Dokumens ? data.Dokumens.map((dok) => dok.url) : [],
      };

      if (data.type === "mahasiswa") {
        const nim = data.User?.Mahasiswas?.[0]?.nim;
        if (nim && !processedNims.has(nim)) {
          processedNims.add(nim);
          result.mahasiswa.institusi = data.PerguruanTinggi?.name || "";
          result.mahasiswa.prodi = data.Prodi?.name || "";
          result.mahasiswa.unitKerja = data.UnitKerjaPenempatan?.name || "";
          result.mahasiswa.totalPeserta++;
          result.mahasiswa.dataMhs.push({
            ...cleanData,
            institusiId: data.PerguruanTinggi?.id,
            prodiId: data.Prodi?.id,
            penempatanId: data.UnitKerjaPenempatan?.id,
          });
        }
      } else {
        const nisn = data.User?.Siswas?.[0]?.nisn;
        if (nisn && !processedNisns.has(nisn)) {
          processedNisns.add(nisn);
          result.siswa.institusi = data.Smk?.name || "";
          result.siswa.unitKerja = data.UnitKerjaPenempatan?.name || "";
          result.siswa.totalPeserta++;
          result.siswa.dataSiswa.push({
            ...cleanData,
            institusiId: data.Smk?.id,
            penempatanId: data.UnitKerjaPenempatan?.id,
          });
        }
      }
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
      error: error.message,
    });
  }
};

const detailUnivDiverifikasi = async (req, res) => {
  try {
    const { idUniv, idProdi, unitKerjaId } = req.params;

    const universitiesDetail = await Permintaan.findAll({
      where: {
        type: "mahasiswa",
        statusId: {
          [sequelize.Op.in]: [2, 3],
        },
        ptId: idUniv,
        prodiId: idProdi,
        penempatan: unitKerjaId,
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
          ],
          attributes: ["email"],
          required: false,
        },
        {
          model: PerguruanTinggi,
          attributes: ["name"],
        },
        {
          model: Prodi,
          attributes: ["name"],
        },
        {
          model: UnitKerja,
          as: "UnitKerjaPenempatan",
          attributes: ["name"],
        },
        {
          model: Dokumen,
          where: {
            tipeDokumenId: {
              [sequelize.Op.in]: [6, 7, 10],
            },
          },
          required: false,
          attributes: ["url"],
        },
      ],
      attributes: ["id", "tanggalMulai", "tanggalSelesai", "createdAt"],
    });

    const formattedUniversities = universitiesDetail.map((item) => ({
      id: item.id,
      nama_peserta: item.User?.Mahasiswas?.[0]?.name ?? null,
      nim: item.User?.Mahasiswas?.[0]?.nim ?? null,
      email: item.User?.email ?? null,
      no_hp: item.User?.Mahasiswas?.[0]?.no_hp ?? null,
      alamat: item.User?.Mahasiswas?.[0]?.alamat ?? null,
      institusi: item.PerguruanTinggi?.name ?? null,
      program_studi: item.Prodi?.name ?? null,
      unit_kerja: item.UnitKerjaPenempatan?.name ?? null,
      tanggal_mulai: item.tanggalMulai,
      tanggal_selesai: item.tanggalSelesai,
      tanggal_daftar: item.createdAt,
      dokumen_urls: item.Dokumens.map((dok) => dok.url),
    }));

    return res.status(200).json(formattedUniversities);
  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
      error: error.message,
    });
  }
};

const detailSmkDiverifikasi = async (req, res) => {
  try {
    const { idSmk, unitKerjaId } = req.params;
    console.log(req.params);

    const schoolsDetail = await Permintaan.findAll({
      where: {
        type: "siswa",
        statusId: {
          [sequelize.Op.in]: [2, 3],
        },
        smkId: idSmk,
        unitKerjaId: unitKerjaId,
      },
      include: [
        {
          model: Users,
          include: [
            {
              model: Siswa,
              attributes: ["name", "nisn", "no_hp", "alamat"],
              required: false,
            },
          ],
          attributes: ["email"],
          required: false,
        },
        {
          model: Smk,
          attributes: ["name"],
        },
        {
          model: Jurusan,
          attributes: ["name"],
        },
        {
          model: UnitKerja,
          as: "UnitKerjaPenempatan",
          attributes: ["name"],
        },
        {
          model: Dokumen,
          where: {
            tipeDokumenId: {
              [sequelize.Op.in]: [6, 7],
            },
          },
          required: false,
          attributes: ["url"],
        },
      ],
      attributes: ["id", "tanggalMulai", "tanggalSelesai", "createdAt"],
    });

    const formattedSchools = schoolsDetail.map((item) => ({
      id: item.id,
      nama_peserta: item.User?.Siswas?.[0]?.name ?? null,
      nisn: item.User?.Siswas?.[0]?.nisn ?? null,
      email: item.User?.email ?? null,
      no_hp: item.User?.Siswas?.[0]?.no_hp ?? null,
      alamat: item.User?.Siswas?.[0]?.alamat ?? null,
      institusi: item.Smk?.name ?? null,
      jurusan: item.Jurusan?.name ?? null,
      unit_kerja: item.UnitKerjaPenempatan?.name ?? null,
      tanggal_mulai: item.tanggalMulai,
      tanggal_selesai: item.tanggalSelesai,
      tanggal_daftar: item.createdAt,
      dokumen_urls: item.Dokumens.map((dok) => dok.url),
    }));

    return res.status(200).json(formattedSchools);
  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
      error: error.message,
    });
  }
};

const detailSmkDiterima = async (req, res) => {
  try {
    const { idSmk } = req.params;
    const schoolsDetail = await Permintaan.findAll({
      where: {
        type: "siswa",
        statusId: 1,
        smkId: idSmk,
        penempatan: {
          [sequelize.Op.not]: null,
        },
      },
      include: [
        {
          model: Users,
          include: [
            {
              model: Siswa,
              attributes: ["name", "nisn", "no_hp", "alamat"],
              required: false,
            },
          ],
          attributes: ["email"],
          required: false,
        },
        {
          model: Smk,
          attributes: ["name"],
        },
        {
          model: Jurusan,
          attributes: ["name"],
        },
        {
          model: UnitKerja,
          as: "UnitKerjaPenempatan",
          attributes: ["name"],
        },
      ],
      attributes: ["id", "tanggalMulai", "tanggalSelesai", "createdAt"],
    });
    const formattedSchools = schoolsDetail.map((item) => ({
      id: item.id,
      nama_peserta: item.User?.Siswas?.[0]?.name ?? null,
      nisn: item.User?.Siswas?.[0]?.nisn ?? null,
      email: item.User?.email ?? null,
      no_hp: item.User?.Siswas?.[0]?.no_hp ?? null,
      alamat: item.User?.Siswas?.[0]?.alamat ?? null,
      institusi: item.Smk?.name ?? null,
      jurusan: item.Jurusan?.name ?? null,
      unit_kerja: item.UnitKerjaPenempatan?.name ?? null,
      tanggal_mulai: item.tanggalMulai,
      tanggal_selesai: item.tanggalSelesai,
      tanggal_daftar: item.createdAt,
    }));
    return res.status(200).json(formattedSchools);
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
  permintaanDiterima,
  detailUnivDiterima,
  detailSmkDiterima,
  getDiverifikasi,
  detailUnivDiverifikasi,
  detailSmkDiverifikasi,
};
