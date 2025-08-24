import { Request, Response } from 'express';
import Stripe from 'stripe';
import {sendIdForPayment} from './materialController'
import dotenv from 'dotenv';
import { sendPurchasedPDFs } from '../services/sendPDF';
import { database } from "../config/database";

dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2025-07-30.basil'
});

// Création du PaymentIntent
export const createPaymentIntent = async (req: Request, res: Response) => {
  const { items, email } = req.body as { items: { id: number; quantity: number }[], email: string };
  
  if (!email) {
    return res.status(400).json({ error: "Email requis pour l'envoi du PDF" });
  }

  try {
    if (!items || items.length === 0) {
      return res.status(400).json({ error: "Aucun article fourni" });
    }

    let totalAmount = 0;

    // Vérifie les prix depuis la DB
    for (const item of items) {
      const material = await sendIdForPayment(item.id);

      if (!material || material.price == null || !item.quantity) {
        throw new Error(`Prix ou quantité invalide pour l'article : ${JSON.stringify(item)}`);
      }

      totalAmount += material.price * item.quantity;
    }

    const totalInCents = Math.round(totalAmount * 100);

    // ⚠️ Ici on ne met QUE id et quantity dans le metadata
    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalInCents,
      currency: 'eur',
      metadata: {
        items: JSON.stringify(items), // seulement [{id, quantity}, ...]
        email,
      },
      automatic_payment_methods: { enabled: true },
    });

    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (error: any) {
    console.error('Erreur création PaymentIntent', error);
    res.status(500).json({ error: 'Impossible de créer le paiement' });
  }
};

export const handleStripeWebhook = async (req: Request, res: Response) => {
  const signature = req.headers["stripe-signature"]!;

  try {
    const event = stripe.webhooks.constructEvent(
      req.body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );

    if (event.type === "payment_intent.succeeded") {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;

      // Récupère les métadonnées
      const customerEmail = paymentIntent.metadata.email;
      const itemsData = paymentIntent.metadata.items;

      if (!customerEmail) {
        console.error("❌ Email client manquant dans les métadonnées");
        return res.status(400).json({ error: "Email client requis" });
      }

      if (!itemsData) {
        console.error("❌ Données d'articles manquantes dans les métadonnées");
        return res.status(400).json({ error: "Données d'articles requises" });
      }

      try {
        const purchasedItems: { id: number; quantity: number }[] = JSON.parse(itemsData);

        // 🔎 Récupère les infos complètes depuis ta DB
        const ids = purchasedItems.map((i) => i.id);

        const result = await database.query(
          `SELECT id, title, price, cover, pdf FROM materials WHERE id = ANY($1)`,
          [ids]
        );

        const enrichedItems = purchasedItems.map((item) => {
          const material = result.rows.find((row) => row.id === item.id);
          if (!material) {
            throw new Error(`Article id=${item.id} introuvable en base`);
          }

          return {
            id: item.id,
            title: material.title,
            quantity: item.quantity,
            amount: Math.round(material.price * 100), // en cents
            cover: material.cover,
          };
        });

        // ✅ Envoi des PDFs enrichis
        await sendPurchasedPDFs(customerEmail, enrichedItems);

      } catch (parseError) {
        console.error("❌ Erreur parsing des articles:", parseError);
      }
    }

    res.json({ received: true });
  } catch (err: any) {
    console.error("⚠️ Webhook error:", err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
  }
};

// Récupération de la session
export const getPaymentSession = async (req: Request, res: Response) => {
  try {
    const { payment_intent_id } = req.body;

    if (!payment_intent_id) {
      return res.status(400).json({ error: "payment_intent_id is required" });
    }

    // 🔎 On récupère le PaymentIntent depuis Stripe
    const paymentIntent: Stripe.PaymentIntent = await stripe.paymentIntents.retrieve(payment_intent_id);

    // Parse les items de la metadata
    const purchasedItems: { id: number; quantity: number }[] = paymentIntent.metadata.items 
      ? JSON.parse(paymentIntent.metadata.items) 
      : [];

    let enrichedItems: any[] = [];

    if (purchasedItems.length > 0) {
      const ids = purchasedItems.map((i) => i.id);

      // 🔎 On récupère les infos complètes depuis ta DB
      const result = await database.query(
        `SELECT id, title, price, cover FROM materials WHERE id = ANY($1)`,
        [ids]
      );

      enrichedItems = purchasedItems.map((item) => {
        const material = result.rows.find((row) => row.id === item.id);
        if (!material) {
          throw new Error(`Article id=${item.id} introuvable en base`);
        }

        return {
          id: item.id,
          title: material.title,
          cover: material.cover,
          quantity: item.quantity,
          amount: Math.round(material.price * 100), // prix en cents
        };
      });
    }

    res.json({
      id: paymentIntent.id,
      amount_total: paymentIntent.amount,
      currency: paymentIntent.currency,
      status: paymentIntent.status,
      items: enrichedItems, // ✅ items enrichis avec cover & title
      customer_email: paymentIntent.receipt_email || paymentIntent.metadata.email,
    });
  } catch (err: any) {
    console.error("Erreur récupération session Stripe:", err);
    res.status(500).json({ error: err.message || "Erreur serveur" });
  }
};


