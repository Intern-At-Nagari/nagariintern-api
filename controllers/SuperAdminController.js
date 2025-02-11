const PizZip = require("pizzip");
const Docxtemplater = require("docxtemplater");
const fs = require("fs");
const path = require("path");
const { Op } = require("sequelize");
const {
  UnitKerja,
  Permintaan,
  PerguruanTinggi,
  Smk,
  Prodi,
  Jurusan,
  Users,
  Mahasiswa,
  Siswa,
  Dokumen,
  Jadwal,
  Karyawan,
  Kehadiran,
  Status,
  RekapKehadiran,
  TipeDokumen
} = require("../models/index");
const sequelize = require("sequelize");
const libre = require("libreoffice-convert");
const util = require("util");
const convert = util.promisify(libre.convert);
const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");
const { get } = require("http");
const ejs = require('ejs');

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

const permintaanDiterima = async (req, res) => {
  try {
    // Query for universities data with student names
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

const generateLetter = async (data) => {
  try {
    console.log("Generating letter with data:", JSON.stringify(data, null, 2));

    let templateFile;
    if (data.jml && data.terbilang) {
      templateFile =
        data.type === "mahasiswa"
          ? "templatePengantarMhs.docx"
          : "templatePengantarSiswa.docx";
    } else {
      templateFile =
        data.type === "mahasiswa" ? "templateMhs.docx" : "templateSiswa.docx";
    }
    console.log("Using template:", templateFile);
    const templatePath = path.resolve(__dirname, templateFile);
    if (!fs.existsSync(templatePath)) {
      throw new Error(`Template file not found: ${templateFile}`);
    }
    const content = fs.readFileSync(templatePath, "binary");
    const zip = new PizZip(content);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
    });
    if (!data.participants || data.participants.length === 0) {
      throw new Error("No participants data provided");
    }
    const now = new Date();
    const formatShortDate = (date) => {
      const month = date.getMonth() + 1;
      const year = date.getFullYear();
      return `${month.toString().padStart(2, "0")}-${year}`;
    };
    const formatLongDate = (date) => {
      const day = date.getDate();
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
      return `${day} ${months[date.getMonth()]} ${date.getFullYear()}`;
    };
    const dataWithDates = {
      ...data,
      jml: data.jml || data.participants.length,
      tanggal_singkat: formatShortDate(now),
      tanggal_panjang: formatLongDate(now),
      students: data.participants.map((student, index) => ({
        no: index + 1,
        ...student,
      })),
    };
    console.log(
      "Rendering template with data:",
      JSON.stringify(dataWithDates, null, 2)
    );
    doc.render(dataWithDates);
    const docxBuf = doc.getZip().generate({ type: "nodebuffer" });
    console.log("DOCX generated successfully");
    console.log("Converting to PDF...");
    const pdfBuf = await convert(docxBuf, ".pdf", undefined);
    console.log("PDF conversion successful");
    return pdfBuf;
  } catch (error) {
    console.error("Detailed error in generateLetter:", {
      message: error.message,
      stack: error.stack,
      data: JSON.stringify(data, null, 2),
    });
    throw error;
  }
};

