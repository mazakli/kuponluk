const express = require('express');
const router = express.Router();
const { getDb } = require('../database');

function turkishSlugify(text) {
  return (text || '').toLowerCase()
    .replace(/ç/g,'c').replace(/ğ/g,'g').replace(/ı/g,'i').replace(/ö/g,'o').replace(/ş/g,'s').replace(/ü/g,'u')
    .replace(/â/g,'a').replace(/î/g,'i').replace(/û/g,'u')
    .replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,50);
}

const COUPON_SELECT = `
  SELECT cp.*, s.name as store_name, s.slug as store_slug, s.logo_url, s.website_url,
         c.name as category_name, c.slug as category_slug
  FROM coupons cp
  JOIN stores s ON cp.store_id = s.id
  LEFT JOIN categories c ON s.category_id = c.id
`;

router.get('/son-eklenenler', (req, res) => {
  const db = getDb();
  const page = parseInt(req.query.sayfa) || 1;
  const limit = 20;
  const offset = (page - 1) * limit;
  const total = db.prepare('SELECT COUNT(*) as c FROM coupons').get().c;
  const coupons = db.prepare(COUPON_SELECT + `ORDER BY cp.created_at DESC LIMIT ? OFFSET ?`).all(limit, offset);
  res.render('new-coupons', {
    title: 'Son Eklenen Kuponlar - Kuponluk.com',
    coupons, currentPage: page,
    totalPages: Math.ceil(total / limit), total,
    currentUser: req.session.user || null,
  });
});

router.get('/populer', (req, res) => {
  const db = getDb();
  const coupons = db.prepare(COUPON_SELECT + `ORDER BY cp.use_count DESC LIMIT 40`).all();
  res.render('popular-coupons', { title: 'Popüler Kuponlar - Kuponluk.com', coupons, currentUser: req.session.user || null });
});

router.get('/kupon-kodu', (req, res) => {
  const db = getDb();
  const coupons = db.prepare(COUPON_SELECT + `WHERE cp.code IS NOT NULL AND cp.code != '' ORDER BY cp.created_at DESC LIMIT 40`).all();
  res.render('coupon-type', { title: 'Kupon Kodları - Kuponluk.com', coupons, typeName: 'Kupon Kodları', typeSlug: 'kupon-kodu', typeDesc: 'Kopyalayıp kullanabileceğiniz aktif kupon kodları.', currentUser: req.session.user || null });
});

router.get('/indirim', (req, res) => {
  const db = getDb();
  const coupons = db.prepare(COUPON_SELECT + `WHERE cp.discount_type IN ('percent', 'fixed') ORDER BY cp.discount_value DESC LIMIT 40`).all();
  res.render('coupon-type', { title: 'İndirimler - Kuponluk.com', coupons, typeName: 'İndirimler', typeSlug: 'indirim', typeDesc: 'Yüzde ve sabit tutarlı indirim kampanyaları.', currentUser: req.session.user || null });
});

router.get('/hediye', (req, res) => {
  const db = getDb();
  const coupons = db.prepare(COUPON_SELECT + `WHERE cp.discount_type = 'gift' ORDER BY cp.created_at DESC LIMIT 40`).all();
  res.render('coupon-type', { title: 'Hediye Kampanyaları - Kuponluk.com', coupons, typeName: 'Hediye', typeSlug: 'hediye', typeDesc: 'Ücretsiz hediye ve ürün kazanma fırsatları.', currentUser: req.session.user || null });
});

router.get('/ucretsiz-kargo', (req, res) => {
  const db = getDb();
  const coupons = db.prepare(COUPON_SELECT + `WHERE cp.discount_type = 'free_shipping' ORDER BY cp.created_at DESC LIMIT 40`).all();
  res.render('coupon-type', { title: 'Ücretsiz Kargo - Kuponluk.com', coupons, typeName: 'Ücretsiz Kargo', typeSlug: 'ucretsiz-kargo', typeDesc: 'Kargo ücreti olmadan alışveriş yapın.', currentUser: req.session.user || null });
});

router.get('/banka-kampanyalari', (req, res) => {
  const db = getDb();
  const coupons = db.prepare(COUPON_SELECT + `WHERE cp.discount_type = 'bank' ORDER BY cp.created_at DESC LIMIT 40`).all();
  res.render('coupon-type', { title: 'Banka Kampanyaları - Kuponluk.com', coupons, typeName: 'Banka Kampanyaları', typeSlug: 'banka-kampanyalari', typeDesc: 'Kredi kartı ve banka özel indirim kampanyaları.', currentUser: req.session.user || null });
});

