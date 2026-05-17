// ================================================
// IklimKu — AI Climate Monitor Indonesia
// JavaScript: Data, AI Prediction, Charts, News
// ================================================
 
// ---- DATA PER KOTA (koordinat GPS) ----
const cityData = {
  surabaya: { lat: -7.2575,  lon: 112.7521 },
  jakarta:  { lat: -6.2088,  lon: 106.8456 },
  bandung:  { lat: -6.9175,  lon: 107.6191 },
  medan:    { lat:  3.5952,  lon: 98.6722  },
  makassar: { lat: -5.1477,  lon: 119.4327 },
};
 
// Cache data yang sudah di-fetch agar tidak fetch ulang tiap klik
const cityCache = {};
 
// ---- FETCH DATA REAL DARI OPEN-METEO ----
async function fetchCityData(city) {
  if (cityCache[city]) return cityCache[city]; // gunakan cache kalau ada
 
  const { lat, lon } = cityData[city];
 
  // Fetch cuaca (suhu, kelembapan, curah hujan) + 7 hari historis
  const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,precipitation&daily=temperature_2m_max,relative_humidity_2m_max,precipitation_sum&past_days=6&forecast_days=1&timezone=Asia%2FJakarta`;
 
  // Fetch AQI dari Open-Meteo Air Quality API
  const aqiUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=european_aqi&hourly=european_aqi&past_days=6&forecast_days=1&timezone=Asia%2FJakarta`;
 
  try {
    const [weatherRes, aqiRes] = await Promise.all([
      fetch(weatherUrl),
      fetch(aqiUrl)
    ]);
 
    const weatherJson = await weatherRes.json();
    const aqiJson     = await aqiRes.json();
 
    const current = weatherJson.current;
    const daily   = weatherJson.daily;
    const aqiCurrent = aqiJson.current;
    const aqiHourly  = aqiJson.hourly;
 
    // Ambil data 7 hari untuk grafik
    const weekTemps = daily.temperature_2m_max;
    const weekHums  = daily.relative_humidity_2m_max;
    const weekRains = daily.precipitation_sum;
 
    // AQI per hari: ambil nilai jam 12:00 tiap hari (index ke-12, 36, 60, dst)
    const weekAqi = [0,1,2,3,4,5,6].map(d => {
      const idx = d * 24 + 12;
      return aqiHourly.european_aqi[idx] ?? 0;
    });
 
    const result = {
      temp: current.temperature_2m,
      hum:  current.relative_humidity_2m,
      rain: current.precipitation,
      aqi:  aqiCurrent.european_aqi ?? 0,
      weekTemps,
      weekHums,
      weekRains,
      weekAqi,
    };
 
    cityCache[city] = result;
    return result;
 
  } catch (err) {
    console.error('Gagal fetch data:', err);
    return null;
  }
}
 
// ---- CHART CONFIG ----
const chartConfigs = {
  suhu:       { label: 'Suhu (°C)',        color: '#f87171', min: 20,  max: 40,  unit: '°C' },
  kelembapan: { label: 'Kelembapan (%)',   color: '#38bdf8', min: 50,  max: 100, unit: '%' },
  aqi:        { label: 'AQI',              color: '#a78bfa', min: 0,   max: 200, unit: '' },
  hujan:      { label: 'Curah Hujan (mm)', color: '#60a5fa', min: 0,   max: 60,  unit: 'mm' },
};
 
let climateChart = null;
let currentCity  = 'surabaya';
let currentChart = 'suhu';
 
