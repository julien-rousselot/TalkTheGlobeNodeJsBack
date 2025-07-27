import { Router } from 'express';
import { sendEmail, sendSuggestion } from '../controllers/mailerController';

const router = Router();

router.post('/send-email', sendEmail);
router.post('/send-suggestion', sendSuggestion);

export default router;