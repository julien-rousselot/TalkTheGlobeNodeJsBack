import { Request, Response } from 'express';
import { database } from '../config/database';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const SALT_ROUNDS = 10;
const JWT_SECRET = process.env.JWT_SECRET;

export const register = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'email et mot de passe requis' });
  }

  try {
    const existing = await database.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'email déjà utilisé' });
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    const result = await database.query(
      'INSERT INTO users (email, password, role) VALUES ($1, $2, $3) RETURNING id, email',
      [email, hashedPassword, 'admin']
    );

    res.status(201).json({ message: 'Admin créé', user: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur', details: (err as Error).message });
  }
};

export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Champs requis' });
  }

  try {
    const result = await database.query(
      'SELECT id, email, password, role FROM users WHERE email = $1',
      [email]
    );

    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ error: 'Identifiants invalides' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Identifiants invalides' });
    }

    if (!JWT_SECRET) {
      console.error('JWT_SECRET non défini dans les variables d’environnement');
      return res.status(500).json({ error: 'Erreur serveur' });
    }
    
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET as string,
      { expiresIn: '2h' }
    );

    res.json({ message: 'Connexion réussie', token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur', details: (err as Error).message });
  }
};
