const express = require('express');
const router = express.Router();
const { getDb } = require('../database');

const slugAliases = {
  'moda': 'moda-giyim', 'giyim': 'moda-giyim',
  'yemek': 'yemek-restoran', 'restoran': 'yemek-restoran',
  'kozmetik': 'kozmetik-guzellik', 'guzellik': 'kozmetik-guzellik',
  'ev': 'ev-yasam',
  'spor': 'spor-outdoor',
  'kitap': 'kitap-egitim', 'egitim': 'kitap-egitim',
  'oyun': 'oyun-eglence', 'eglence': 'oyun-eglence',
  'market': 'market-supermarket', 'supermarket': 'market-supermarket',
  'sigorta': 'sigorta-finans', 'finans': 'sigorta-finans',
  'teknoloji': 'teknoloji-yazilim', 'yazilim': 'teknoloji-yazilim',
};

router.get('/', (req, res) => {
  const db = getDb();
  const categories = db.prepare(`
    SELECT c.*,
           COUNT(DISTINCT s.id) as store_count,
           COUNT(cp.id) as coupon_count
    FROM categories c
    LEFT JOIN stores s ON s.category_id = c.id
    LEFT JOIN coupons cp ON cp.store_id = s.id
    GROUP BY c.id
    ORDER BY c.name
  `).all();
  res.render('categories', { title: 'Tüm Kategoriler - Kuponluk.com', categories, currentUser: req.session.user || null });
});

router.get('/:slug', (req, res) => {
  const { slug } = req.params;
  if (slugAliases[slug]) return res.redirect(301, `/kategori/${slugAliases[slug]}`);

  const db = getDb();
  const category = db.prepare('SELECT * FROM categories WHERE slug = ?').get(slug);
  if (!category) return res.status(404).render('404', { title: 'Sayfa Bulunamadı', currentUser: req.session.user || null });

  const stores = db.prepare(`
    SELECT s.*, COUNT(cp.id) as active_coupons
    FROM stores s
    LEFT JOIN coupons cp ON cp.store_id = s.id
    WHERE s.category_id = ?
    GROUP BY s.id
    ORDER BY s.is_featured DESC, s.name
  `).all(category.id);

  const coupons = db.prepare(`
    SELECT cp.*, s.name as store_name, s.slug as store_slug, s.logo_url
    FROM coupons cp
    JOIN stores s ON cp.store_id = s.id
    WHERE s.category_id = ?
    ORDER BY cp.is_verified DESC, cp.use_count DESC
    LIMIT 20
  `).all(category.id);

  res.render('category', {
    title: `${category.name} Kuponları ve İndirimleri - Kuponluk.com`,
    category, stores, coupons,
    currentUser: req.session.user || null,
  });
});

module.exports = router;
