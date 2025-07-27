import { Request, Response } from 'express';
import { pool } from '../config/db';

export const createMaterial = async (req: Request, res: Response) => {
  const { title, description, price, photos, coverPhoto } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO materials (title, description, price, photos, cover_photo) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [title, description, price, JSON.stringify(photos), coverPhoto]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la création' });
  }
};

export const getMaterials = async (_req: Request, res: Response) => {
  try {
    const result = await pool.query('SELECT * FROM materials ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

export const getMaterialById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM materials WHERE id = $1', [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Non trouvé' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};
