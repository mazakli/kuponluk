const express = require('express');
const router = express.Router();
const { getDb } = require('../database');

router.get('/', (req, res) => {
  const db = getDb();
  const letter = req.query.harf || '';
  const catSlug = req.query.kategori || '';

  let query = `
    SELECT s.*, c.name as category_name, c.icon as category_icon,
           COUNT(cp.id) as active_coupons
    FROM stores s
    LEFT JOIN categories c ON s.category_id = c.id
    LEFT JOIN coupons cp ON cp.store_id = s.id
  `;
  const params = [];
  const conditions = [];

  if (letter) {
    conditions.push(`s.name LIKE ?`);
    params.push(letter + '%');
  }
  if (catSlug) {
    conditions.push(`c.slug = ?`);
    params.push(catSlug);
  }

  if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
  query += ' GROUP BY s.id ORDER BY s.name';

  const stores = db.prepare(query).all(...params);
  const categories = db.prepare('SELECT * FROM categories ORDER BY name').all();
  const alphabet = 'ABCÇDEFGĞHIİJKLMNOÖPRSŞTUÜVYZ'.split('');

  res.render('stores', {
    title: 'Tüm Mağazalar - Kuponluk.com',
    stores, categories, alphabet, letter, catSlug,
  });
});

router.get('/:slug', (req, res) => {
  const db = getDb();
  const store = db.prepare(`
    SELECT s.*, c.name as category_name, c.icon as category_icon, c.slug as category_slug
    FROM stores s
    LEFT JOIN categories c ON s.category_id = c.id
    WHERE s.slug = ?
  `).get(req.params.slug);

  if (!store) return res.status(404).render('404', { title: 'Sayfa Bulunamadı' });

  const coupons = db.prepare(`
    SELECT * FROM coupons WHERE store_id = ? ORDER BY is_verified DESC, use_count DESC
  `).all(store.id);

  const storeStats = db.prepare(`
    SELECT
      COALESCE(SUM(cp.use_count), 0) as total_uses,
      COALESCE(SUM(cp.rating_sum), 0) as total_rating_sum,
      COALESCE(SUM(cp.rating_count), 0) as total_rating_count,
      COUNT(cp.id) as total_coupons
    FROM coupons cp
    WHERE cp.store_id = ?
  `).get(store.id);

  const avgRating = storeStats.total_rating_count > 0
    ? Math.round((storeStats.total_rating_sum / storeStats.total_rating_count) * 10) / 10
    : 0;

  const relatedStores = db.prepare(`
    SELECT s.*, COUNT(cp.id) as active_coupons
    FROM stores s
    LEFT JOIN coupons cp ON cp.store_id = s.id
    WHERE s.category_id = ? AND s.id != ?
    GROUP BY s.id
    ORDER BY RANDOM()
    LIMIT 6
  `).all(store.category_id, store.id);

  let isFavorite = false;
  if (req.session.user) {
    const fav = db.prepare('SELECT 1 FROM user_favorites WHERE user_id = ? AND store_id = ?').get(req.session.user.id, store.id);
    isFavorite = !!fav;
  }

  res.render('store', {
    title: `${store.name} İndirim Kodu ve Kuponları - Kuponluk.com`,
    store, coupons, relatedStores, isFavorite,
    totalUses: storeStats.total_uses,
    totalCoupons: storeStats.total_coupons,
    avgRating,
  });
});

router.post('/:slug/favori', (req, res) => {
  if (!req.session.user) return res.json({ success: false, message: 'Giriş yapmanız gerekiyor' });

  const db = getDb();
  const store = db.prepare('SELECT id FROM stores WHERE slug = ?').get(req.params.slug);
  if (!store) return res.json({ success: false });

  const existing = db.prepare('SELECT 1 FROM user_favorites WHERE user_id = ? AND store_id = ?').get(req.session.user.id, store.id);

  if (existing) {
    db.prepare('DELETE FROM user_favorites WHERE user_id = ? AND store_id = ?').run(req.session.user.id, store.id);
    res.json({ success: true, action: 'removed' });
  } else {
    db.prepare('INSERT OR IGNORE INTO user_favorites (user_id, store_id) VALUES (?, ?)').run(req.session.user.id, store.id);
    res.json({ success: true, action: 'added' });
  }
});

module.exports = router;
