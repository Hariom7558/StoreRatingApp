import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../db.js';
import { asyncHandler, authenticate, validateUserFields } from '../middleware.js';

const router = Router();

router.post('/register', validateUserFields, asyncHandler(async (req, res) => {
  const { name, email, address, password } = req.body;
  const [existing] = await pool.execute('SELECT id FROM users WHERE email = ?', [email]);
  if (existing.length) return res.status(409).json({ message: 'An account with this email already exists.' });
  const passwordHash = await bcrypt.hash(password, 12);
  const [result] = await pool.execute(
    'INSERT INTO users (name, email, address, password_hash, role) VALUES (?, ?, ?, ?, ?)',
    [name, email, address, passwordHash, 'user']
  );
  res.status(201).json({ message: 'Your account is ready. You can now sign in.', userId: result.insertId });
}));

router.post('/login', asyncHandler(async (req, res) => {
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = req.body.password;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || typeof password !== 'string' || !password.length) {
    return res.status(400).json({ message: 'Enter a valid email and password.' });
  }
  const [rows] = await pool.execute('SELECT id, name, email, address, role, password_hash FROM users WHERE email = ?', [email]);
  const account = rows[0];
  if (!account || !(await bcrypt.compare(password, account.password_hash))) {
    return res.status(401).json({ message: 'Email or password is incorrect.' });
  }
  const user = { id: account.id, name: account.name, email: account.email, address: account.address, role: account.role };
  const token = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '8h' });
  res.json({ token, user });
}));

router.get('/me', authenticate, asyncHandler(async (req, res) => {
  const [rows] = await pool.execute(
    'SELECT id, name, email, address, role FROM users WHERE id = ?',
    [req.user.id]
  );
  if (!rows.length) return res.status(401).json({ message: 'This account is no longer available.' });
  res.json({ user: rows[0] });
}));

router.put('/password', authenticate, asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (typeof currentPassword !== 'string' || !currentPassword.length) {
    return res.status(400).json({ message: 'Enter your current password.' });
  }
  if (typeof newPassword !== 'string' || newPassword.length < 8 || newPassword.length > 16 || !/[A-Z]/.test(newPassword) || !/[^A-Za-z0-9]/.test(newPassword)) {
    return res.status(400).json({ message: 'New password must be 8 to 16 characters with an uppercase letter and a special character.' });
  }
  const [rows] = await pool.execute('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
  if (!rows.length || !(await bcrypt.compare(currentPassword, rows[0].password_hash))) {
    return res.status(400).json({ message: 'Current password is incorrect.' });
  }
  const passwordHash = await bcrypt.hash(newPassword, 12);
  await pool.execute('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, req.user.id]);
  res.json({ message: 'Password updated successfully.' });
}));

export default router;
