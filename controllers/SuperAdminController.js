const PizZip = require("pizzip");
const Docxtemplater = require("docxtemplater");
const fs = require("fs");
const path = require("path");
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
} = require("../models");
const sequelize = require("sequelize");
const libre = require('libreoffice-convert');
const util = require('util');
const convert = util.promisify(libre.convert);

const calculateAvailableQuota = async () => {
  const unitKerjas = await UnitKerja.findAll();
  const acceptedRequests = await Permintaan.findAll({
    where: {
      statusId: 2 
    },
    attributes: [
      'unitKerjaId',
      'type',
      [sequelize.fn('COUNT', sequelize.col('id')), 'count']
    ],
    group: ['unitKerjaId', 'type']
  });

  return unitKerjas.map(unit => {
    const mhsCount = acceptedRequests.find(r =>
      r.unitKerjaId === unit.id && r.type === 'mahasiswa'
    )?.get('count') || 0;
   
    const siswaCount = acceptedRequests.find(r =>
      r.unitKerjaId === unit.id && r.type === 'siswa'
    )?.get('count') || 0;

    return {
      ...unit.toJSON(),
      sisaKuotaMhs: unit.kuotaMhs - mhsCount,
      sisaKuotaSiswa: unit.kuotaSiswa - siswaCount
    };
  });
};

