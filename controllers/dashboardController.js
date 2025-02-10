const {
  Status,
  TipeDokumen,
  Permintaan,
  Dokumen,
  Smk,
  Jurusan,
  Users,
  Siswa,
  UnitKerja,
  PerguruanTinggi,
  Prodi,
  Mahasiswa,
  Karyawan,
  Kehadiran,
  Jadwal,
} = require("../models/index");
const path = require("path");
const { Op } = require("sequelize");
const fs = require("fs");
const { where } = require("sequelize");



const dahsboardData = async (_, res) => {
  try {
    // Get counts for each status category
    const diproses = await Permintaan.count({
      where: {
        statusId: 1,
        penempatan: null,
      },
    });

    const diterima = await Permintaan.count({
      where: {
        statusId: 1,
        penempatan: {
          [sequelize.Op.not]: null,
        },
      },
    });

    const pesertaMagangAktif = await Permintaan.count({
      where: {
        statusId: 4,
      },
    });

    const pesertaSelesai = await Permintaan.count({
      where: {
        statusId: 7,
      },
    });

    // Get total permintaan by type
    const typeCounts = await Permintaan.findAll({
      attributes: [
        "type",
        [sequelize.fn("COUNT", sequelize.col("Permintaan.id")), "count"],
      ],
      group: ["type"],
    });

    // Get top 5 unit kerja with most interns
    const topUnitKerja = await Permintaan.findAll({
      attributes: [
        "penempatan",
        [sequelize.fn("COUNT", sequelize.col("Permintaan.id")), "count"],
      ],
      include: [
        {
          model: UnitKerja,
          as: "UnitKerjaPenempatan",
          attributes: ["name"],
        },
      ],
      where: {
        penempatan: {
          [sequelize.Op.not]: null,
        },
        statusId: {
          [sequelize.Op.in]: [2, 3, 4],
        },
      },
      group: [
        "penempatan",
        "UnitKerjaPenempatan.id",
        "UnitKerjaPenempatan.name",
      ],
      order: [[sequelize.fn("COUNT", sequelize.col("Permintaan.id")), "DESC"]],
      limit: 5,
    });

    // Get total registrants
    const totalRegistrants = await Users.count({
      where: {
        roleId: 1,
      },
      include: [
        {
          model: Permintaan,
          where: {
            penempatan: null,
          },
          required: true,
        },
      ],
    });

    // Get monthly registration trends for current year
    const currentYear = new Date().getFullYear();
    const monthlyTrends = await Users.findAll({
      attributes: [
        [
          sequelize.fn("EXTRACT", sequelize.literal('MONTH FROM "createdAt"')),
          "month",
        ],
        [sequelize.fn("COUNT", sequelize.col("id")), "count"],
      ],
      where: {
        roleId: 1,
        createdAt: {
          [sequelize.Op.between]: [
            new Date(`${currentYear}-01-01`),
            new Date(`${currentYear}-12-31`),
          ],
        },
      },
      group: [
        sequelize.fn("EXTRACT", sequelize.literal('MONTH FROM "createdAt"')),
      ],
    });

    // Format the response
    const response = {
      statusCounts: {
        diproses,
        diterima,
        pesertaMagangAktif,
        pesertaSelesai,
      },
      typeCounts: typeCounts.reduce((acc, curr) => {
        acc[curr.type] = curr.get("count");
        return acc;
      }, {}),
      topUnitKerja: topUnitKerja.map((uk) => ({
        name: uk.UnitKerjaPenempatan?.name,
        count: uk.get("count"),
      })),
      totalRegistrants,

      monthlyRegistrationTrends: monthlyTrends.reduce((acc, curr) => {
        acc[curr.get("month")] = curr.get("count");
        return acc;
      }, {}),
    };

    return res.status(200).json(response);
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
  dahsboardData,
};
