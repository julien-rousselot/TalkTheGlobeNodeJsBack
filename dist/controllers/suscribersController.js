"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SuscribeNewsletter = void 0;
const database_1 = require("../config/database");
const SuscribeNewsletter = async (req, res) => {
    const { email, consent } = req.body;
    if (!email) {
        return res.status(400).json({ error: "Email is required" });
    }
    if (consent === undefined || consent === null) {
        return res.status(400).json({ error: "Consent is required" });
    }
    try {
        // Use UPSERT to insert new or update existing subscriber
        await database_1.database.query(`
      INSERT INTO newsletter_subscribers (email, consent, created_at) 
      VALUES ($1, $2, NOW())
      ON CONFLICT (email) 
      DO UPDATE SET 
        consent = EXCLUDED.consent,
        created_at = NOW()
    `, [email, consent]);
        res.status(201).json({ message: "Newsletter subscription successful" });
    }
    catch (error) {
        console.error("Error subscribing to newsletter:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
exports.SuscribeNewsletter = SuscribeNewsletter;
