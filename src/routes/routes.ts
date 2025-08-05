import { Router } from 'express';
import { sendEmail, sendSuggestion } from '../controllers/mailerController';
import { login, register } from '../controllers/authController';

const router = Router();

router.post('/send-email', sendEmail);
router.post('/send-suggestion', sendSuggestion);
router.post('/login', login);
router.post('/register', register);


export default router;
