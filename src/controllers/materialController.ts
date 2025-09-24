import { Request, Response } from 'express';
import { database } from '../config/database';
import { AuthRequest } from '../types';
import Stripe from 'stripe';
import path from "path";
import fs from "fs";
import { PoolClient } from 'pg';

const PDF_DIR = path.join(__dirname, "../uploads");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {apiVersion: '2025-07-30.basil'});  

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
        m.pdf,
        m.publish_at,
        m.is_draft,
        p.id AS picture_id,
        p.url
      FROM materials m
      LEFT JOIN pictures p ON m.id = p.material_id
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
          pdf: row.pdf,
          publishAt: row.publish_at,
          isDraft: row.is_draft,
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

export const getFreeMaterials = async (_req: Request, res: Response) => {
  try {
    const result = await database.query(`
      SELECT 
        m.id AS material_id,
        m.title,
        m.description,
        m.price,
        m.publish_at,
        m.cover,
        p.id AS picture_id,
        p.url,
        m.pdf
      FROM materials m
      LEFT JOIN pictures p ON m.id = p.material_id
      WHERE (m.publish_at IS NULL OR m.publish_at <= NOW())
        AND (m.price IS NULL OR m.price = 0)
        AND (m.is_draft = false OR m.is_draft IS NULL)
      ORDER BY m.id;
    `);

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
          cover: row.cover,
          pdf: row.pdf,
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
    console.error('Erreur récupération des matériels sans prix :', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

export const getPaidMaterials = async (_req: Request, res: Response) => {
  try {
    const result = await database.query(`
      SELECT 
        m.id AS material_id,
        m.title,
        m.description,
        m.cover,
        m.stripe_product_id,
        m.stripe_price_id,
        p.id AS picture_id,
        p.url
      FROM materials m
      LEFT JOIN pictures p ON m.id = p.material_id
      WHERE m.stripe_product_id IS NOT NULL
        AND m.stripe_price_id IS NOT NULL
        AND (m.publish_at IS NULL OR m.publish_at <= NOW())
        AND (m.is_draft = false OR m.is_draft IS NULL)
      ORDER BY m.id;
    `);

    const materialsMap: { [key: number]: any } = {};

    for (const row of result.rows) {
      const id = row.material_id;

      if (!materialsMap[id]) {
        materialsMap[id] = {
          id: row.material_id,
          title: row.title,
          description: row.description,
          cover: row.cover,
          stripeProductId: row.stripe_product_id,
          stripePriceId: row.stripe_price_id,
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

    // Récupération des infos Stripe
    for (const material of materials) {
      try {
        const price = await stripe.prices.retrieve(material.stripePriceId);
        material.price = price.unit_amount ? price.unit_amount / 100 : 0;
        material.currency = price.currency;

        const product = await stripe.products.retrieve(material.stripeProductId);
        material.stripeName = product.name;
      } catch (err) {
        console.error('Erreur récupération infos Stripe pour material', material.id, err);
      }
    }

    res.json(materials);
  } catch (error) {
    console.error('Erreur récupération des matériels avec prix :', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

export const createMaterial = async (req: Request, res: Response) => { 
  const { title, description, price, isDraft, publish_at, selectedResource } = req.body;
  const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;

  const priceNum = Number(price);

  // Vérifications selon le type de ressource
  if (selectedResource === 'free') {
    if (!title || !description || !files?.cover?.[0] || !files?.pdf?.[0]) {
      return res.status(400).json({ error: 'Title, description, cover and PDF are required for free resources' });
    }
  } else if (selectedResource === 'paid') {
    if (!title || isNaN(priceNum) || !description || !files?.cover?.[0] || !files?.pdf?.[0] || !files?.pictures?.[0]) {
      return res.status(400).json({ error: 'Title, description, price, cover, pictures and PDF are required for paid resources' });
    }
  }

  const coverUrl = files?.cover?.[0] ? `/uploads/${files.cover[0].filename}` : null;
  const pdfUrl = files?.pdf?.[0] ? `/uploads/${files.pdf[0].filename}` : null;
  const client = await database.connect();

  try {
    await client.query('BEGIN');

    const materialResult = await client.query(
      `INSERT INTO materials (title, description, price, is_draft, publish_at, cover, pdf) 
       VALUES ($1, $2, $3, $4, $5::timestamp, $6, $7) RETURNING id`,
      [title, description, priceNum || null, isDraft === 'true', publish_at || null, coverUrl, pdfUrl]
    );

    const materialId = materialResult.rows[0].id;

    if (files?.pictures?.length) {
      const picturesUrls = files.pictures.map(file => `/uploads/${file.filename}`);
      const placeholders = picturesUrls.map((_, i) => `($1, $${i + 2})`).join(', ');
      const values = [materialId, ...picturesUrls];

      await client.query(
        `INSERT INTO pictures (material_id, url) VALUES ${placeholders}`,
        values
      );
    }

    // --- Création du Product et Price Stripe si c'est payant ---
    let stripeProductId: string | null = null;
    let stripePriceId: string | null = null;

    if (selectedResource === 'paid') {
      const product = await stripe.products.create({
        name: title,
        description,
      });

      stripeProductId = product.id;

      const priceStripe = await stripe.prices.create({
        product: stripeProductId,
        unit_amount: Math.round(priceNum * 100), // en centimes
        currency: 'eur',
      });

      stripePriceId = priceStripe.id;

      // Tu peux stocker ces ids Stripe dans ta DB si besoin
      await client.query(
        `UPDATE materials SET stripe_product_id = $1, stripe_price_id = $2 WHERE id = $3`,
        [stripeProductId, stripePriceId, materialId]
      );
    }

    await client.query('COMMIT');

    res.status(201).json({ 
      message: 'Matériel créé avec succès', 
      id: materialId,
      cover: coverUrl,
      pdf: pdfUrl,
      stripeProductId,
      stripePriceId,
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
    // Récupérer le matériel
    const materialResult = await database.query(
      'SELECT * FROM materials WHERE id = $1',
      [id]
    );

    if (materialResult.rows.length === 0) {
      return res.status(404).json({ error: 'Matériel non trouvé' });
    }

    const material = materialResult.rows[0];

    // Récupérer les images liées
    const picturesResult = await database.query(
      'SELECT id, url FROM pictures WHERE material_id = $1',
      [id]
    );

    // Répondre avec le matériel et ses images
    res.json({
      ...material,
      pictures: picturesResult.rows
    });
  } catch (error) {
    console.error('Erreur récupération matériel:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

export const sendIdForPayment = async (id: number) => {
  if (isNaN(id)) throw new Error('ID invalide');

  const materialResult = await database.query(
    'SELECT * FROM materials WHERE id = $1',
    [id]
  );

  if (materialResult.rows.length === 0) return null;

  const material = materialResult.rows[0];

  const picturesResult = await database.query(
    'SELECT id, url FROM pictures WHERE material_id = $1',
    [id]
  );

  return {
    ...material,
    pictures: picturesResult.rows,
  };
};

export const updateMaterial = async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  const { title, description, price, selectedResource, isDraft, publish_at } = req.body;
  const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;

  if (isNaN(id)) {
    return res.status(400).json({ error: 'ID invalide' });
  }

  const priceNum = Number(price);

  // Vérifications selon le type de ressource
  if (selectedResource === 'free') {
    if (!title && !description && !files?.cover?.[0] && !files?.pdf?.[0]) {
      return res.status(400).json({ error: 'Aucune donnée à mettre à jour pour une ressource gratuite' });
    }
  } else if (selectedResource === 'paid') {
    if (!title && isNaN(priceNum) && !description && !files?.cover?.[0] && !files?.pdf?.[0] && !files?.pictures?.[0]) {
      return res.status(400).json({ error: 'Aucune donnée à mettre à jour pour une ressource payante' });
    }
  }

  const coverUrl = files?.cover?.[0] ? `/uploads/${files.cover[0].filename}` : undefined;
  const pdfUrl = files?.pdf?.[0] ? `/uploads/${files.pdf[0].filename}` : undefined;

  const client = await database.connect();
  try {
    await client.query('BEGIN');

    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (title) {
      fields.push(`title = $${paramIndex++}`);
      values.push(title);
    }
    if (description) {
      fields.push(`description = $${paramIndex++}`);
      values.push(description);
    }
    if (!isNaN(priceNum)) {
      fields.push(`price = $${paramIndex++}`);
      values.push(priceNum);
    }
    if (coverUrl) {
      fields.push(`cover = $${paramIndex++}`);
      values.push(coverUrl);
    }
    if (pdfUrl) {
      fields.push(`pdf = $${paramIndex++}`);
      values.push(pdfUrl);
    }
    if (isDraft !== undefined) {
      fields.push(`is_draft = $${paramIndex++}`);
      values.push(isDraft === 'true' || isDraft === true);
    }
    if (publish_at !== undefined) {
      fields.push(`publish_at = $${paramIndex++}`);
      values.push(publish_at || null);
    }
    if (fields.length > 0) {
      await client.query(
        `UPDATE materials SET ${fields.join(', ')} WHERE id = $${paramIndex}`,
        [...values, id]
      );
    }

    if (files?.pictures?.length) {
      // Supprimer les anciennes photos
      await client.query('DELETE FROM pictures WHERE material_id = $1', [id]);
      // Ajouter les nouvelles
      const picturesUrls = files.pictures.map(file => `/uploads/${file.filename}`);
      const placeholders = picturesUrls.map((_, i) => `($1, $${i + 2})`).join(', ');
      const valuesPics = [id, ...picturesUrls];
      await client.query(`INSERT INTO pictures (material_id, url) VALUES ${placeholders}`, valuesPics);
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

export const downloadMaterial = async (req: AuthRequest, res: Response) => {
  const materialId = parseInt(req.params.id, 10);

  try {
    // 1. Vérifier si le user a payé (ex: via Stripe Checkout Session, PaymentIntent, etc.)
    // ⚠️ À adapter à ton modèle : ici je mets un check fictif
    const userId = req.user?.id; // si tu as un middleware auth
    if (typeof userId !== 'number' || isNaN(userId)) {
      return res.status(401).json({ error: "Utilisateur non authentifié ou ID invalide" });
    }
    const hasPaid = await checkIfUserPaid(userId, materialId);

    if (!hasPaid) {
      return res.status(403).json({ error: "Accès interdit, paiement requis" });
    }

    // 2. Récupérer le chemin du PDF depuis la DB
    const result = await database.query(
      "SELECT pdf FROM materials WHERE id = $1",
      [materialId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "Matériel introuvable" });
    }

    const pdfFileName = result.rows[0].pdf;
    const pdfPath = path.join(PDF_DIR, pdfFileName);

    // 3. Vérifier que le fichier existe
    if (!fs.existsSync(pdfPath)) {
      return res.status(404).json({ error: "Fichier PDF introuvable" });
    }

    // 4. Envoyer le fichier
    res.download(pdfPath, path.basename(pdfFileName));
  } catch (error) {
    console.error("Erreur download :", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
};

async function checkIfUserPaid(userId: number, materialId: number): Promise<boolean> {
  // Ici tu relies Stripe & ta DB pour vérifier si l'utilisateur a bien payé ce produit
  // Exemple fictif : SELECT FROM purchases WHERE user_id = ? AND material_id = ?
  const result = await database.query(
    "SELECT 1 FROM purchases WHERE user_id = $1 AND material_id = $2",
    [userId, materialId]
  );
  return result.rows.length > 0;
}