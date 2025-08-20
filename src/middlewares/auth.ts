import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthRequest } from '../types';

// Middleware pour vérifier le token JWT
export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Token d\'accès requis' });
  }

  const JWT_SECRET = process.env.JWT_SECRET;
  if (!JWT_SECRET) {
    return res.status(500).json({ error: 'Configuration serveur manquante' });
  }

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) {
      return res.status(403).json({ error: 'Token invalide ou expiré' });
    }
    req.user = user as AuthRequest['user'];
    next();
  });
};

// Middleware pour vérifier le rôle admin
export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Utilisateur non authentifié' });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({ 
      error: 'Accès refusé: seuls les administrateurs peuvent effectuer cette action' 
    });
  }

  next();
};