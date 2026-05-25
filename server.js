require('dotenv').config();
const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const path = require('path');
const { initDb } = require('./database');
const { loadUser } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;

initDb();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Security headers
app.use((req, res, next) => {
  res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  next();
});

// Session
app.use(session({
  store: new SQLiteStore({ db: 'sessions.db', dir: path.join(__dirname, 'data') }),
  secret: process.env.SESSION_SECRET || 'kuponluk-gizli-anahtar-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000, httpOnly: true },
}));

app.use(loadUser);

// Routes
app.use('/', require('./routes/index'));
app.use('/magaza', require('./routes/stores'));
app.use('/magazalar', require('./routes/stores'));
app.use('/kupon', require('./routes/coupons'));
app.use('/kategori', require('./routes/categories'));
app.use('/kategoriler', require('./routes/categories'));
app.use('/', require('./routes/auth'));
app.use('/', require('./routes/user'));
app.use('/', require('./routes/pages'));
app.use('/mesajlar', require('./routes/messages'));

// Sitemap
app.get('/sitemap.xml', (req, res) => {
  const { getDb } = require('./database');
  const db = getDb();
  const base = process.env.SITE_URL || 'https://kuponluk.com';
  const today = new Date().toISOString().split('T')[0];

  const stores = db.prepare('SELECT slug FROM stores').all();
  const categories = db.prepare('SELECT slug FROM categories').all();
  const coupons = db.prepare('SELECT id FROM coupons').all();

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
  const add = (loc, freq, priority) => {
    xml += `  <url><loc>${base}${loc}</loc><changefreq>${freq}</changefreq><priority>${priority}</priority><lastmod>${today}</lastmod></url>\n`;
  };

  add('/', 'daily', '1.0');
  add('/magazalar', 'weekly', '0.9');
  add('/kategoriler', 'weekly', '0.9');
  add('/kupon/son-eklenenler', 'daily', '0.8');
  add('/kupon/populer', 'daily', '0.8');
  add('/telegram', 'monthly', '0.7');
  add('/kupon-gonder', 'monthly', '0.6');
  add('/sss', 'monthly', '0.5');
  add('/hakkimizda', 'monthly', '0.4');

  stores.forEach(s => add(`/magaza/${s.slug}`, 'weekly', '0.8'));
  categories.forEach(c => add(`/kategori/${c.slug}`, 'weekly', '0.8'));
  coupons.forEach(c => add(`/kupon/${c.id}`, 'weekly', '0.7'));

  xml += '</urlset>';
  res.set('Content-Type', 'application/xml; charset=utf-8');
  res.send(xml);
});

app.get('/robots.txt', (req, res) => {
  const base = process.env.SITE_URL || 'https://kuponluk.com';
  res.type('text/plain');
  res.send(`User-agent: *\nAllow: /\nDisallow: /profil\nDisallow: /giris\nDisallow: /kayit\nSitemap: ${base}/sitemap.xml\n`);
});

// 404
app.use((req, res) => {
  res.status(404).render('404', { title: 'Sayfa Bulunamadı - Kuponluk.com' });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render('404', { title: 'Sunucu Hatası - Kuponluk.com' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Kuponluk.com sunucu çalışıyor: http://localhost:${PORT}`);
});
