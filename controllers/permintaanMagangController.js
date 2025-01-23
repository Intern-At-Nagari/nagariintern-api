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
} = require("../models/index");

const createPermintaanMagangSiswa = async (req, res) => {
  try {
    const {
      nama,
      nisn,
      alamat,
      noHp,
      smk,
      jurusan,
      unitKerja,
      tanggalMulai,
      tanggalSelesai,
    } = req.body;

    console.log(req.body);

    // Ambil ID pengguna yang sudah diverifikasi dari token
    const userId = req.userId;

    // Input validation
    if (
      !nama ||
      !nisn ||
      !alamat ||
      !noHp ||
      !smk ||
      !jurusan ||
      !unitKerja ||
      !tanggalMulai ||
      !tanggalSelesai
    ) {
      return res.status(400).json({
        error: "Semua field wajib diisi",
      });
    }

    if (!req.files || !req.files.fileCv || !req.files.fileKtp) {
      return res.status(400).json({
        error: "File CV dan KTP wajib diunggah",
      });
    }
    // Validate dates
    const startDate = new Date(tanggalMulai);
    const endDate = new Date(tanggalSelesai);
    if (startDate >= endDate) {
      return res.status(400).json({
        error: "Tanggal selesai harus lebih besar dari tanggal mulai",
      });
    }

    // Create or find institution record
    const [smkRecord] = await Smk.findOrCreate({
      where: { name: smk },
      defaults: { name: smk },
    });

    await Siswa.create({
      userId,
      name: nama,
      nisn: nisn,
      no_hp: noHp,
      alamat: alamat,
    });

    // Create or find department record
    const [jurusanRecord] = await Jurusan.findOrCreate({
      where: {
        name: jurusan,
      },
      defaults: {
        name: jurusan,
      },
    });

    // Create or find unit kerja record
    const unitKerjaRecord = await UnitKerja.findOne({
      where: { id: unitKerja },
      defaults: { id: unitKerja },
    });

    // Create PermintaanMagang record
    const permintaanMagang = await Permintaan.create({
      userId,
      type: "siswa",
      smkId: smkRecord.id,
      jurusanId: jurusanRecord.id,
      tanggalMulai,
      tanggalSelesai,
      unitKerjaId: unitKerjaRecord.id,
      statusId: 1,
    });
    
    const documents = [
      {
        permintaanId: permintaanMagang.id,
        tipeDokumenId: 1,
        url: req.files.fileCv[0].filename,
      },
      {
        permintaanId: permintaanMagang.id,
        tipeDokumenId: 4, 
        url: req.files.fileKtp[0].filename,
      }
    ];
    await Dokumen.bulkCreate(documents);

    res.status(201).json({
      message: "Permintaan magang berhasil dibuat",
      data: {
        id: permintaanMagang.id,
        nama,
        smk: smkRecord.name,
        jurusan: jurusanRecord.name,
        unitKerja: unitKerjaRecord.name,
        tanggalMulai,
        tanggalSelesai,
        status: permintaanMagang.status,
      },
    });
  } catch (error) {
    console.error("Create Permintaan Magang Error:", error);

    // Handle specific database errors
    if (error.name === "SequelizeValidationError") {
      return res.status(400).json({
        message: "Data yang dimasukkan tidak valid",
        error: error.errors.map((e) => e.message),
      });
    }

    // Handle general errors
    res.status(500).json({
      message: "Terjadi kesalahan saat membuat permintaan magang",
      error: error.message,
    });
  }
};

