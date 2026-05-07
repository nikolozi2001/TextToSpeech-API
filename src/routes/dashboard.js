const { Router } = require('express');
const redis = require('../redis');
const { getStats, countCacheKeys, clearCacheKeys } = require('../metrics');
const { rateLimit: rateLimitConfig } = require('../config');

const router = Router();
const sseClients = new Set();

async function buildStats() {
    const [stats, redisInfo, dbSize, cacheCount] = await Promise.all([
        getStats(),
        redis.info('memory'),
        redis.dbsize(),
        countCacheKeys(),
    ]);
    const memMatch = redisInfo.match(/used_memory_human:(\S+)/);
    return {
        uptime: Math.floor(process.uptime()),
        requests: {
            total:     stats.total,
            hits:      stats.hits,
            misses:    stats.misses,
            hitRate:   stats.hitRate,
            avgHitMs:  stats.avgHitMs,
            avgMissMs: stats.avgMissMs,
        },
        redis:  { status: 'ok', memory: memMatch ? memMatch[1] : 'N/A', keys: dbSize },
        cache:  { count: cacheCount },
        rateLimit: { windowSec: rateLimitConfig.windowMs / 1000, max: rateLimitConfig.max },
        errors:     stats.errors,
        recent:     stats.recent,
        topPhrases: stats.topPhrases,
        timeline:   stats.timeline,
    };
}

// SSE broadcast every 3s
setInterval(async () => {
    if (!sseClients.size) return;
    try {
        const data = 'data: ' + JSON.stringify(await buildStats()) + '\n\n';
        sseClients.forEach(res => res.write(data));
    } catch (_) {}
}, 3000);

