import { Request, Response } from 'express';
import Stripe from 'stripe';
import {sendIdForPayment} from './materialController'
import dotenv from 'dotenv';
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
    const enrichedItems: { id: number; title: string; quantity: number; amount: number; cover: string }[] = [];

    for (const item of items) {
      const material = await sendIdForPayment(item.id);
      console.log(material);

      if (!material || material.price == null || !item.quantity) {
        throw new Error(`Prix ou quantité invalide pour l'article : ${JSON.stringify(item)}`);
      }

      totalAmount += material.price * item.quantity;

      enrichedItems.push({
        id: item.id,
        title: material.title,
        quantity: item.quantity,
        amount: Math.round(material.price * 100),
        cover: material.cover
      });
    }

    const totalInCents = Math.round(totalAmount * 100);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalInCents,
      currency: 'eur',
      metadata: { items: JSON.stringify(enrichedItems), email },
      automatic_payment_methods: { enabled: true },
    });

    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (error: any) {
    console.error('Erreur création PaymentIntent', error);
    res.status(500).json({ error: 'Impossible de créer le paiement' });
  }
};

// Récupération de la session
export const getPaymentSession = async (req: Request, res: Response) => {
  try {
    const { payment_intent_id } = req.body;

    if (!payment_intent_id) {
      return res.status(400).json({ error: "payment_intent_id is required" });
    }

    const paymentIntent: Stripe.PaymentIntent = await stripe.paymentIntents.retrieve(payment_intent_id);

    // On récupère directement les items depuis le PaymentIntent
    const purchasedItems = paymentIntent.metadata.items
      ? JSON.parse(paymentIntent.metadata.items)
      : [];

    res.json({
      id: paymentIntent.id,
      amount_total: paymentIntent.amount,
      currency: paymentIntent.currency,
      status: paymentIntent.status,
      items: purchasedItems,
      customer_email: paymentIntent.receipt_email || paymentIntent.metadata.email,
    });
  } catch (err: any) {
    console.error("Erreur récupération session Stripe:", err);
    res.status(500).json({ error: err.message || "Erreur serveur" });
  }
};


export const stripeWebhook = (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string;

  try {
    const event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET as string
    );

    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const materialId = paymentIntent.metadata.materialId;

      console.log(`✅ Paiement réussi pour matériel ${materialId}`);
      // updateMaterialAsPaid(materialId);
    }

    res.json({ received: true });
  } catch (err) {
    console.error('Erreur Webhook', err);
    res.status(400).send(`Webhook Error: ${(err as Error).message}`);
  }
};
