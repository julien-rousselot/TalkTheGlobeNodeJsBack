// src/controllers/mailerController.ts
import { Request, Response } from 'express';
import { transporter } from '../config/mailer';

export const sendEmail = async (req: Request, res: Response) => {
  const { email, message, name } = req.body;

  if (!email || !message || !name) {
    return res.status(400).json({ error: 'Données invalides' });
  }

  const mailOptions = {
    from: 'talktheglobe7@gmail.com',
    replyTo: email,
    to: 'talktheglobe7@gmail.com',
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
    from: 'talktheglobe7@gmail.com',
    to: 'talktheglobe7@gmail.com',
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
