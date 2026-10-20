import jwt from 'jsonwebtoken';
import { validationResult } from 'express-validator';
import 'dotenv/config';

export function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

export function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      message: 'Please correct the highlighted fields.',
      errors: errors.array().map(({ path, msg }) => ({ field: path, message: msg }))
    });
  }
  next();
}

export function authenticate(req, res, next) {
  const [scheme, token] = (req.headers.authorization || '').split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ message: 'Please sign in to continue.' });
  }
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ message: 'Your session has expired. Please sign in again.' });
  }
}

export function allowRoles(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'You do not have permission to access this resource.' });
    }
    next();
  };
}

export const userValidators = [
  (req, res, next) => {
    if (typeof req.body.name === 'string') req.body.name = req.body.name.trim();
    if (typeof req.body.email === 'string') req.body.email = req.body.email.trim().toLowerCase();
    if (typeof req.body.address === 'string') req.body.address = req.body.address.trim();
    next();
  }
];

export const validateUserFields = [
  ...userValidators,
  (req, res, next) => {
    const { name, email, address, password } = req.body;
    const errors = [];
    if (typeof name !== 'string' || name.length < 20 || name.length > 60) errors.push({ path: 'name', msg: 'Name must be 20 to 60 characters.' });
    if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) errors.push({ path: 'email', msg: 'Enter a valid email address.' });
    if (typeof address !== 'string' || address.length > 400) errors.push({ path: 'address', msg: 'Address must be at most 400 characters.' });
    if (typeof password !== 'string' || password.length < 8 || password.length > 16 || !/[A-Z]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
      errors.push({ path: 'password', msg: 'Password must be 8 to 16 characters with an uppercase letter and a special character.' });
    }
    if (errors.length) return res.status(400).json({ message: 'Please correct the highlighted fields.', errors: errors.map(({ path, msg }) => ({ field: path, message: msg })) });
    next();
  }
];
