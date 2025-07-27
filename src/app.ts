import dotenv from 'dotenv';
dotenv.config();
import cors from 'cors';
import express from 'express';
import authRoutes from './routes/auth';
import materialRoutes from './routes/material';

import { pool, testConnection } from './config/db';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/materials', materialRoutes);

// Test database connection on startup
testConnection();

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

export { pool };