import { Router } from 'express';
import { sendEmail, sendSuggestion } from '../controllers/mailerController';
import { login, register } from '../controllers/authController';
import { authenticateToken, requireAdmin } from '../middlewares/auth';
import { upload } from '../middlewares/upload';

import {
  createMaterial,
  getAllMaterials,
  getMaterialById,
  updateMaterial,
  deleteMaterial,
  getFreeMaterials,
  getPaidMaterials
} from '../controllers/materialController';

const router = Router();

router.post('/send-email', sendEmail);
router.post('/send-suggestion', sendSuggestion);
router.post('/login', login);
router.post('/register', register);

router.get('/materials/resource', getFreeMaterials);
router.get('/material', requireAdmin, getAllMaterials);
router.get('/materials/shop', getPaidMaterials);
router.get('/material/:id', getMaterialById);
router.post(
  '/material',
  authenticateToken,
  requireAdmin,
  upload.fields([
    { name: 'cover', maxCount: 1 },
    { name: 'pictures', maxCount: 10 }
  ]),
  createMaterial
);
router.put('/material/:id', authenticateToken, requireAdmin, updateMaterial);
router.delete('/material/:id', authenticateToken, requireAdmin, deleteMaterial);


export default router;
