import { transporter } from "../config/mailer";
import { database } from "../config/database";
import path from "path";
import fs from "fs/promises";

export const sendPurchasedPDFs = async (
  email: string,
  items: {
    id: number;
    title: string;
    quantity: number;
    amount: number;
    cover: string;
  }[]
) => {
  if (!email || items.length === 0) {
    console.warn("Email vide ou aucun article à envoyer.");
    return false;
  }
  try {
    const ids = items.map(i => i.id);
    const result = await database.query(
      `SELECT id, title, pdf FROM materials WHERE id = ANY($1)`,
      [ids]
    );

    const attachments = [];
    const itemTitles: string[] = [];

    for (const row of result.rows) {
      console.log("in pdf function");
      if (!row.pdf) {
        console.warn(`⚠️ Aucun PDF trouvé pour l'article id=${row.id} - ${row.title}`);
        continue;
      }

      // Décoder le bytea en chemin string comme dans getFreeMaterials
      let pdfPath: string;
      if (Buffer.isBuffer(row.pdf)) {
        pdfPath = new TextDecoder().decode(new Uint8Array(row.pdf));
      } else if (typeof row.pdf === "string") {
        pdfPath = row.pdf;
      } else {
        console.warn(`⚠️ Format PDF inconnu pour l'article id=${row.id} - ${row.title}`);
        continue;
      }

      const fullPath = path.join(__dirname, "../", pdfPath);

      // Lire le PDF réel depuis le chemin
      let pdfBuffer: Buffer;
      try {
        pdfBuffer = await fs.readFile(fullPath);
      } catch (err) {
        console.log(`⚠️ Impossible de lire le PDF pour id=${row.id} - ${row.title}:`, err);
        continue;
      }

      const sanitizedTitle = row.title.replace(/[^\w\s-]/g, '').trim();

      attachments.push({
        filename: `${sanitizedTitle}.pdf`,
        content: pdfBuffer,
        contentType: "application/pdf",
      });

      itemTitles.push(row.title);
    }

    if (attachments.length === 0) {
      console.log("📭 Aucun PDF valide à envoyer.");
      console.error("❌ Aucun PDF valide à envoyer pour ces articles.");
      return false;
    }

    await transporter.sendMail({
      from: process.env.EMAIL_USER || 'talktheglobe7@gmail.com',
      to: email,
      subject: "Your TalkTheGlobe Purchase - PDF Documents",
      html: `
        <h2>Thank you for your purchase!</h2>
        <p>Hello,</p>
        <p>Thank you for making a purchase on TalkTheGlobe. Please find attached the PDF documents you purchased:</p>
        <ul>
          ${itemTitles.map(title => `<li>${title}</li>`).join('')}
        </ul>
        <p>We hope these resources will be useful for your learning!</p>
        <p>Best regards,<br>The TalkTheGlobe Team</p>
      `,
      attachments,
    });
    return true;
  } catch (err) {
    console.error("❌ Erreur envoi email avec PDFs:", err);
    return false;
  }
};
