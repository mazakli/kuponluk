const express = require('express');
const router = express.Router();
const { getDb } = require('../database');

function ensureListingsTable(db) {
  db.prepare(`CREATE TABLE IF NOT EXISTS listings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    title TEXT NOT NULL,
    coupon_code TEXT,
    store_name TEXT NOT NULL,
    category TEXT,
    price REAL,
    is_free INTEGER DEFAULT 0,
    description TEXT,
    expires_at TEXT,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`).run();
}

router.get('/kupon-gonder', (req, res) => {
  const db = getDb();
  const stores = db.prepare('SELECT id, name FROM stores ORDER BY name').all();
  res.render('submit', { title: 'Kupon Gönder - Kuponluk.com', stores, success: false, error: null });
});

router.post('/kupon-gonder', (req, res) => {
  const db = getDb();
  const { store_name, coupon_code, description, discount_value, expiry_date, submitter_name, submitter_email } = req.body;
  const stores = db.prepare('SELECT id, name FROM stores ORDER BY name').all();
  if (!store_name || !description) {
    return res.render('submit', { title: 'Kupon Gönder - Kuponluk.com', stores, success: false, error: 'Mağaza adı ve açıklama alanları zorunludur.' });
  }
  db.prepare(`INSERT INTO coupon_submissions (store_name, coupon_code, description, discount_value, expiry_date, submitter_name, submitter_email) VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(store_name, coupon_code || null, description, discount_value || null, expiry_date || null, submitter_name || null, submitter_email || null);
  res.render('submit', { title: 'Kupon Gönder - Kuponluk.com', stores, success: true, error: null });
});

router.get('/telegram', (req, res) => res.render('telegram', { title: 'Telegram Kanalımız - Kuponluk.com' }));
router.get('/hakkimizda', (req, res) => res.render('about', { title: 'Hakkımızda - Kuponluk.com', description: 'Kuponluk.com hakkında bilgi alın. Misyonumuz, ekibimiz ve kupon platformu hikayemiz.' }));
router.get('/iletisim', (req, res) => res.render('iletisim', { title: 'İletişim - Kuponluk.com', description: 'Kuponluk.com ile iletişime geçin. Soru, öneri ve geri bildirimleriniz için bize ulaşın.', success: false, error: null }));
router.post('/iletisim', (req, res) => res.render('iletisim', { title: 'İletişim - Kuponluk.com', description: 'Kuponluk.com ile iletişime geçin. Soru, öneri ve geri bildirimleriniz için bize ulaşın.', success: true, error: null }));
router.get('/sss', (req, res) => res.render('faq', { title: 'Sıkça Sorulan Sorular - Kuponluk.com', description: 'Kupon kodları nasıl kullanılır? Kuponluk.com hakkında sıkça sorulan sorular ve cevapları.' }));
router.get('/gizlilik-politikasi', (req, res) => res.render('gizlilik', { title: 'Gizlilik Politikası - Kuponluk.com', description: 'Kuponluk.com gizlilik politikası. Kişisel verilerinizin nasıl toplandığı ve korunduğu hakkında bilgi alın.' }));
router.get('/kullanim-kosullari', (req, res) => res.render('kullanim-kosullari', { title: 'Kullanım Koşulları - Kuponluk.com', description: 'Kuponluk.com kullanım koşulları. Siteyi kullanmadan önce lütfen okuyun.' }));
router.get('/cerez-politikasi', (req, res) => res.render('cerez-politikasi', { title: 'Çerez Politikası - Kuponluk.com', description: 'Kuponluk.com çerez politikası. Çerezlerin nasıl kullanıldığı ve nasıl kontrol edebileceğiniz hakkında bilgi.' }));

router.get('/sitene-ekle', (req, res) => {
  const db = getDb();
  const categories = db.prepare('SELECT * FROM categories ORDER BY name').all();
  res.render('sitene-ekle', {
    title: 'Sitenize Kupon Ekleyin - Kuponluk.com',
    description: 'Haber sitenize veya bloğunuza ücretsiz kupon widget’ı ekleyin. Tek satır kod ile ziyaretçilerinize binlerce fırsatı sunun.',
    categories,
  });
});

router.get('/widget', (req, res) => {
  const db = getDb();
  const kategori = (req.query.kategori || '').replace(/[^a-z0-9À-ɏ-]/gi, '');
  const magaza   = (req.query.magaza   || '').replace(/[^a-z0-9-]/gi, '');
  const adet = Math.min(Math.max(parseInt(req.query.adet) || 5, 1), 10);
  const tema = req.query.tema === 'dark' ? 'dark' : 'light';

  let query = `SELECT cp.id, cp.title, cp.code, cp.discount_value, cp.discount_type,
    s.name as store_name, s.slug as store_slug
    FROM coupons cp
    JOIN stores s ON cp.store_id = s.id
    WHERE (cp.expiry_date IS NULL OR cp.expiry_date >= date('now'))`;
  const params = [];

  if (kategori) {
    query += ` AND s.category_id = (SELECT id FROM categories WHERE slug = ? LIMIT 1)`;
    params.push(kategori);
  }
  if (magaza) {
    query += ` AND s.slug = ?`;
    params.push(magaza);
  }
  query += ` ORDER BY cp.is_verified DESC, cp.use_count DESC LIMIT ?`;
  params.push(adet);

  let coupons = [];
  try { coupons = db.prepare(query).all(...params); } catch (e) {}

  res.setHeader('X-Frame-Options', 'ALLOWALL');
  res.setHeader('Content-Security-Policy', 'frame-ancestors *');
  res.render('widget', { coupons, tema });
});

router.get('/araclar/kupon-kodu-olusturma', (req, res) => {
  res.render('kupon-olusturucu', { title: 'Ücretsiz Kupon Kodu Oluşturucu - Kuponluk.com' });
});

router.get('/ilanlar', (req, res) => {
  const db = getDb();
  ensureListingsTable(db);
  const { kategori, magaza, tip, minFiyat, maxFiyat } = req.query;
  let query = "SELECT l.*, u.username FROM listings l LEFT JOIN users u ON l.user_id = u.id WHERE l.status = 'approved'";
  const params = [];
  if (kategori) { query += ' AND l.category = ?'; params.push(kategori); }
  if (magaza) { query += ' AND l.store_name = ?'; params.push(magaza); }
  if (tip === 'ucretsiz') { query += ' AND l.is_free = 1'; }
  if (tip === 'ucretli') { query += ' AND l.is_free = 0 AND l.price IS NOT NULL'; }
  if (minFiyat && !isNaN(parseFloat(minFiyat))) { query += ' AND l.price >= ?'; params.push(parseFloat(minFiyat)); }
  if (maxFiyat && !isNaN(parseFloat(maxFiyat))) { query += ' AND l.price <= ?'; params.push(parseFloat(maxFiyat)); }
  query += ' ORDER BY l.created_at DESC';
  const listings = db.prepare(query).all(...params);
  const categories = db.prepare("SELECT DISTINCT category FROM listings WHERE category IS NOT NULL AND status='approved' ORDER BY category").all().map(r => r.category);
  const storeNames = db.prepare("SELECT DISTINCT store_name FROM listings WHERE status='approved' ORDER BY store_name").all().map(r => r.store_name);
  res.render('ilanlar', {
    title: 'İlanlar - Kuponluk.com',
    listings, categories, storeNames,
    filterCategory: kategori || null, filterStore: magaza || null,
    filterType: tip || null, filterMinFiyat: minFiyat || null, filterMaxFiyat: maxFiyat || null,
  });
});

router.get('/ilanlar/olustur', (req, res) => {
  if (!req.session || !req.session.user) return res.redirect('/giris?redirect=/ilanlar/olustur');
  res.render('ilan-olustur', { title: 'İlan Oluştur - Kuponluk.com', success: false, error: null });
});

router.post('/ilanlar/olustur', (req, res) => {
  if (!req.session || !req.session.user) return res.redirect('/giris?redirect=/ilanlar/olustur');
  const db = getDb();
  ensureListingsTable(db);
  const { title, coupon_code, store_name, category, price, is_free, description, expires_at } = req.body;
  if (!title || !store_name) {
    return res.render('ilan-olustur', { title: 'İlan Oluştur - Kuponluk.com', success: false, error: 'Başlık ve mağaza adı zorunludur.' });
  }
  db.prepare(`INSERT INTO listings (user_id, title, coupon_code, store_name, category, price, is_free, description, expires_at, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved')`)
    .run(req.session.user.id, title, coupon_code || null, store_name, category || null, price ? parseFloat(price) : null, is_free ? 1 : 0, description || null, expires_at || null);
  res.render('ilan-olustur', { title: 'İlan Oluştur - Kuponluk.com', success: true, error: null });
});

router.get('/ilanlar/:id', (req, res) => {
  const db = getDb();
  ensureListingsTable(db);
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(404).render('404', { title: '404 - Kuponluk.com' });
  const ownerId = req.session && req.session.user ? parseInt(req.session.user.id) : null;
  let listing;
  if (ownerId) {
    listing = db.prepare(`SELECT l.*, u.username FROM listings l LEFT JOIN users u ON l.user_id = u.id WHERE l.id = ? AND (l.status = 'approved' OR l.user_id = ?)`).get(id, ownerId);
  } else {
    listing = db.prepare(`SELECT l.*, u.username FROM listings l LEFT JOIN users u ON l.user_id = u.id WHERE l.id = ? AND l.status = 'approved'`).get(id);
  }
  if (!listing) return res.status(404).render('404', { title: '404 - Kuponluk.com' });
  res.render('ilan-detay', { title: listing.title + ' - Kuponluk.com', listing });
});

router.post('/abone-ol', (req, res) => {
  const db = getDb();
  const { email } = req.body;
  if (!email || !email.includes('@')) return res.json({ success: false, message: 'Geçerli bir e-posta adresi giriniz.' });
  try {
    db.prepare('INSERT OR IGNORE INTO newsletter_subscribers (email) VALUES (?)').run(email);
    res.json({ success: true, message: 'Başarıyla abone oldunuz!' });
  } catch (e) {
    res.json({ success: false, message: 'Bir hata oluştu.' });
  }
});

router.post('/marka-abone-ol', (req, res) => {
  const db = getDb();
  const { email, store_id } = req.body;
  if (!email || !email.includes('@') || !store_id) return res.json({ success: false, message: 'Geçerli bilgiler giriniz.' });
  try {
    const user_id = req.session && req.session.user ? req.session.user.id : null;
    db.prepare('INSERT OR IGNORE INTO brand_subscriptions (email, store_id, user_id) VALUES (?, ?, ?)').run(email, parseInt(store_id), user_id);
    res.json({ success: true, message: 'Marka bildirimlerine başarıyla abone oldunuz!' });
  } catch (e) {
    res.json({ success: false, message: 'Bir hata oluştu.' });
  }
});

module.exports = router;