const univGenerateLetter = async (req, res) => {
  try {
    const { idUniv, idProdi } = req.params;
    const { nomorSurat, perihal, pejabat, institusi, prodi, perihal_detail } =
      req.body;
    console.log("prodi", prodi);
    console.log("req body", req.body);
    const universitiesDetail = await Permintaan.findAll({
      where: {
        type: "mahasiswa",
        statusId: 1,
        penempatan: {
          [sequelize.Op.not]: null,
        },
        ptId: idUniv,
        prodiId: idProdi,
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
    const formatPeriod = (startDate, endDate) => {
      const formatDate = (date) => {
        const d = new Date(date);
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
        return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
      };
      return `${formatDate(startDate)} - ${formatDate(endDate)}`;
    };
    const participants = universitiesDetail.map((item) => ({
      nama_mahasiswa: item.User?.Mahasiswas?.[0]?.name || "",
      nim: item.User?.Mahasiswas?.[0]?.nim || "",
      penempatan: item.UnitKerjaPenempatan?.name || "",
      periode: formatPeriod(item.tanggalMulai, item.tanggalSelesai),
    }));
    const data = {
      noSurat: nomorSurat,
      perihal: perihal,
      pejabat: pejabat,
      institusi: institusi,
      prodi: prodi,
      perihal_detail: perihal_detail,
      participants: participants,
      type: "mahasiswa",
    };
    const pdfBuffer = await generateLetter(data);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=surat_magang.pdf"
    );
    res.setHeader("Content-Length", pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
      error: error.message,
    });
  }
};

const smkGenerateLetter = async (req, res) => {
  try {
    const { idSmk } = req.params;
    const { nomorSurat, perihal, pejabat, institusi, perihal_detail } =
      req.body;

    console.log("Fetching SMK details for ID:", idSmk);

    const smkDetail = await Permintaan.findAll({
      where: {
        type: "siswa",
        statusId: 1,
        penempatan: {
          [sequelize.Op.not]: null,
        },
        smkId: idSmk,
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

    if (!smkDetail || smkDetail.length === 0) {
      console.log("No SMK details found for ID:", idSmk);
      return res.status(404).json({
        status: "error",
        message: "No data found for the specified SMK",
      });
    }

    console.log("Found SMK details:", JSON.stringify(smkDetail, null, 2));

    const formatPeriod = (startDate, endDate) => {
      const formatDate = (date) => {
        const d = new Date(date);
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
        return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
      };
      return `${formatDate(startDate)} - ${formatDate(endDate)}`;
    };

    const participants = smkDetail.map((item) => ({
      nama_siswa: item.User?.Siswas?.[0]?.name || "",
      nisn: item.User?.Siswas?.[0]?.nisn || "",
      penempatan: item.UnitKerjaPenempatan?.name || "",
      periode: formatPeriod(item.tanggalMulai, item.tanggalSelesai),
    }));

    const data = {
      noSurat: nomorSurat,
      perihal: perihal,
      pejabat: pejabat,
      institusi: institusi,
      perihal_detail: perihal_detail,
      participants: participants,
      type: "siswa", // Add this
    };

    console.log("Generating letter with data:", JSON.stringify(data, null, 2));
    const pdfBuffer = await generateLetter(data);
    console.log("PDF generated successfully, size:", pdfBuffer.length);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=surat_magang.pdf"
    );
    res.setHeader("Content-Length", pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (error) {
    console.error("Detailed error in smkGenerateLetter:", {
      message: error.message,
      stack: error.stack,
      params: req.params,
      body: req.body,
    });

    return res.status(500).json({
      status: "error",
      message: "Gagal membuat surat",
      error: error.message,
    });
  }
};

const generateSuratPengantarMhs = async (req, res) => {
  try {
    const { idUniv, idProdi, unitKerjaId } = req.params;
    const {
      nomorSurat,
      perihal,
      pejabat,
      terbilang,
      institusi,
      prodi,
      tmptMagang,
    } = req.body;

    const universitiesDetail = await Permintaan.findAll({
      where: {
        type: "mahasiswa",
        statusId: {
          [sequelize.Op.in]: [2, 3],
        },
        penempatan: unitKerjaId, // Changed this line to use penempatan
        ptId: idUniv,
        prodiId: idProdi,
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

    const formatPeriod = (startDate, endDate) => {
      const formatDate = (date) => {
        const d = new Date(date);
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
        return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
      };
      return `${formatDate(startDate)} - ${formatDate(endDate)}`;
    };

    const participants = universitiesDetail.map((item) => ({
      nama_mahasiswa: item.User?.Mahasiswas?.[0]?.name || "",
      nim: item.User?.Mahasiswas?.[0]?.nim || "",
      penempatan: item.UnitKerjaPenempatan?.name || "",
      periode: formatPeriod(item.tanggalMulai, item.tanggalSelesai),
    }));

    const data = {
      noSurat: nomorSurat,
      perihal: perihal,
      pejabat: pejabat,
      terbilang: terbilang,
      institusi: institusi,
      prodi: prodi,
      tmptMagang: tmptMagang,
      jml: participants.length,
      participants: participants,
      type: "mahasiswa", // Add this
    };
    console.log("Data:", data);
    const pdfBuffer = await generateLetter(data);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=surat_pengantar.pdf"
    );
    res.setHeader("Content-Length", pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
      error: error.message,
    });
  }
};

const generateSuratPengantarSiswa = async (req, res) => {
  try {
    const { idSmk, unitKerjaId } = req.params;
    const { nomorSurat, perihal, pejabat, terbilang, institusi, tmptMagang } =
      req.body;

    const smkDetail = await Permintaan.findAll({
      where: {
        type: "siswa",
        statusId: {
          [sequelize.Op.in]: [2, 3],
        },
        penempatan: unitKerjaId,
        smkId: idSmk,
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
          model: UnitKerja,
          as: "UnitKerjaPenempatan",
          attributes: ["name"],
        },
      ],
      attributes: ["id", "tanggalMulai", "tanggalSelesai", "createdAt"],
    });

    const formatPeriod = (startDate, endDate) => {
      const formatDate = (date) => {
        const d = new Date(date);
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
        return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
      };
      return `${formatDate(startDate)} - ${formatDate(endDate)}`;
    };

    const participants = smkDetail.map((item) => ({
      nama_siswa: item.User?.Siswas?.[0]?.name || "",
      nisn: item.User?.Siswas?.[0]?.nisn || "",
      penempatan: item.UnitKerjaPenempatan?.name || "",
      periode: formatPeriod(item.tanggalMulai, item.tanggalSelesai),
    }));

    const data = {
      noSurat: nomorSurat,
      perihal: perihal,
      pejabat: pejabat,
      terbilang: terbilang,
      institusi: institusi,
      tmptMagang: tmptMagang,
      jml: participants.length,
      participants: participants,
      type: "siswa", // Add this
    };
    console.log("Data:", data);
    const pdfBuffer = await generateLetter(data);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=surat_pengantar.pdf"
    );
    res.setHeader("Content-Length", pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
      error: error.message,
    });
  }
};

const sendSuratBalasan = async (req, res) => {
  try {
    const responseArray = JSON.parse(req.body.responseArray);

    if (!Array.isArray(responseArray)) {
      return res.status(400).json({
        status: "error",
        message: "responseArray harus berupa array",
      });
    }

    if (!req.files || !req.files.fileSuratBalasan) {
      return res.status(400).json({
        status: "error",
        message: "File surat balasan harus diunggah",
      });
    }

    const logoUrl = "https://upload.wikimedia.org/wikipedia/commons/d/db/Bank_Nagari.svg";

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    for (const response of responseArray) {
      const participant = await Permintaan.findOne({
        where: { id: response.id },
        include: [{
          model: Users,
          include: [
            { model: Mahasiswa, attributes: ['name'] },
            { model: Siswa, attributes: ['name'] }
          ]
        }]
      });

      if (!participant) {
        console.error(`Participant with id ${response.id} not found`);
        continue;
      }

      const nama = participant.User?.Mahasiswas?.[0]?.name || 
                  participant.User?.Siswas?.[0]?.name || 
                  'Peserta Magang';

      const templatePath = path.join(__dirname, '../public/template/SuratBalasanMail.ejs');
      const emailTemplate = await ejs.renderFile(templatePath, { 
        nama,
        logoUrl
      });

      const mailOptions = {
        from: `"Bank Nagari Intern" <${process.env.EMAIL_USER}>`,
        to: response.email,
        subject: "Surat Balasan Magang - Bank Nagari",
        html: emailTemplate,
        attachments: [{
          filename: req.files.fileSuratBalasan[0].filename,
          path: req.files.fileSuratBalasan[0].path,
        }]
      };

      try {
        await transporter.sendMail(mailOptions);

        await Promise.all([
          Dokumen.create({
            permintaanId: response.id,
            tipeDokumenId: 5,
            url: req.files.fileSuratBalasan[0].filename,
          }),
          Permintaan.update({ statusId: 2 }, { where: { id: response.id } })
        ]);
      } catch (emailError) {
        console.error(`Error sending email to ${response.email}:`, emailError);
        continue;
      }
    }

    return res.status(200).json({
      status: "success",
      message: "Surat balasan berhasil dikirim ke semua email"
    });

  } catch (error) {
    console.error("Error in sendSuratBalasan:", error);
    return res.status(500).json({
      status: "error", 
      message: "Internal server error",
      error: error.message
    });
  }
};

const sendSuratPengantar = async (req, res) => {
  try {
    const responseArray = JSON.parse(req.body.responseArray);
    if (!Array.isArray(responseArray)) {
      return res.status(400).json({
        status: "error",
        message: "responseArray harus berupa array",
      });
    }

    // Check if all participants have statusId = 3
    for (const response of responseArray) {
      const participant = await Permintaan.findOne({
        where: { id: response.id }
      });
      
      if (!participant || participant.statusId !== 3) {
        return res.status(400).json({
          status: "error", 
          message: "Belum semua peserta mengupload surat pernyataan"
        });
      }
    }

    if (!req.files || !req.files.SuratPengantar) {
      return res.status(400).json({
        status: "error",
        message: "File surat pengantar harus diunggah",
      });
    }

    const logoUrl = "https://upload.wikimedia.org/wikipedia/commons/d/db/Bank_Nagari.svg";
    
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    for (const response of responseArray) {
      // Get participant details
      const participant = await Permintaan.findOne({
        where: { id: response.id },
        include: [{
          model: Users,
          include: [
            { model: Mahasiswa, attributes: ['name'] },
            { model: Siswa, attributes: ['name'] }
          ]
        }]
      });

      if (!participant) {
        console.error(`Participant with id ${response.id} not found`);
        continue;
      }

      const nama = participant.User?.Mahasiswas?.[0]?.name || 
                  participant.User?.Siswas?.[0]?.name || 
                  'Peserta Magang';

      // Render email template
      const templatePath = path.join(__dirname, '../public/template/SuratPengantarMail.ejs');
      const emailTemplate = await ejs.renderFile(templatePath, { 
        nama,
        logoUrl
      });

      const mailOptions = {
        from: `"Bank Nagari Intern" <${process.env.EMAIL_USER}>`,
        to: response.email,
        subject: "Surat Pengantar Magang - Bank Nagari",
        html: emailTemplate,
        attachments: [{
          filename: req.files.SuratPengantar[0].filename,
          path: req.files.SuratPengantar[0].path,
        }]
      };

      await transporter.sendMail(mailOptions);

      await Promise.all([
        Dokumen.create({
          permintaanId: response.id,
          tipeDokumenId: 8,
          url: req.files.SuratPengantar[0].filename,
        }),
        Permintaan.update({ statusId: 4 }, { where: { id: response.id } }),
      ]);

      // Create attendance records
      const start = new Date(response.tanggal_mulai);
      const end = new Date(response.tanggal_selesai);
      const currentDate = new Date(start);
      currentDate.setDate(1);
      
      const kehadiranRecords = [];
      while (currentDate <= end) {
        kehadiranRecords.push({
          permintaanId: response.id,
          bulan: currentDate.toLocaleString("id-ID", { month: "long" }),
          tahun: currentDate.getFullYear(),
          totalKehadiran: 0,
        });
        currentDate.setMonth(currentDate.getMonth() + 1);
      }
      
      await Kehadiran.bulkCreate(kehadiranRecords);
    }

    res.status(200).json({
      status: "success",
      message: "Surat pengantar berhasil dikirim ke semua email",
    });
  } catch (error) {
    console.error("Error in sendSuratPengantar:", error);
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

const getAllPermintaanMagang = async (req, res) => {
  try {
    const permintaan = await Permintaan.findAll({
      where: {
        penempatan: null, // Only get records where penempatan is null
      },
      include: [
        {
          model: Status,
          attributes: ["name"],
        },
        {
          model: Users,
          attributes: ["email"],
          include: [
            {
              model: Siswa,
              attributes: ["name", "nisn", "no_hp", "alamat"],
            },
            {
              model: Mahasiswa,
              attributes: ["name", "nim", "no_hp", "alamat"],
            },
          ],
        },
        {
          model: UnitKerja,
          as: "UnitKerjaPengajuan",
          attributes: ["name"],
        },
        {
          model: UnitKerja,
          as: "UnitKerjaPenempatan",
          attributes: ["name"],
        },
        {
          model: Dokumen,
          required: false,
          include: [
            {
              model: TipeDokumen,
              as: "tipeDokumen",
              attributes: ["name"],
            },
          ],
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
      order: [["createdAt", "DESC"]],
    });

    if (!permintaan.length) {
      return res.status(404).json({
        message: "Data permintaan magang tidak ditemukan",
      });
    }

    const transformedData = permintaan.map((item) => {
      const baseData = {
        id: item.id,
        userId: item.userId,
        email: item.User.email,
        type: item.type,
        tanggalMulai: item.tanggalMulai,
        tanggalSelesai: item.tanggalSelesai,
        status: item.Status,
        unitKerja: item.UnitKerjaPengajuan?.name || null,
        penempatan: item.UnitKerjaPenempatan?.name || null,
        dokumen: item.Dokumens
          ? item.Dokumens.map((doc) => ({
              tipe: doc.tipeDokumen?.name || null,
              url: doc.url,
            }))
          : [],
        createdAt: item.createdAt,
      };

      if (item.type === "siswa") {
        const siswa = item.User?.Siswas?.[0];
        baseData.institusi = item.Smk?.name || null;
        baseData.jurusan = item.Jurusan?.name || null;
        if (siswa) {
          baseData.biodata = {
            nama: siswa.name,
            nisn: siswa.nisn,
            noHp: siswa.no_hp,
            alamat: siswa.alamat,
          };
        }
      } else if (item.type === "mahasiswa") {
        const mahasiswa = item.User?.Mahasiswas?.[0];
        baseData.institusi = item.PerguruanTinggi?.name || null;
        baseData.jurusan = item.Prodi?.name || null;
        if (mahasiswa) {
          baseData.biodata = {
            nama: mahasiswa.name,
            nim: mahasiswa.nim,
            noHp: mahasiswa.no_hp,
            alamat: mahasiswa.alamat,
          };
        }
      }

      return baseData;
    });

    res.status(200).json({
      message: "Data permintaan magang berhasil diambil",
      total: transformedData.length,
      data: transformedData,
    });
  } catch (error) {
    console.error("Get All Permintaan Magang Error:", error);
    res.status(500).json({
      message: "Terjadi kesalahan saat mengambil data permintaan magang",
      error: error.message,
    });
  }
};

const getPermintaanMagangById = async (req, res) => {
  try {
    const { id } = req.params;

    const permintaanMagang = await Permintaan.findByPk(id, {
      include: [
        {
          model: Users,
          attributes: ["email"],
          include: [
            {
              model: Siswa,
              attributes: ["name", "nisn", "no_hp", "alamat"],
            },
            {
              model: Mahasiswa, 
              attributes: ["name", "nim", "no_hp", "alamat"],
            },
          ],
        },
        { model: Smk, attributes: ["name"] },
        { model: Jurusan, attributes: ["name"] },
        {
          model: UnitKerja,
          as: "UnitKerjaPengajuan",
          attributes: ["name"],
        },
        {
          model: UnitKerja, 
          as: "UnitKerjaPenempatan",
          attributes: ["name"],
        },
        { model: PerguruanTinggi, attributes: ["name"] },
        { model: Prodi, attributes: ["name"] },
        { model: Status },
        { model: Kehadiran },
        {
          model: Dokumen,
          required: false,
          include: [
            {
              model: TipeDokumen,
              as: "tipeDokumen",
            },
          ],
        },
      ],
      order: [[Kehadiran, "id", "ASC"]],
    });

    if (!permintaanMagang) {
      return res.status(404).json({
        message: "Permintaan magang tidak ditemukan.",
      });
    }

    // Transform dokumen array into object with tipeDokumen as keys
    const transformedData = {
      ...permintaanMagang.toJSON(),
      dokumen: permintaanMagang.Dokumens.reduce((acc, doc) => {
        if (doc.tipeDokumen) {
          acc[doc.tipeDokumen.name.toLowerCase().replace(/\s+/g, '_')] = doc.url;
        }
        return acc;
      }, {}),
    };

    // Remove the original Dokumens array
    delete transformedData.Dokumens;

    res.status(200).json(transformedData);
  } catch (error) {
    console.error("Error in getPermintaanMagangById:", error.message || error);
    res.status(500).json({
      message: "Terjadi kesalahan pada server.",
      error: error.message,
    });
  }
};

const approveStatusPermintaanMagang = async (req, res) => {
  try {
    const { id } = req.params;
    const { penempatan } = req.body;

    console.log(req.body);
    const permintaanMagang = await Permintaan.findByPk(id);

    if (!permintaanMagang) {
      return res
        .status(404)
        .json({ error: "Permintaan magang tidak ditemukan." });
    }

    // Validate penempatan exists in UnitKerja
    if (penempatan) {
      const unitKerja = await UnitKerja.findByPk(penempatan);
      if (!unitKerja) {
        return res
          .status(400)
          .json({ error: "Unit kerja penempatan tidak valid" });
      }

      // Check and update quota based on internship type
      if (permintaanMagang.type === "siswa") {
        if (unitKerja.kuotaSiswa <= 0) {
          return res
            .status(400)
            .json({ error: "Kuota siswa magang sudah penuh" });
        }
        await unitKerja.update({
          kuotaSiswa: unitKerja.kuotaSiswa - 1,
        });
      } else if (permintaanMagang.type === "mahasiswa") {
        if (unitKerja.kuotaMhs <= 0) {
          return res
            .status(400)
            .json({ error: "Kuota mahasiswa magang sudah penuh" });
        }
        await unitKerja.update({
          kuotaMhs: unitKerja.kuotaMhs - 1,
        });
      }
    }

    // Update both penempatan and unitKerjaId if penempatan provided
    const updateData = {};
    if (penempatan) {
      updateData.penempatan = penempatan;
      updateData.unitKerjaId = penempatan;
    }

    await permintaanMagang.update(updateData);

    res.status(200).json({
      message: "Penempatan magang berhasil diperbarui.",
      data: permintaanMagang,
    });
  } catch (error) {
    console.error(
      "Error in approveStatusPermintaanMagang:",
      error.message || error
    );
    res.status(500).json({ error: "Terjadi kesalahan pada server." });
  }
};

const rejectedStatusPermintaanMagang = async (req, res) => {
  try {
    const { id } = req.params;
    const { keterangan } = req.body;

    const permintaanMagang = await Permintaan.findByPk(id);

    if (!permintaanMagang) {
      return res
        .status(404)
        .json({ error: "Permintaan magang tidak ditemukan." });
    }

    await permintaanMagang.update({
      statusId: 5,
      keterangan: keterangan,
    });

    res.status(200).json({
      message: "Permintaan magang berhasil ditolak.",
      data: permintaanMagang,
    });
  } catch (error) {
    console.error(
      "Error in rejectStatusPermintaanMagang:",
      error.message || error
    );
    res.status(500).json({ error: "Terjadi kesalahan pada server." });
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
              [sequelize.Op.in]: [6, 7, 10],
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

const createAccountPegawaiCabang = async (req, res) => {
  try {
    const { email, unitKerjaId } = req.body;

    // Generate random password
    const generatePassword = () => {
      const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
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

    const verificationLink = `${req.protocol}://${req.get("host")}/verify-email-pegawai?token=${user.id}`;
    const logoUrl = "https://upload.wikimedia.org/wikipedia/commons/d/db/Bank_Nagari.svg";

    // Render email template
    const templatePath = path.join(__dirname, '../public/template/AccountCreatedMail.ejs');
    const emailTemplate = await ejs.renderFile(templatePath, {
      email,
      password,
      verificationLink,
      logoUrl
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
      message: "Account created successfully. Credentials have been sent to the email.",
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
    const logoUrl = "https://upload.wikimedia.org/wikipedia/commons/d/db/Bank_Nagari.svg";

    // Render email template
    const templatePath = path.join(__dirname, '../public/template/ResetPassword.ejs');
    const emailTemplate = await ejs.renderFile(templatePath, {
      password,
      logoUrl
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

const generateLampiranRekomenMhs = async (req, res) => {
  try {
    const fs = require("fs");
    const path = require("path");
    const PizZip = require("pizzip");
    const Docxtemplater = require("docxtemplater");

    // Mock response object to capture permintaanDiterima data
    const mockRes = {
      status: () => ({ json: (data) => data }),
    };

    // Get data from permintaanDiterima function
    const { universities = [] } = await permintaanDiterima(req, mockRes);

    if (!universities || universities.length === 0) {
      return res.status(404).json({
        status: "error",
        message: "No data found",
      });
    }

    // Format data for template
    const institusi = universities.reduce((acc, univ) => {
      if (univ.prodi && Array.isArray(univ.prodi)) {
        const prodiData = univ.prodi.map((prodiData) => ({
          prodi: prodiData.nama_prodi,
          univ: univ.nama_institusi,
          students: Array.isArray(prodiData.mahasiswa)
            ? prodiData.mahasiswa.map((student, index) => ({
              no: index + 1,
              nama: student.nama,
              jurusan: prodiData.nama_prodi,
              penempatan: student.penempatan,
              periode: student.periode,
            }))
            : [],
        }));
        return [...acc, ...prodiData];
      }
      return acc;
    }, []);

    const data = {
      institusi: institusi,
    };

    // Load template
    const templatePath = path.join(__dirname, "templateRekomenMhs.docx");

    if (!fs.existsSync(templatePath)) {
      return res.status(404).json({
        status: "error",
        message: "Template file not found at: " + templatePath,
      });
    }

    const content = fs.readFileSync(templatePath, "binary");
    const zip = new PizZip(content);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
    });

    // Render template
    doc.render(data);
    const buffer = doc.getZip().generate({
      type: "nodebuffer",
    });

    // Send response
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=lampiran_rekomendasi.docx"
    );
    res.setHeader("Content-Length", buffer.length);
    res.send(buffer);
  } catch (error) {
    console.error("Error:", error);
    if (!res.headersSent) {
      return res.status(500).json({
        status: "error",
        message: "Internal server error",
        error: error.message,
      });
    }
  }
};

const generateLampiranRekomenSiswa = async (req, res) => {
  try {
    const fs = require("fs");
    const path = require("path");
    const PizZip = require("pizzip");
    const Docxtemplater = require("docxtemplater");

    // Mock response object to capture permintaanDiterima data
    const mockRes = {
      status: () => ({ json: (data) => data }),
    };

    // Get data from permintaanDiterima function
    const { schools = [] } = await permintaanDiterima(req, mockRes);

    if (!schools || schools.length === 0) {
      return res.status(404).json({
        status: "error",
        message: "No data found",
      });
    }

    // Format data for template
    const institusi = schools.map((school) => ({
      nama_institusi: school.nama_institusi,
      students: Array.isArray(school.siswa)
        ? school.siswa.map((student, index) => ({
          no: index + 1,
          nama: student.nama,
          penempatan: student.penempatan,
          periode: student.periode,
        }))
        : [],
    }));

    const data = {
      institusi: institusi,
    };

    // Load template
    const templatePath = path.join(__dirname, "templateRekomenSiswa.docx");

    if (!fs.existsSync(templatePath)) {
      return res.status(404).json({
        status: "error",
        message: "Template file not found at: " + templatePath,
      });
    }

    const content = fs.readFileSync(templatePath, "binary");
    const zip = new PizZip(content);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
    });

    // Render template
    doc.render(data);
    const buffer = doc.getZip().generate({
      type: "nodebuffer",
    });

    // Send response
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=lampiran_rekomendasi_siswa.docx"
    );
    res.setHeader("Content-Length", buffer.length);
    res.send(buffer);
  } catch (error) {
    console.error("Error:", error);
    if (!res.headersSent) {
      return res.status(500).json({
        status: "error",
        message: "Internal server error",
        error: error.message,
      });
    }
  }
};

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

const getSelesai = async (req, res) => {
  try {

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
              attributes: ["name"]
            }
          ]
        }
      ],
      order: [
        ["tahun", "DESC"],
        ["bulan", "ASC"]
      ]
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
              attributes: ["name"]
            },
            {
              model: Jadwal,
              attributes: ["tanggalMulai", "tanggalTutup"]
            }
          ]
        }
      ]
    });

    // Group kehadiran data by unit kerja, month and year
    const kehadiranData = {};
    kehadiran.forEach(record => {
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
          jadwalTutup: jadwalTutup
        };
      }

      kehadiranData[key].total_peserta.add(record.permintaanId);
      kehadiranData[key].total_kehadiran += record.totalKehadiran;
      kehadiranData[key].total_biaya += record.totalKehadiran * 19000;
    });

    // Format date helper function
    const formatDate = (date) => {
      if (!date) return '';
      return new Date(date).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
    };

    // Format the response by combining rekap and kehadiran data
    const formattedData = rekapKehadiran.map(rekap => {
      const key = `${rekap.karyawan?.UnitKerja?.name}-${rekap.bulan}-${rekap.tahun}`;
      const kehadiranInfo = kehadiranData[key] || {
        total_peserta: new Set(),
        total_kehadiran: 0,
        total_biaya: 0,
        jadwalMulai: null,
        jadwalTutup: null
      };

      return {
        id: rekap.id,
        unit_kerja: rekap.karyawan?.UnitKerja?.name || "Unknown",
        bulan: rekap.bulan,
        tahun: rekap.tahun,
        periode: `${formatDate(kehadiranInfo.jadwalMulai)} - ${formatDate(kehadiranInfo.jadwalTutup)}`,
        total_peserta: kehadiranInfo.total_peserta.size,
        total_kehadiran: kehadiranInfo.total_kehadiran,
        total_biaya: kehadiranInfo.total_biaya.toLocaleString("id-ID"),
        url_rekap: rekap.url,
        uploaded_by: rekap.karyawan?.nama || "Unknown",
        uploaded_at: rekap.createdAt
      };
    });

    // Sort by year and month
    formattedData.sort((a, b) => {
      if (a.tahun !== b.tahun) {
        return b.tahun - a.tahun;
      }
      const months = [
        "Januari", "Februari", "Maret", "April", "Mei", "Juni",
        "Juli", "Agustus", "September", "Oktober", "November", "Desember"
      ];
      return months.indexOf(a.bulan) - months.indexOf(b.bulan);
    });

    return res.status(200).json({
      status: "success",
      total: formattedData.length,
      data: formattedData
    });

  } catch (error) {
    console.error("Error in getRekapAbsensi:", error);
    return res.status(500).json({
      status: "error", 
      message: "Internal server error",
      error: error.message
    });
  }
};

module.exports = {
  createJadwalPendaftaran,
  getAllUnitKerja,
  editKuotaUnitKerja,
  permintaanDiterima,
  detailUnivDiterima,
  detailSmkDiterima,
  generateLetter,
  univGenerateLetter,
  smkGenerateLetter,
  sendSuratBalasan,
  getDiverifikasi,
  detailUnivDiverifikasi,
  detailSmkDiverifikasi,
  generateSuratPengantarMhs,
  generateSuratPengantarSiswa,
  sendSuratPengantar,
  editSchedule,
  createAccountPegawaiCabang,
  getAccountPegawai,
  editPasswordPegawai,
  generateLampiranRekomenMhs,
  generateLampiranRekomenSiswa,
  dahsboardData,
  getSelesai,
  getDetailSelesai,
  getMulaiMagang,
  editWaktuSelesaiPesertaMagang,
  getRekapAbsensi,
  getAllPermintaanMagang,
  getPermintaanMagangById,
  approveStatusPermintaanMagang,
  rejectedStatusPermintaanMagang
};
