import { Request, Response } from "express";
import { database } from "../config/database";

interface Subscribers {
  email: string;
  consent: boolean;
}

export const SuscribeNewsletter = async (req: Request, res: Response) => {
  const { email, consent } = req.body as Subscribers;
  
  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  if (consent === undefined || consent === null) {
    return res.status(400).json({ error: "Consent is required" });
  }

  // Additional check: verify that consent is actually true
  if (!consent) {
    return res.status(400).json({ 
      error: "Newsletter subscription requires explicit consent",
      message: "You must consent to receive marketing emails to subscribe to the newsletter"
    });
  }

  // Check if user has cookie consent for marketing (if middleware didn't already check)
  if (!req.consentInfo?.marketing_allowed) {
    return res.status(403).json({
      error: "Marketing consent required",
      message: "You must accept marketing cookies before subscribing to the newsletter",
      code: "MARKETING_CONSENT_REQUIRED"
    });
  }

  try {
    // Use UPSERT to insert new or update existing subscriber
    await database.query(`
      INSERT INTO newsletter_subscribers (email, consent, created_at) 
      VALUES ($1, $2, NOW())
      ON CONFLICT (email) 
      DO UPDATE SET 
        consent = EXCLUDED.consent,
        created_at = NOW()
    `, [email, consent]);

    res.status(201).json({ message: "Newsletter subscription successful" });
  } catch (error) {
    console.error("Error subscribing to newsletter:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