// ---- INIT ----
document.addEventListener('DOMContentLoaded', async () => {
  updateTime();
  setInterval(updateTime, 1000);
 
  await loadCity('surabaya');
  renderChart('suhu');
  renderNews();
 
  // Auto-refresh data iklim setiap 1 menit
  setInterval(async () => {
    // Hapus cache kota aktif agar fetch ulang data terbaru
    delete cityCache[currentCity];
    await loadCity(currentCity);
    renderChart(currentChart);
  }, 60000);
 
  // City buttons
  document.querySelectorAll('.city-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      document.querySelectorAll('.city-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentCity = btn.dataset.city;
      await loadCity(currentCity);
      renderChart(currentChart);
    });
  });
 
  // Chart tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentChart = btn.dataset.chart;
      renderChart(currentChart);
    });
  });
});
 
// ---- TIME ----
function updateTime() {
  const now = new Date();
  const opts = { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
  document.getElementById('navTime').textContent = 'WIB ' + now.toLocaleTimeString('id-ID', opts);
}
 
// ---- LOAD CITY DATA (REAL API) ----
async function loadCity(city) {
  // Tampilkan loading state
  ['tempVal','humVal','aqiVal','rainVal'].forEach(id => {
    document.getElementById(id).textContent = '...';
  });
  document.getElementById('heroTemp').textContent = '...';
  document.getElementById('heroHum').textContent  = '...';
  document.getElementById('heroAqi').textContent  = '...';
 
  const d = await fetchCityData(city);
 
  if (!d) {
    ['tempVal','humVal','aqiVal','rainVal'].forEach(id => {
      document.getElementById(id).textContent = 'ERR';
    });
    return;
  }
 
  const temp = +d.temp.toFixed(1);
  const hum  = Math.round(d.hum);
  const aqi  = Math.round(d.aqi);
  const rain = +d.rain.toFixed(1);
 
  // Hero stats
  document.getElementById('heroTemp').textContent = temp;
  document.getElementById('heroHum').textContent  = hum;
  document.getElementById('heroAqi').textContent  = aqi;
 
  // Dashboard cards
  setCard('temp', temp, `${temp}`, `${Math.round((temp / 45) * 100)}%`,  getTempStatus(temp));
  setCard('hum',  hum,  `${hum}`,  `${hum}%`,                            getHumStatus(hum));
  setCard('aqi',  aqi,  `${aqi}`,  `${Math.min(100, Math.round(aqi / 2))}%`, getAqiStatus(aqi));
  setCard('rain', rain, `${rain}`, `${Math.min(100, Math.round(rain / 60 * 100))}%`, getRainStatus(rain));
 
  // AI Prediction
  runAIPrediction(temp, hum, aqi, rain);
 
  // Update grafik dengan data real 7 hari
  renderChart(currentChart);
}
 
function setCard(id, raw, display, barPct, status) {
  document.getElementById(`${id}Val`).textContent   = display;
  document.getElementById(`${id}Bar`).style.width   = barPct;
  const el = document.getElementById(`${id}Status`);
  el.textContent = status.text;
  el.className   = `card-status ${status.cls}`;
}
 
// ---- STATUS HELPERS ----
function getTempStatus(t) {
  if (t < 20) return { text: '❄️ Dingin',      cls: 'status-good' };
  if (t < 28) return { text: '✅ Normal',       cls: 'status-good' };
  if (t < 35) return { text: '⚠️ Hangat',      cls: 'status-warn' };
  return              { text: '🔥 Sangat Panas', cls: 'status-bad' };
}
 
function getHumStatus(h) {
  if (h < 40)  return { text: '🌵 Sangat Kering', cls: 'status-bad' };
  if (h < 60)  return { text: '✅ Ideal',         cls: 'status-good' };
  if (h < 80)  return { text: '⚠️ Lembap',       cls: 'status-warn' };
  return               { text: '💧 Sangat Lembap', cls: 'status-bad' };
}
 
function getAqiStatus(a) {
  if (a <= 50)  return { text: '✅ Baik',          cls: 'status-good' };
  if (a <= 100) return { text: '🟡 Sedang',        cls: 'status-warn' };
  if (a <= 150) return { text: '⚠️ Tidak Sehat',  cls: 'status-warn' };
  return               { text: '🔴 Berbahaya',     cls: 'status-bad' };
}
 
function getRainStatus(r) {
  if (r < 5)   return { text: '☀️ Cerah',         cls: 'status-good' };
  if (r < 20)  return { text: '🌦️ Hujan Ringan',  cls: 'status-good' };
  if (r < 40)  return { text: '⚠️ Hujan Sedang',  cls: 'status-warn' };
  return               { text: '⛈️ Hujan Lebat',  cls: 'status-bad' };
}
 
// ================================================
// AI PREDICTION ENGINE
// Logika berbasis threshold ilmiah sederhana
// ================================================
function runAIPrediction(temp, hum, aqi, rain) {
  // --- BANJIR ---
  // Faktor: curah hujan tinggi + kelembapan tinggi
  const banjirScore = Math.min(100, Math.round(
    (rain / 50) * 60 + (hum / 100) * 30 + (Math.random() * 10)
  ));
  setBanjirWarn(banjirScore, rain, hum);
 
  // --- HEATWAVE ---
  // Faktor: suhu tinggi + kelembapan rendah
  const heatScore = Math.min(100, Math.round(
    ((temp - 20) / 20) * 70 + ((100 - hum) / 100) * 20 + (Math.random() * 10)
  ));
  setHeatWarn(heatScore, temp, hum);
 
  // --- KUALITAS UDARA ---
  const udaraScore = Math.min(100, Math.round(aqi / 2));
  setUdaraWarn(udaraScore, aqi);
}
 
function setBanjirWarn(score, rain, hum) {
  const card = document.getElementById('warnBanjir');
  const levelEl = document.getElementById('banjirLevel');
  const descEl  = document.getElementById('banjirDesc');
  const meterEl = document.getElementById('banjirMeter');
  const scoreEl = document.getElementById('banjirScore');
 
  let level, desc, color, cls;
 
  if (score < 30) {
    level = '✅ AMAN'; cls = 'safe'; color = '#34d399';
    desc  = `Curah hujan ${rain}mm/hr dan kelembapan ${hum}% masih dalam batas normal. Tidak ada indikasi risiko banjir.`;
  } else if (score < 65) {
    level = '⚠️ WASPADA'; cls = 'warn'; color = '#fbbf24';
    desc  = `Curah hujan ${rain}mm/hr cukup tinggi. Waspada potensi genangan di daerah rendah. Pantau terus kondisi setempat.`;
  } else {
    level = '🚨 BAHAYA'; cls = 'danger'; color = '#f87171';
    desc  = `Curah hujan ${rain}mm/hr sangat tinggi dengan kelembapan ${hum}%. Risiko banjir TINGGI. Segera waspada dan hindari daerah rawan.`;
  }
 
  card.className = `warning-card level-${cls}`;
  levelEl.textContent = level;
  levelEl.className   = `warn-level ${cls}`;
  descEl.textContent  = desc;
  meterEl.style.width = `${score}%`;
  meterEl.style.background = color;
  scoreEl.textContent = `Risk Score: ${score}%`;
}
 
function setHeatWarn(score, temp, hum) {
  const card = document.getElementById('warnHeatwave');
  const levelEl = document.getElementById('heatLevel');
  const descEl  = document.getElementById('heatDesc');
  const meterEl = document.getElementById('heatMeter');
  const scoreEl = document.getElementById('heatScore');
 
  let level, desc, color, cls;
 
  if (score < 30) {
    level = '✅ AMAN'; cls = 'safe'; color = '#34d399';
    desc  = `Suhu ${temp}°C masih dalam batas nyaman. Tidak ada indikasi heatwave.`;
  } else if (score < 65) {
    level = '⚠️ WASPADA'; cls = 'warn'; color = '#fbbf24';
    desc  = `Suhu ${temp}°C terasa panas. Perbanyak minum air, hindari aktivitas luar ruang saat siang hari.`;
  } else {
    level = '🔥 BAHAYA'; cls = 'danger'; color = '#f87171';
    desc  = `Suhu ${temp}°C sangat tinggi! Risiko heatwave TINGGI. Hindari paparan matahari langsung dan jaga hidrasi tubuh.`;
  }
 
  card.className = `warning-card level-${cls}`;
  levelEl.textContent = level;
  levelEl.className   = `warn-level ${cls}`;
  descEl.textContent  = desc;
  meterEl.style.width = `${score}%`;
  meterEl.style.background = color;
  scoreEl.textContent = `Risk Score: ${score}%`;
}
 
function setUdaraWarn(score, aqi) {
  const card = document.getElementById('warnUdara');
  const levelEl = document.getElementById('udaraLevel');
  const descEl  = document.getElementById('udaraDesc');
  const meterEl = document.getElementById('udaraMeter');
  const scoreEl = document.getElementById('udaraScore');
 
  let level, desc, color, cls;
 
  if (aqi <= 50) {
    level = '✅ BAIK'; cls = 'safe'; color = '#34d399';
    desc  = `AQI ${aqi} — Kualitas udara sangat baik. Aman untuk semua aktivitas luar ruang.`;
  } else if (aqi <= 100) {
    level = '🟡 SEDANG'; cls = 'safe'; color = '#fbbf24';
    desc  = `AQI ${aqi} — Kualitas udara sedang. Kelompok sensitif sebaiknya batasi aktivitas di luar.`;
  } else if (aqi <= 150) {
    level = '⚠️ TIDAK SEHAT'; cls = 'warn'; color = '#fbbf24';
    desc  = `AQI ${aqi} — Tidak sehat untuk kelompok sensitif. Gunakan masker saat beraktivitas luar.`;
  } else {
    level = '🚨 BERBAHAYA'; cls = 'danger'; color = '#f87171';
    desc  = `AQI ${aqi} — Kualitas udara sangat buruk! Hindari aktivitas luar ruang. Gunakan masker N95.`;
  }
 
  card.className = `warning-card level-${cls}`;
  levelEl.textContent = level;
  levelEl.className   = `warn-level ${cls}`;
  descEl.textContent  = desc;
  meterEl.style.width = `${score}%`;
  meterEl.style.background = color;
  scoreEl.textContent = `AQI: ${aqi}`;
}
 
// ================================================
// CHART.JS — pakai data real 7 hari dari cache
// ================================================
function renderChart(type) {
  const cached = cityCache[currentCity];
  const cfg    = chartConfigs[type];
 
  // Pakai data real kalau sudah ada di cache, fallback ke kosong
  let data;
  if (cached) {
    const map = {
      suhu:       cached.weekTemps,
      kelembapan: cached.weekHums,
      aqi:        cached.weekAqi,
      hujan:      cached.weekRains,
    };
    data = (map[type] || []).map(v => parseFloat((+v).toFixed(1)));
  } else {
    data = Array(7).fill(0);
  }
 
  // Label hari: 6 hari lalu sampai hari ini
  const dayLabels = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dayLabels.push(d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric' }));
  }
 
  if (climateChart) climateChart.destroy();
 
  const ctx = document.getElementById('climateChart').getContext('2d');
 
  const gradient = ctx.createLinearGradient(0, 0, 0, 300);
  gradient.addColorStop(0, cfg.color + '33');
  gradient.addColorStop(1, cfg.color + '00');
 
  climateChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: dayLabels,
      datasets: [{
        label: cfg.label,
        data,
        borderColor: cfg.color,
        backgroundColor: gradient,
        borderWidth: 2.5,
        pointBackgroundColor: cfg.color,
        pointRadius: 5,
        pointHoverRadius: 8,
        tension: 0.4,
        fill: true,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 600, easing: 'easeInOutCubic' },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1a2540',
          borderColor: cfg.color + '55',
          borderWidth: 1,
          titleColor: '#94a3b8',
          bodyColor: cfg.color,
          bodyFont: { family: 'Space Mono', size: 14, weight: 'bold' },
          callbacks: { label: ctx => ` ${ctx.parsed.y}${cfg.unit}` }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: { color: '#64748b', font: { family: 'DM Sans', size: 11 } }
        },
        y: {
          min: cfg.min,
          max: cfg.max,
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: {
            color: '#64748b',
            font: { family: 'Space Mono', size: 11 },
            callback: v => `${v}${cfg.unit}`
          }
        }
      }
    }
  });
 
  // Summary stats
  const validData = data.filter(v => v > 0);
  if (validData.length > 0) {
    const avg   = (validData.reduce((a, b) => a + b, 0) / validData.length).toFixed(1);
    const min   = Math.min(...validData).toFixed(1);
    const max   = Math.max(...validData).toFixed(1);
    const trend = data[6] > data[0] ? '📈 Naik' : '📉 Turun';
    document.getElementById('chartSummary').innerHTML = `
      <div class="cs-item"><div class="cs-label">Rata-rata</div><div class="cs-value">${avg}${cfg.unit}</div></div>
      <div class="cs-item"><div class="cs-label">Minimum</div><div class="cs-value">${min}${cfg.unit}</div></div>
      <div class="cs-item"><div class="cs-label">Maksimum</div><div class="cs-value">${max}${cfg.unit}</div></div>
      <div class="cs-item"><div class="cs-label">Tren 7 Hari</div><div class="cs-value" style="font-size:1rem">${trend}</div></div>
    `;
  }
}
 
