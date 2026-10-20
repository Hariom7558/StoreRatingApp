import { Router } from 'express';
import pool from '../db.js';
import { allowRoles, asyncHandler, authenticate } from '../middleware.js';

const router = Router();
router.use(authenticate, allowRoles('store_owner'));

router.get('/dashboard', asyncHandler(async (req, res) => {
  const [stores] = await pool.execute('SELECT id, name, address FROM stores WHERE owner_id = ?', [req.user.id]);
  if (!stores.length) return res.json({ store: null, averageRating: null, ratings: [] });
  const store = stores[0];
  const [ratings] = await pool.execute(
    `SELECT u.id AS userId, u.name, u.email, r.rating, r.created_at AS submittedAt
     FROM ratings r JOIN users u ON u.id = r.user_id
     WHERE r.store_id = ? ORDER BY r.created_at DESC`,
    [store.id]
  );
  const [[average]] = await pool.execute('SELECT ROUND(AVG(rating), 2) AS averageRating FROM ratings WHERE store_id = ?', [store.id]);
  res.json({ store, averageRating: average.averageRating, ratings });
}));

export default router;
