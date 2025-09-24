import { Request, Response } from 'express';
import { database } from '../config/database';

interface ConsentRequest {
  consent_type: 'accepted' | 'declined' | 'custom';
  marketing_allowed: boolean;
  functional_allowed?: boolean;
  analytics_allowed?: boolean;
}

// Helper function to get real IP address
const getRealIP = (req: Request): string => {
  // Check various headers for real IP (in order of preference)
  const xForwardedFor = req.headers['x-forwarded-for'];
  const xRealIP = req.headers['x-real-ip'];
  const cfConnectingIP = req.headers['cf-connecting-ip']; // Cloudflare
  
  if (xForwardedFor) {
    // x-forwarded-for can contain multiple IPs, take the first one
    const ips = Array.isArray(xForwardedFor) ? xForwardedFor[0] : xForwardedFor;
    return ips.split(',')[0].trim();
  }
  
  if (xRealIP && typeof xRealIP === 'string') {
    return xRealIP;
  }
  
  if (cfConnectingIP && typeof cfConnectingIP === 'string') {
    return cfConnectingIP;
  }
  
  // Fallback to connection remote address
  return req.connection.remoteAddress || req.socket.remoteAddress || 'unknown';
};

// POST /api/consent - Record user consent
export const recordConsent = async (req: Request, res: Response) => {
  try {
    const { consent_type, marketing_allowed, functional_allowed = true, analytics_allowed = false } = req.body as ConsentRequest;
    
    // Validation
    if (!consent_type || !['accepted', 'declined', 'custom'].includes(consent_type)) {
      return res.status(400).json({ 
        error: 'Invalid consent_type. Must be: accepted, declined, or custom' 
      });
    }
    
    if (typeof marketing_allowed !== 'boolean') {
      return res.status(400).json({ 
        error: 'marketing_allowed must be a boolean' 
      });
    }
    
    // Get user info
    const ipAddress = getRealIP(req);
    const userAgent = req.headers['user-agent'] || 'unknown';
    
    // Insert or update consent record
    const result = await database.query(`
      INSERT INTO consent (ip_address, consent_type, marketing_allowed, functional_allowed, analytics_allowed, user_agent, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      ON CONFLICT (ip_address) 
      DO UPDATE SET 
        consent_type = EXCLUDED.consent_type,
        marketing_allowed = EXCLUDED.marketing_allowed,
        functional_allowed = EXCLUDED.functional_allowed,
        analytics_allowed = EXCLUDED.analytics_allowed,
        user_agent = EXCLUDED.user_agent,
        updated_at = NOW()
      RETURNING id, created_at, updated_at
    `, [ipAddress, consent_type, marketing_allowed, functional_allowed, analytics_allowed, userAgent]);
    
    const consentRecord = result.rows[0];
    
    res.status(200).json({
      success: true,
      message: 'Consent recorded successfully',
      data: {
        id: consentRecord.id,
        ip_address: ipAddress,
        consent_type,
        marketing_allowed,
        functional_allowed,
        analytics_allowed,
        timestamp: consentRecord.updated_at || consentRecord.created_at
      }
    });
    
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to record consent',
      details: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
};

// GET /api/consent/check - Check user consent status
export const checkConsent = async (req: Request, res: Response) => {
  try {
    const ipAddress = getRealIP(req);
    
    const result = await database.query(`
      SELECT consent_type, marketing_allowed, functional_allowed, analytics_allowed, created_at, updated_at
      FROM consent 
      WHERE ip_address = $1
    `, [ipAddress]);
    
    if (result.rows.length === 0) {
      return res.status(200).json({
        has_consent: false,
        marketing_allowed: false,
        functional_allowed: true, // Default assumption
        analytics_allowed: false,
        message: 'No consent record found for this IP'
      });
    }
    
    const consent = result.rows[0];
    
    res.status(200).json({
      has_consent: true,
      consent_type: consent.consent_type,
      marketing_allowed: consent.marketing_allowed,
      functional_allowed: consent.functional_allowed,
      analytics_allowed: consent.analytics_allowed,
      timestamp: consent.updated_at || consent.created_at
    });
    
  } catch (error) {
    console.error('Error checking consent:', error);
    res.status(500).json({ 
      error: 'Failed to check consent',
      details: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
};

// GET /api/consent/status/:ip - Admin endpoint to check specific IP (optional)
export const checkConsentByIP = async (req: Request, res: Response) => {
  try {
    const { ip } = req.params;
    
    if (!ip) {
      return res.status(400).json({ error: 'IP address is required' });
    }
    
    const result = await database.query(`
      SELECT ip_address, consent_type, marketing_allowed, functional_allowed, analytics_allowed, created_at, updated_at, user_agent
      FROM consent 
      WHERE ip_address = $1
    `, [ip]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'No consent record found for this IP address'
      });
    }
    
    const consent = result.rows[0];
    
    res.status(200).json({
      success: true,
      data: consent
    });
    
  } catch (error) {
    console.error('Error checking consent by IP:', error);
    res.status(500).json({ 
      error: 'Failed to check consent',
      details: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
};

// DELETE /api/consent - Withdraw consent (GDPR right to be forgotten)
export const withdrawConsent = async (req: Request, res: Response) => {
  try {
    const ipAddress = getRealIP(req);
    
    const result = await database.query(`
      UPDATE consent 
      SET consent_type = 'declined', 
          marketing_allowed = false, 
          analytics_allowed = false,
          updated_at = NOW()
      WHERE ip_address = $1
      RETURNING id
    `, [ipAddress]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'No consent record found to withdraw'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Consent withdrawn successfully'
    });
    
  } catch (error) {
    console.error('Error withdrawing consent:', error);
    res.status(500).json({ 
      error: 'Failed to withdraw consent',
      details: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
};