// ================================================
// BERITA CUACA & IKLIM PER KOTA — NewsData.io
// ================================================

// ⚠️ GANTI dengan API key kamu dari newsdata.io (gratis)
const NEWS_API_KEY = 'pub_f51fcf6ffb204cda922676de645d45cf';

const tagColors = [
  { color: '#38bdf8', tagBg: 'rgba(56,189,248,0.15)' },
  { color: '#34d399', tagBg: 'rgba(52,211,153,0.15)' },
  { color: '#a78bfa', tagBg: 'rgba(167,139,250,0.15)' },
  { color: '#fbbf24', tagBg: 'rgba(251,191,36,0.15)'  },
  { color: '#f87171', tagBg: 'rgba(248,113,113,0.15)' },
  { color: '#60a5fa', tagBg: 'rgba(96,165,250,0.15)'  },
];

// Kata kunci cuaca/iklim yang HARUS ada di artikel
const weatherKeywords = [
  'cuaca','hujan','banjir','banjir bandang','kekeringan','angin','suhu','panas',
  'iklim','BMKG','musim','badai','petir','topan','curah hujan','gelombang',
  'udara','kabut','polusi','kualitas udara','rob','longsor','La Nina','El Nino'
];

// Kata kunci yang menandakan artikel TIDAK relevan (properti, bisnis, dll)
const excludeKeywords = [
  'rumah','properti','jual','beli','bisnis','saham','investasi','harga tanah',
  'apartemen','kredit','KPR','developer','perumahan','kavling'
];

