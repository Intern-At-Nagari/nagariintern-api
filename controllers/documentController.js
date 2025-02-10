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



const downloadSuratBalasan = async (req, res) => {
  try {
    const userId = req.userId;

    const permintaan = await Permintaan.findOne({
      where: { userId: userId },
      include: [
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
      ],
    });

    if (!permintaan) {
      return res.status(404).json({
        message: "Data permintaan tidak ditemukan",
      });
    }

    const suratPernyataan = permintaan.Dokumens.find(
      (doc) => doc.tipeDokumenId === 7
    );

    if (!suratPernyataan) {
      return res.status(404).json({
        message: "Surat pernyataan tidak ditemukan",
      });
    }

    const filePath = path.join(
      __dirname,
      "..",
      "public",
      "uploads",
      suratPernyataan.url
    );

    // Check if the file exists
    if (!fs.existsSync(filePath)) {
      return res
        .status(404)
        .json({ message: "File tidak ditemukan di server" });
    }

    const mimeType =
      path.extname(filePath).toLowerCase() === ".pdf"
        ? "application/pdf"
        : "application/octet-stream";

    // Send the file
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${path.basename(filePath)}"`
    );
    res.setHeader("Content-Type", mimeType);

    const fileStream = fs.createReadStream(filePath);
    fileStream.on("error", (err) => {
      console.error("File Stream Error:", err);
      if (!res.headersSent) {
        res.status(500).json({ message: "Gagal membaca file" });
      }
      v;
    });

    fileStream.pipe(res);
  } catch (error) {
    console.error("Error in downloadSuratBalasan:", error.message || error);
    if (!res.headersSent) {
      res.status(500).json({
        message: "Terjadi kesalahan pada server",
        error: error.message,
      });
    }
  }
};

const downloadTemplateSiswa = async (req, res) => {
  try {
    const filePath = path.join(
      __dirname,
      "..",
      "public",
      "uploads",
      "template_surat_pernyataan_siswa.docx"
    );

    // Check if the file exists
    if (!fs.existsSync(filePath)) {
      return res
        .status(404)
        .json({ message: "File tidak ditemukan di server" });
    }

    const mimeType = path.extname(filePath).toLowerCase() === ".docx";

    // Send the file
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${path.basename(filePath)}"`
    );
    res.setHeader("Content-Type", mimeType);

    const fileStream = fs.createReadStream(filePath);
    fileStream.on("error", (err) => {
      console.error("File Stream Error:", err);
      if (!res.headersSent) {
        res.status(500).json({ message: "Gagal membaca file" });
      }
      v;
    });

    fileStream.pipe(res);
  } catch (error) {
    console.error("Error in downloadTemplateSiswa:", error.message || error);
    if (!res.headersSent) {
      res.status(500).json({
        message: "Terjadi kesalahan pada server",
        error: error.message,
      });
    }
  }
};

const downloadTemplateInstitusi = async (req, res) => {
  try {
    const filePath = path.join(
      __dirname,
      "..",
      "public",
      "uploads",
      "template_surat_pernyataan_institusi.docx"
    );

    // Check if the file exists
    if (!fs.existsSync(filePath)) {
      return res
        .status(404)
        .json({ message: "File tidak ditemukan di server" });
    }

    const mimeType = "application/msword";

    // Send the file
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${path.basename(filePath)}"`
    );
    res.setHeader("Content-Type", mimeType);

    const fileStream = fs.createReadStream(filePath);
    fileStream.on("error", (err) => {
      console.error("File Stream Error:", err);
      if (!res.headersSent) {
        res.status(500).json({ message: "Gagal membaca file" });
      }
    });

    fileStream.pipe(res);
  } catch (error) {
    console.error("Error in downloadTemplateSiswa:", error.message || error);
    if (!res.headersSent) {
      res.status(500).json({
        message: "Terjadi kesalahan pada server",
        error: error.message,
      });
    }
  }
};

