// src/controllers/mailerController.ts
import { Request, Response } from 'express';
import { transporter } from '../config/mailer';

export const sendEmail = async (req: Request, res: Response) => {
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
    await transporter.sendMail(mailOptions);
    res.status(200).json({ message: 'Email envoyé avec succès' });
  } catch (error) {
    console.error('Erreur envoi email:', error);
    res.status(500).json({ error: 'Erreur serveur lors de l\'envoi de l\'email' });
  }
};

export const sendSuggestion = async (req: Request, res: Response) => {
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
    await transporter.sendMail(mailOptions);
    res.status(200).json({ message: 'Email envoyé avec succès' });
  } catch (error) {
    console.error('Erreur envoi email:', error);
    res.status(500).json({ error: 'Erreur serveur lors de l\'envoi de l\'email' });
  }
};