const getAllUnitKerja = async (req, res) => {
  try {
    const unitKerjaWithQuota = await calculateAvailableQuota();
    return res.status(200).json({
      unitKerja: unitKerjaWithQuota 
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

const editKuotaUnitKerja = async (req, res) => {
  try {
    const { id } = req.params;
    const { tipe_cabang } = req.body;

    const unitKerja = await UnitKerja.findByPk(id);

    if (!unitKerja) {
      return res.status(404).json({ error: "Unit kerja tidak ditemukan." });
    }

    // Validate tipe_cabang
    if (
      !["pusat", "utama", "a", "b", "c"].includes(tipe_cabang.toLowerCase())
    ) {
      return res.status(400).json({ error: "Tipe cabang tidak valid." });
    }

    // Get default kuota based on tipe_cabang
    let kuota;
    switch (tipe_cabang.toLowerCase()) {
      case "pusat":
        kuota = { kuotaMhs: 16, kuotaSiswa: 0 };
        break;
      case "utama":
        kuota = { kuotaMhs: 25, kuotaSiswa: 0 };
        break;
      case "a":
        kuota = { kuotaMhs: 10, kuotaSiswa: 8 };
        break;
      case "b":
        kuota = { kuotaMhs: 8, kuotaSiswa: 3 };
        break;
      case "c":
        kuota = { kuotaMhs: 5, kuotaSiswa: 2 };
        break;
    }

    // Update unit kerja with default kuota
    unitKerja.kuotaMhs = kuota.kuotaMhs;
    unitKerja.kuotaSiswa = kuota.kuotaSiswa;
    unitKerja.tipe_cabang = tipe_cabang;
    await unitKerja.save();

    // Get updated data with available quota calculations
    const unitKerjaWithQuota = await calculateAvailableQuota();
    
    return res.status(200).json({
      message: "Unit kerja berhasil diperbarui.",
      unitKerja: unitKerjaWithQuota
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};


const permintaanDiterima = async (req, res) => {
  try {
    // Get universities data with count of accepted requests per prodi
    const universitiesData = await PerguruanTinggi.findAll({
      include: [
        {
          model: Permintaan,
          where: {
            type: "mahasiswa",
            statusId: 2,
          },
          include: [
            {
              model: Prodi,
              attributes: ["id", "name"],
            },
          ],
          attributes: [],
        },
      ],
      attributes: [
        "id",
        "name",
        [sequelize.col("Permintaans.Prodi.id"), "prodi_id"],
        [sequelize.col("Permintaans.Prodi.name"), "prodi_name"],
        [
          sequelize.fn("COUNT", sequelize.col("Permintaans.id")),
          "total_diterima",
        ],
      ],
      group: [
        "PerguruanTinggi.id",
        "PerguruanTinggi.name",
        "Permintaans.Prodi.id",
        "Permintaans.Prodi.name",
      ],
      raw: true,
    });

    // Get vocational schools data with count of accepted requests
    const schoolsData = await Smk.findAll({
      include: [
        {
          model: Permintaan,
          where: {
            type: "siswa",
            statusId: 2,
          },
          attributes: [],
        },
      ],
      attributes: [
        "id",
        "name",
        [
          sequelize.fn("COUNT", sequelize.col("Permintaans.id")),
          "total_diterima",
        ],
      ],
      group: ["Smk.id", "Smk.name"],
      raw: true,
    });

    // Restructure universities data to group by university
    const formattedUniversitiesData = universitiesData.reduce((acc, curr) => {
      const existingUniv = acc.find(
        (univ) => univ.nama_institusi === curr.name
      );

      const prodiData = {
        id_prodi: curr.prodi_id,
        nama_prodi: curr.prodi_name,
        total_diterima: parseInt(curr.total_diterima),
      };

      if (existingUniv) {
        existingUniv.prodi.push(prodiData);
      } else {
        acc.push({
          id_univ: curr.id,
          nama_institusi: curr.name,
          prodi: [prodiData],
        });
      }

      return acc;
    }, []);

    return res.status(200).json({
      universities: formattedUniversitiesData,
      schools: schoolsData.map((school) => ({
        id_smk: school.id,
        nama_institusi: school.name,
        total_diterima: parseInt(school.total_diterima),
      })),
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

const getDetailPermintaanDiterima = async (req, res) => {
  try {
    // Get detailed university students data
    const universitiesDetail = await Permintaan.findAll({
      where: {
        type: "mahasiswa",
        statusId: 2, // Status diterima
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

    // Get detailed vocational students data
    const schoolsDetail = await Permintaan.findAll({
      where: {
        type: "siswa",
        statusId: 2, // Status diterima
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

    const formattedUniversities = universitiesDetail.map((item) => ({
      id: item.id,
      nama_peserta: item.User?.Mahasiswas?.[0]?.name ?? null, // Changed to Mahasiswas
      nim: item.User?.Mahasiswas?.[0]?.nim ?? null, // Changed to Mahasiswas
      email: item.User?.email ?? null,
      no_hp: item.User?.Mahasiswas?.[0]?.no_hp ?? null, // Changed to Mahasiswas
      alamat: item.User?.Mahasiswas?.[0]?.alamat ?? null, // Changed to Mahasiswas
      institusi: item.PerguruanTinggi?.name ?? null,
      program_studi: item.Prodi?.name ?? null,
      unit_kerja: item.UnitKerjaPenempatan?.name ?? null,
      tanggal_mulai: item.tanggalMulai,
      tanggal_selesai: item.tanggalSelesai,
      tanggal_daftar: item.createdAt,
    }));

    // Format vocational students data
    const formattedSchools = schoolsDetail.map((item) => ({
      id: item.id,
      nama_peserta: item.User?.Siswas?.[0]?.name ?? null, // Changed to Siswas
      nisn: item.User?.Siswas?.[0]?.nisn ?? null, // Changed to Siswas
      email: item.User?.email ?? null,
      no_hp: item.User?.Siswas?.[0]?.no_hp ?? null, // Changed to Siswas
      alamat: item.User?.Siswas?.[0]?.alamat ?? null, // Changed to Siswas
      institusi: item.Smk?.name ?? null,
      jurusan: item.Jurusan?.name ?? null,
      unit_kerja: item.UnitKerjaPenempatan?.name ?? null,
      tanggal_mulai: item.tanggalMulai,
      tanggal_selesai: item.tanggalSelesai,
      tanggal_daftar: item.createdAt,
    }));
    
    return res.status(200).json({
      mahasiswa: formattedUniversities,
      siswa: formattedSchools,
    });
  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({ error: error.message });
  }
};

const detailUnivDiverifikasi = async (req, res) => {
  try {
    const { idUniv, idProdi } = req.params;

    const universitiesDetail = await Permintaan.findAll({
      where: {
        type: "mahasiswa",
        statusId: 2,
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

    const formattedUniversities = universitiesDetail.map((item) => ({
      id: item.id,
      nama_peserta: item.User?.Mahasiswas?.[0]?.name ?? null, // Changed to Mahasiswas
      nim: item.User?.Mahasiswas?.[0]?.nim ?? null, // Changed to Mahasiswas
      email: item.User?.email ?? null,
      no_hp: item.User?.Mahasiswas?.[0]?.no_hp ?? null, // Changed to Mahasiswas
      alamat: item.User?.Mahasiswas?.[0]?.alamat ?? null, // Changed to Mahasiswas
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

const detailSmkDiverifikasi = async (req, res) => {
  try {
    const { idSmk } = req.params;

    const schoolsDetail = await Permintaan.findAll({
      where: {
        type: "siswa",
        statusId: 2,
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

    // Format vocational students data
    const formattedSchools = schoolsDetail.map((item) => ({
      id: item.id,
      nama_peserta: item.User?.Siswas?.[0]?.name ?? null, // Changed to Siswas
      nisn: item.User?.Siswas?.[0]?.nisn ?? null, // Changed to Siswas
      email: item.User?.email ?? null,
      no_hp: item.User?.Siswas?.[0]?.no_hp ?? null, // Changed to Siswas
      alamat: item.User?.Siswas?.[0]?.alamat ?? null, // Changed to Siswas
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
    console.log("Generating letter...");
    const content = fs.readFileSync(path.resolve(__dirname, "template.docx"), "binary");
    const zip = new PizZip(content);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
    });
    // Format tanggal sekarang
    const now = new Date();
    const formatShortDate = (date) => {
      const month = date.getMonth() + 1; // Bulan dalam format 1-12
      const year = date.getFullYear();
      return `${month.toString().padStart(2, "0")}-${year}`; // Format MM-YYYY
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
      return `${day} ${months[date.getMonth()]} ${date.getFullYear()}`; // Format DD MMMM YYYY
    };

    const dataWithDates = {
      ...data,
      jml: data.participants.length, // Add total count of participants
      tanggal_singkat: formatShortDate(now), // Format MM-YYYY
      tanggal_panjang: formatLongDate(now), // Format DD MMMM YYYY
      students: data.participants.map((student, index) => ({
        no: index + 1,
        ...student,
      })),
    };

    doc.render(dataWithDates);

    const docxBuf = doc.getZip().generate({ type: "nodebuffer" });
    
    // Convert to PDF
    const pdfBuf = await convert(docxBuf, '.pdf', undefined);
    
    return pdfBuf;

  } catch (error) {
    console.error("Error in generateLetter:", error);
    throw error;
  }
};


const univGenerateLetter = async (req, res) => {
  try {
    const { idUniv, idProdi } = req.params;
    const { nomorSurat, perihal, pejabat, institusi, prodi, perihal_detail } =
      req.body;

    const universitiesDetail = await Permintaan.findAll({
      where: {
        type: "mahasiswa",
        statusId: 2,
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
      pejabat: pejabat,
      institusi: institusi,
      prodi: prodi,
      perihal: perihal,
      perihal_detail:perihal_detail,
      participants: participants,
    };

    const pdfBuffer = await generateLetter(data);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=surat_magang.pdf');
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);

  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({
      status: "error",
      message: "Internal server error", 
      error: error.message
    });
  }
};

module.exports = {
  getAllUnitKerja,
  editKuotaUnitKerja,
  permintaanDiterima,
  detailUnivDiverifikasi,
  detailSmkDiverifikasi,
  getDetailPermintaanDiterima,
  generateLetter,
  univGenerateLetter,
};
