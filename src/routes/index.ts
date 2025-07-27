import { Router, Request, Response } from 'express';
import mailerRoutes from './mailer';

const router = Router();

// Basic routes
router.get('/', (req: Request, res: Response) => {
  res.json({ message: 'TalkTheGlobe API is running!' });
});

router.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Mailer routes
router.use('/mailer', mailerRoutes);

export default router;