const sendSuratPernyataan = async (req, res) => {
  try {
    const userId = req.userId;
    const fileSuratPernyataanSiswa = req.files.fileSuratPernyataanSiswa;
    const fileSuratPernyataanWali = req.files.fileSuratPernyataanWali;
    const fileTabungan = req.files.fileTabungan;
    const { nomorRekening } = req.body;

    const permintaan = await Permintaan.findOne({
      where: { userId: userId },
    });

    const user =
      (await Mahasiswa.findOne({ where: { userId } })) ||
      (await Siswa.findOne({ where: { userId } }));

    await user.update({
      rekening: nomorRekening,
    });
    await permintaan.update({
      statusId: 3,
    });

    if (!permintaan) {
      return res.status(404).json({
        status: "error",
        message: "Permintaan magang tidak ditemukan",
      });
    }

    if (
      !fileSuratPernyataanSiswa ||
      !fileSuratPernyataanWali ||
      !fileTabungan
    ) {
      return res.status(400).json({
        status: "error",
        message: "File surat balasan harus diunggah",
      });
    }

    const documents = [
      {
        permintaanId: permintaan.id,
        tipeDokumenId: 6,
        url: req.files.fileSuratPernyataanWali[0].filename,
      },
      {
        permintaanId: permintaan.id,
        tipeDokumenId: 7,
        url: req.files.fileSuratPernyataanSiswa[0].filename,
      },
      {
        permintaanId: permintaan.id,
        tipeDokumenId: 10,
        url: req.files.fileTabungan[0].filename,
      },
    ];
    await Dokumen.bulkCreate(documents);

    return res.status(200).json({
      status: "success",
      message: "Surat pernyataan berhasil diunggah",
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

    const logoUrl =
      "https://upload.wikimedia.org/wikipedia/commons/d/db/Bank_Nagari.svg";

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
        include: [
          {
            model: Users,
            include: [
              { model: Mahasiswa, attributes: ["name"] },
              { model: Siswa, attributes: ["name"] },
            ],
          },
        ],
      });

      if (!participant) {
        console.error(`Participant with id ${response.id} not found`);
        continue;
      }

      const nama =
        participant.User?.Mahasiswas?.[0]?.name ||
        participant.User?.Siswas?.[0]?.name ||
        "Peserta Magang";

      const templatePath = path.join(
        __dirname,
        "../public/template/SuratBalasanMail.ejs"
      );
      const emailTemplate = await ejs.renderFile(templatePath, {
        nama,
        logoUrl,
      });

      const mailOptions = {
        from: `"Bank Nagari Intern" <${process.env.EMAIL_USER}>`,
        to: response.email,
        subject: "Surat Balasan Magang - Bank Nagari",
        html: emailTemplate,
        attachments: [
          {
            filename: req.files.fileSuratBalasan[0].filename,
            path: req.files.fileSuratBalasan[0].path,
          },
        ],
      };

      try {
        await transporter.sendMail(mailOptions);

        await Promise.all([
          Dokumen.create({
            permintaanId: response.id,
            tipeDokumenId: 5,
            url: req.files.fileSuratBalasan[0].filename,
          }),
          Permintaan.update({ statusId: 2 }, { where: { id: response.id } }),
        ]);
      } catch (emailError) {
        console.error(`Error sending email to ${response.email}:`, emailError);
        continue;
      }
    }

    return res.status(200).json({
      status: "success",
      message: "Surat balasan berhasil dikirim ke semua email",
    });
  } catch (error) {
    console.error("Error in sendSuratBalasan:", error);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
      error: error.message,
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
    if (!req.files || !req.files.SuratPengantar) {
      return res.status(400).json({
        status: "error",
        message: "File surat pengantar harus diunggah",
      });
    }

    const logoUrl =
      "https://upload.wikimedia.org/wikipedia/commons/d/db/Bank_Nagari.svg";

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
        include: [
          {
            model: Users,
            include: [
              { model: Mahasiswa, attributes: ["name"] },
              { model: Siswa, attributes: ["name"] },
            ],
          },
        ],
      });

      if (!participant) {
        console.error(`Participant with id ${response.id} not found`);
        continue;
      }

      const nama =
        participant.User?.Mahasiswas?.[0]?.name ||
        participant.User?.Siswas?.[0]?.name ||
        "Peserta Magang";

      // Render email template
      const templatePath = path.join(
        __dirname,
        "../public/template/SuratPengantarMail.ejs"
      );
      const emailTemplate = await ejs.renderFile(templatePath, {
        nama,
        logoUrl,
      });

      const mailOptions = {
        from: `"Bank Nagari Intern" <${process.env.EMAIL_USER}>`,
        to: response.email,
        subject: "Surat Pengantar Magang - Bank Nagari",
        html: emailTemplate,
        attachments: [
          {
            filename: req.files.SuratPengantar[0].filename,
            path: req.files.SuratPengantar[0].path,
          },
        ],
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

module.exports = {
  sendSuratPernyataan,
  downloadSuratBalasan,
  downloadTemplateSiswa,
  downloadTemplateInstitusi,
  generateLetter,
  univGenerateLetter,
  smkGenerateLetter,
  sendSuratBalasan,
  generateSuratPengantarMhs,
  generateSuratPengantarSiswa,
  sendSuratPengantar,
  generateLampiranRekomenMhs,
  generateLampiranRekomenSiswa,
};