router.get('/events', async (req, res) => {
    res.setHeader('Content-Type',  'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection',    'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    sseClients.add(res);

    const heartbeat = setInterval(() => res.write(':ping\n\n'), 25000);
    req.on('close', () => { clearInterval(heartbeat); sseClients.delete(res); });

    try {
        res.write('data: ' + JSON.stringify(await buildStats()) + '\n\n');
    } catch (_) {}
});

router.get('/stats', async (req, res) => {
    try { res.json(await buildStats()); }
    catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/cache/clear', async (req, res) => {
    try {
        const deleted = await clearCacheKeys();
        res.json({ deleted });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
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

// ─── CSS ─────────────────────────────────────────────────────────────────────

const STYLES = `
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'Segoe UI', system-ui, sans-serif; background: #0f172a; color: #e2e8f0; min-height: 100vh; }
header { background: #1e293b; border-bottom: 1px solid #334155; padding: 1rem 2rem; display: flex; align-items: center; justify-content: space-between; }
header h1 { font-size: 1.2rem; font-weight: 600; color: #f1f5f9; }
header h1 span { color: #3b82f6; }
.header-right { display: flex; align-items: center; gap: 0.75rem; font-size: 0.8rem; color: #64748b; }
main { padding: 2rem; max-width: 1400px; margin: 0 auto; display: flex; flex-direction: column; gap: 1.5rem; }
.grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; }
.grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; }
.grid-2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; }
.card { background: #1e293b; border: 1px solid #334155; border-radius: 0.75rem; padding: 1.25rem 1.5rem; }
.card-label { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 0.5rem; }
.card-label-lg { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 0.75rem; }
.card-value { font-size: 2rem; font-weight: 700; color: #f1f5f9; line-height: 1; }
.card-value-sm { font-size: 1.1rem; font-weight: 700; color: #f1f5f9; line-height: 1; padding-top: 0.4rem; }
.card-value-md { font-size: 1.5rem; font-weight: 700; color: #f1f5f9; line-height: 1; }
.card-sub { font-size: 0.8rem; color: #64748b; margin-top: 0.4rem; }
.card-value-green { color: #4ade80; }
.card-value-red   { color: #f87171; }
.card-value-blue  { color: #60a5fa; }
.hit-bar-wrap { margin-top: 0.75rem; background: #0f172a; border-radius: 999px; height: 6px; overflow: hidden; }
.hit-bar { height: 100%; width: 0%; border-radius: 999px; background: #22c55e; transition: width 0.4s ease; }
.badge { display: inline-block; padding: 0.15rem 0.5rem; border-radius: 999px; font-size: 0.7rem; font-weight: 600; }
.badge-green { background: #14532d; color: #4ade80; }
.badge-red   { background: #450a0a; color: #f87171; }
.badge-blue  { background: #1e3a5f; color: #60a5fa; }
.badge-amber { background: #451a03; color: #fbbf24; }
.status-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
.dot-green { background: #22c55e; box-shadow: 0 0 6px #22c55e; }
.dot-red   { background: #ef4444; box-shadow: 0 0 6px #ef4444; }
.dot-amber { background: #f59e0b; box-shadow: 0 0 6px #f59e0b; }
.info-row { display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0; border-bottom: 1px solid #0f172a; font-size: 0.85rem; }
.info-row:last-child { border-bottom: none; }
.info-key { color: #94a3b8; }
.info-val { color: #f1f5f9; font-weight: 500; }
table { width: 100%; border-collapse: collapse; font-size: 0.82rem; }
thead th { text-align: left; padding: 0.6rem 0.75rem; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; border-bottom: 1px solid #334155; }
tbody tr { border-bottom: 1px solid rgba(30,58,92,0.13); transition: background 0.15s; }
tbody tr:hover { background: rgba(255,255,255,0.03); }
tbody td { padding: 0.6rem 0.75rem; color: #cbd5e1; max-width: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.text-green { color: #4ade80; }
.text-red   { color: #f87171; }
.empty-row td { color: #64748b; text-align: center; padding: 1.5rem; }
.chart-wrap { position: relative; width: 100%; }
canvas { display: block; width: 100%; border-radius: 0.25rem; }
.btn { display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.5rem 1rem; border-radius: 0.5rem; border: none; font-size: 0.82rem; font-weight: 600; cursor: pointer; transition: opacity 0.15s; }
.btn:hover { opacity: 0.85; }
.btn-red { background: #7f1d1d; color: #fca5a5; }
.btn-blue { background: #1e3a5f; color: #93c5fd; }
.top-row { display: flex; justify-content: space-between; align-items: center; font-size: 0.82rem; padding: 0.45rem 0; border-bottom: 1px solid #0f172a; }
.top-row:last-child { border-bottom: none; }
.top-text { color: #cbd5e1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 75%; }
.top-bar-bg { background: #0f172a; border-radius: 999px; height: 4px; margin-top: 0.25rem; overflow: hidden; }
.top-bar { height: 100%; background: #3b82f6; border-radius: 999px; }
.donut-legend { display: flex; gap: 1.5rem; justify-content: center; margin-top: 0.75rem; font-size: 0.8rem; }
.legend-dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; margin-right: 4px; }
@media (max-width: 1100px) { .grid-4 { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 900px) { .grid-3 { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 600px) { .grid-4, .grid-3, .grid-2 { grid-template-columns: 1fr; } main { padding: 1rem; } }
`;

// ─── CLIENT JS ───────────────────────────────────────────────────────────────

const CLIENT_JS = `
var sseConnected = false;

function $(id) { return document.getElementById(id); }
function setText(id, v) { var el = $(id); if (el) el.textContent = v; }
function setHTML(id, v) { var el = $(id); if (el) el.innerHTML = v; }

// ── SSE ──────────────────────────────────────────────────────────────────────
function setupSSE() {
  var es = new EventSource('/dashboard/events');
  es.onopen = function() {
    sseConnected = true;
    setHTML('connDot', '<span class="status-dot dot-green"></span>');
    setText('connLabel', 'Live');
  };
  es.onmessage = function(e) { updateUI(JSON.parse(e.data)); };
  es.onerror = function() {
    sseConnected = false;
    setHTML('connDot', '<span class="status-dot dot-amber"></span>');
    setText('connLabel', 'Reconnecting...');
    es.close();
    setTimeout(setupSSE, 5000);
  };
}

// ── UI Update ─────────────────────────────────────────────────────────────────
function formatUptime(s) {
  var d = Math.floor(s/86400), h = Math.floor((s%86400)/3600),
      m = Math.floor((s%3600)/60), sec = s%60;
  if (d > 0) return d+'d '+h+'h '+m+'m';
  if (h > 0) return h+'h '+m+'m '+sec+'s';
  return m+'m '+sec+'s';
}
function formatTime(ts) { return new Date(ts).toLocaleTimeString('ka-GE'); }
function formatMs(ms) { return ms >= 1000 ? (ms/1000).toFixed(1)+'s' : ms+'ms'; }

function updateUI(d) {
  // Row 1
  setText('total',   d.requests.total.toLocaleString());
  setText('hitRate', d.requests.hitRate + '%');
  setText('hits',    d.requests.hits.toLocaleString());
  setText('misses',  d.requests.misses.toLocaleString());
  var bar = $('hitBar'); if (bar) bar.style.width = d.requests.hitRate + '%';
  setText('uptime',  formatUptime(d.uptime));
  var rDot = d.redis.status === 'ok'
    ? '<span class="status-dot dot-green"></span> OK'
    : '<span class="status-dot dot-red"></span> Error';
  setHTML('redisStatus', rDot);

  // Row 2
  setText('avgHit',    formatMs(d.requests.avgHitMs));
  setText('avgMiss',   formatMs(d.requests.avgMissMs));
  setText('errCount',  d.errors.total.toLocaleString());
  setText('cacheKeys', d.cache.count.toLocaleString());

  // Redis / RateLimit
  setHTML('rStatus', rDot);
  setText('rMemory', d.redis.memory);
  setText('rKeys',   d.redis.keys.toLocaleString());
  setText('rlWindow', d.rateLimit.windowSec + ' წმ');
  setText('rlMax',    d.rateLimit.max + ' req');

  // Charts
  drawTimeline(d.timeline);
  drawDonut(d.requests.hits, d.requests.misses);

  // Top phrases
  var tp = $('topPhrases');
  if (tp) {
    if (!d.topPhrases.length) {
      tp.innerHTML = '<div class="empty-row"><td>მონაცემები არ არის</td></div>';
    } else {
      var max = d.topPhrases[0].count;
      tp.innerHTML = d.topPhrases.map(function(p) {
        var pct = max > 0 ? Math.round(p.count / max * 100) : 0;
        return '<div class="top-row">' +
          '<div>' +
            '<div class="top-text" title="' + p.text + '">' + p.text + '</div>' +
            '<div class="top-bar-bg"><div class="top-bar" style="width:' + pct + '%"></div></div>' +
          '</div>' +
          '<span class="badge badge-blue">' + p.count.toLocaleString() + '</span>' +
          '</div>';
      }).join('');
    }
  }

  // Recent errors
  var errTbody = $('errTable');
  if (errTbody) {
    if (!d.errors.recent.length) {
      errTbody.innerHTML = '<tr class="empty-row"><td colspan="3">შეცდომები არ არის</td></tr>';
    } else {
      errTbody.innerHTML = d.errors.recent.map(function(e) {
        return '<tr>' +
          '<td><span class="badge badge-red">' + e.type + '</span></td>' +
          '<td>' + e.message + '</td>' +
          '<td>' + formatTime(e.ts) + '</td>' +
          '</tr>';
      }).join('');
    }
  }

  // Recent requests
  var tbody = $('recentTable');
  if (tbody) {
    if (!d.recent.length) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="5">მოთხოვნები არ არის</td></tr>';
    } else {
      tbody.innerHTML = d.recent.map(function(r) {
        var dClass = r.durationMs < 200 ? 'text-green' : r.durationMs > 5000 ? 'text-red' : '';
        return '<tr>' +
          '<td title="' + r.text + '">' + r.text + '</td>' +
          '<td><span class="badge badge-blue">' + r.lang.toUpperCase() + '</span></td>' +
          '<td><span class="badge ' + (r.cacheHit ? 'badge-green' : 'badge-red') + '">' + (r.cacheHit ? 'HIT' : 'MISS') + '</span></td>' +
          '<td class="' + dClass + '">' + formatMs(r.durationMs) + '</td>' +
          '<td>' + formatTime(r.ts) + '</td>' +
          '</tr>';
      }).join('');
    }
  }
}

// ── Charts ────────────────────────────────────────────────────────────────────
function drawTimeline(timeline) {
  var canvas = $('timelineChart');
  if (!canvas) return;
  canvas.width  = canvas.parentElement.clientWidth;
  canvas.height = 180;
  var ctx = canvas.getContext('2d');
  var W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  if (timeline.length < 2) {
    ctx.fillStyle = '#64748b';
    ctx.font = '13px Segoe UI';
    ctx.textAlign = 'center';
    ctx.fillText('მონაცემები გროვდება... (1 წთ)', W/2, H/2);
    return;
  }

  var deltas = [];
  for (var i = 1; i < timeline.length; i++) {
    deltas.push({
      ts:      timeline[i].ts,
      requests: Math.max(0, timeline[i].total - timeline[i-1].total),
      hits:     Math.max(0, timeline[i].hits  - timeline[i-1].hits),
    });
  }

  var pad = { t: 10, r: 10, b: 30, l: 35 };
  var cW = W - pad.l - pad.r;
  var cH = H - pad.t - pad.b;
  var maxVal = Math.max.apply(null, deltas.map(function(d) { return d.requests; })) || 1;

  // Grid
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 1;
  for (var g = 0; g <= 4; g++) {
    var gy = pad.t + cH * g / 4;
    ctx.beginPath(); ctx.moveTo(pad.l, gy); ctx.lineTo(pad.l + cW, gy); ctx.stroke();
    ctx.fillStyle = '#475569';
    ctx.font = '10px Segoe UI';
    ctx.textAlign = 'right';
    ctx.fillText(Math.round(maxVal * (4-g) / 4), pad.l - 4, gy + 3);
  }

  function px(i) { return pad.l + cW * i / (deltas.length - 1); }
  function py(v) { return pad.t + cH - cH * v / maxVal; }

  // Fill under requests line
  ctx.beginPath();
  deltas.forEach(function(d, i) { i === 0 ? ctx.moveTo(px(i), py(d.requests)) : ctx.lineTo(px(i), py(d.requests)); });
  ctx.lineTo(px(deltas.length-1), pad.t + cH);
  ctx.lineTo(pad.l, pad.t + cH);
  ctx.closePath();
  ctx.fillStyle = 'rgba(59,130,246,0.1)';
  ctx.fill();

  // Requests line (blue)
  ctx.beginPath();
  deltas.forEach(function(d, i) { i === 0 ? ctx.moveTo(px(i), py(d.requests)) : ctx.lineTo(px(i), py(d.requests)); });
  ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 2; ctx.stroke();

  // Hits line (green)
  ctx.beginPath();
  deltas.forEach(function(d, i) { i === 0 ? ctx.moveTo(px(i), py(d.hits)) : ctx.lineTo(px(i), py(d.hits)); });
  ctx.strokeStyle = '#22c55e'; ctx.lineWidth = 2; ctx.stroke();

  // X labels
  ctx.fillStyle = '#475569'; ctx.font = '10px Segoe UI'; ctx.textAlign = 'center';
  var step = Math.max(1, Math.floor(deltas.length / 5));
  deltas.forEach(function(d, i) {
    if (i % step === 0) {
      var t = new Date(d.ts);
      ctx.fillText(t.getHours()+':'+(t.getMinutes()<10?'0':'')+t.getMinutes(), px(i), H - 8);
    }
  });
}

function drawDonut(hits, misses) {
  var canvas = $('donutChart');
  if (!canvas) return;
  var size = Math.min(canvas.parentElement.clientWidth, 180);
  canvas.width = size; canvas.height = size;
  var ctx = canvas.getContext('2d');
  var cx = size/2, cy = size/2, r = size/2 - 8, inner = r * 0.58;
  ctx.clearRect(0, 0, size, size);

  var total = hits + misses;
  if (total === 0) {
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2);
    ctx.fillStyle = '#334155'; ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy, inner, 0, Math.PI*2);
    ctx.fillStyle = '#1e293b'; ctx.fill();
    return;
  }

  var hitAngle = (hits / total) * Math.PI * 2;
  var start = -Math.PI / 2;

  ctx.beginPath(); ctx.moveTo(cx, cy);
  ctx.arc(cx, cy, r, start, start + hitAngle);
  ctx.closePath(); ctx.fillStyle = '#22c55e'; ctx.fill();

  ctx.beginPath(); ctx.moveTo(cx, cy);
  ctx.arc(cx, cy, r, start + hitAngle, start + Math.PI*2);
  ctx.closePath(); ctx.fillStyle = '#ef4444'; ctx.fill();

  ctx.beginPath(); ctx.arc(cx, cy, inner, 0, Math.PI*2);
  ctx.fillStyle = '#1e293b'; ctx.fill();

  ctx.fillStyle = '#f1f5f9'; ctx.font = 'bold 15px Segoe UI';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(Math.round(hits/total*100)+'%', cx, cy);
}

// ── Cache clear ───────────────────────────────────────────────────────────────
var clearBtn = $('clearCacheBtn');
if (clearBtn) {
  clearBtn.addEventListener('click', function() {
    if (!confirm('ყველა cached audio წაიშლება. გააგრძელებ?')) return;
    clearBtn.disabled = true;
    fetch('/dashboard/cache/clear', { method: 'POST' })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        alert(data.deleted + ' ფაილი წაიშალა cache-იდან');
        clearBtn.disabled = false;
      })
      .catch(function() { clearBtn.disabled = false; });
  });
}

setupSSE();
`;

// ─── HTML ─────────────────────────────────────────────────────────────────────

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
  <div class="header-right">
    <span id="connDot"><span class="status-dot dot-amber"></span></span>
    <span id="connLabel">Connecting...</span>
  </div>
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

  <div class="grid-4">
    <div class="card">
      <div class="card-label">საშ. HIT დრო</div>
      <div class="card-value-md card-value-green" id="avgHit">—</div>
    </div>
    <div class="card">
      <div class="card-label">საშ. MISS დრო</div>
      <div class="card-value-md card-value-blue" id="avgMiss">—</div>
    </div>
    <div class="card">
      <div class="card-label">შეცდომები</div>
      <div class="card-value-md card-value-red" id="errCount">—</div>
    </div>
    <div class="card">
      <div class="card-label">Cached Files</div>
      <div class="card-value-md" id="cacheKeys">—</div>
    </div>
  </div>

  <div class="grid-2">
    <div class="card">
      <div class="card-label-lg">მოთხოვნები დროის მიხედვით</div>
      <div class="chart-wrap">
        <canvas id="timelineChart"></canvas>
      </div>
      <div class="donut-legend">
        <span><span class="legend-dot" style="background:#3b82f6"></span>სულ</span>
        <span><span class="legend-dot" style="background:#22c55e"></span>HIT</span>
      </div>
    </div>
    <div class="card">
      <div class="card-label-lg">HIT / MISS</div>
      <div style="display:flex;justify-content:center;padding:0.5rem 0">
        <canvas id="donutChart" width="160" height="160"></canvas>
      </div>
      <div class="donut-legend">
        <span><span class="legend-dot" style="background:#22c55e"></span>HIT</span>
        <span><span class="legend-dot" style="background:#ef4444"></span>MISS</span>
      </div>
    </div>
  </div>

  <div class="grid-3">
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
    <div class="card">
      <div class="card-label-lg">Cache მართვა</div>
      <div class="info-row"><span class="info-key">Cached Files</span><span class="info-val" id="cacheKeys2">—</span></div>
      <div class="info-row"><span class="info-key">Prefix</span><span class="info-val">tts:</span></div>
      <div class="info-row">
        <button class="btn btn-red" id="clearCacheBtn">Cache გასუფთავება</button>
      </div>
    </div>
  </div>

  <div class="grid-2">
    <div class="card">
      <div class="card-label-lg">ყველაზე ხშირი ფრაზები</div>
      <div id="topPhrases"><div class="empty-row">ჩატვირთვა...</div></div>
    </div>
    <div class="card">
      <div class="card-label-lg">ბოლო შეცდომები</div>
      <table>
        <thead><tr><th>ტიპი</th><th>შეტყობინება</th><th>დრო</th></tr></thead>
        <tbody id="errTable"><tr class="empty-row"><td colspan="3">შეცდომები არ არის</td></tr></tbody>
      </table>
    </div>
  </div>

  <div class="card">
    <div class="card-label-lg">ბოლო მოთხოვნები</div>
    <table>
      <thead><tr><th>ტექსტი</th><th>ენა</th><th>Cache</th><th>დრო</th><th>საათი</th></tr></thead>
      <tbody id="recentTable"><tr class="empty-row"><td colspan="5">ჩატვირთვა...</td></tr></tbody>
    </table>
  </div>

</main>
<script src="/dashboard/client.js"></script>
</body>
</html>`;

module.exports = router;
