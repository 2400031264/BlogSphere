const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { sign, requireAuth } = require('../middleware/auth');

const router = express.Router();
const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post('/register', (req, res) => {
  const { username, email, password } = req.body || {};
  if (!username || username.trim().length < 3)
    return res.status(400).json({ error: 'Username must be at least 3 characters' });
  if (!email || !emailRe.test(email)) return res.status(400).json({ error: 'Valid email required' });
  if (!password || password.length < 6)
    return res.status(400).json({ error: 'Password must be at least 6 characters' });

  const exists = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?')
    .get(username.trim(), email.toLowerCase());
  if (exists) return res.status(409).json({ error: 'Username or email already in use' });

  const hash = bcrypt.hashSync(password, 10);
  const info = db.prepare('INSERT INTO users (username, email, password) VALUES (?, ?, ?)')
    .run(username.trim(), email.toLowerCase(), hash);
  const user = { id: Number(info.lastInsertRowid), username: username.trim() };
  res.status(201).json({ token: sign(user), user });
});

router.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
  if (!row || !bcrypt.compareSync(password, row.password))
    return res.status(401).json({ error: 'Invalid email or password' });
  const user = { id: row.id, username: row.username };
  res.json({ token: sign(user), user });
});

router.get('/me', requireAuth, (req, res) => {
  const row = db.prepare('SELECT id, username, email, created_at FROM users WHERE id = ?').get(req.user.id);
  if (!row) return res.status(404).json({ error: 'User not found' });
  res.json(row);
});

module.exports = router;
