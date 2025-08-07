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
  deleteMaterial
} from '../controllers/materialController';

const router = Router();

router.post('/send-email', sendEmail);
router.post('/send-suggestion', sendSuggestion);
router.post('/login', login);
router.post('/register', register);

router.get('/material', authenticateToken, requireAdmin, getAllMaterials);
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
router.get('/material/:id', authenticateToken, requireAdmin, getMaterialById);
router.put('/material/:id', authenticateToken, requireAdmin, updateMaterial);
router.delete('/material/:id', authenticateToken, requireAdmin, deleteMaterial);


export default router;
