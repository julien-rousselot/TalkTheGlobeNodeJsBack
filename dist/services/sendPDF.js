"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendPurchasedPDFs = void 0;
const mailer_1 = require("../config/mailer");
const database_1 = require("../config/database");
const path_1 = __importDefault(require("path"));
const promises_1 = __importDefault(require("fs/promises"));
const sendPurchasedPDFs = async (email, items) => {
    if (!email || items.length === 0) {
        console.warn("Email vide ou aucun article à envoyer.");
        return false;
    }
    try {
        const ids = items.map(i => i.id);
        const result = await database_1.database.query(`SELECT id, title, pdf FROM materials WHERE id = ANY($1)`, [ids]);
        const attachments = [];
        const itemTitles = [];
        for (const row of result.rows) {
            if (!row.pdf) {
                continue;
            }
            // Décoder le bytea en chemin string comme dans getFreeMaterials
            let pdfPath;
            if (Buffer.isBuffer(row.pdf)) {
                pdfPath = new TextDecoder().decode(new Uint8Array(row.pdf));
            }
            else if (typeof row.pdf === "string") {
                pdfPath = row.pdf;
            }
            else {
                continue;
            }
            const fullPath = path_1.default.join(__dirname, "../", pdfPath);
            // Lire le PDF réel depuis le chemin
            let pdfBuffer;
            try {
                pdfBuffer = await promises_1.default.readFile(fullPath);
            }
            catch (err) {
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
            return false;
        }
        await mailer_1.transporter.sendMail({
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
    }
    catch (err) {
        console.error("❌ Erreur envoi email avec PDFs:", err);
        return false;
    }
};
exports.sendPurchasedPDFs = sendPurchasedPDFs;
