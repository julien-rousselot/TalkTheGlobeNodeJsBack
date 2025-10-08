import dotenv from 'dotenv';
dotenv.config();


import express from 'express';
import path from 'path';
import cors from 'cors';
import { database } from './config/database';
import router from './routes/routes';
import { handleStripeWebhook } from './controllers/stripeController';
import r2Routes from "./routes/r2.routes";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://pub-e936eccc264545cbb892e22ef2cce4f1.r2.dev'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Length', 'Content-Type']
}));


// Middleware pour parser JSON
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.post("/webhook", express.raw({ type: "application/json" }), handleStripeWebhook);

// Routes principales
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/r2", r2Routes);
app.use('/api', router);

// Tester la connexion à la DB au démarrage
database.connect()
  .then(() => console.log('✅ Connexion à PostgreSQL réussie'))
  .catch((err) => console.error('❌ Erreur de connexion à PostgreSQL :', err));


app.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur le port ${PORT}`);
});