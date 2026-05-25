function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.redirect('/giris?redirect=' + encodeURIComponent(req.originalUrl));
  }
  next();
}

function loadUser(req, res, next) {
  res.locals.currentUser = req.session.user || null;
  res.locals.unreadMessages = 0;
  try {
    const { getDb } = require('../database');
    const db = getDb();
    res.locals.navCategories = db.prepare('SELECT name, slug FROM categories ORDER BY name ASC').all();
    if (req.session.user) {
      try {
        const row = db.prepare(`
          SELECT COUNT(*) as c FROM messages m
          JOIN conversations cv ON m.conversation_id = cv.id
          WHERE (cv.user1_id = ? OR cv.user2_id = ?)
            AND m.sender_id != ?
            AND m.is_read = 0
        `).get(req.session.user.id, req.session.user.id, req.session.user.id);
        res.locals.unreadMessages = row ? row.c : 0;
      } catch(e) {}
    }
  } catch (e) {
    res.locals.navCategories = [];
  }
  next();
}

module.exports = { requireAuth, loadUser };
