import { Router } from 'express';
import { body, param } from 'express-validator';
import pool from '../db.js';
import { allowRoles, asyncHandler, authenticate, validate } from '../middleware.js';

const router = Router();
router.use(authenticate, allowRoles('user'));

router.get('/', asyncHandler(async (req, res) => {
  const search = typeof req.query.search === 'string' ? `%${req.query.search.trim()}%` : '%%';
  const [stores] = await pool.execute(
    `SELECT s.id, s.name, s.address, s.email,
      ROUND(AVG(r.rating), 2) AS averageRating,
      MAX(CASE WHEN r.user_id = ? THEN r.rating END) AS userRating
     FROM stores s LEFT JOIN ratings r ON r.store_id = s.id
     WHERE s.name LIKE ? OR s.address LIKE ?
     GROUP BY s.id
     ORDER BY s.name ASC`,
    [req.user.id, search, search]
  );
  res.json({ stores });
}));

router.put('/:storeId/rating',
  param('storeId').isInt({ min: 1 }).withMessage('Invalid store.'),
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be an integer from 1 to 5.'),
  validate,
  asyncHandler(async (req, res) => {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [store] = await connection.execute('SELECT id FROM stores WHERE id = ? FOR UPDATE', [req.params.storeId]);
      if (!store.length) {
        await connection.rollback();
        return res.status(404).json({ message: 'Store not found.' });
      }
      await connection.execute(
        `INSERT INTO ratings (user_id, store_id, rating) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE rating = VALUES(rating)`,
        [req.user.id, req.params.storeId, Number(req.body.rating)]
      );
      await connection.commit();
      res.json({ message: 'Your rating has been saved.' });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  })
);

export default router;
