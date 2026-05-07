const { Router } = require('express');
const redis = require('../redis');
const { getStats } = require('../metrics');
const { rateLimit: rateLimitConfig } = require('../config');

const router = Router();

router.get('/stats', async (req, res) => {
    const [stats, redisInfo, keyCount] = await Promise.all([
        getStats(),
        redis.info('memory'),
        redis.dbsize(),
    ]);

    const memMatch = redisInfo.match(/used_memory_human:(\S+)/);

    res.json({
        uptime: Math.floor(process.uptime()),
        requests: {
            total:   stats.total,
            hits:    stats.hits,
            misses:  stats.misses,
            hitRate: stats.total > 0 ? Math.round((stats.hits / stats.total) * 100) : 0,
        },
        redis: {
            status: 'ok',
            memory: memMatch ? memMatch[1] : 'N/A',
            keys:   keyCount,
        },
        rateLimit: {
            windowSec: rateLimitConfig.windowMs / 1000,
            max:       rateLimitConfig.max,
        },
        recent: stats.recent,
    });
});

router.get('/styles.css', (req, res) => {
    res.setHeader('Content-Type', 'text/css; charset=utf-8');
    res.send(STYLES);
});

router.get('/client.js', (req, res) => {
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.send(CLIENT_JS);
});

router.get('/', (req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(DASHBOARD_HTML);
});

const STYLES = `
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'Segoe UI', system-ui, sans-serif; background: #0f172a; color: #e2e8f0; min-height: 100vh; }
header { background: #1e293b; border-bottom: 1px solid #334155; padding: 1rem 2rem; display: flex; align-items: center; justify-content: space-between; }
header h1 { font-size: 1.2rem; font-weight: 600; color: #f1f5f9; }
header h1 span { color: #3b82f6; }
.refresh-info { font-size: 0.8rem; color: #64748b; }
main { padding: 2rem; max-width: 1400px; margin: 0 auto; display: flex; flex-direction: column; gap: 1.5rem; }
.grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; }
.grid-2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; }
.card { background: #1e293b; border: 1px solid #334155; border-radius: 0.75rem; padding: 1.25rem 1.5rem; }
.card-label { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 0.5rem; }
.card-label-lg { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 0.75rem; }
.card-value { font-size: 2rem; font-weight: 700; color: #f1f5f9; line-height: 1; }
.card-value-sm { font-size: 1.1rem; font-weight: 700; color: #f1f5f9; line-height: 1; padding-top: 0.4rem; }
.card-sub { font-size: 0.8rem; color: #64748b; margin-top: 0.4rem; }
.hit-bar-wrap { margin-top: 0.75rem; background: #0f172a; border-radius: 999px; height: 6px; overflow: hidden; }
.hit-bar { height: 100%; width: 0%; border-radius: 999px; background: #22c55e; transition: width 0.4s ease; }
.badge { display: inline-block; padding: 0.15rem 0.5rem; border-radius: 999px; font-size: 0.7rem; font-weight: 600; }
.badge-green { background: #14532d; color: #4ade80; }
.badge-red   { background: #450a0a; color: #f87171; }
.badge-blue  { background: #1e3a5f; color: #60a5fa; }
.status-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; margin-right: 6px; }
.dot-green { background: #22c55e; box-shadow: 0 0 6px #22c55e; }
.dot-red   { background: #ef4444; box-shadow: 0 0 6px #ef4444; }
.info-row { display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0; border-bottom: 1px solid #0f172a; font-size: 0.85rem; }
.info-row:last-child { border-bottom: none; }
.info-key { color: #94a3b8; }
.info-val { color: #f1f5f9; font-weight: 500; }
table { width: 100%; border-collapse: collapse; font-size: 0.82rem; }
thead th { text-align: left; padding: 0.6rem 0.75rem; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; border-bottom: 1px solid #334155; }
tbody tr { border-bottom: 1px solid rgba(30,58,92,0.13); transition: background 0.15s; }
tbody tr:hover { background: rgba(255,255,255,0.03); }
tbody td { padding: 0.6rem 0.75rem; color: #cbd5e1; max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.text-green { color: #4ade80; }
.text-red   { color: #f87171; }
.empty-row td { color: #64748b; text-align: center; padding: 1rem; }
@media (max-width: 900px) { .grid-4 { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 600px) { .grid-4, .grid-2 { grid-template-columns: 1fr; } main { padding: 1rem; } }
`;