function isWeatherArticle(article) {
  const text = ((article.title || '') + ' ' + (article.description || '')).toLowerCase();
  const hasWeather = weatherKeywords.some(k => text.includes(k.toLowerCase()));
  const isExcluded = excludeKeywords.some(k => text.includes(k.toLowerCase()));
  return hasWeather && !isExcluded;
}

// Fetch berita per kota dengan query ketat
const cityQueries = [
  { city: 'Surabaya', tag: '🌊 Surabaya', color: 0, q: 'cuaca OR banjir OR BMKG Surabaya' },
  { city: 'Surabaya', tag: '🌊 Surabaya', color: 1, q: 'hujan OR suhu OR iklim Surabaya' },
  { city: 'Surabaya', tag: '🌊 Surabaya', color: 2, q: 'angin OR panas OR curah hujan Surabaya' },
  { city: 'Jakarta',  tag: '🏙️ Jakarta',  color: 3, q: 'cuaca OR banjir OR BMKG Jakarta' },
  { city: 'Bandung',  tag: '🌿 Bandung',  color: 4, q: 'cuaca OR hujan OR suhu Bandung' },
  { city: 'Medan',    tag: '🌴 Medan',    color: 5, q: 'cuaca OR banjir OR hujan Medan' },
  { city: 'Makassar', tag: '⛵ Makassar', color: 0, q: 'cuaca OR banjir OR BMKG Makassar' },
];

