const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const SELECT = `
  SELECT p.id, p.title, p.content, p.author_id, u.username AS author,
         p.created_at, p.updated_at,
         (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS comment_count
  FROM posts p JOIN users u ON u.id = p.author_id`;

// List posts (search + pagination)
router.get('/', (req, res) => {
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 50);
  const q = (req.query.q || '').trim();
  const where = q ? 'WHERE p.title LIKE @q OR p.content LIKE @q' : '';
  const offset = (page - 1) * limit;

  const posts = q
    ? db.prepare(`${SELECT} ${where} ORDER BY p.created_at DESC, p.id DESC LIMIT @limit OFFSET @offset`).all({ q: `%${q}%`, limit, offset })
    : db.prepare(`${SELECT} ORDER BY p.created_at DESC, p.id DESC LIMIT @limit OFFSET @offset`).all({ limit, offset });
  const total = q
    ? db.prepare(`SELECT COUNT(*) AS n FROM posts p ${where}`).get({ q: `%${q}%` }).n
    : db.prepare('SELECT COUNT(*) AS n FROM posts').get().n;
  res.json({ posts, page, pages: Math.max(Math.ceil(total / limit), 1), total });
});

router.get('/:id', (req, res) => {
  const post = db.prepare(`${SELECT} WHERE p.id = ?`).get(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  res.json(post);
});

router.post('/', requireAuth, (req, res) => {
  const { title, content } = req.body || {};
  if (!title || !title.trim()) return res.status(400).json({ error: 'Title is required' });
  if (!content || !content.trim()) return res.status(400).json({ error: 'Content is required' });
  const info = db.prepare('INSERT INTO posts (title, content, author_id) VALUES (?, ?, ?)')
    .run(title.trim(), content.trim(), req.user.id);
  res.status(201).json(db.prepare(`${SELECT} WHERE p.id = ?`).get(info.lastInsertRowid));
});

router.put('/:id', requireAuth, (req, res) => {
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  if (post.author_id !== req.user.id) return res.status(403).json({ error: 'You can only edit your own posts' });
  const { title, content } = req.body || {};
  if (!title || !title.trim() || !content || !content.trim())
    return res.status(400).json({ error: 'Title and content are required' });
  db.prepare('UPDATE posts SET title = ?, content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(title.trim(), content.trim(), post.id);
  res.json(db.prepare(`${SELECT} WHERE p.id = ?`).get(post.id));
});

router.delete('/:id', requireAuth, (req, res) => {
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  if (post.author_id !== req.user.id) return res.status(403).json({ error: 'You can only delete your own posts' });
  db.prepare('DELETE FROM posts WHERE id = ?').run(post.id);
  res.json({ message: 'Post deleted' });
});

// Comments nested under a post
router.get('/:id/comments', (req, res) => {
  const post = db.prepare('SELECT id FROM posts WHERE id = ?').get(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  const comments = db.prepare(`
    SELECT c.id, c.post_id, c.user_id, u.username AS author, c.content, c.created_at
    FROM comments c JOIN users u ON u.id = c.user_id
    WHERE c.post_id = ? ORDER BY c.created_at ASC, c.id ASC`).all(post.id);
  res.json(comments);
});

router.post('/:id/comments', requireAuth, (req, res) => {
  const post = db.prepare('SELECT id FROM posts WHERE id = ?').get(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  const { content } = req.body || {};
  if (!content || !content.trim()) return res.status(400).json({ error: 'Comment cannot be empty' });
  const info = db.prepare('INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?)')
    .run(post.id, req.user.id, content.trim());
  const row = db.prepare(`
    SELECT c.id, c.post_id, c.user_id, u.username AS author, c.content, c.created_at
    FROM comments c JOIN users u ON u.id = c.user_id WHERE c.id = ?`).get(info.lastInsertRowid);
  res.status(201).json(row);
});

module.exports = router;