const CLIENT_JS = `
function formatUptime(s) {
  var d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600),
      m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (d > 0) return d + 'd ' + h + 'h ' + m + 'm';
  if (h > 0) return h + 'h ' + m + 'm ' + sec + 's';
  return m + 'm ' + sec + 's';
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString('ka-GE');
}

function set(id, val) {
  var el = document.getElementById(id);
  if (el) el.textContent = val;
}

function setHTML(id, val) {
  var el = document.getElementById(id);
  if (el) el.innerHTML = val;
}

function load() {
  fetch('/dashboard/stats')
    .then(function(r) { return r.json(); })
    .then(function(d) {
      set('total', d.requests.total.toLocaleString());
      set('hitRate', d.requests.hitRate + '%');
      set('hits', d.requests.hits.toLocaleString());
      set('misses', d.requests.misses.toLocaleString());
      var bar = document.getElementById('hitBar');
      if (bar) bar.style.width = d.requests.hitRate + '%';
      set('uptime', formatUptime(d.uptime));

      var dot = d.redis.status === 'ok'
        ? '<span class="status-dot dot-green"></span>OK'
        : '<span class="status-dot dot-red"></span>Error';
      setHTML('redisStatus', dot);
      setHTML('rStatus', dot);
      set('rMemory', d.redis.memory);
      set('rKeys', d.redis.keys.toLocaleString());
      set('rlWindow', d.rateLimit.windowSec + ' წმ');
      set('rlMax', d.rateLimit.max + ' req');

      var tbody = document.getElementById('recentTable');
      if (!tbody) return;
      if (!d.recent.length) {
        tbody.innerHTML = '<tr class="empty-row"><td colspan="5">მოთხოვნები არ არის</td></tr>';
      } else {
        tbody.innerHTML = d.recent.map(function(r) {
          var dClass = r.durationMs < 200 ? 'text-green' : r.durationMs > 5000 ? 'text-red' : '';
          var cClass = r.cacheHit ? 'badge-green' : 'badge-red';
          var cLabel = r.cacheHit ? 'HIT' : 'MISS';
          return '<tr>' +
            '<td title="' + r.text + '">' + r.text + '</td>' +
            '<td><span class="badge badge-blue">' + r.lang.toUpperCase() + '</span></td>' +
            '<td><span class="badge ' + cClass + '">' + cLabel + '</span></td>' +
            '<td class="' + dClass + '">' + r.durationMs + 'ms</td>' +
            '<td>' + formatTime(r.ts) + '</td>' +
            '</tr>';
        }).join('');
      }
    })
    .catch(function(e) { console.error('Dashboard error:', e); });
}

load();
var countdown = 5;
setInterval(function() {
  countdown--;
  set('countdown', countdown);
  if (countdown <= 0) { countdown = 5; load(); }
}, 1000);
`;

const DASHBOARD_HTML = `<!DOCTYPE html>
<html lang="ka">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>TTS API Dashboard</title>
<link rel="stylesheet" href="/dashboard/styles.css">
</head>
<body>
<header>
  <h1>TTS API <span>Dashboard</span></h1>
  <span class="refresh-info">განახლება <span id="countdown">5</span>წმ-ში</span>
</header>
<main>
  <div class="grid-4">
    <div class="card">
      <div class="card-label">სულ მოთხოვნები</div>
      <div class="card-value" id="total">—</div>
    </div>
    <div class="card">
      <div class="card-label">Cache Hit Rate</div>
      <div class="card-value" id="hitRate">—</div>
      <div class="hit-bar-wrap"><div class="hit-bar" id="hitBar"></div></div>
      <div class="card-sub"><span id="hits">0</span> HIT / <span id="misses">0</span> MISS</div>
    </div>
    <div class="card">
      <div class="card-label">Uptime</div>
      <div class="card-value" id="uptime">—</div>
    </div>
    <div class="card">
      <div class="card-label">Redis</div>
      <div class="card-value-sm" id="redisStatus">—</div>
    </div>
  </div>

  <div class="grid-2">
    <div class="card">
      <div class="card-label-lg">Redis ინფო</div>
      <div class="info-row"><span class="info-key">სტატუსი</span><span class="info-val" id="rStatus">—</span></div>
      <div class="info-row"><span class="info-key">მეხსიერება</span><span class="info-val" id="rMemory">—</span></div>
      <div class="info-row"><span class="info-key">სულ Key-ები</span><span class="info-val" id="rKeys">—</span></div>
    </div>
    <div class="card">
      <div class="card-label-lg">Rate Limit</div>
      <div class="info-row"><span class="info-key">ფანჯარა</span><span class="info-val" id="rlWindow">—</span></div>
      <div class="info-row"><span class="info-key">მაქს. მოთხოვნა</span><span class="info-val" id="rlMax">—</span></div>
      <div class="info-row"><span class="info-key">IP-ზე</span><span class="info-val">დამოუკიდებელი</span></div>
    </div>
  </div>

  <div class="card">
    <div class="card-label-lg">ბოლო მოთხოვნები</div>
    <table>
      <thead>
        <tr><th>ტექსტი</th><th>ენა</th><th>Cache</th><th>დრო</th><th>თარიღი</th></tr>
      </thead>
      <tbody id="recentTable">
        <tr class="empty-row"><td colspan="5">ჩატვირთვა...</td></tr>
      </tbody>
    </table>
  </div>
</main>
<script src="/dashboard/client.js"></script>
</body>
</html>`;

module.exports = router;