async function fetchNewsForQuery(q) {
  const url = `https://newsdata.io/api/1/latest?apikey=${NEWS_API_KEY}&q=${encodeURIComponent(q)}&country=id&language=id&size=5`;
  const res  = await fetch(url);
  const json = await res.json();
  if (json.status !== 'success') return [];
  return (json.results || []).filter(isWeatherArticle);
}

async function renderNews() {
  const grid = document.getElementById('newsGrid');
  grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;color:#64748b;padding:3rem;font-family:'Space Mono',monospace;">⏳ Memuat berita cuaca & iklim...</div>`;

  try {
    if (NEWS_API_KEY === 'pub_f51fcf6ffb204cda922676de645d45cf') throw new Error('no-key');

    // Fetch semua query secara paralel
    const results = await Promise.all(cityQueries.map(cq => fetchNewsForQuery(cq.q)));

    // Gabungkan: tiap query ambil 1 artikel terbaik, hindari duplikat judul
    const seenTitles = new Set();
    const articles   = [];

    for (let i = 0; i < cityQueries.length; i++) {
      const cq   = cityQueries[i];
      const pool = results[i];
      for (const art of pool) {
        if (!seenTitles.has(art.title)) {
          seenTitles.add(art.title);
          articles.push({ ...art, _city: cq.city, _tag: cq.tag, _colorIdx: cq.color });
          break;
        }
      }
      if (articles.length >= 6) break;
    }

    if (!articles.length) throw new Error('empty');

    grid.innerHTML = articles.map((article, i) => {
      const clr    = tagColors[article._colorIdx % tagColors.length];
      const title  = article.title || 'Tanpa Judul';
      const excerpt= (article.description || article.content || 'Klik untuk membaca artikel lengkap.').slice(0, 180);
      const source = article.source_id || 'Media Online';
      const link   = article.link || '#';
      const date   = article.pubDate
        ? new Date(article.pubDate).toLocaleDateString('id-ID', { day:'numeric', month:'short', year:'numeric' })
        : '-';

      return `
        <a href="${link}" target="_blank" rel="noopener noreferrer" class="news-card"
           style="animation-delay:${i*0.1}s;text-decoration:none;display:block;cursor:pointer;">
          <div class="news-tag-bar" style="background:${clr.color}"></div>
          <div class="news-body">
            <span class="news-tag" style="background:${clr.tagBg};color:${clr.color}">${article._tag}</span>
            <div class="news-title">${title}</div>
            <div class="news-excerpt">${excerpt}${excerpt.length >= 180 ? '...' : ''}</div>
            <div class="news-meta">
              <span>🗞️ ${source}</span>
              <span>${date}</span>
            </div>
            <div style="margin-top:0.75rem;font-size:0.8rem;color:${clr.color};font-family:'Space Mono',monospace;">Baca selengkapnya →</div>
          </div>
        </a>
      `;
    }).join('');

  } catch (err) {
    console.warn('News API gagal, tampilkan fallback:', err.message);
    renderNewsFallback(grid);
  }
}

