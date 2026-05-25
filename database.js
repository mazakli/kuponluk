const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, 'data', 'kuponluk.db');
let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

function initDb() {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      icon TEXT DEFAULT '',
      color TEXT DEFAULT '#FF6B00',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS stores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      description TEXT,
      logo_url TEXT,
      website_url TEXT,
      category_id INTEGER,
      is_featured INTEGER DEFAULT 0,
      coupon_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES categories(id)
    );

    CREATE TABLE IF NOT EXISTS coupons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      store_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      code TEXT,
      description TEXT,
      discount_type TEXT DEFAULT 'percent',
      discount_value TEXT,
      expiry_date DATE,
      is_verified INTEGER DEFAULT 0,
      is_exclusive INTEGER DEFAULT 0,
      rating_sum INTEGER DEFAULT 0,
      rating_count INTEGER DEFAULT 0,
      view_count INTEGER DEFAULT 0,
      use_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (store_id) REFERENCES stores(id)
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      avatar TEXT,
      is_admin INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS user_favorites (
      user_id INTEGER,
      store_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, store_id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (store_id) REFERENCES stores(id)
    );

    CREATE TABLE IF NOT EXISTS user_saved_coupons (
      user_id INTEGER,
      coupon_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, coupon_id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (coupon_id) REFERENCES coupons(id)
    );

    CREATE TABLE IF NOT EXISTS coupon_ratings (
      user_id INTEGER,
      coupon_id INTEGER,
      rating INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, coupon_id)
    );

    CREATE TABLE IF NOT EXISTS coupon_submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      store_name TEXT NOT NULL,
      coupon_code TEXT,
      description TEXT NOT NULL,
      discount_value TEXT,
      expiry_date DATE,
      submitter_name TEXT,
      submitter_email TEXT,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS newsletter_subscribers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      notify_push INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS coupon_reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      coupon_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      rating INTEGER NOT NULL,
      comment TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (coupon_id) REFERENCES coupons(id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      UNIQUE(user_id, coupon_id)
    );

    CREATE TABLE IF NOT EXISTS brand_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL,
      store_id INTEGER NOT NULL,
      user_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(email, store_id),
      FOREIGN KEY (store_id) REFERENCES stores(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS sliders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      subtitle TEXT,
      image_url TEXT,
      link_url TEXT DEFAULT '/',
      bg_color TEXT DEFAULT '#FF6B00',
      order_index INTEGER DEFAULT 0,
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS listings (
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
    );
  `);

  seedData(db);
  runMigrations(db);
}

function runMigrations(db) {
  const logoMap = [
    ['trendyol', 'https://logo.clearbit.com/trendyol.com'],
    ['hepsiburada', 'https://logo.clearbit.com/hepsiburada.com'],
    ['zara', 'https://logo.clearbit.com/zara.com'],
    ['lc-waikiki', 'https://logo.clearbit.com/lcwaikiki.com'],
    ['boyner', 'https://logo.clearbit.com/boyner.com.tr'],
    ['koton', 'https://logo.clearbit.com/koton.com'],
    ['defacto', 'https://logo.clearbit.com/defacto.com.tr'],
    ['mediamarkt', 'https://logo.clearbit.com/mediamarkt.com.tr'],
    ['teknosa', 'https://logo.clearbit.com/teknosa.com'],
    ['yemeksepeti', 'https://logo.clearbit.com/yemeksepeti.com'],
    ['getir', 'https://logo.clearbit.com/getir.com'],
    ['migros', 'https://logo.clearbit.com/migros.com.tr'],
    ['booking', 'https://logo.clearbit.com/booking.com'],
    ['nike', 'https://logo.clearbit.com/nike.com'],
    ['adidas', 'https://logo.clearbit.com/adidas.com'],
    ['sephora', 'https://logo.clearbit.com/sephora.com'],
    ['morhipo', 'https://logo.clearbit.com/morhipo.com'],
    ['amazon', 'https://logo.clearbit.com/amazon.com.tr'],
    ['n11', 'https://logo.clearbit.com/n11.com'],
    ['flo', 'https://logo.clearbit.com/flo.com.tr'],
  ];
  const update = db.prepare('UPDATE stores SET logo_url = ? WHERE slug = ?');
  logoMap.forEach(([slug, url]) => update.run(url, slug));

  const sliderCount = db.prepare('SELECT COUNT(*) as c FROM sliders').get().c;
  if (sliderCount === 0) seedSliders(db);

  const trendyolCount = db.prepare("SELECT COUNT(*) as c FROM coupons WHERE store_id = (SELECT id FROM stores WHERE slug = 'trendyol')").get();
  if (trendyolCount && trendyolCount.c < 8) {
    const trendyolStore = db.prepare("SELECT id FROM stores WHERE slug = 'trendyol'").get();
    if (trendyolStore) {
      const ins = db.prepare(`INSERT INTO coupons (store_id, title, code, description, discount_type, discount_value, expiry_date, is_verified, is_exclusive, view_count, use_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
      try { ins.run(trendyolStore.id, 'Giyim Ürünlerinde %25 İndirim', 'TY25GIYIM', 'Seçili giyim ürünlerinde geçerli', 'percent', '25', '2026-10-31', 1, 0, 2100, 630); } catch(e) {}
      try { ins.run(trendyolStore.id, 'Elektronik Ürünlerde %10 İndirim', 'TY10ELEK', 'Trendyol elektronik kategorisinde geçerli', 'percent', '10', '2026-09-30', 1, 0, 1800, 540); } catch(e) {}
      try { ins.run(trendyolStore.id, 'Kozmetik Alışverişte 50 TL İndirim', 'TY50KOZMET', '200 TL üzeri kozmetik alışverişlerde geçerli', 'fixed', '50', '2026-08-31', 0, 0, 950, 285); } catch(e) {}
      try { ins.run(trendyolStore.id, 'Ayakkabı Kategorisinde Ücretsiz Kargo', 'TYYAKKARGO', 'Seçili ayakkabı ürünlerinde ücretsiz kargo', 'free_shipping', null, '2026-12-31', 1, 0, 1350, 405); } catch(e) {}
      try { ins.run(trendyolStore.id, 'Ev & Yaşam Ürünlerinde %15 İndirim', 'TYEV15', 'Ev ve yaşam kategorisinde geçerli', 'percent', '15', '2026-11-30', 0, 0, 760, 228); } catch(e) {}
      db.prepare("UPDATE stores SET coupon_count = (SELECT COUNT(*) FROM coupons WHERE store_id = stores.id) WHERE slug = 'trendyol'").run();
    }
  }

  try {
    const listingCount = db.prepare('SELECT COUNT(*) as c FROM listings').get();
    if (listingCount && listingCount.c === 0) {
      const insL = db.prepare('INSERT INTO listings (title, coupon_code, store_name, category, is_free, description, expires_at, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
      insL.run('Trendyol %20 İndirim Kodu Paylaşıyorum', 'TRENDYOL20', 'Trendyol', 'Moda & Giyim', 1, "Trendyol'da ilk alışverişlerde geçerli %20 indirim kodu. Denedim çalışıyor!", '2026-12-31', 'approved');
      insL.run('Hepsiburada Elektronik 50 TL İndirim', 'HBTECH50', 'Hepsiburada', 'Elektronik', 1, '300 TL üzeri elektronik alışverişlerde 50 TL indirim. Kampanya süreli!', '2026-09-30', 'approved');
      insL.run('Yemeksepeti İlk Sipariş %40 İndirim', 'YS40ILK', 'Yemeksepeti', 'Yemek & Restoran', 1, "Yemeksepeti'nde ilk siparişe özel %40 indirim. Hızlı yararlanın!", '2026-12-31', 'approved');
      insL.run('Nike Yaz Koleksiyonu %20 İndirim', 'NIKEYAZ20', 'Nike', 'Spor & Outdoor', 1, 'Nike yaz koleksiyonunda seçili ürünlerde %20 indirim. Spor ayakkabı dahil.', '2026-08-31', 'approved');
      insL.run('LC Waikiki Çocuk Giyimde %25 İndirim', 'LCWCOCUK25', 'LC Waikiki', 'Moda & Giyim', 1, 'Tüm çocuk giyim ürünlerinde %25 indirim. Okul alışverişi için ideal!', '2026-08-15', 'approved');
      insL.run('Booking.com Otel Rezervasyonunda %10 İndirim', 'BOOK10TR', 'Booking.com', 'Seyahat', 1, 'Türkiye otelleri için rezervasyonda %10 indirim kodu.', '2026-12-31', 'approved');
    }
  } catch(e) {}
}

