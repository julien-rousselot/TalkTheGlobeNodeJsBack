import { Request, Response } from 'express';
import { database } from '../config/database';

interface Material {
  title: string;
  description?: string;
  price: number;
  pictures?: string[];
}

export const getAllMaterials = async (_req: Request, res: Response) => {
  try {
    const result = await database.query(`
      SELECT 
        m.id AS material_id,
        m.title,
        m.description,
        m.price,
        m.publish_at,
        p.id AS picture_id,
        p.url
      FROM materials m
      LEFT JOIN pictures p ON m.id = p.material_id
      WHERE m.publish_at IS NULL OR m.publish_at <= NOW()
      ORDER BY m.id;
    `);

    // Regrouper les résultats par matériel
    const materialsMap: { [key: number]: any } = {};

    for (const row of result.rows) {
      const id = row.material_id;

      if (!materialsMap[id]) {
        materialsMap[id] = {
          id: row.material_id,
          title: row.title,
          description: row.description,
          price: row.price,
          publishAt: row.publish_at,
          pictures: []
        };
      }

      if (row.picture_id) {
        materialsMap[id].pictures.push({
          id: row.picture_id,
          url: row.url
        });
      }
    }

    const materials = Object.values(materialsMap);

    res.json(materials);
  } catch (error) {
    console.error('Erreur récupération de tous les matériels :', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

export const createMaterial = async (req: Request, res: Response) => {
  const { title, description, price, isDraft, publish_at } = req.body;
  const files = req.files as {[fieldname: string]: Express.Multer.File[];} | undefined;
  
  const priceNum = Number(price);
  if (!title || isNaN(priceNum)) {
    return res.status(400).json({ error: 'Titre et prix valides requis' });
  }

  const allPictures: string[] = [];

  if (files?.cover?.[0]) {
    allPictures.push(`/uploads/${files.cover[0].filename}`);
  }

  if (files?.pictures?.length) {
    files.pictures.forEach(file => {
      allPictures.push(`/uploads/${file.filename}`);
    });
  }

  const client = await database.connect();

  try {
    await client.query('BEGIN');

    const materialResult = await client.query(
      'INSERT INTO materials (title, description, price, is_draft, publish_at) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [title, description, priceNum || null, isDraft === 'true', publish_at || null]
    );

    const materialId = materialResult.rows[0].id;

    // Insertion des images associées (seulement s'il y en a)
    if (allPictures.length > 0) {
      const placeholders = allPictures.map((_, i) => `($1, $${i + 2})`).join(', ');
      const values = [materialId, ...allPictures];
      await client.query(
        `INSERT INTO pictures (material_id, url) VALUES ${placeholders}`,
        values
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ 
      message: 'Matériel créé avec succès', 
      id: materialId,
      pictures: allPictures 
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erreur création matériel:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  } finally {
    client.release();
  }
};

export const getMaterialById = async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);

  if (isNaN(id)) {
    return res.status(400).json({ error: 'ID invalide' });
  }

  try {
    const materialResult = await database.query(
      'SELECT id, title, description, price FROM materials WHERE id = $1',
      [id]
    );

    if (materialResult.rows.length === 0) {
      return res.status(404).json({ error: 'Matériel non trouvé' });
    }

    const material = materialResult.rows[0];

    const picturesResult = await database.query(
      'SELECT id, url FROM pictures WHERE material_id = $1',
      [id]
    );

    res.json({
      ...material,
      pictures: picturesResult.rows
    });
  } catch (error) {
    console.error('Erreur récupération matériel:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

export const updateMaterial = async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  const { title, description, price, pictures } = req.body as Material;

  if (isNaN(id)) {
    return res.status(400).json({ error: 'ID invalide' });
  }

  if (!title && !description && price === undefined && !pictures) {
    return res.status(400).json({ error: 'Aucune donnée à mettre à jour' });
  }

  const client = await database.connect();

  try {
    await client.query('BEGIN');

    // Construction dynamique de la requête SQL
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (title) {
      fields.push(`title = $${paramIndex++}`);
      values.push(title);
    }
    if (description !== undefined) {
      fields.push(`description = $${paramIndex++}`);
      values.push(description);
    }
    if (price !== undefined) {
      fields.push(`price = $${paramIndex++}`);
      values.push(price);
    }

    if (fields.length > 0) {
      await client.query(
        `UPDATE materials SET ${fields.join(', ')} WHERE id = $${paramIndex}`,
        [...values, id]
      );
    }

    if (Array.isArray(pictures)) {
      // Supprimer les anciennes photos
      await client.query('DELETE FROM pictures WHERE material_id = $1', [id]);

      // Ajouter les nouvelles
      if (pictures.length > 0) {
        const placeholders = pictures.map((_, i) => `($1, $${i + 2})`).join(', ');
        const picValues = [id, ...pictures];
        await client.query(`INSERT INTO pictures (material_id, url) VALUES ${placeholders}`, picValues);
      }
    }

    await client.query('COMMIT');
    res.status(200).json({ message: 'Matériel mis à jour avec succès' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erreur mise à jour matériel:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  } finally {
    client.release();
  }
};

export const deleteMaterial = async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);

  if (isNaN(id)) {
    return res.status(400).json({ error: 'ID invalide' });
  }

  const client = await database.connect();

  try {
    await client.query('BEGIN');

    // Vérifier si le matériel existe
    const check = await client.query('SELECT id FROM materials WHERE id = $1', [id]);
    if (check.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Matériel non trouvé' });
    }

    // Supprimer les photos associées
    await client.query('DELETE FROM pictures WHERE material_id = $1', [id]);

    // Supprimer le matériel
    await client.query('DELETE FROM materials WHERE id = $1', [id]);

    await client.query('COMMIT');
    res.status(200).json({ message: 'Matériel supprimé avec succès' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erreur suppression matériel:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  } finally {
    client.release();
  }
};