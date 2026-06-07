const CMS_URL = process.env.CMS_URL || 'https://ozel-cms-production.up.railway.app';
const MARKA = process.env.CMS_MARKA || 'kuponluk';

async function getIcerikler(tur) {
  try {
    const res = await fetch(`${CMS_URL}/api/public/${MARKA}/icerikler?tur=${tur}`);
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

async function getAyarlar() {
  try {
    const res = await fetch(`${CMS_URL}/api/public/${MARKA}/ayarlar`);
    if (!res.ok) return {};
    return await res.json();
  } catch {
    return {};
  }
}

module.exports = { getIcerikler, getAyarlar };