router.get('/:id', (req, res) => {
  const db = getDb();
  const rawId = req.params.id.split('-')[0];
  const coupon = db.prepare(`
    SELECT cp.*, s.name as store_name, s.slug as store_slug, s.logo_url,
           s.website_url, s.description as store_desc, s.id as store_id_ref,
           c.name as category_name, c.slug as category_slug
    FROM coupons cp
    JOIN stores s ON cp.store_id = s.id
    LEFT JOIN categories c ON s.category_id = c.id
    WHERE cp.id = ?
  `).get(rawId);

  if (!coupon) return res.status(404).render('404', { title: 'Sayfa Bulunamadı', currentUser: req.session.user || null });

  db.prepare('UPDATE coupons SET view_count = view_count + 1 WHERE id = ?').run(coupon.id);

  const storeCoupons = db.prepare(`
    SELECT cp.*, s.name as store_name, s.slug as store_slug, s.logo_url
    FROM coupons cp JOIN stores s ON cp.store_id = s.id
    WHERE cp.store_id = ? AND cp.id != ?
    ORDER BY cp.is_verified DESC, cp.use_count DESC LIMIT 8
  `).all(coupon.store_id, coupon.id);

  const popularCoupons = db.prepare(`
    SELECT cp.*, s.name as store_name, s.slug as store_slug, s.logo_url
    FROM coupons cp JOIN stores s ON cp.store_id = s.id
    ORDER BY cp.use_count DESC LIMIT 6
  `).all();

  const reviews = db.prepare(`
    SELECT cr.*, u.username
    FROM coupon_reviews cr
    JOIN users u ON cr.user_id = u.id
    WHERE cr.coupon_id = ?
    ORDER BY cr.created_at DESC LIMIT 20
  `).all(coupon.id);

  let isSaved = false, userRating = 0, userHasReviewed = false;
  if (req.session.user) {
    const saved = db.prepare('SELECT 1 FROM user_saved_coupons WHERE user_id = ? AND coupon_id = ?').get(req.session.user.id, coupon.id);
    isSaved = !!saved;
    const rated = db.prepare('SELECT rating FROM coupon_ratings WHERE user_id = ? AND coupon_id = ?').get(req.session.user.id, coupon.id);
    userRating = rated ? rated.rating : 0;
    const reviewed = db.prepare('SELECT 1 FROM coupon_reviews WHERE user_id = ? AND coupon_id = ?').get(req.session.user.id, coupon.id);
    userHasReviewed = !!reviewed;
  }

  res.render('coupon', {
    title: `${coupon.title} - ${coupon.store_name} Kupon - Kuponluk.com`,
    coupon, storeCoupons, popularCoupons, isSaved, userRating, reviews, userHasReviewed,
    currentUser: req.session.user || null,
  });
});

router.post('/:id/yorum', (req, res) => {
  if (!req.session.user) return res.redirect('/giris?redirect=/kupon/' + req.params.id);
  const rating = parseInt(req.body.rating);
  const comment = (req.body.comment || '').trim();
  if (!rating || rating < 1 || rating > 5 || !comment) return res.redirect('/kupon/' + req.params.id);
  const db = getDb();
  try {
    db.prepare(`INSERT INTO coupon_reviews (coupon_id, user_id, rating, comment) VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id, coupon_id) DO UPDATE SET rating = excluded.rating, comment = excluded.comment, created_at = CURRENT_TIMESTAMP`
    ).run(req.params.id, req.session.user.id, rating, comment);
  } catch (e) {}
  res.redirect('/kupon/' + req.params.id + '#yorumlar');
});

router.post('/:id/kaydet', (req, res) => {
  if (!req.session.user) return res.json({ success: false, message: 'Giriş yapmanız gerekiyor' });
  const db = getDb();
  const existing = db.prepare('SELECT 1 FROM user_saved_coupons WHERE user_id = ? AND coupon_id = ?').get(req.session.user.id, req.params.id);
  if (existing) {
    db.prepare('DELETE FROM user_saved_coupons WHERE user_id = ? AND coupon_id = ?').run(req.session.user.id, req.params.id);
    res.json({ success: true, action: 'removed' });
  } else {
    db.prepare('INSERT OR IGNORE INTO user_saved_coupons (user_id, coupon_id) VALUES (?, ?)').run(req.session.user.id, req.params.id);
    res.json({ success: true, action: 'saved' });
  }
});

router.post('/:id/puan', (req, res) => {
  if (!req.session.user) return res.json({ success: false });
  const rating = parseInt(req.body.rating);
  if (rating < 1 || rating > 5) return res.json({ success: false });
  const db = getDb();
  const existing = db.prepare('SELECT rating FROM coupon_ratings WHERE user_id = ? AND coupon_id = ?').get(req.session.user.id, req.params.id);
  if (existing) {
    const diff = rating - existing.rating;
    db.prepare('UPDATE coupon_ratings SET rating = ? WHERE user_id = ? AND coupon_id = ?').run(rating, req.session.user.id, req.params.id);
    db.prepare('UPDATE coupons SET rating_sum = rating_sum + ? WHERE id = ?').run(diff, req.params.id);
  } else {
    db.prepare('INSERT INTO coupon_ratings (user_id, coupon_id, rating) VALUES (?, ?, ?)').run(req.session.user.id, req.params.id, rating);
    db.prepare('UPDATE coupons SET rating_sum = rating_sum + ?, rating_count = rating_count + 1 WHERE id = ?').run(rating, req.params.id);
  }
  const updated = db.prepare('SELECT rating_sum, rating_count FROM coupons WHERE id = ?').get(req.params.id);
  const avg = updated.rating_count > 0 ? (updated.rating_sum / updated.rating_count).toFixed(1) : 0;
  res.json({ success: true, avg, count: updated.rating_count });
});

router.post('/:id/kullan', (req, res) => {
  const db = getDb();
  db.prepare('UPDATE coupons SET use_count = use_count + 1 WHERE id = ?').run(req.params.id);
  if (req.session.user) {
    try {
      db.prepare('INSERT INTO coupon_usages (user_id, coupon_id) VALUES (?, ?)').run(req.session.user.id, req.params.id);
    } catch(e) {}
  }
  res.json({ success: true });
});

router.post('/:id/geri-bildirim', (req, res) => {
  const db = getDb();
  const pos = req.body.positive === '1';
  if (pos) db.prepare('UPDATE coupons SET use_count = use_count + 1 WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
