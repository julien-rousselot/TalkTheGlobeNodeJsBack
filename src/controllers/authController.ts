import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';

const authorizedUsers = [
  { email: 'talktheglobe7@gmail.com', password: 'supersecret' },
  { email: 'jujuf50@live.fr', password: '123456' }
];

const JWT_SECRET = process.env.JWT_SECRET;

export const login = (req: Request, res: Response) => {
  const { email, password } = req.body;

  const user = authorizedUsers.find(u => u.email === email && u.password === password);
  
  if (!user) {
    return res.status(401).json({ error: 'Email ou mot de passe invalide' });
  }

  if (!JWT_SECRET) {
    return res.status(500).json({ error: 'JWT_SECRET non défini sur le serveur' });
  }

  const token = jwt.sign({ email: user.email }, JWT_SECRET, { expiresIn: '1h' });

  return res.json({ token });
};