const createPermintaanMagangMahasiswa = async (req, res) => {
  try {
    const {
      nama,
      nim,
      alamat,
      noHp,
      perguruanTinggi,
      prodi,
      unitKerja,
      tanggalMulai,
      tanggalSelesai,
    } = req.body;

    console.log(req.body);

    // Ambil ID pengguna yang sudah diverifikasi dari token
    const userId = req.userId;

    // Input validation
    if (
      !nama ||
      !nim ||
      !alamat ||
      !noHp ||
      !perguruanTinggi ||
      !prodi ||
      !unitKerja ||
      !tanggalMulai ||
      !tanggalSelesai
    ) {
      return res.status(400).json({
        error: "Semua field wajib diisi",
      });
    }

    if (
      !req.files ||
      !req.files.fileCv ||
      !req.files.fileTranskrip ||
      !req.files.fileKtp ||
      !req.files.fileSuratPengantar
    ) {
      return res.status(400).json({
        error:
          "Semua file wajib diunggah (CV, Transkrip, KTP, Surat Pengantar)",
      });
    }

    // Validate dates
    const startDate = new Date(tanggalMulai);
    const endDate = new Date(tanggalSelesai);
    if (startDate >= endDate) {
      return res.status(400).json({
        error: "Tanggal selesai harus lebih besar dari tanggal mulai",
      });
    }

    console.log(perguruanTinggi, ">>>>>>>>>>>>>>>>>>>>>>>");
    const perguruanTinggiRecord = await PerguruanTinggi.findOne({
      where: { name: perguruanTinggi },
    });
    console.log(perguruanTinggiRecord, ">>>>>>>>>>>>>>>>>>>>>>>");

    await Mahasiswa.create({
      userId,
      name: nama,
      nim: nim,
      no_hp: noHp,
      alamat: alamat,
    });

    // Create or find department record
    const [prodiRecord] = await Prodi.findOrCreate({
      where: {
        name: prodi,
      },
      defaults: {
        name: prodi,
      },
    });
    console.log(prodiRecord, ">>>>>>>>>>>>>>>>>>>>>>>");

    // Create or find unit kerja record
    const unitKerjaRecord = await UnitKerja.findOne({
      where: { id: unitKerja },
      defaults: { id: unitKerja },
    });
    // Create PermintaanMagang record
    const permintaanMagang = await Permintaan.create({
      userId,
      type: "mahasiswa",
      ptId: perguruanTinggiRecord.id,
      prodiId: prodiRecord.id,
      tanggalMulai,
      tanggalSelesai,
      unitKerjaId: unitKerjaRecord.id,
      statusId: 1,
    });
    console.log(permintaanMagang.id, ">>>>>>>>>>>>>>>>>>>>>>>");

    const documents = [
      {
        permintaanId: permintaanMagang.id,
        tipeDokumenId: 1,
        url: req.files.fileCv[0].filename,
      },
      {
        permintaanId: permintaanMagang.id,
        tipeDokumenId: 3,
        url: req.files.fileTranskrip[0].filename,
      },
      {
        permintaanId: permintaanMagang.id,
        tipeDokumenId: 4,
        url: req.files.fileKtp[0].filename,
      },
      {
        permintaanId: permintaanMagang.id,
        tipeDokumenId: 2,
        url: req.files.fileSuratPengantar[0].filename,
      },
    ];

    await Dokumen.bulkCreate(documents);

    // Send success response
    res.status(201).json({
      message: "Permintaan magang berhasil dibuat",
      data: {
        id: permintaanMagang.id,
        nama,
        perguruangTinggi: perguruanTinggiRecord.name,
        prodi: prodiRecord.name,
        unitKerja: unitKerjaRecord.name, // Ensure name is included
        tanggalMulai,
        tanggalSelesai,
        status: permintaanMagang.status,
      },
    });
  } catch (error) {
    console.error("Create Permintaan Magang Error:", error);

    // Handle specific database errors
    if (error.name === "SequelizeValidationError") {
      return res.status(400).json({
        message: "Data yang dimasukkan tidak valid",
        error: error.errors.map((e) => e.message),
      });
    }

    // Handle general errors
    res.status(500).json({
      message: "Terjadi kesalahan saat membuat permintaan magang",
      error: error.message,
    });
  }
};

