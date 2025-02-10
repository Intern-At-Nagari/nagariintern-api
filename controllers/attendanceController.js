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




const createAbsensi = async (req, res) => {
  try {
    const { permintaanId, bulan, tahun, totalKehadiran } = req.body;

    const [absensi, created] = await Kehadiran.findOrCreate({
      where: {
        permintaanId,
        bulan,
        tahun,
      },
      defaults: {
        totalKehadiran,
      },
    });

    if (!created) {
      await absensi.update({
        totalKehadiran,
      });
    }

    return res.status(201).json({
      status: "success",
      data: absensi,
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

const updateAbsensi = async (req, res) => {
  try {
    const { id } = req.params;
    const { kehadiran } = req.body;
    console.log(req.body);
    console.log(req.params);
    userId = req.userId;
    const karyawan = await Karyawan.findOne({ where: { userId } });
    if (!karyawan) {
      return res.status(404).json({
        status: "error",
        message: "Authentication failed",
      });
    }

    const absensi = await Kehadiran.findByPk(id);

    if (!absensi) {
      return res.status(404).json({
        status: "error",
        message: "Absensi not found",
      });
    }

    await absensi.update({
      totalKehadiran: kehadiran,
    });

    return res.status(200).json({
      status: "success",
      data: absensi,
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

const getAbsensi = async (req, res) => {
  try {
    const userId = req.userId;
    const karyawan = await Karyawan.findOne({ where: { userId } });

    if (!karyawan) {
      return res.status(404).json({ message: "Karyawan tidak ditemukan" });
    }

    const absensi = await Kehadiran.findAll({
      include: [
        {
          model: Permintaan,
          as: "pesertamagang",
          where: { penempatan: karyawan.unitKerjaId },
          include: [
            { model: Status, attributes: ["name"] },
            {
              model: Users,
              attributes: ["email"],
              include: [
                { model: Siswa, attributes: ["name", "nisn", "no_hp"] },
                { model: Mahasiswa, attributes: ["name", "nim", "no_hp"] },
              ],
            },
            {
              model: UnitKerja,
              as: "UnitKerjaPenempatan",
              attributes: ["name"],
            },
          ],
        },
      ],
    });

    if (!absensi.length) {
      return res.status(404).json({ message: "Data absensi tidak ditemukan" });
    }

    const groupedData = {};
    const monthOrder = {
      Januari: 1,
      Februari: 2,
      Maret: 3,
      April: 4,
      Mei: 5,
      Juni: 6,
      Juli: 7,
      Agustus: 8,
      September: 9,
      Oktober: 10,
      November: 11,
      Desember: 12,
    };

    absensi.forEach((item) => {
      const key = `${item.bulan}-${item.tahun}`;
      if (!groupedData[key]) {
        groupedData[key] = {
          bulan: item.bulan,
          tahun: item.tahun,
          totalKehadiran: 0,
          peserta: new Set(),
          filledAbsences: 0,
          unitKerja: item.pesertamagang?.UnitKerjaPenempatan?.name,
          type: item.pesertamagang?.type,
        };
      }
      groupedData[key].totalKehadiran += item.totalKehadiran;
      groupedData[key].peserta.add(item.pesertamagang?.id);
      if (item.totalKehadiran > 0) {
        groupedData[key].filledAbsences += 1;
      }
    });

    const transformedData = Object.values(groupedData)
      .map((item) => {
        const totalPeserta = item.peserta.size;
        return {
          bulan: item.bulan,
          tahun: item.tahun,
          totalKehadiran: item.totalKehadiran,
          peserta: totalPeserta,
          status:
            totalPeserta > 0 ? `${item.filledAbsences}/${totalPeserta}` : "0/0",
          unitKerja: item.unitKerja,
          type: item.type,
        };
      })
      .sort(
        (a, b) => a.tahun - b.tahun || monthOrder[a.bulan] - monthOrder[b.bulan]
      );

    res.status(200).json({
      message: "Data absensi berhasil diambil",
      total: transformedData.length,
      data: transformedData,
    });
  } catch (error) {
    console.error("Get Absensi Error:", error);
    res.status(500).json({
      message: "Terjadi kesalahan saat mengambil data absensi",
      error: error.message,
    });
  }
};

const getDetailAbsensi = async (req, res) => {
  try {
    const { bulan, tahun } = req.params;
    const userId = req.userId;
    const karyawan = await Karyawan.findOne({ where: { userId } });

    if (!karyawan) {
      return res.status(404).json({ message: "Karyawan tidak ditemukan" });
    }

    const absensi = await Kehadiran.findAll({
      where: { bulan, tahun },
      include: [
        {
          model: Permintaan,
          as: "pesertamagang",
          where: { penempatan: karyawan.unitKerjaId },
          include: [
            {
              model: Users,
              attributes: ["email"],
              include: [
                {
                  model: Siswa,
                  attributes: ["name", "rekening"],
                },
                {
                  model: Mahasiswa,
                  attributes: ["name", "rekening"],
                },
              ],
            },
            {
              model: UnitKerja,
              as: "UnitKerjaPenempatan",
              attributes: ["name"],
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
              model: PerguruanTinggi,
              attributes: ["name"],
            },
            {
              model: Prodi,
              attributes: ["name"],
            },
          ],
        },
      ],
    });

    if (!absensi.length) {
      return res
        .status(404)
        .json({ message: "Data detail absensi tidak ditemukan" });
    }

    const rekapKehadiran = await RekapKehadiran.findOne({
      where: {
        bulan,
        tahun,
        karyawanId: karyawan.id,
      },

      include: [
        {
          model: Karyawan,
          as: "karyawan",
        },
      ],
    });

    const detailedData = absensi.map((item, index) => {
      const user = item.pesertamagang.User;
      const nama = user.Mahasiswas?.[0]?.name || user.Siswas?.[0]?.name;
      const institusi =
        item.pesertamagang.Smk?.name ||
        item.pesertamagang.PerguruanTinggi?.name;
      const rekening =
        user.Mahasiswas?.[0]?.rekening || user.Siswas?.[0]?.rekening;
      console.log(user.Mahasiswas?.[0]?.rekening || user.Siswas?.[0]?.rekening);

      return {
        id: item.id,
        nama,
        institusi,
        rekening,
        kehadiran: item.totalKehadiran,
      };
    });

    res.status(200).json({
      message: "Data detail absensi berhasil diambil",
      total: detailedData.length,
      rekapKehadiran: rekapKehadiran,
      data: detailedData,
    });
  } catch (error) {
    console.error("Get Detail Absensi Error:", error);
    res.status(500).json({
      message: "Terjadi kesalahan saat mengambil data detail absensi",
      error: error.message,
    });
  }
};

const generateAbsensi = async (req, res) => {
  try {
    const { bulan, tahun } = req.params;
    const { tempat, nama_pimpinan, jabatan } = req.body;
    console.log(req.body);
    const userId = req.userId;
    const karyawan = await Karyawan.findOne({ where: { userId } });

    if (!karyawan) {
      return res.status(404).json({ message: "Karyawan tidak ditemukan" });
    }

    const absensi = await Kehadiran.findAll({
      where: { bulan, tahun },
      include: [
        {
          model: Permintaan,
          as: "pesertamagang",
          where: { penempatan: karyawan.unitKerjaId },
          include: [
            {
              model: Users,
              attributes: ["email"],
              include: [
                {
                  model: Siswa,
                  attributes: ["name", "rekening"],
                },
                {
                  model: Mahasiswa,
                  attributes: ["name", "rekening"],
                },
              ],
            },
            {
              model: UnitKerja,
              as: "UnitKerjaPenempatan",
              attributes: ["name"],
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
              model: PerguruanTinggi,
              attributes: ["name"],
            },
            {
              model: Prodi,
              attributes: ["name"],
            },
          ],
        },
      ],
    });

    if (!absensi.length) {
      return res
        .status(404)
        .json({ message: "Data detail absensi tidak ditemukan" });
    }

    const detailedData = absensi.map((item, index) => {
      const user = item.pesertamagang.User;
      const nama = user.Mahasiswas?.[0]?.name || user.Siswas?.[0]?.name;
      const institusi =
        item.pesertamagang.Smk?.name ||
        item.pesertamagang.PerguruanTinggi?.name;
      const rekening =
        user.Mahasiswas?.[0]?.rekening || user.Siswas?.[0]?.rekening;

      return {
        id: item.id,
        nama,
        institusi,
        rekening,
        hadir: item.totalKehadiran,
        jumlah: (item.totalKehadiran * 19000).toLocaleString(),
        kode_cb: rekening,
      };
    });

    //jumlahkan semua kehadiran dari detailedData
    const totalKehadiran = detailedData.reduce(
      (acc, item) => acc + item.hadir,
      0
    );
    const totalBiaya = totalKehadiran * 19000;

    const now = new Date();

    const formatLongDate = (date) => {
      const day = date.getDate();
      const months = [
        "JANUARI",
        "FEBRUARI",
        "MARET",
        "APRIL",
        "MEI",
        "JUNI",
        "JULI",
        "AGUSTUS",
        "SEPTEMBER",
        "OKTOBER",
        "NOVEMBER",
        "DESEMBER",
      ];
      return `${day} ${months[date.getMonth()]} ${date.getFullYear()}`;
    };
    console.log(formatLongDate(now));
    const tanggal = formatLongDate(now);

    const data = {
      bulan: bulan.toUpperCase(),
      tahun: tahun,
      total: totalBiaya.toLocaleString(),
      tempat: tempat,
      tanggal: tanggal,
      nama_pimpinan: nama_pimpinan,
      jabatan: jabatan,
      students: detailedData,
    };

    try {
      const templateFile = "templateRekapitulasi.docx";
      const templatePath = path.resolve(__dirname, templateFile);

      if (!fs.existsSync(templatePath)) {
        return res.status(404).json({ message: "Template file not found" });
      }

      const content = fs.readFileSync(templatePath, "binary");
      const zip = new PizZip(content);
      const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
      });

      const dataWithDates = {
        ...data,
        bulan: bulan,
        tahun: tahun,
        tanggal: tanggal,
        tempat: tempat,
        nama_pimpinan: nama_pimpinan,
        jabatan: jabatan,
        total: totalBiaya.toLocaleString(),
        students: data.students.map((student, index) => ({
          no: index + 1,
          ...student,
        })),
      };

      doc.render(dataWithDates);
      const docxBuf = doc.getZip().generate({ type: "nodebuffer" });
      const pdfBuf = await convert(docxBuf, ".pdf", undefined);

      // Set appropriate headers for PDF download
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=absensi_${bulan}_${tahun}.pdf`
      );
      return res.send(pdfBuf);
    } catch (error) {
      console.error("Document generation error:", {
        message: error.message,
        stack: error.stack,
      });
      return res.status(500).json({
        message: "Terjadi kesalahan saat generate dokumen",
        error: error.message,
      });
    }
  } catch (error) {
    console.error("Get Detail Absensi Error:", error);
    return res.status(500).json({
      message: "Terjadi kesalahan saat mengambil data detail absensi",
      error: error.message,
    });
  }
};

const sendAbsensi = async (req, res) => {
  try {
    const { bulan, tahun } = req.params;
    const fileRekap = req.files.fileRekap;

    if (!fileRekap) {
      return res.status(400).json({
        status: "error",
        message: "File rekap absensi is required",
      });
    }

    const userId = req.userId;
    const karyawan = await Karyawan.findOne({ where: { userId } });

    if (!karyawan) {
      return res.status(404).json({ message: "Karyawan tidak ditemukan" });
    }

    // Find or create rekap kehadiran
    const [rekapitulasi, created] = await RekapKehadiran.findOrCreate({
      where: { bulan, tahun, karyawanId: karyawan.id },
      defaults: {
        karyawanId: karyawan.id,
        bulan: bulan,
        tahun: tahun,
        url: req.files.fileRekap[0].filename,
      },
    });

    // If record exists, update it
    if (!created) {
      await rekapitulasi.update({
        bulan: bulan,
        tahun: tahun,
        karyawanId: karyawan.id,
        url: req.files.fileRekap[0].filename,
      });
    }
    res.status(201).json({
      status: "success",
      message: "Rekap absensi berhasil diunggah",
      data: rekapitulasi,
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

const getRekapAbsensi = async (req, res) => {
  try {
    // Get all rekap kehadiran records with related data
    const rekapKehadiran = await RekapKehadiran.findAll({
      include: [
        {
          model: Karyawan,
          as: "karyawan",
          include: [
            {
              model: UnitKerja,
              attributes: ["name"],
            },
          ],
        },
      ],
      order: [
        ["tahun", "DESC"],
        ["bulan", "ASC"],
      ],
    });

    // Get all attendance records with permintaan and jadwal details
    const kehadiran = await Kehadiran.findAll({
      include: [
        {
          model: Permintaan,
          as: "pesertamagang",
          include: [
            {
              model: UnitKerja,
              as: "UnitKerjaPenempatan",
              attributes: ["name"],
            },
            {
              model: Jadwal,
              attributes: ["tanggalMulai", "tanggalTutup"],
            },
          ],
        },
      ],
    });

    // Group kehadiran data by unit kerja, month and year
    const kehadiranData = {};
    kehadiran.forEach((record) => {
      const unitKerja = record.pesertamagang?.UnitKerjaPenempatan?.name;
      const bulan = record.bulan;
      const tahun = record.tahun;
      const jadwalMulai = record.pesertamagang?.Jadwal?.tanggalMulai;
      const jadwalTutup = record.pesertamagang?.Jadwal?.tanggalTutup;

      if (!unitKerja) return;

      const key = `${unitKerja}-${bulan}-${tahun}`;

      if (!kehadiranData[key]) {
        kehadiranData[key] = {
          unit_kerja: unitKerja,
          bulan: bulan,
          tahun: tahun,
          total_peserta: new Set(),
          total_kehadiran: 0,
          total_biaya: 0,
          jadwalMulai: jadwalMulai,
          jadwalTutup: jadwalTutup,
        };
      }

      kehadiranData[key].total_peserta.add(record.permintaanId);
      kehadiranData[key].total_kehadiran += record.totalKehadiran;
      kehadiranData[key].total_biaya += record.totalKehadiran * 19000;
    });

    // Format date helper function
    const formatDate = (date) => {
      if (!date) return "";
      return new Date(date).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    };

    // Format the response by combining rekap and kehadiran data
    const formattedData = rekapKehadiran.map((rekap) => {
      const key = `${rekap.karyawan?.UnitKerja?.name}-${rekap.bulan}-${rekap.tahun}`;
      const kehadiranInfo = kehadiranData[key] || {
        total_peserta: new Set(),
        total_kehadiran: 0,
        total_biaya: 0,
        jadwalMulai: null,
        jadwalTutup: null,
      };

      return {
        id: rekap.id,
        unit_kerja: rekap.karyawan?.UnitKerja?.name || "Unknown",
        bulan: rekap.bulan,
        tahun: rekap.tahun,
        periode: `${formatDate(kehadiranInfo.jadwalMulai)} - ${formatDate(
          kehadiranInfo.jadwalTutup
        )}`,
        total_peserta: kehadiranInfo.total_peserta.size,
        total_kehadiran: kehadiranInfo.total_kehadiran,
        total_biaya: kehadiranInfo.total_biaya.toLocaleString("id-ID"),
        url_rekap: rekap.url,
        uploaded_by: rekap.karyawan?.nama || "Unknown",
        uploaded_at: rekap.createdAt,
      };
    });

    // Sort by year and month
    formattedData.sort((a, b) => {
      if (a.tahun !== b.tahun) {
        return b.tahun - a.tahun;
      }
      const months = [
        "Januari",
        "Februari",
        "Maret",
        "April",
        "Mei",
        "Juni",
        "Juli",
        "Agustus",
        "September",
        "Oktober",
        "November",
        "Desember",
      ];
      return months.indexOf(a.bulan) - months.indexOf(b.bulan);
    });

    return res.status(200).json({
      status: "success",
      total: formattedData.length,
      data: formattedData,
    });
  } catch (error) {
    console.error("Error in getRekapAbsensi:", error);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
      error: error.message,
    });
  }
};

module.exports = {
  createAbsensi,
  getAbsensi,
  getDetailAbsensi,
  updateAbsensi,
  generateAbsensi,
  getRekapAbsensi,
  sendAbsensi,
};
