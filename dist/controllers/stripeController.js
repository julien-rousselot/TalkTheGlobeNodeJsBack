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
dotenv_1.default.config();
const stripe = new stripe_1.default(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2025-07-30.basil'
});
// Création du PaymentIntent
const createPaymentIntent = async (req, res) => {
    const { items, email } = req.body;
    if (!email) {
        return res.status(400).json({ error: "Email requis pour l'envoi du PDF" });
    }
    try {
        if (!items || items.length === 0) {
            return res.status(400).json({ error: "Aucun article fourni" });
        }
        let totalAmount = 0;
        const enrichedItems = [];
        for (const item of items) {
            const material = await (0, materialController_1.sendIdForPayment)(item.id);
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
    }
    catch (error) {
        console.error('Erreur création PaymentIntent', error);
        res.status(500).json({ error: 'Impossible de créer le paiement' });
    }
};
exports.createPaymentIntent = createPaymentIntent;
const handleStripeWebhook = async (req, res) => {
    const sig = req.headers["stripe-signature"];
    try {
        const event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
        if (event.type === "payment_intent.succeeded") {
            const paymentIntent = event.data.object;
            console.log("✅ Paiement réussi :", paymentIntent.id);
            // Validate required metadata
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
                const purchasedItems = JSON.parse(itemsData);
                console.log(`📧 Envoi des PDFs à ${customerEmail} pour ${purchasedItems.length} articles`);
                // Send PDFs to customer
                const success = await (0, sendPDF_1.sendPurchasedPDFs)(customerEmail, purchasedItems);
                if (success) {
                    console.log(`✅ PDFs envoyés avec succès à ${customerEmail}`);
                }
                else {
                    console.error(`❌ Échec de l'envoi des PDFs à ${customerEmail}`);
                }
            }
            catch (parseError) {
                console.error("❌ Erreur parsing des articles:", parseError);
            }
        }
        res.json({ received: true });
    }
    catch (err) {
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
        const paymentIntent = await stripe.paymentIntents.retrieve(payment_intent_id);
        // On récupère directement les items depuis le PaymentIntent
        const purchasedItems = paymentIntent.metadata.items ? JSON.parse(paymentIntent.metadata.items) : [];
        res.json({
            id: paymentIntent.id,
            amount_total: paymentIntent.amount,
            currency: paymentIntent.currency,
            status: paymentIntent.status,
            items: purchasedItems,
            customer_email: paymentIntent.receipt_email || paymentIntent.metadata.email,
        });
    }
    catch (err) {
        console.error("Erreur récupération session Stripe:", err);
        res.status(500).json({ error: err.message || "Erreur serveur" });
    }
};
exports.getPaymentSession = getPaymentSession;