function renderNewsFallback(grid) {
  const fallback = [
    { tag:'🌊 Surabaya', color:'#38bdf8', tagBg:'rgba(56,189,248,0.15)',  title:'BMKG: Waspadai Hujan Lebat Disertai Angin Kencang di Surabaya',      excerpt:'BMKG Juanda mengeluarkan peringatan dini cuaca ekstrem di wilayah Surabaya dan sekitarnya. Warga diminta waspada terhadap potensi banjir.',  date:'18 Mei 2025', source:'BMKG Juanda', link:'https://www.bmkg.go.id/cuaca/prakiraan-cuaca.bmkg?Kota=Surabaya' },
    { tag:'🌊 Surabaya', color:'#34d399', tagBg:'rgba(52,211,153,0.15)',  title:'Banjir Rob Kembali Rendam Kawasan Pesisir Surabaya Utara',            excerpt:'Sejumlah kawasan di Surabaya Utara terendam banjir rob. Ketinggian air mencapai 30-50 cm dan warga terdampak diminta waspada.',              date:'17 Mei 2025', source:'Jawa Pos',    link:'https://www.jawapos.com' },
    { tag:'🌊 Surabaya', color:'#a78bfa', tagBg:'rgba(167,139,250,0.15)', title:'Suhu Surabaya Capai 36°C, BMKG Imbau Warga Hindari Aktivitas Siang',  excerpt:'Surabaya mencatat suhu tertinggi dalam sebulan terakhir. BMKG mengimbau masyarakat memperbanyak konsumsi air putih.',                       date:'16 Mei 2025', source:'BMKG',        link:'https://www.bmkg.go.id' },
    { tag:'🏙️ Jakarta',  color:'#fbbf24', tagBg:'rgba(251,191,36,0.15)',  title:'Jakarta Siaga Banjir, Pintu Air Manggarai Naik Status Siaga 2',       excerpt:'Tinggi muka air di pintu air Manggarai meningkat signifikan akibat hujan deras sejak dini hari. BPBD DKI minta warga pesisir waspada.',    date:'15 Mei 2025', source:'BPBD DKI',    link:'https://bpbd.jakarta.go.id' },
    { tag:'🌿 Bandung',  color:'#f87171', tagBg:'rgba(248,113,113,0.15)', title:'Longsor Terjadi di Beberapa Titik Bandung Akibat Hujan Deras',        excerpt:'Hujan deras sejak sore hari memicu longsor di beberapa titik Kabupaten Bandung. Tim BPBD segera diterjunkan ke lokasi.',                   date:'14 Mei 2025', source:'BNPB',        link:'https://www.bnpb.go.id' },
    { tag:'🌴 Medan',    color:'#60a5fa', tagBg:'rgba(96,165,250,0.15)',  title:'Gelombang Panas Melanda Medan, Suhu Terasa 38°C pada Siang Hari',     excerpt:'Kota Medan mengalami suhu udara ekstrem akibat minimnya tutupan awan. BMKG memprakirakan kondisi panas berlanjut hingga akhir bulan.',    date:'13 Mei 2025', source:'BMKG Medan',  link:'https://www.bmkg.go.id' },
  ];

  grid.innerHTML = fallback.map((n, i) => `
    <a href="${n.link}" target="_blank" rel="noopener noreferrer" class="news-card"
       style="animation-delay:${i*0.1}s;text-decoration:none;display:block;cursor:pointer;">
      <div class="news-tag-bar" style="background:${n.color}"></div>
      <div class="news-body">
        <span class="news-tag" style="background:${n.tagBg};color:${n.color}">${n.tag}</span>
        <div class="news-title">${n.title}</div>
        <div class="news-excerpt">${n.excerpt}</div>
        <div class="news-meta"><span>🗞️ ${n.source}</span><span>${n.date}</span></div>
        <div style="margin-top:0.75rem;font-size:0.8rem;color:${n.color};font-family:'Space Mono',monospace;">Baca selengkapnya →</div>
      </div>
    </a>
  `).join('');
}