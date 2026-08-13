import { Router } from 'express';
import crypto from 'node:crypto';

export const authRouter = Router();

// Single hardcoded reviewer, per the challenge scope. Tokens are random,
// held in memory only (lost on server restart), and just used to gate the
// review endpoints below - this is demo-grade auth, not production auth.
// See README "Data Protection Trade-offs" for what real auth would need.
const REVIEWER = { username: 'reviewer', password: 'reviewer123', name: 'Jordan Reviewer' };
const activeTokens = new Set();

export function requireReviewer(req, res, next) {
  const authHeader = req.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token || !activeTokens.has(token)) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  req.reviewer = REVIEWER.name;
  next();
}

authRouter.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  if (username !== REVIEWER.username || password !== REVIEWER.password) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = crypto.randomBytes(24).toString('hex');
  activeTokens.add(token);
  res.json({ token, name: REVIEWER.name });
});

authRouter.post('/logout', (req, res) => {
  const authHeader = req.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  activeTokens.delete(token);
  res.status(204).end();
});
