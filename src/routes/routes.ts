import { Router } from 'express';
import { sendEmail, sendSuggestion } from '../controllers/mailerController';
import { login, register } from '../controllers/authController';
import { authenticateToken, requireAdmin } from '../middlewares/auth';
import { upload } from '../middlewares/upload';
import { getPaymentSession, createPaymentIntent } from '../controllers/stripeController';
import { SuscribeNewsletter } from '../controllers/suscribersController';

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
router.post('/subscribe-newsletter', SuscribeNewsletter)

router.get('/materials/resource', getFreeMaterials);
router.get('/material', requireAdmin, getAllMaterials);
router.get('/materials/shop', getPaidMaterials);
router.get('/material/:id', getMaterialById);
router.post('/material', authenticateToken, requireAdmin, upload.fields([{ name: 'cover', maxCount: 1 }, { name: 'pictures', maxCount: 10 }, { name: 'pdf', maxCount: 1 }]), createMaterial);
router.put('/material/:id', authenticateToken, requireAdmin, updateMaterial);
router.delete('/material/:id', authenticateToken, requireAdmin, deleteMaterial);
router.get("/download/:id", authenticateToken, downloadMaterial);

// Création paiement
router.post('/stripe/create-payment-intent', createPaymentIntent);
router.post('/stripe/payment-session', getPaymentSession);

export default router;
