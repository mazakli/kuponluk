const express = require('express');
const router = express.Router();
const { getDb } = require('../database');

router.get('/', (req, res) => {
  const db = getDb();

  const sliders = db.prepare(`
    SELECT sl.*, s.slug as store_slug, s.logo_url as store_logo, s.name as store_name_real
    FROM sliders sl
    LEFT JOIN stores s ON s.slug = REPLACE(REPLACE(sl.link_url, '/magaza/', ''), '/', '')
    WHERE sl.active = 1
    ORDER BY sl.order_index ASC
  `).all();

  const popularBrands = db.prepare(`
    SELECT s.*, SUM(cp.use_count) as total_uses, COUNT(cp.id) as active_coupons
    FROM stores s
    LEFT JOIN coupons cp ON cp.store_id = s.id
    GROUP BY s.id
    ORDER BY total_uses DESC
    LIMIT 12
  `).all();

  const newBrands = db.prepare(`
    SELECT s.*, MAX(cp.created_at) as latest_coupon, COUNT(cp.id) as active_coupons
    FROM stores s
    LEFT JOIN coupons cp ON cp.store_id = s.id
    GROUP BY s.id
    ORDER BY latest_coupon DESC
    LIMIT 12
  `).all();

  const expiringBrands = db.prepare(`
    SELECT s.*, MIN(cp.expiry_date) as earliest_expiry, COUNT(cp.id) as active_coupons
    FROM stores s
    JOIN coupons cp ON cp.store_id = s.id
    WHERE cp.expiry_date IS NOT NULL
      AND cp.expiry_date >= date('now')
      AND cp.expiry_date <= date('now', '+14 days')
    GROUP BY s.id
    ORDER BY earliest_expiry ASC
    LIMIT 12
  `).all();

  let featuredListings = [];
  try {
    featuredListings = db.prepare(`
      SELECT l.*, u.username as seller_name
      FROM listings l
      LEFT JOIN users u ON l.user_id = u.id
      WHERE l.status = 'approved'
      ORDER BY l.created_at DESC
      LIMIT 6
    `).all();
  } catch(e) {}

  const stats = {
    totalCoupons: db.prepare('SELECT COUNT(*) as c FROM coupons').get().c,
    totalStores: db.prepare('SELECT COUNT(*) as c FROM stores').get().c,
    totalUsers: db.prepare('SELECT COUNT(*) as c FROM users').get().c,
    totalCategories: db.prepare('SELECT COUNT(*) as c FROM categories').get().c,
  };

  res.render('index', {
    title: "Kuponluk.com - Türkiye'nin Kupon Merkezi",
    sliders,
    popularBrands,
    newBrands,
    expiringBrands,
    featuredListings,
    stats,
  });
});

router.get('/arama', (req, res) => {
  const db = getDb();
  const q = (req.query.q || '').trim();
  const type = req.query.type || 'all';
  let coupons = [], stores = [];

  if (q.length > 0) {
    if (type === 'all' || type === 'coupon') {
      coupons = db.prepare(`
        SELECT cp.*, s.name as store_name, s.slug as store_slug, s.logo_url
        FROM coupons cp
        JOIN stores s ON cp.store_id = s.id
        WHERE cp.title LIKE ? OR cp.code LIKE ? OR cp.description LIKE ?
        ORDER BY cp.use_count DESC LIMIT 20
      `).all(`%${q}%`, `%${q}%`, `%${q}%`);
    }
    if (type === 'all' || type === 'store') {
      stores = db.prepare(`
        SELECT s.*, c.name as category_name
        FROM stores s
        LEFT JOIN categories c ON s.category_id = c.id
        WHERE s.name LIKE ? OR s.description LIKE ?
        ORDER BY s.coupon_count DESC LIMIT 10
      `).all(`%${q}%`, `%${q}%`);
    }
  }

  res.render('search', {
    title: q ? `"${q}" için Arama Sonuçları - Kuponluk.com` : 'Arama - Kuponluk.com',
    q, type, coupons, stores,
  });
});

module.exports = router;
