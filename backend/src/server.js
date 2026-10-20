import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import pool from './db.js';
import authRoutes from './routes/auth.js';
import storeRoutes from './routes/stores.js';
import adminRoutes from './routes/admin.js';
import ownerRoutes from './routes/owner.js';

const app = express();
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
app.use(express.json({ limit: '32kb' }));
app.get('/api/health', async (req, res, next) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  } catch (error) {
    next(error);
  }
});
app.use('/api/auth', authRoutes);
app.use('/api/stores', storeRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/owner', ownerRoutes);
app.use((req, res) => res.status(404).json({ message: 'The requested endpoint was not found.' }));
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  console.error('API error:', error.code || error.message);
  if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'A record with those details already exists.' });
  if (error.code === 'ER_NO_REFERENCED_ROW_2') return res.status(400).json({ message: 'The selected related record does not exist.' });
  res.status(500).json({ message: 'An unexpected server error occurred.' });
});

const port = Number(process.env.PORT || 5000);
app.listen(port, () => console.log(`Store Rating API listening on http://localhost:${port}`));
