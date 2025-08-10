// app.ts
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import path from 'path';
import cors from 'cors';
import { database } from './config/database';
import router from './routes/routes';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: 'http://localhost:5173', 
  credentials: true
}));

// Middleware pour parser JSON
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes principales
app.use('/api', router);

// Tester la connexion à la DB au démarrage
database.connect()
  .then(() => console.log('✅ Connexion à PostgreSQL réussie'))
  .catch((err) => console.error('❌ Erreur de connexion à PostgreSQL :', err));

app.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur le port ${PORT}`);
});


