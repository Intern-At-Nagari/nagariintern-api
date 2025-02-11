const PizZip = require("pizzip");
const Docxtemplater = require("docxtemplater");
const fs = require("fs");
const bcrypt = require("bcryptjs");
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
  Dokumen,
  Karyawan,
  Kehadiran,
  Status,
  RekapKehadiran,
  TipeDokumen,
} = require("../models/index");
const libre = require("libreoffice-convert");
const util = require("util");
const convert = util.promisify(libre.convert);

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

    const uppercaseBulan = bulan.toUpperCase();
    console.log(uppercaseBulan);

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
    console.log(formatLongDate(now));
    const tanggal = formatLongDate(now);

    const data = {
      bulan: bulan,
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
        bulan: uppercaseBulan,
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

const cabangPermintaanMagang = async (req, res) => {
  try {
    const userId = req.userId;
    const karyawan = await Karyawan.findOne({ where: { userId } });

    const permintaan = await Permintaan.findAll({
      where: {
        penempatan: karyawan.unitKerjaId,
        statusId: 4,
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
        {
          model: Kehadiran,
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

const completedMagang = async (req, res) => {
  try {
    const { id } = req.params;

    const userId = req.userId;
    const karyawan = await Karyawan.findOne({ where: { userId } });

    const permintaanMagang = await Permintaan.findByPk(id);

    if (!permintaanMagang) {
      return res
        .status(404)
        .json({ error: "Permintaan magang tidak ditemukan." });
    }

    // Validate penempatan exists in UnitKerja

    const unitKerja = await UnitKerja.findByPk(karyawan.unitKerjaId);
    if (!unitKerja) {
      return res
        .status(400)
        .json({ error: "Unit kerja penempatan tidak valid" });
    }

    // Check and update quota based on internship type
    if (permintaanMagang.type === "siswa") {
      await unitKerja.update({
        kuotaSiswa: unitKerja.kuotaSiswa + 1,
      });
    } else if (permintaanMagang.type === "mahasiswa") {
      await unitKerja.update({
        kuotaMhs: unitKerja.kuotaMhs + 1,
      });
    }

    await permintaanMagang.update({
      statusId: 7,
    });

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

const getAdminProfile = async (req, res) => {
  try {
    const userId = req.userId;
    const user = await Users.findByPk(userId, {
      attributes: ["email"],
      include: [
        {
          model: Karyawan,
          include: [
            {
              model: UnitKerja,
              attributes: ["name"],
            },
          ],
        },
      ],
    });

    if (!user) {
      return res.status(404).json({
        message: "Data user tidak ditemukan",
      });
    }

    res.status(200).json({
      message: "Data berhasil diambil",
      data: user,
    });
  } catch (error) {
    console.error("Get Admin Profile Error:", error);
    res.status(500).json({
      message: "Terjadi kesalahan saat mengambil data user",
      error: error.message,
    });
  }
};

const updateProfile = async (req, res) => {
  try {
    const userId = req.userId;
    const { nama, nik, nomorHp, jabatan } = req.body;

    // Find the user and their karyawan record
    const karyawan = await Karyawan.findOne({ where: { userId } });

    if (!karyawan) {
      return res.status(404).json({
        message: "Data karyawan tidak ditemukan",
      });
    }

    // Update existing karyawan record
    await karyawan.update({
      nama,
      nik,
      nomorHp,
      jabatan,
    });

    // Fetch updated data to return
    const updatedUser = await Users.findByPk(userId, {
      attributes: ["email"],
      include: [
        {
          model: Karyawan,
          include: [
            {
              model: UnitKerja,
              attributes: ["name"],
            },
          ],
        },
      ],
    });

    res.status(200).json({
      message: "Profil berhasil diperbarui",
      data: updatedUser,
    });
  } catch (error) {
    console.error("Update Profile Error:", error);
    res.status(500).json({
      message: "Terjadi kesalahan saat memperbarui profil",
      error: error.message,
    });
  }
};

const changePassword = async (req, res) => {
  try {
    const userId = req.userId;
    const { newPassword } = req.body;

    const user = await Users.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await user.update({
      password: hashedPassword
    });

    return res.status(200).json({
      message: "Password successfully updated"
    });

  } catch (error) {
    console.error("Change Password Error:", error);
    return res.status(500).json({
      message: "Error updating password",
      error: error.message
    });
  }
};

module.exports = {
  createAbsensi,
  getAbsensi,
  getDetailAbsensi,
  updateAbsensi,
  generateAbsensi,
  sendAbsensi,
  cabangPermintaanMagang,
  verifyEmailPegawai,
  completedMagang,
  getAdminProfile,
  updateProfile,
  changePassword
};