function seedSliders(db) {
  const ins = db.prepare('INSERT INTO sliders (title, subtitle, link_url, bg_color, order_index) VALUES (?, ?, ?, ?, ?)');
  ins.run('Trendyol Özel İndirim Kodları', 'İlk siparişinize özel indirim kuponu ile büyük tasarruf edin', '/magaza/trendyol', '#FF6B00', 1);
  ins.run('Hepsiburada Fırsatları', 'Elektronik, giyim ve daha fazlasında yüzlerce indirim', '/magaza/hepsiburada', '#FF8800', 2);
  ins.run('Yemeksepeti İlk Sipariş', 'İlk siparişinize özel yüzde 40 indirim fırsatı', '/magaza/yemeksepeti', '#CC1111', 3);
}

function seedData(db) {
  const catCount = db.prepare('SELECT COUNT(*) as c FROM categories').get().c;
  if (catCount > 0) return;

  const categories = [
    { name: 'Moda & Giyim', slug: 'moda-giyim', icon: '', color: '#e91e63' },
    { name: 'Elektronik', slug: 'elektronik', icon: '', color: '#2196f3' },
    { name: 'Yemek & Restoran', slug: 'yemek-restoran', icon: '', color: '#ff5722' },
    { name: 'Seyahat', slug: 'seyahat', icon: '', color: '#00bcd4' },
    { name: 'Kozmetik & Güzellik', slug: 'kozmetik-guzellik', icon: '', color: '#9c27b0' },
    { name: 'Ev & Yaşam', slug: 'ev-yasam', icon: '', color: '#4caf50' },
    { name: 'Spor & Outdoor', slug: 'spor-outdoor', icon: '', color: '#ff9800' },
    { name: 'Kitap & Eğitim', slug: 'kitap-egitim', icon: '', color: '#795548' },
    { name: 'Oyun & Eğlence', slug: 'oyun-eglence', icon: '', color: '#607d8b' },
    { name: 'Market & Süpermarket', slug: 'market-supermarket', icon: '', color: '#f44336' },
    { name: 'Sigorta & Finans', slug: 'sigorta-finans', icon: '', color: '#3f51b5' },
    { name: 'Teknoloji & Yazılım', slug: 'teknoloji-yazilim', icon: '', color: '#009688' },
  ];
  const insertCat = db.prepare('INSERT INTO categories (name, slug, icon, color) VALUES (?, ?, ?, ?)');
  categories.forEach(c => insertCat.run(c.name, c.slug, c.icon, c.color));

  const stores = [
    { name: 'Trendyol', slug: 'trendyol', desc: "Türkiye'nin en büyük online moda ve alışveriş platformu", logo: 'https://logo.clearbit.com/trendyol.com', url: 'https://trendyol.com', cat: 1, featured: 1 },
    { name: 'Hepsiburada', slug: 'hepsiburada', desc: 'Elektronik, giyim ve daha fazlası için alışveriş sitesi', logo: 'https://logo.clearbit.com/hepsiburada.com', url: 'https://hepsiburada.com', cat: 2, featured: 1 },
    { name: 'Zara', slug: 'zara', desc: 'Uluslararası moda markası', logo: 'https://logo.clearbit.com/zara.com', url: 'https://zara.com', cat: 1, featured: 1 },
    { name: 'LC Waikiki', slug: 'lc-waikiki', desc: 'Uygun fiyatlı moda markası', logo: 'https://logo.clearbit.com/lcwaikiki.com', url: 'https://lcwaikiki.com', cat: 1, featured: 1 },
    { name: 'Boyner', slug: 'boyner', desc: "Türkiye'nin köklü perakende markası", logo: 'https://logo.clearbit.com/boyner.com.tr', url: 'https://boyner.com.tr', cat: 1, featured: 1 },
    { name: 'Koton', slug: 'koton', desc: 'Şik ve uygun fiyatlı giyim markası', logo: 'https://logo.clearbit.com/koton.com', url: 'https://koton.com', cat: 1, featured: 0 },
    { name: 'Defacto', slug: 'defacto', desc: 'Günlük ve trend giyim markası', logo: 'https://logo.clearbit.com/defacto.com.tr', url: 'https://defacto.com.tr', cat: 1, featured: 1 },
    { name: 'MediaMarkt', slug: 'mediamarkt', desc: 'Elektronik ve teknoloji ürünleri mağazası', logo: 'https://logo.clearbit.com/mediamarkt.com.tr', url: 'https://mediamarkt.com.tr', cat: 2, featured: 1 },
    { name: 'Teknosa', slug: 'teknosa', desc: 'Elektronik ve teknoloji perakendecisi', logo: 'https://logo.clearbit.com/teknosa.com', url: 'https://teknosa.com', cat: 2, featured: 0 },
    { name: 'Yemeksepeti', slug: 'yemeksepeti', desc: 'Online yemek sipariş platformu', logo: 'https://logo.clearbit.com/yemeksepeti.com', url: 'https://yemeksepeti.com', cat: 3, featured: 1 },
    { name: 'Getir', slug: 'getir', desc: 'Dakikalar içinde teslimat platformu', logo: 'https://logo.clearbit.com/getir.com', url: 'https://getir.com', cat: 3, featured: 1 },
    { name: 'Migros', slug: 'migros', desc: 'Online süpermarket alışverişi', logo: 'https://logo.clearbit.com/migros.com.tr', url: 'https://migros.com.tr', cat: 10, featured: 1 },
    { name: 'Booking.com', slug: 'booking', desc: 'Dünya genelinde otel rezervasyon platformu', logo: 'https://logo.clearbit.com/booking.com', url: 'https://booking.com', cat: 4, featured: 1 },
    { name: 'Nike', slug: 'nike', desc: 'Dünyaca ünlü spor markası', logo: 'https://logo.clearbit.com/nike.com', url: 'https://nike.com/tr', cat: 7, featured: 1 },
    { name: 'Adidas', slug: 'adidas', desc: 'Küresel spor giyim ve ayakkabı markası', logo: 'https://logo.clearbit.com/adidas.com', url: 'https://adidas.com.tr', cat: 7, featured: 1 },
    { name: 'Sephora', slug: 'sephora', desc: 'Kozmetik ve güzellik ürünleri markası', logo: 'https://logo.clearbit.com/sephora.com', url: 'https://sephora.com.tr', cat: 5, featured: 0 },
    { name: 'Morhipo', slug: 'morhipo', desc: 'Outlet moda alışveriş sitesi', logo: 'https://logo.clearbit.com/morhipo.com', url: 'https://morhipo.com', cat: 1, featured: 0 },
    { name: 'Amazon Türkiye', slug: 'amazon', desc: "Dünyanın en büyük e-ticaret platformu", logo: 'https://logo.clearbit.com/amazon.com.tr', url: 'https://amazon.com.tr', cat: 2, featured: 1 },
    { name: 'N11', slug: 'n11', desc: "Türkiye'nin köklü online alışveriş platformu", logo: 'https://logo.clearbit.com/n11.com', url: 'https://n11.com', cat: 2, featured: 0 },
    { name: 'Flo', slug: 'flo', desc: 'Ayakkabı ve aksesuar mağazası', logo: 'https://logo.clearbit.com/flo.com.tr', url: 'https://flo.com.tr', cat: 1, featured: 1 },
  ];
  const insertStore = db.prepare('INSERT INTO stores (name, slug, description, logo_url, website_url, category_id, is_featured) VALUES (?, ?, ?, ?, ?, ?, ?)');
  stores.forEach(s => insertStore.run(s.name, s.slug, s.desc, s.logo, s.url, s.cat, s.featured));

  const coupons = [
    { store_id: 1, title: 'İlk Siparışte %20 İndirim', code: 'TRENDYOL20', desc: "Trendyol'da ilk siparışinize özel %20 indirim kuponu", type: 'percent', value: '20', expiry: '2026-12-31', verified: 1, exclusive: 1 },
    { store_id: 1, title: '150 TL ve Üzeri Alışverişte 30 TL İndirim', code: 'TY30INDIRIM', desc: '150 TL ve üzeri alışverişlerde geçerli', type: 'fixed', value: '30', expiry: '2026-08-31', verified: 1, exclusive: 0 },
    { store_id: 1, title: 'Ücretsiz Kargo', code: 'TYKARGO', desc: 'Seçili ürünlerde ücretsiz kargo fırsatı', type: 'free_shipping', value: null, expiry: '2026-07-15', verified: 0, exclusive: 0 },
    { store_id: 2, title: 'Elektronik Ürünlerde %15 İndirim', code: 'HBTECH15', desc: 'Tüm elektronik kategorisinde geçerli', type: 'percent', value: '15', expiry: '2026-09-30', verified: 1, exclusive: 0 },
    { store_id: 2, title: 'Yeni Üye 50 TL Kupon', code: 'HBYENI50', desc: 'Yeni üyelere özel 50 TL indirim', type: 'fixed', value: '50', expiry: '2026-12-31', verified: 1, exclusive: 1 },
    { store_id: 3, title: 'Outlet Ürünlerde Ekstra %10', code: 'ZARAOUTLET', desc: 'Outlet bölümündeki tüm ürünlerde ekstra indirim', type: 'percent', value: '10', expiry: '2026-06-30', verified: 0, exclusive: 0 },
    { store_id: 4, title: 'Çocuk Giyimde %25 İndirim', code: 'LCWCOCUK25', desc: 'Tüm çocuk giyim ürünlerinde geçerli', type: 'percent', value: '25', expiry: '2026-08-15', verified: 1, exclusive: 0 },
    { store_id: 4, title: '3 Al 2 Öde', code: 'LCW3AL2ODE', desc: 'Seçili ürünlerde 3 al 2 öde kampanyası', type: 'deal', value: '3 Al 2 Öde', expiry: '2026-07-31', verified: 1, exclusive: 0 },
    { store_id: 5, title: 'Sezon Sonu %30 İndirim', code: 'BOYNER30', desc: 'Sezon sonu ürünlerinde büyük indirim', type: 'percent', value: '30', expiry: '2026-06-30', verified: 1, exclusive: 0 },
    { store_id: 7, title: "Online'a Özel %20 İndirim", code: 'DFCONLINE20', desc: 'Sadece online alışverişlerde geçerli', type: 'percent', value: '20', expiry: '2026-10-31', verified: 1, exclusive: 1 },
    { store_id: 8, title: 'Laptop ve Bilgisayarlarda %12 İndirim', code: 'MMLAPTOP12', desc: 'Seçili laptop modellerinde geçerli', type: 'percent', value: '12', expiry: '2026-07-31', verified: 1, exclusive: 0 },
    { store_id: 8, title: '500 TL Üzeri 75 TL İndirim', code: 'MM500AL75', desc: '500 TL ve üzeri alışverişlerde geçerli', type: 'fixed', value: '75', expiry: '2026-08-31', verified: 0, exclusive: 0 },
    { store_id: 10, title: 'İlk Siparışe %40 İndirim', code: 'YS40ILK', desc: 'Yeni kullanıcılara özel ilk sipariş indirimi', type: 'percent', value: '40', expiry: '2026-12-31', verified: 1, exclusive: 1 },
    { store_id: 10, title: 'Ücretsiz Teslimat', code: 'YSKARGOBED', desc: 'Seçili restoranlardan ücretsiz teslimat', type: 'free_shipping', value: null, expiry: '2026-07-31', verified: 1, exclusive: 0 },
    { store_id: 11, title: 'Market Alışverişinde 30 TL İndirim', code: 'GETIR30', desc: '150 TL üzeri marketten alışverişlerde geçerli', type: 'fixed', value: '30', expiry: '2026-09-30', verified: 1, exclusive: 0 },
    { store_id: 12, title: 'Online Alışverişte Ücretsiz Kargo', code: 'MIGROSKARGO', desc: '200 TL üzeri alışverişlerde ücretsiz kargo', type: 'free_shipping', value: null, expiry: '2026-12-31', verified: 1, exclusive: 0 },
    { store_id: 13, title: 'Otel Rezervasyonunda %10 İndirim', code: 'BOOK10TR', desc: 'Türkiye otelleri için geçerli', type: 'percent', value: '10', expiry: '2026-12-31', verified: 1, exclusive: 0 },
    { store_id: 14, title: 'Yaz Koleksiyonunda %20 İndirim', code: 'NIKEYAZ20', desc: 'Seçili yaz ürünlerinde indirim', type: 'percent', value: '20', expiry: '2026-08-31', verified: 1, exclusive: 0 },
    { store_id: 15, title: 'Koşu Ayakkabısında %15 İndirim', code: 'ADIDAS15KOS', desc: 'Seçili koşu ayakkabılarında geçerli', type: 'percent', value: '15', expiry: '2026-09-30', verified: 0, exclusive: 0 },
    { store_id: 18, title: 'Prime Üyeliğinde %50 İndirim', code: 'PRIMETR50', desc: 'Prime üyelik aboneliğinde geçerli', type: 'percent', value: '50', expiry: '2026-06-30', verified: 1, exclusive: 1 },
    { store_id: 18, title: 'Kitaplarda Ücretsiz Kargo', code: 'AZKITAP', desc: 'Tüm kitap alışverişlerinde ücretsiz kargo', type: 'free_shipping', value: null, expiry: '2026-12-31', verified: 1, exclusive: 0 },
    { store_id: 20, title: 'Spor Ayakkabılarda %20 İndirim', code: 'FLO20SPOR', desc: 'Seçili spor ayakkabı modellerinde geçerli', type: 'percent', value: '20', expiry: '2026-08-31', verified: 1, exclusive: 0 },
  ];
  const insertCoupon = db.prepare(`INSERT INTO coupons (store_id, title, code, description, discount_type, discount_value, expiry_date, is_verified, is_exclusive, rating_sum, rating_count, view_count, use_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  coupons.forEach(c => {
    const views = Math.floor(Math.random() * 5000) + 100;
    const uses = Math.floor(views * 0.3);
    const ratingCount = Math.floor(Math.random() * 50) + 5;
    const ratingSum = Math.floor(ratingCount * (Math.random() * 2 + 3));
    insertCoupon.run(c.store_id, c.title, c.code, c.desc, c.type, c.value, c.expiry, c.verified, c.exclusive, ratingSum, ratingCount, views, uses);
  });
  db.prepare(`UPDATE stores SET coupon_count = (SELECT COUNT(*) FROM coupons WHERE store_id = stores.id)`).run();
  seedSliders(db);
}

module.exports = { getDb, initDb };
