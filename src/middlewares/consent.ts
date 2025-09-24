import { Request, Response, NextFunction } from 'express';
import { database } from '../config/database';

// Helper function to get real IP address (same as in controller)
const getRealIP = (req: Request): string => {
  const xForwardedFor = req.headers['x-forwarded-for'];
  const xRealIP = req.headers['x-real-ip'];
  const cfConnectingIP = req.headers['cf-connecting-ip'];
  
  if (xForwardedFor) {
    const ips = Array.isArray(xForwardedFor) ? xForwardedFor[0] : xForwardedFor;
    return ips.split(',')[0].trim();
  }
  
  if (xRealIP && typeof xRealIP === 'string') {
    return xRealIP;
  }
  
  if (cfConnectingIP && typeof cfConnectingIP === 'string') {
    return cfConnectingIP;
  }
  
  return req.connection.remoteAddress || req.socket.remoteAddress || 'unknown';
};

// Middleware to check if user has given marketing consent
export const requireMarketingConsent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ipAddress = getRealIP(req);
    
    // Query consent table for this IP
    const result = await database.query(`
      SELECT marketing_allowed, consent_type, updated_at
      FROM consent 
      WHERE ip_address = $1
    `, [ipAddress]);
    
    // If no consent record exists, block marketing activities
    if (result.rows.length === 0) {
      return res.status(403).json({
        error: 'Marketing consent required',
        message: 'You must accept marketing cookies to use this feature',
        code: 'CONSENT_REQUIRED',
        consent_status: {
          has_consent: false,
          marketing_allowed: false
        }
      });
    }
    
    const consent = result.rows[0];
    
    // If marketing is not allowed, block the request
    if (!consent.marketing_allowed) {
      return res.status(403).json({
        error: 'Marketing consent denied',
        message: 'You have declined marketing cookies. This feature requires marketing consent.',
        code: 'CONSENT_DENIED',
        consent_status: {
          has_consent: true,
          marketing_allowed: false,
          consent_type: consent.consent_type,
          timestamp: consent.updated_at
        }
      });
    }
    
    // Add consent info to request for use in controllers
    req.consentInfo = {
      marketing_allowed: consent.marketing_allowed,
      consent_type: consent.consent_type,
      ip_address: ipAddress
    };
    
    // Consent is valid, proceed
    next();
    
  } catch (error) {
    console.error('Error checking marketing consent:', error);
    
    // In case of database error, we could either:
    // 1. Block the request (secure approach)
    // 2. Allow the request (user-friendly approach)
    // Let's go with blocking for GDPR compliance
    return res.status(500).json({
      error: 'Consent verification failed',
      message: 'Unable to verify consent status. Please try again.',
      code: 'CONSENT_CHECK_FAILED'
    });
  }
};

// Optional: Middleware to check any specific consent type
export const requireConsent = (consentType: 'marketing' | 'analytics' | 'functional') => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ipAddress = getRealIP(req);
      
      const result = await database.query(`
        SELECT marketing_allowed, analytics_allowed, functional_allowed, consent_type, updated_at
        FROM consent 
        WHERE ip_address = $1
      `, [ipAddress]);
      
      if (result.rows.length === 0) {
        return res.status(403).json({
          error: `${consentType} consent required`,
          message: `You must accept ${consentType} cookies to use this feature`,
          code: 'CONSENT_REQUIRED'
        });
      }
      
      const consent = result.rows[0];
      const allowedField = `${consentType}_allowed`;
      
      if (!consent[allowedField]) {
        return res.status(403).json({
          error: `${consentType} consent denied`,
          message: `You have declined ${consentType} cookies. This feature requires ${consentType} consent.`,
          code: 'CONSENT_DENIED'
        });
      }
      
      req.consentInfo = {
        marketing_allowed: consent.marketing_allowed,
        analytics_allowed: consent.analytics_allowed,
        functional_allowed: consent.functional_allowed,
        consent_type: consent.consent_type,
        ip_address: ipAddress
      };
      
      next();
      
    } catch (error) {
      console.error(`Error checking ${consentType} consent:`, error);
      return res.status(500).json({
        error: 'Consent verification failed',
        code: 'CONSENT_CHECK_FAILED'
      });
    }
  };
};

// Extend Express Request interface to include consent info
declare global {
  namespace Express {
    interface Request {
      consentInfo?: {
        marketing_allowed: boolean;
        analytics_allowed?: boolean;
        functional_allowed?: boolean;
        consent_type: string;
        ip_address: string;
      };
    }
  }
}
