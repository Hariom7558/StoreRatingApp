import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { body, param } from 'express-validator';
import pool from '../db.js';
import { allowRoles, asyncHandler, authenticate, validate, validateUserFields } from '../middleware.js';

const router = Router();
router.use(authenticate, allowRoles('admin'));

router.get('/stats', asyncHandler(async (req, res) => {
  const [[users]] = await pool.query('SELECT COUNT(*) AS total FROM users');
  const [[stores]] = await pool.query('SELECT COUNT(*) AS total FROM stores');
  const [[ratings]] = await pool.query('SELECT COUNT(*) AS total FROM ratings');
  res.json({ users: users.total, stores: stores.total, ratings: ratings.total });
}));

router.get('/stores', asyncHandler(async (req, res) => {
  const search = typeof req.query.search === 'string' ? `%${req.query.search.trim()}%` : '%%';
  const columns = { name: 's.name', email: 's.email', address: 's.address', averageRating: 'averageRating' };
  const sort = columns[req.query.sort] || columns.name;
  const direction = req.query.direction === 'desc' ? 'DESC' : 'ASC';
  const [stores] = await pool.execute(
    `SELECT s.id, s.name, s.email, s.address, s.owner_id AS ownerId, u.name AS ownerName,
      ROUND(AVG(r.rating), 2) AS averageRating
     FROM stores s LEFT JOIN ratings r ON r.store_id = s.id
     LEFT JOIN users u ON u.id = s.owner_id
     WHERE s.name LIKE ? OR s.email LIKE ? OR s.address LIKE ?
     GROUP BY s.id
     ORDER BY ${sort} ${direction}, s.id ASC`,
    [search, search, search]
  );
  res.json({ stores });
}));

router.post('/stores', [
  body('name').trim().isLength({ min: 1, max: 60 }).withMessage('Store name must be 1 to 60 characters.'),
  body('email').trim().isEmail().withMessage('Enter a valid store email.').normalizeEmail(),
  body('address').trim().isLength({ max: 400 }).withMessage('Address must be at most 400 characters.'),
  body('ownerId').optional({ nullable: true, checkFalsy: true }).isInt({ min: 1 }).withMessage('Choose a valid store owner.'),
  validate
], asyncHandler(async (req, res) => {
  const { name, email, address, ownerId } = req.body;
  if (ownerId) {
    const [owners] = await pool.execute('SELECT id FROM users WHERE id = ? AND role = ?', [ownerId, 'store_owner']);
    if (!owners.length) return res.status(400).json({ message: 'The selected account is not a store owner.' });
    const [assigned] = await pool.execute('SELECT id FROM stores WHERE owner_id = ?', [ownerId]);
    if (assigned.length) return res.status(409).json({ message: 'This owner is already assigned to a store.' });
  }
  const [result] = await pool.execute(
    'INSERT INTO stores (name, email, address, owner_id) VALUES (?, ?, ?, ?)',
    [name, email, address, ownerId || null]
  );
  res.status(201).json({ message: 'Store created successfully.', id: result.insertId });
}));

router.get('/users', asyncHandler(async (req, res) => {
  const search = typeof req.query.search === 'string' ? `%${req.query.search.trim()}%` : '%%';
  const role = ['admin', 'user', 'store_owner'].includes(req.query.role) ? req.query.role : null;
  const columns = { name: 'u.name', email: 'u.email', address: 'u.address', role: 'u.role' };
  const sort = columns[req.query.sort] || columns.name;
  const direction = req.query.direction === 'desc' ? 'DESC' : 'ASC';
  const [users] = await pool.execute(
    `SELECT u.id, u.name, u.email, u.address, u.role,
      ROUND(AVG(r.rating), 2) AS averageRating
     FROM users u LEFT JOIN stores s ON s.owner_id = u.id
     LEFT JOIN ratings r ON r.store_id = s.id
     WHERE (u.name LIKE ? OR u.email LIKE ? OR u.address LIKE ?)
       AND (? IS NULL OR u.role = ?)
     GROUP BY u.id
     ORDER BY ${sort} ${direction}, u.id ASC`,
    [search, search, search, role, role]
  );
  res.json({ users });
}));

router.post('/users', [
  ...validateUserFields,
  body('role').isIn(['admin', 'user', 'store_owner']).withMessage('Choose a valid account role.'),
  validate
], asyncHandler(async (req, res) => {
  const { name, email, address, password, role } = req.body;
  const [existing] = await pool.execute('SELECT id FROM users WHERE email = ?', [email]);
  if (existing.length) return res.status(409).json({ message: 'An account with this email already exists.' });
  const passwordHash = await bcrypt.hash(password, 12);
  const [result] = await pool.execute(
    'INSERT INTO users (name, email, address, password_hash, role) VALUES (?, ?, ?, ?, ?)',
    [name, email, address, passwordHash, role]
  );
  res.status(201).json({ message: 'User created successfully.', id: result.insertId });
}));

router.get('/users/:userId', param('userId').isInt({ min: 1 }).withMessage('Invalid user.'), validate, asyncHandler(async (req, res) => {
  const [users] = await pool.execute(
    `SELECT u.id, u.name, u.email, u.address, u.role, ROUND(AVG(r.rating), 2) AS averageRating
     FROM users u LEFT JOIN stores s ON s.owner_id = u.id
     LEFT JOIN ratings r ON r.store_id = s.id
     WHERE u.id = ? GROUP BY u.id`,
    [req.params.userId]
  );
  if (!users.length) return res.status(404).json({ message: 'User not found.' });
  res.json({ user: users[0] });
}));

export default router;
