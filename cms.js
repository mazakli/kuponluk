const nodeFetch = require('node-fetch');
const CMS_URL = process.env.CMS_URL || 'https://ozel-cms-production.up.railway.app';
const MARKA = process.env.CMS_MARKA || 'kuponluk';

async function getIcerikler(tur) {
  try {
    const res = await nodeFetch(`${CMS_URL}/api/public/${MARKA}/icerikler?tur=${tur}`);
    if (!res.ok) return [];
    const data = await res.json();
    console.log(`[CMS] ${MARKA} / ${tur}: ${data.length} içerik alındı`);
    return data;
  } catch (err) {
    console.error('[CMS] Hata:', err.message);
    return [];
  }
}

async function getAyarlar() {
  try {
    const res = await nodeFetch(`${CMS_URL}/api/public/${MARKA}/ayarlar`);
    if (!res.ok) return {};
    return await res.json();
  } catch (err) {
    console.error('[CMS] Ayarlar hatası:', err.message);
    return {};
  }
}

module.exports = { getIcerikler, getAyarlar };
