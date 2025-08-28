"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPaymentSession = exports.handleStripeWebhook = exports.createPaymentIntent = void 0;
const stripe_1 = __importDefault(require("stripe"));
const materialController_1 = require("./materialController");
const dotenv_1 = __importDefault(require("dotenv"));
const sendPDF_1 = require("../services/sendPDF");
const database_1 = require("../config/database");
dotenv_1.default.config();
const stripe = new stripe_1.default(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2025-07-30.basil'
});
// Création du PaymentIntent
const createPaymentIntent = async (req, res) => {
    const { items, email } = req.body;
    console.log('Création d\'un PaymentIntent pour l\'email:');
    if (!email) {
        return res.status(400).json({ error: "Email requis pour l'envoi du PDF" });
    }
    try {
        if (!items || items.length === 0) {
            return res.status(400).json({ error: "Aucun article fourni" });
        }
        let totalAmount = 0;
        const enrichedItems = [];
        const metadataItems = [];
        for (const item of items) {
            const material = await (0, materialController_1.sendIdForPayment)(item.id);
            if (!material) {
                throw new Error(`Matériel avec l'ID ${item.id} introuvable`);
            }
            if (material.price == null) {
                throw new Error(`Prix manquant pour le matériel ID ${item.id}: ${material.title}`);
            }
            if (!item.quantity || item.quantity <= 0) {
                throw new Error(`Quantité invalide pour l'article ID ${item.id}: ${item.quantity}`);
            }
            totalAmount += material.price * item.quantity;
            enrichedItems.push({
                id: item.id,
                title: material.title,
                quantity: item.quantity,
                amount: Math.round(material.price * 100),
                cover: material.cover
            });
            metadataItems.push({
                id: item.id,
                quantity: item.quantity
            });
        }
        const totalInCents = Math.round(totalAmount * 100);
        const paymentIntent = await stripe.paymentIntents.create({
            amount: totalInCents,
            currency: 'eur',
            metadata: { items: JSON.stringify(metadataItems), email },
            automatic_payment_methods: { enabled: true },
        });
        res.json({ clientSecret: paymentIntent.client_secret });
    }
    catch (error) {
        console.error('Erreur création PaymentIntent', error);
        res.status(500).json({
            error: 'Impossible de créer le paiement',
            details: error.message
        });
    }
};
exports.createPaymentIntent = createPaymentIntent;
const handleStripeWebhook = async (req, res) => {
    const sig = req.headers["stripe-signature"];
    console.log("🔧 Webhook received:");
    try {
        const event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
        console.log("🔧 Webhook event constructed:", event.type);
        // helper to process a PaymentIntent object (shared between events)
        // Adds idempotency by recording processed payment/charge ids in the database.
        const processPaymentIntent = async (paymentIntent, uniqueIdOverride) => {
            if (!paymentIntent)
                return false;
            const procId = uniqueIdOverride || `payment_intent:${paymentIntent.id}`;
            console.log("✅ Processing PaymentIntent:", paymentIntent.id, "procId:", procId);
            // Ensure idempotency table exists (cheap, safe operation)
            try {
                await database_1.database.query(`CREATE TABLE IF NOT EXISTS stripe_processed_payments (id TEXT PRIMARY KEY, created_at TIMESTAMPTZ DEFAULT now())`);
            }
            catch (e) {
                console.error('❌ Failed to ensure idempotency table exists:', e);
                // continue; we'll still try to insert/check
            }
            // Try to insert a record for this procId. If it already exists, skip processing.
            try {
                await database_1.database.query('INSERT INTO stripe_processed_payments(id) VALUES($1)', [procId]);
            }
            catch (e) {
                // Postgres unique violation code
                if (e && (e.code === '23505' || (e.message && e.message.includes('duplicate key')))) {
                    console.log(`ℹ️ Already processed ${procId}, skipping.`);
                    return false;
                }
                console.error('❌ DB error inserting processed id for', procId, e);
                return false;
            }
            const customerEmail = paymentIntent.metadata.email;
            const itemsData = paymentIntent.metadata.items;
            if (!customerEmail) {
                console.error("❌ Email client manquant dans les métadonnées");
                return false;
            }
            if (!itemsData) {
                console.error("❌ Données d'articles manquantes dans les métadonnées");
                return false;
            }
            try {
                const simplifiedItems = JSON.parse(itemsData);
                console.log(`📧 Préparation de l'envoi des PDFs à ${customerEmail} pour ${simplifiedItems.length} articles`);
                const enrichedItems = [];
                for (const item of simplifiedItems) {
                    const material = await (0, materialController_1.sendIdForPayment)(item.id);
                    if (material) {
                        enrichedItems.push({
                            id: item.id,
                            title: material.title,
                            quantity: item.quantity,
                            amount: Math.round(material.price * 100),
                            cover: material.cover
                        });
                    }
                }
                console.log("🔧 About to call sendPurchasedPDFs for:", customerEmail, "items:", enrichedItems.length);
                const success = await (0, sendPDF_1.sendPurchasedPDFs)(customerEmail, enrichedItems);
                if (success) {
                    console.log(`✅ PDFs envoyés avec succès à ${customerEmail}`);
                    return true;
                }
                else {
                    console.error(`❌ Échec de l'envoi des PDFs à ${customerEmail}`);
                    return false;
                }
            }
            catch (parseError) {
                console.error("❌ Erreur parsing des articles:", parseError);
                return false;
            }
        };
        if (event.type === "payment_intent.succeeded") {
            const paymentIntent = event.data.object;
            await processPaymentIntent(paymentIntent);
        }
        else if (event.type === 'charge.succeeded') {
            // A Charge may be created/updated independently; try to find its PaymentIntent
            const charge = event.data.object;
            console.log('🔔 charge.succeeded received for charge:', charge.id);
            // Prefer metadata on charge if present
            const chargeEmail = (charge.metadata && charge.metadata.email) || undefined;
            const chargeItems = (charge.metadata && charge.metadata.items) || undefined;
            if (chargeEmail && chargeItems) {
                try {
                    const simplifiedItems = JSON.parse(chargeItems);
                    // Build a fake paymentIntent-like object to reuse the processor
                    // Use a distinct id when no payment_intent exists to avoid collision
                    const fakeId = charge.payment_intent ? charge.payment_intent : `charge:${charge.id}`;
                    const fakePI = { id: fakeId, metadata: { email: chargeEmail, items: chargeItems } };
                    await processPaymentIntent(fakePI);
                }
                catch (e) {
                    console.error('❌ Failed to parse items from charge metadata:', e);
                }
            }
            else if (charge.payment_intent) {
                try {
                    const pi = await stripe.paymentIntents.retrieve(charge.payment_intent);
                    await processPaymentIntent(pi);
                }
                catch (e) {
                    console.error('❌ Unable to retrieve PaymentIntent for charge:', charge.payment_intent, e);
                }
            }
            else {
                console.warn('⚠️ charge.succeeded had no payment_intent or metadata to process');
            }
        }
        res.json({ received: true });
    }
    catch (err) {
        console.log("⚠️ Webhook error:", err);
        console.error("⚠️ Webhook error:", err.message);
        res.status(400).send(`Webhook Error: ${err.message}`);
    }
};
exports.handleStripeWebhook = handleStripeWebhook;
// Récupération de la session
const getPaymentSession = async (req, res) => {
    try {
        const { payment_intent_id } = req.body;
        if (!payment_intent_id) {
            return res.status(400).json({ error: "payment_intent_id is required" });
        }
        // 🔎 On récupère le PaymentIntent depuis Stripe
        const paymentIntent = await stripe.paymentIntents.retrieve(payment_intent_id);
        // Reconstruct enriched items from metadata with all necessary information
        const simplifiedItems = paymentIntent.metadata.items ? JSON.parse(paymentIntent.metadata.items) : [];
        const enrichedItems = [];
        for (const item of simplifiedItems) {
            const material = await (0, materialController_1.sendIdForPayment)(item.id);
            if (material) {
                enrichedItems.push({
                    id: item.id,
                    title: material.title,
                    quantity: item.quantity,
                    amount: Math.round(material.price * 100), // Amount in cents
                    cover: material.cover
                });
            }
        }
        res.json({
            id: paymentIntent.id,
            amount_total: paymentIntent.amount,
            currency: paymentIntent.currency,
            status: paymentIntent.status,
            items: enrichedItems, // Return enriched items with amount
            customer_email: paymentIntent.receipt_email || paymentIntent.metadata.email,
        });
    }
    catch (err) {
        console.error("Erreur récupération session Stripe:", err);
        res.status(500).json({ error: err.message || "Erreur serveur" });
    }
};
exports.getPaymentSession = getPaymentSession;
