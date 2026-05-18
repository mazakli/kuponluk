const express = require('express');
const router = express.Router();
const { getDb } = require('../database');

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
router.get('/hakkimizda', (req, res) => res.render('about', { title: 'Hakkımızda - Kuponluk.com' }));
router.get('/iletisim', (req, res) => res.render('contact', { title: 'İletişim - Kuponluk.com', success: false, error: null }));
router.post('/iletisim', (req, res) => res.render('contact', { title: 'İletişim - Kuponluk.com', success: true, error: null }));
router.get('/sss', (req, res) => res.render('faq', { title: 'Sıkça Sorulan Sorular - Kuponluk.com' }));
router.get('/gizlilik-politikasi', (req, res) => res.render('privacy', { title: 'Gizlilik Politikası - Kuponluk.com' }));
router.get('/kullanim-kosullari', (req, res) => res.render('terms', { title: 'Kullanım Koşulları - Kuponluk.com' }));
router.get('/cerez-politikasi', (req, res) => res.render('cookies', { title: 'Çerez Politikası - Kuponluk.com' }));

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
    const user_id = req.session.user ? req.session.user.id : null;
    db.prepare('INSERT OR IGNORE INTO brand_subscriptions (email, store_id, user_id) VALUES (?, ?, ?)').run(email, parseInt(store_id), user_id);
    res.json({ success: true, message: 'Marka bildirimlerine başarıyla abone oldunuz!' });
  } catch (e) {
    res.json({ success: false, message: 'Bir hata oluştu.' });
  }
});

module.exports = router;
