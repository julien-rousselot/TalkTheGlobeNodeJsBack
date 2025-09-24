import { Router } from 'express';
import { sendEmail, sendSuggestion } from '../controllers/mailerController';
import { login, register } from '../controllers/authController';
import { authenticateToken, requireAdmin } from '../middlewares/auth';
import { upload } from '../middlewares/upload';
import { getPaymentSession, createPaymentIntent } from '../controllers/stripeController';
import { SuscribeNewsletter } from '../controllers/suscribersController';
import { recordConsent, checkConsent, checkConsentByIP, withdrawConsent } from '../controllers/consentController';
import { requireMarketingConsent } from '../middlewares/consent';

import {
  createMaterial,
  getAllMaterials,
  getMaterialById,
  updateMaterial,
  deleteMaterial,
  getFreeMaterials,
  getPaidMaterials,
  downloadMaterial
} from '../controllers/materialController';

const router = Router();

router.post('/send-email', sendEmail);
router.post('/send-suggestion', sendSuggestion);
router.post('/login', login);
router.post('/register', register);

// Cookie Consent Routes - GDPR Compliance
router.post('/consent', recordConsent);
router.get('/consent/check', checkConsent);
router.get('/consent/status/:ip', authenticateToken, requireAdmin, checkConsentByIP); // Admin only
router.delete('/consent', withdrawConsent);

// Newsletter subscription with consent protection
router.post('/subscribe-newsletter', requireMarketingConsent, SuscribeNewsletter);

router.get('/materials/resource', getFreeMaterials);
router.get('/materials',authenticateToken, requireAdmin, getAllMaterials);
router.get('/materials/shop', getPaidMaterials);
router.get('/material/:id', getMaterialById);
router.post('/material', authenticateToken, requireAdmin, upload.fields([{ name: 'cover', maxCount: 1 }, { name: 'pictures', maxCount: 10 }, { name: 'pdf', maxCount: 1 }]), createMaterial);
router.put('/material/:id', authenticateToken, requireAdmin, upload.fields([{ name: 'cover', maxCount: 1 }, { name: 'pictures', maxCount: 10 }, { name: 'pdf', maxCount: 1 }]), updateMaterial);
router.delete('/material/:id', authenticateToken, requireAdmin, deleteMaterial);
router.get("/download/:id", authenticateToken, downloadMaterial);

// Création paiement
router.post('/stripe/create-payment-intent', createPaymentIntent);
router.post('/stripe/payment-session', getPaymentSession);

export default router;
