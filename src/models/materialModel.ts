import { pool } from '../config/db';

export interface Material {
  id?: number;
  title: string;
  description?: string;
  price: number;
  photos: string[]; // URLs des photos
  created_at?: Date;
}

const MaterialModel = {
  async create(data: Material): Promise<number> {
    const { title, description, price, photos } = data;
    const result = await pool.query(
      'INSERT INTO materials (title, description, price, photos) VALUES ($1, $2, $3, $4) RETURNING id',
      [title, description || null, price, JSON.stringify(photos)]
    );
    return result.rows[0].id;
  },

  async findAll(): Promise<Material[]> {
    const result = await pool.query('SELECT * FROM materials ORDER BY created_at DESC');
    
    interface MaterialRow {
      id: number;
      title: string;
      description: string | null;
      price: number;
      photos: string;
      created_at: Date;
    }

    return result.rows.map((row: MaterialRow): Material => ({
      id: row.id,
      title: row.title,
      description: row.description ?? undefined,
      price: Number(row.price),
      photos: JSON.parse(row.photos || '[]'),
      created_at: row.created_at,
    }));
  },

  async findById(id: number): Promise<Material | null> {
    const result = await pool.query('SELECT * FROM materials WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      title: row.title,
      description: row.description ?? undefined,
      price: Number(row.price),
      photos: JSON.parse(row.photos || '[]'),
      created_at: row.created_at,
    };
  },

  async update(id: number, data: Partial<Material>): Promise<boolean> {
    const { title, description, price, photos } = data;
    const result = await pool.query(
      'UPDATE materials SET title = $1, description = $2, price = $3, photos = $4 WHERE id = $5',
      [title, description || null, price, JSON.stringify(photos), id]
    );
    return result.rowCount > 0;
  },

  async delete(id: number): Promise<boolean> {
    const result = await pool.query('DELETE FROM materials WHERE id = $1', [id]);
    return result.rowCount > 0;
  }
};

export default MaterialModel;
