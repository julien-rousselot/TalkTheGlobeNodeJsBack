import { Request, Response } from 'express';
import Stripe from 'stripe';
import {sendIdForPayment} from './materialController'
import dotenv from 'dotenv';
dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2025-07-30.basil'
});

type Item = {
  id: string;
  price: number;
  quantity: number;
};

export const createPaymentIntent = async (req: Request, res: Response) => {
  const { items } = req.body as { items: { id: number; quantity: number }[] };

  try {
    let totalAmount = 0;

    for (const item of items) {
      const material = await sendIdForPayment(item.id);
      if (!material || material.price == null || !item.quantity) {
        throw new Error(`Prix ou quantité invalide pour l'article : ${JSON.stringify(item)}`);
      }
      totalAmount += material.price * item.quantity;
    }

    const totalInCents = Math.round(totalAmount * 100);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalInCents,
      currency: 'eur',
      metadata: { items: JSON.stringify(items) },
      automatic_payment_methods: { enabled: true },
    });

    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    console.error('Erreur création PaymentIntent', error);
    res.status(500).json({ error: 'Impossible de créer le paiement' });
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