const getMyPermintaanMagang = async (req, res) => {
  try {
    const userId = req.userId;
 
    const permintaan = await Permintaan.findOne({
      where: {
        userId: userId,
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
          as: 'UnitKerjaPengajuan',
          attributes: ["name"],
        },
        {
          model: UnitKerja,
          as: 'UnitKerjaPenempatan', 
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
    });
 
    if (!permintaan) {
      return res.status(404).json({
        message: "Data permintaan magang tidak ditemukan",
      });
    }
 
    // Transform the data based on type
    const transformedData = {
      id: permintaan.id,
      userId: permintaan.userId,
      email: permintaan.User.email,
      type: permintaan.type,
      tanggalMulai: permintaan.tanggalMulai,
      tanggalSelesai: permintaan.tanggalSelesai,
      status: permintaan.Status.name,
      unitKerja: permintaan.UnitKerjaPengajuan?.name || null,
      penempatan: permintaan.UnitKerjaPenempatan?.name || null,
      dokumen: permintaan.Dokumens ? permintaan.Dokumens.map((doc) => ({
        tipe: doc.tipeDokumen?.name || null,
        url: doc.url,
      })) : [],
      createdAt: permintaan.createdAt,
    };
 
    // Add user details based on type
    if (permintaan.type === "siswa") {
      const siswa = permintaan.User?.Siswas?.[0];
      transformedData.institusi = permintaan.Smk?.name || null;
      transformedData.jurusan = permintaan.Jurusan?.name || null;
      if (siswa) {
        transformedData.biodata = {
          nama: siswa.name,
          nisn: siswa.nisn,
          noHp: siswa.no_hp,
          alamat: siswa.alamat,
        };
      }
    } else if (permintaan.type === "mahasiswa") {
      const mahasiswa = permintaan.User?.Mahasiswas?.[0];
      transformedData.institusi = permintaan.PerguruanTinggi?.name || null;
      transformedData.jurusan = permintaan.Prodi?.name || null;
      if (mahasiswa) {
        transformedData.biodata = {
          nama: mahasiswa.name,
          nim: mahasiswa.nim,
          noHp: mahasiswa.no_hp,
          alamat: mahasiswa.alamat,
        };
      }
    }
 
    res.status(200).json({
      message: "Data permintaan magang berhasil diambil",
      data: transformedData,
    });
  } catch (error) {
    console.error("Get Permintaan Magang Error:", error);
    res.status(500).json({
      message: "Terjadi kesalahan saat mengambil data permintaan magang",
      error: error.message,
    });
  }
 };

const getAllPermintaanMagang = async (req, res) => {
  try {
    const permintaan = await Permintaan.findAll({
      include: [
        {
          model: Status,
          
        },
        {
          model: Users,
          attributes: ['email'],
          include: [
            {
              model: Siswa,
              attributes: ['name', 'nisn', 'no_hp', 'alamat']
            },
            {
              model: Mahasiswa,
              attributes: ['name', 'nim', 'no_hp', 'alamat']
            }
          ]
        },
        {
          model: UnitKerja,
          as: 'UnitKerjaPengajuan',
          attributes: ['name']
        },
        {
          model: UnitKerja,
          as: 'UnitKerjaPenempatan',
          attributes: ['name']
        },
        {
          model: Dokumen,
          required: false,
          include: [{
            model: TipeDokumen,
            as: 'tipeDokumen',
            attributes: ['name']
          }]
        },
        {
          model: Smk,
          attributes: ['name']
        },
        {
          model: Jurusan,
          attributes: ['name']
        },
        {
          model: PerguruanTinggi,
          attributes: ['name']
        },
        {
          model: Prodi,
          attributes: ['name']
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    if (!permintaan.length) {
      return res.status(404).json({
        message: "Data permintaan magang tidak ditemukan"
      });
    }

    const transformedData = permintaan.map(item => {
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
        dokumen: item.Dokumens ? item.Dokumens.map(doc => ({
          tipe: doc.tipeDokumen?.name || null,
          url: doc.url
        })) : [],
        createdAt: item.createdAt
      };

      if (item.type === 'siswa') {
        const siswa = item.User?.Siswas?.[0];
        baseData.institusi = item.Smk?.name || null;
        baseData.jurusan = item.Jurusan?.name || null;
        if (siswa) {
          baseData.biodata = {
            nama: siswa.name,
            nisn: siswa.nisn,
            noHp: siswa.no_hp,
            alamat: siswa.alamat
          };
        }
      } else if (item.type === 'mahasiswa') {
        const mahasiswa = item.User?.Mahasiswas?.[0];
        baseData.institusi = item.PerguruanTinggi?.name || null;
        baseData.jurusan = item.Prodi?.name || null;
        if (mahasiswa) {
          baseData.biodata = {
            nama: mahasiswa.name,
            nim: mahasiswa.nim,
            noHp: mahasiswa.no_hp,
            alamat: mahasiswa.alamat
          };
        }
      }

      return baseData;
    });

    res.status(200).json({
      message: "Data permintaan magang berhasil diambil",
      total: transformedData.length,
      data: transformedData
    });

  } catch (error) {
    console.error("Get All Permintaan Magang Error:", error);
    res.status(500).json({
      message: "Terjadi kesalahan saat mengambil data permintaan magang",
      error: error.message
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
              attributes: ['name', 'nisn', 'no_hp', 'alamat']
            },
            {
              model: Mahasiswa,
              attributes: ['name', 'nim', 'no_hp', 'alamat']
            }
          ]
        },
        { model: Smk, attributes: ["name"] },
        { model: Jurusan, attributes: ["name"] },
        { 
          model: UnitKerja,
          as: 'UnitKerjaPengajuan',
          attributes: ["name"]
        },
        { 
          model: UnitKerja,
          as: 'UnitKerjaPenempatan',
          attributes: ["name"]
        },
        { 
          model: Dokumen, 
          required: false,
          include: [{ 
            model: TipeDokumen, 
            as: "tipeDokumen", 
            attributes: ["name"] 
          }] 
        },
        { model: PerguruanTinggi, attributes: ["name"] },
        { model: Prodi, attributes: ["name"] },
        { model: Status, attributes: ["name"] },
      ],
    });

    if (!permintaanMagang) {
      return res.status(404).json({ 
        message: "Permintaan magang tidak ditemukan." 
      });
    }

    res.status(200).json(permintaanMagang);

  } catch (error) {
    console.error("Error in getPermintaanMagangById:", error.message || error);
    res.status(500).json({ 
      message: "Terjadi kesalahan pada server.",
      error: error.message
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
        return res.status(400).json({ error: "Unit kerja penempatan tidak valid" });
      }

      // Check and update quota based on internship type
      if (permintaanMagang.type === 'siswa') {
        if (unitKerja.kuotaSiswa <= 0) {
          return res.status(400).json({ error: "Kuota siswa magang sudah penuh" });
        }
        await unitKerja.update({
          kuotaSiswa: unitKerja.kuotaSiswa - 1
        });
      } else if (permintaanMagang.type === 'mahasiswa') {
        if (unitKerja.kuotaMhs <= 0) {
          return res.status(400).json({ error: "Kuota mahasiswa magang sudah penuh" });
        }
        await unitKerja.update({
          kuotaMhs: unitKerja.kuotaMhs - 1
        });
      }

      await permintaanMagang.update({ penempatan });
    }

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

const deletePermintaanMagang = async (req, res) => {
  try {
    const { id } = req.params;

    const permintaanMagang = await PermintaanMagang.findByPk(id);

    if (!permintaanMagang) {
      return res
        .status(404)
        .json({ error: "Permintaan magang tidak ditemukan." });
    }

    await permintaanMagang.destroy();

    res.status(200).json({ message: "Permintaan magang berhasil dihapus." });
  } catch (error) {
    console.error("Error in deletePermintaanMagang:", error.message || error);
    res.status(500).json({ error: "Terjadi kesalahan pada server." });
  }
};

module.exports = {
  createPermintaanMagangSiswa,
  createPermintaanMagangMahasiswa,
  getAllPermintaanMagang,
  getPermintaanMagangById,
  approveStatusPermintaanMagang,
  deletePermintaanMagang,
  getMyPermintaanMagang,
};
