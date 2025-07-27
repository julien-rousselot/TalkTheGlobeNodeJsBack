import { Router } from 'express';
import { createMaterial, getMaterials, getMaterialById } from '../controllers/materialController';
import adminAuth from '../middleware/auth';

const router = Router();

router.post('/', adminAuth, createMaterial);
router.get('/', getMaterials);
router.get('/:id', getMaterialById);

export default router;
