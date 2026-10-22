const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Comment author or the post's author can delete a comment
router.delete('/:id', requireAuth, (req, res) => {
  const row = db.prepare(`
    SELECT c.id, c.user_id, p.author_id FROM comments c
    JOIN posts p ON p.id = c.post_id WHERE c.id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Comment not found' });
  if (row.user_id !== req.user.id && row.author_id !== req.user.id)
    return res.status(403).json({ error: 'Not allowed to delete this comment' });
  db.prepare('DELETE FROM comments WHERE id = ?').run(row.id);
  res.json({ message: 'Comment deleted' });
});

module.exports = router;
