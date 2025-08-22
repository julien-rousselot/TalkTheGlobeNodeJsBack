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
    console.log(`🔧 Preparing to send PDFs to ${email} for ${items.length} items`);

    const ids = items.map(i => i.id);
    const result = await database.query(
      `SELECT id, title, pdf FROM materials WHERE id = ANY($1)`,
      [ids]
    );

    console.log(`📄 Found ${result.rows.length} materials in database`);

    const attachments = [];
    const itemTitles: string[] = [];

    for (const row of result.rows) {
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
        console.error(`❌ Impossible de lire le PDF pour id=${row.id} - ${row.title}:`, err);
        continue;
      }

      const sanitizedTitle = row.title.replace(/[^\w\s-]/g, '').trim();

      attachments.push({
        filename: `${sanitizedTitle}.pdf`,
        content: pdfBuffer,
        contentType: "application/pdf",
      });

      itemTitles.push(row.title);
      console.log(`✅ Added PDF attachment for: ${row.title} (${pdfBuffer.length} bytes)`);
    }

    if (attachments.length === 0) {
      console.error("❌ Aucun PDF valide à envoyer pour ces articles.");
      return false;
    }

    console.log(`📧 Sending email with ${attachments.length} PDF attachments to ${email}`);

    await transporter.sendMail({
      from: process.env.EMAIL_USER || 'talktheglobe7@gmail.com',
      to: email,
      subject: "Votre achat TalkTheGlobe - Documents PDF",
      html: `
        <h2>Merci pour votre achat !</h2>
        <p>Bonjour,</p>
        <p>Merci d'avoir effectué un achat sur TalkTheGlobe. Vous trouverez en pièces jointes les documents PDF que vous avez achetés :</p>
        <ul>
          ${itemTitles.map(title => `<li>${title}</li>`).join('')}
        </ul>
        <p>Nous espérons que ces ressources vous seront utiles dans votre apprentissage !</p>
        <p>Cordialement,<br>L'équipe TalkTheGlobe</p>
      `,
      attachments,
    });

    console.log("✅ Email avec PDFs envoyé avec succès à", email);
    return true;
  } catch (err) {
    console.error("❌ Erreur envoi email avec PDFs:", err);
    return false;
  }
};
