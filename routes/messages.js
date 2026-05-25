const express = require('express');
const router = express.Router();
const { getDb } = require('../database');
const { requireAuth } = require('../middleware/auth');

function ensureTables(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user1_id INTEGER NOT NULL,
      user2_id INTEGER NOT NULL,
      listing_id INTEGER,
      last_message_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER NOT NULL,
      sender_id INTEGER NOT NULL,
      body TEXT NOT NULL,
      is_read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

// Inbox
router.get('/', requireAuth, (req, res) => {
  const db = getDb();
  ensureTables(db);
  const uid = req.session.user.id;
  const convs = db.prepare(`
    SELECT c.*,
      u1.username as user1_name,
      u2.username as user2_name,
      lm.body as last_body,
      lm.created_at as last_at,
      lm.sender_id as last_sender_id,
      (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id AND sender_id != ? AND is_read = 0) as unread
    FROM conversations c
    JOIN users u1 ON c.user1_id = u1.id
    JOIN users u2 ON c.user2_id = u2.id
    LEFT JOIN messages lm ON lm.id = (
      SELECT id FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1
    )
    WHERE c.user1_id = ? OR c.user2_id = ?
    ORDER BY COALESCE(lm.created_at, c.created_at) DESC
  `).all(uid, uid, uid);
  res.render('mesajlar', { title: 'Mesajlar - Kuponluk.com', convs, uid });
});

// Conversation detail
router.get('/:id', requireAuth, (req, res) => {
  const db = getDb();
  ensureTables(db);
  const uid = req.session.user.id;
  const cid = parseInt(req.params.id);
  if (isNaN(cid)) return res.status(404).render('404', { title: '404 - Kuponluk.com' });

  const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(cid);
  if (!conv || (conv.user1_id !== uid && conv.user2_id !== uid)) {
    return res.status(403).render('404', { title: '403 - Kuponluk.com' });
  }

  db.prepare('UPDATE messages SET is_read = 1 WHERE conversation_id = ? AND sender_id != ?').run(cid, uid);

  const otherId = conv.user1_id === uid ? conv.user2_id : conv.user1_id;
  const otherUser = db.prepare('SELECT id, username FROM users WHERE id = ?').get(otherId);
  const msgs = db.prepare(`
    SELECT m.*, u.username as sender_name
    FROM messages m JOIN users u ON m.sender_id = u.id
    WHERE m.conversation_id = ? ORDER BY m.created_at ASC
  `).all(cid);

  let listing = null;
  if (conv.listing_id) {
    try { listing = db.prepare('SELECT id, title, store_name FROM listings WHERE id = ?').get(conv.listing_id); } catch(e) {}
  }

  res.render('mesaj-detay', {
    title: (otherUser ? otherUser.username : 'Mesaj') + ' - Kuponluk.com',
    conv, msgs, otherUser, listing, uid
  });
});

// Start new conversation
router.post('/yeni', requireAuth, (req, res) => {
  const db = getDb();
  ensureTables(db);
  const uid = req.session.user.id;
  const toId = parseInt(req.body.to_user_id);
  const body = (req.body.body || '').trim().substring(0, 2000);
  const listIdRaw = req.body.listing_id ? parseInt(req.body.listing_id) : null;
  const listId = (listIdRaw && !isNaN(listIdRaw)) ? listIdRaw : null;

  if (isNaN(toId) || toId === uid || !body) return res.redirect('back');
  if (!db.prepare('SELECT id FROM users WHERE id = ?').get(toId)) return res.redirect('back');

  let conv;
  if (listId) {
    conv = db.prepare('SELECT * FROM conversations WHERE ((user1_id=? AND user2_id=?) OR (user1_id=? AND user2_id=?)) AND listing_id=?').get(uid, toId, toId, uid, listId);
  } else {
    conv = db.prepare('SELECT * FROM conversations WHERE ((user1_id=? AND user2_id=?) OR (user1_id=? AND user2_id=?)) AND listing_id IS NULL').get(uid, toId, toId, uid);
  }

  if (!conv) {
    const r = db.prepare('INSERT INTO conversations (user1_id, user2_id, listing_id) VALUES (?, ?, ?)').run(uid, toId, listId);
    conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(r.lastInsertRowid);
  }

  db.prepare('INSERT INTO messages (conversation_id, sender_id, body) VALUES (?, ?, ?)').run(conv.id, uid, body);
  db.prepare('UPDATE conversations SET last_message_at = CURRENT_TIMESTAMP WHERE id = ?').run(conv.id);
  res.redirect('/mesajlar/' + conv.id);
});

// Send message in existing conversation
router.post('/:id/gonder', requireAuth, (req, res) => {
  const db = getDb();
  ensureTables(db);
  const uid = req.session.user.id;
  const cid = parseInt(req.params.id);
  if (isNaN(cid)) return res.redirect('/mesajlar');

  const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(cid);
  if (!conv || (conv.user1_id !== uid && conv.user2_id !== uid)) return res.redirect('/mesajlar');

  const body = (req.body.body || '').trim().substring(0, 2000);
  if (!body) return res.redirect('/mesajlar/' + cid);

  db.prepare('INSERT INTO messages (conversation_id, sender_id, body) VALUES (?, ?, ?)').run(cid, uid, body);
  db.prepare('UPDATE conversations SET last_message_at = CURRENT_TIMESTAMP WHERE id = ?').run(conv.id);
  res.redirect('/mesajlar/' + cid);
});

module.exports = router;
