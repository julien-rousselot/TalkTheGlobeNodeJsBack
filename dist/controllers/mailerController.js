"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendSuggestion = exports.sendEmail = void 0;
const mailer_1 = require("../config/mailer");
const sendEmail = async (req, res) => {
    const { email, message, name } = req.body;
    if (!email || !message || !name) {
        return res.status(400).json({ error: 'Données invalides' });
    }
    const mailOptions = {
        from: process.env.EMAIL_USER,
        replyTo: email,
        to: process.env.EMAIL_USER,
        subject: `Nouveau message de ${name}`,
        text: message,
    };
    try {
        await mailer_1.transporter.sendMail(mailOptions);
        res.status(200).json({ message: 'Email envoyé avec succès' });
    }
    catch (error) {
        console.error('Erreur envoi email:', error);
        res.status(500).json({ error: 'Erreur serveur lors de l\'envoi de l\'email' });
    }
};
exports.sendEmail = sendEmail;
const sendSuggestion = async (req, res) => {
    const { message } = req.body;
    if (!message) {
        return res.status(400).json({ error: 'Données invalides' });
    }
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: process.env.EMAIL_USER,
        subject: 'Nouvelle suggestion',
        text: message,
    };
    try {
        await mailer_1.transporter.sendMail(mailOptions);
        res.status(200).json({ message: 'Email envoyé avec succès' });
    }
    catch (error) {
        console.error('Erreur envoi email:', error);
        res.status(500).json({ error: 'Erreur serveur lors de l\'envoi de l\'email' });
    }
};
exports.sendSuggestion = sendSuggestion;
