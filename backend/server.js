import express from "express";
import fs from "fs";
import { PDFDocument } from "pdf-lib";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json({ limit: "5mb" }));

app.post("/generar-pdf", async (req, res) => {
  try {
    const { nombre, apellido, dni, domicilio, email, firma } = req.body;

    if (!nombre || !apellido || !dni || !email || !firma) {
      return res.status(400).send("Datos incompletos");
    }

    const pdfBytes = fs.readFileSync(process.env.PDF_BASE_PATH);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const page = pdfDoc.getPages()[0];

    page.drawText(nombre, { x: 150, y: 500, size: 10 });
    page.drawText(apellido, { x: 150, y: 480, size: 10 });
    page.drawText(dni, { x: 150, y: 460, size: 10 });
    page.drawText(domicilio || "", { x: 150, y: 440, size: 10 });

    const firmaImg = await pdfDoc.embedPng(
      Buffer.from(firma.split(",")[1], "base64")
    );
    page.drawImage(firmaImg, { x: 150, y: 380, width: 200, height: 80 });

    const pdfFinal = await pdfDoc.save();

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: email,
      subject: "Formulario firmado",
      text: "Adjuntamos el formulario completo y firmado.",
      attachments: [
        { filename: "formulario.pdf", content: pdfFinal }
      ]
    });

    res.sendStatus(200);

  } catch (err) {
    console.error(err);
    res.status(500).send("Error al generar el PDF");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Servidor iniciado en puerto", PORT);
});
