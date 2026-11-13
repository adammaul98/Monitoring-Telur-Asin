(function () {
  'use strict';

  /* =====================================================================
     KONFIGURASI
     ===================================================================== */
  var CFG = {
    host: 'v28c2407.ala.asia-southeast1.emqxsl.com', port: 8084,   // WebSocket TLS
    user: 'Telur-asin', pass: 'TELURASIN12345',
    sub: 'telur/slave/+',               // data slave 1, 2, led, time, status, siklus
    cmd: 'telur/control/heater',        // perintah ON / OFF ke ESP32
    cycleDays: 7,                       // lama siklus (hari), bisa diubah dengan mengetuk "Lama siklus"
    alertDay: 7,                        // hari munculnya peringatan (sama seperti program sebelumnya)
    levelLow: 20,                       // peringatan air rendah jika di bawah angka ini (%)
    levelReset: 25,                     // peringatan bisa muncul lagi setelah level naik di atas angka ini (%)
    garamMax: 30,                       // nilai garam yang dianggap indikator penuh (sesuaikan satuan sensor)
    staleSec: 120,                      // slave dianggap "Terlambat" jika tidak ada data selama ini (detik)
    // 3 sesi penyimpanan data per hari. Data pertama yang masuk di tiap sesi akan disimpan.
    sesi: [{ name: 'Pagi', from: 6 }, { name: 'Siang', from: 12 }, { name: 'Malam', from: 18 }],
    suhu: { dingin: 20, hangat: 32, panas: 40 },    // batas status suhu air (°C)
    lembab: { kering: 40, basah: 80 }               // batas status kelembaban (%)
  };

  /* Pencocokan nama data dari ESP32 ke indikator (lewat kata kunci).
     - Kata "dalam / in / kotak / box"  -> kelembaban DALAM kotak
     - Kata "luar / out / ruang / room" -> kelembaban LUAR kotak
     - Tanpa keterangan: kelembaban dari Slave 1 = dalam kotak, dari Slave 2 = luar kotak
     - "suhu" dari Slave 1 = suhu air, dari Slave 2 = suhu ruang
     Kalau slave hanya mengirim angka tanpa nama, dipakai urutan ORDER. */
  var RE = {
    hum: /lembab|hum|\brh/i, temp: /suhu|temp/i, garam: /garam|salin|salt|tds|kadar/i,
    level: /tinggi|level|jarak|volume|water/i, lampu: /heater|pemanas|relay|lampu|led/i,
    dalam: /dalam|inside|kotak|box|in$|_in\b|\bin\b/i, luar: /luar|outside|ruang|room|out$|_out\b|\bout\b/i,
    airW: /air|water|brine|larutan/i, udara: /ruang|room|udara|ambient|luar|env/i
  };
  var SPECIFIC = [
    ['humIn', function (k) { return RE.hum.test(k) && RE.dalam.test(k); }],
    ['humOut', function (k) { return RE.hum.test(k) && RE.luar.test(k); }],
    ['suhuAir', function (k) { return RE.temp.test(k) && RE.airW.test(k); }],
    ['suhuRuang', function (k) { return RE.temp.test(k) && RE.udara.test(k); }]
  ];
  var GENERIC = {
    1: [['garam', RE.garam], ['level', RE.level], ['suhuAir', RE.temp], ['humIn', RE.hum], ['humOut', RE.hum], ['heater', RE.lampu]],
    2: [['garam', RE.garam], ['level', RE.level], ['suhuRuang', RE.temp], ['humOut', RE.hum], ['humIn', RE.hum], ['heater', RE.lampu], ['suhuAir', RE.temp]]
  };
  var ORDER = { 1: ['garam', 'suhuAir', 'level', 'humIn'], 2: ['suhuRuang', 'humOut', 'heater', 'humIn'] };

  var META = {
    garam:     { label: 'Kepekatan Garam',        unit: '',   color: '#f472b6', icon: 'salt' },
    suhuAir:   { label: 'Suhu Air',               unit: '°C', color: '#f59e0b', icon: 'temp' },
    level:     { label: 'Ketinggian Air',         unit: '%',  color: '#60a5fa', icon: 'wave' },
    humIn:     { label: 'Kelembaban Dalam Kotak', unit: '%',  color: '#22d3ee', icon: 'drop' },
    humOut:    { label: 'Kelembaban Luar Kotak',  unit: '%',  color: '#a78bfa', icon: 'cloud' },
    suhuRuang: { label: 'Suhu Ruang',             unit: '°C', color: '#34d399', icon: 'temp' },
    heater:    { label: 'Lampu',                  unit: '',   color: '#fbbf24', icon: 'bulb' }
  };
  var FIELDS = ['garam', 'suhuAir', 'level', 'humIn', 'humOut', 'suhuRuang'];

  /* Isi halaman "Perangkat". Ubah teks di sini sesuai alat yang dipakai. */
  var DEVICES = [
    { n: 1, color: 'cyan', name: 'Slave 1', role: 'Unit Kotak Pengasinan',
      place: 'Dipasang di dalam / pada kotak rendaman telur. Membaca kondisi larutan garam.',
      items: [
        { id: 'garam', alat: 'Sensor kepekatan garam (TDS / salinitas)', fungsi: 'Mengukur kadar garam larutan rendaman telur.' },
        { id: 'suhuAir', alat: 'Sensor suhu air (probe tahan air)', fungsi: 'Mengukur suhu larutan garam di dalam kotak.' },
        { id: 'level', alat: 'Sensor ketinggian air (water level)', fungsi: 'Memantau tinggi larutan agar telur tetap terendam.' },
        { id: 'humIn', alat: 'Sensor kelembaban dalam kotak', fungsi: 'Mengukur kelembaban udara di dalam kotak.' }
      ] },
    { n: 2, color: 'emerald', name: 'Slave 2', role: 'Unit Lingkungan & Lampu',
      place: 'Dipasang di luar kotak. Membaca kondisi ruangan dan mengendalikan lampu.',
      items: [
        { id: 'suhuRuang', alat: 'Sensor suhu ruang', fungsi: 'Mengukur suhu udara di sekitar kotak.' },
        { id: 'humOut', alat: 'Sensor kelembaban luar kotak', fungsi: 'Mengukur kelembaban udara ruangan.' },
        { id: 'heater', alat: 'Lampu (relay)', fungsi: 'Dinyalakan / dimatikan dari dashboard lewat topik telur/control/heater.' }
      ] }
  ];

  var GROUPS = [
    { id: 'suhu', label: 'Suhu', fields: ['suhuAir', 'suhuRuang'], unit: '°C' },
    { id: 'lembab', label: 'Kelembaban', fields: ['humIn', 'humOut'], unit: '%', min: 0, max: 100 },
    { id: 'level', label: 'Ketinggian Air', fields: ['level'], unit: '%', min: 0, max: 100 },
    { id: 'garam', label: 'Kepekatan Garam', fields: ['garam'], unit: '' }
  ];

  var ICON = {
    salt: '<svg viewBox="0 0 24 24"><path d="M8 3h8l1 5H7zM7 8h10l-1 13H8z"/><path d="M10 12h.01M14 12h.01M12 15h.01"/></svg>',
    temp: '<svg viewBox="0 0 24 24"><path d="M14 14.8V3.5a2.5 2.5 0 0 0-5 0v11.3a4.5 4.5 0 1 0 5 0z"/></svg>',
    wave: '<svg viewBox="0 0 24 24"><path d="M2 12c2-2 4-2 6 0s4 2 6 0 4-2 6 0M2 17c2-2 4-2 6 0s4 2 6 0 4-2 6 0M12 3v5"/></svg>',
    drop: '<svg viewBox="0 0 24 24"><path d="M12 2.7l5.7 5.7a8 8 0 1 1-11.4 0z"/></svg>',
    cloud: '<svg viewBox="0 0 24 24"><path d="M17.5 19a4.5 4.5 0 1 0-1.4-8.8A6 6 0 1 0 6 16.5"/><path d="M8 19v2M12 18v3M16 20v1"/></svg>',
    bulb: '<svg viewBox="0 0 24 24"><path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1V17h6v-.2c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2z"/></svg>'
  };

  /* =====================================================================
     UTILITAS
     ===================================================================== */
  function $(id) { return document.getElementById(id); }
  function pad(n) { return String(n).padStart(2, '0'); }
  function hhmmss(d) { d = d || new Date(); return pad(d.getHours()) + '.' + pad(d.getMinutes()) + '.' + pad(d.getSeconds()); }
  function hhmm(d) { return pad(d.getHours()) + '.' + pad(d.getMinutes()); }
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function load(k, def) { try { var v = localStorage.getItem(k); return v === null ? def : JSON.parse(v); } catch (e) { return def; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function fmtNum(n, d) { return n === null || n === undefined || isNaN(n) ? '' : (Math.round(n * Math.pow(10, d || 1)) / Math.pow(10, d || 1)); }
  function ago(t) {
    var s = Math.round((Date.now() - t) / 1000);
    if (s < 5) return 'baru saja';
    if (s < 60) return s + ' dtk lalu';
    if (s < 3600) return Math.floor(s / 60) + ' mnt lalu';
    return hhmm(new Date(t));
  }
  function tag(el, cls, text) { if (!el) return; el.className = 'tag ' + cls; el.textContent = text; }
  var toastT;
  function toast(msg) {
    var el = $('toast'); el.textContent = msg; el.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(function () { el.classList.remove('show'); }, 2600);
  }

  /* ============ PARSER TEKS ESP32 (sama seperti sebelumnya) ============ */
  function parsePairs(raw) {
    var out = []; raw = raw.trim();
    if (raw.charAt(0) === '{') {
      try { var o = JSON.parse(raw); Object.keys(o).forEach(function (k) { out.push([k, String(o[k])]); }); return out; } catch (e) {}
    }
    raw.split(/[,;|\n\r]+/).forEach(function (tok) {
      tok = tok.trim(); if (!tok) return;
      var multi = tok.match(/[A-Za-z_][\w.]*\s*(?:->|[:=])\s*-?\d/g);
      if (multi && multi.length > 1) {
        var re = /([A-Za-z_][\w.]*)\s*(?:->|[:=])\s*(-?\d+(?:[.,]\d+)?[^\s]*)/g, m;
        while ((m = re.exec(tok))) out.push([m[1], m[2]]);
        return;
      }
      var p = tok.match(/^(.+?)\s*(?:->|[:=])\s*(.+)$/);
      if (p) out.push([p[1].trim(), p[2].trim()]); else out.push(['Data ' + (out.length + 1), tok]);
    });
    return out;
  }
  function splitVal(v) {
    var m = v.match(/^(-?\d+(?:[.,]\d+)?)\s*(.*)$/);
    return m ? { num: m[1], unit: m[2].replace(/^C$/i, '°C'), n: parseFloat(m[1].replace(',', '.')) } : { num: v, unit: '', n: NaN };
  }
  function isOn(t) { return /NYALA|^\s*(on|1|true|high)\s*$/i.test(t); }

  /* =====================================================================
     STATE
     ===================================================================== */
  var S = {
    vals: {}, heater: null, heaterKey: '', pending: 0,
    mqtt: false, connecting: true, esp: null, msgCount: 0, lastMsg: 0, lastTopic: '',
    slave: { 1: { t: 0, ok: null, raw: '—', extra: {} }, 2: { t: 0, ok: null, raw: '—', extra: {} } },
    espOffset: null, espDay: null, day: 1, totalDays: CFG.cycleDays
  };
  try { var sd = parseInt(localStorage.getItem('cycleDays'), 10); if (sd >= 1) S.totalDays = sd; } catch (e) {}
  var client = null;

  function num(id) { var v = S.vals[id]; return v && !isNaN(v.n) ? v.n : null; }
  function txt(id) { var v = S.vals[id]; return v ? v.num + (v.unit ? ' ' + v.unit : '') : '—'; }
  function levelPct() {
    var L = S.vals.level; if (!L || isNaN(L.n)) return null;
    return L.unit === '%' ? clamp(L.n, 0, 100) : null;
  }
  function estLevel() {   // estimasi tinggi air dari hari berjalan (dipakai sebelum ada data sensor)
    var p = clamp((S.day - 1) / Math.max(S.totalDays, 1), 0, 1);
    return Math.round(100 - p * 45);
  }

  /* =====================================================================
     ELEMEN ANIMASI (dibuat sekali)
     ===================================================================== */
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function buildScene() {
    var eggs = $('eggs'), rows = [['back', 4], ['front', 5]];
    rows.forEach(function (r) {
      var row = document.createElement('div'); row.className = 'egg-row ' + r[0];
      for (var i = 0; i < r[1]; i++) {
        var e = document.createElement('div'); e.className = 'egg';
        e.style.setProperty('--r', rnd(-14, 14).toFixed(1) + 'deg');
        e.style.setProperty('--dl', rnd(0, 3).toFixed(2) + 's');
        e.style.setProperty('--bob', rnd(3.5, 5.5).toFixed(2) + 's');
        row.appendChild(e);
      }
      eggs.appendChild(row);
    });
    var b = $('bubbles');
    for (var i = 0; i < 16; i++) {
      var s = document.createElement('span'), z = rnd(3, 8);
      s.className = 'bubble';
      s.style.cssText = 'left:' + rnd(4, 84) + '%;width:' + z + 'px;height:' + z + 'px;--f:' + rnd(.7, 1.4).toFixed(2) + ';--dl:' + rnd(0, 6).toFixed(2) + 's';
      b.appendChild(s);
    }
    var salt = $('salt');
    for (i = 0; i < 30; i++) {
      var k = document.createElement('span'); k.className = 'speck';
      k.style.cssText = 'left:' + rnd(2, 88) + '%;top:' + rnd(5, 95) + '%;--d:' + rnd(6, 12).toFixed(1) + 's;--dl:' + rnd(-8, 0).toFixed(1) + 's;opacity:' + rnd(.4, 1).toFixed(2);
      salt.appendChild(k);
    }
    var drops = $('drops');
    for (i = 0; i < 20; i++) {
      var d = document.createElement('span'), dz = rnd(.7, 1.4);
      d.className = 'droplet';
      d.style.cssText = 'left:' + rnd(3, 92) + '%;top:' + rnd(4, 70) + '%;transform:scale(' + dz.toFixed(2) + ');--d:' + rnd(7, 13).toFixed(1) + 's;--dl:' + rnd(-10, 0).toFixed(1) + 's';
      drops.appendChild(d);
    }
    var sh = $('shaker');
    for (i = 0; i < 10; i++) {
      var c = document.createElement('span'); c.className = 'crystal';
      c.style.cssText = 'left:' + rnd(12, 80) + '%;--d:' + rnd(1.8, 3).toFixed(2) + 's;--dl:' + rnd(0, 3).toFixed(2) + 's';
      sh.appendChild(c);
    }
  }

  /* =====================================================================
     RENDER
     ===================================================================== */
  function tempColor(t) {
    if (t === null) return '#64748b';
    var h = 205 - clamp((t - 15) / 30, 0, 1) * 200;
    return 'hsl(' + h.toFixed(0) + ',85%,55%)';
  }
  function tempStatus(t) {
    if (t === null) return ['idle', 'Menunggu'];
    if (t < CFG.suhu.dingin) return ['info', 'Dingin'];
    if (t < CFG.suhu.hangat) return ['ok', 'Normal'];
    if (t < CFG.suhu.panas) return ['warn', 'Hangat'];
    return ['bad', 'Panas'];
  }
  function humStatus(h) {
    if (h === null) return ['idle', 'Menunggu'];
    if (h < CFG.lembab.kering) return ['warn', 'Kering'];
    if (h <= CFG.lembab.basah) return ['ok', 'Normal'];
    return ['info', 'Lembab'];
  }
  function levelStatus(p) {
    if (p === null) return ['idle', 'Menunggu'];
    if (p < CFG.levelLow) return ['bad', 'Rendah'];
    if (p < 50) return ['warn', 'Waspada'];
    return ['ok', 'Aman'];
  }

  function renderPill() {
    var k, t, el = $('mqtt-pill');
    if (!S.mqtt) { k = S.connecting ? 'wait' : 'bad'; t = S.connecting ? 'Menghubungkan...' : 'Broker Terputus'; }
    else if (S.esp) { k = 'ok'; t = 'Terhubung'; }
    else { k = 'wait'; t = S.esp === false ? 'ESP32 Offline' : 'Menunggu ESP32'; }
    el.className = 'pill ' + k; $('mqtt-pill-text').textContent = t;
  }

  function renderTank() {
    var scene = $('scene'), tank = $('tank');
    var lp = levelPct(), est = lp === null, w = est ? estLevel() : lp;
    scene.style.setProperty('--lvl', w + '%');
    $('tank-level').textContent = Math.round(w) + '%';
    $('tank-level-note').textContent = est ? 'estimasi hari' : 'sensor';
    tank.classList.toggle('low', w < CFG.levelLow);

    var t = num('suhuAir');
    // air tetap biru; makin panas makin kuat semburat oranye
    scene.style.setProperty('--wh', t === null ? 200 : (205 - clamp((t - 15) / 20, 0, 1) * 25).toFixed(0));
    scene.style.setProperty('--warm', t === null ? 0 : clamp((t - 30) / 12, 0, .7).toFixed(2));
    scene.style.setProperty('--bd', (t === null ? 5 : 6.5 - clamp((t - 20) / 20, 0, 1) * 4.5).toFixed(2) + 's');
    var th = $('thermo');
    th.style.setProperty('--t', (t === null ? 0 : clamp(t / 50, 0, 1) * 100) + '%');
    th.style.setProperty('--tc', tempColor(t));
    $('tank-temp').textContent = t === null ? '—°C' : fmtNum(t) + '°C';

    var g = num('garam');
    $('salt').style.opacity = g === null ? .35 : clamp(g / CFG.garamMax, .05, 1).toFixed(2);

    var h = num('humIn');
    $('drops').style.opacity = h === null ? .2 : clamp((h - 30) / 70, .05, 1).toFixed(2);
    $('tank-hum').textContent = h === null ? '—' : Math.round(h) + '%';

    // warna telur makin gelap seiring hari (proses pengasinan)
    var p = clamp((S.day - 1) / Math.max(S.totalDays - 1, 1), 0, 1);
    var c0 = [233, 243, 239], c1 = [176, 205, 192];
    scene.style.setProperty('--egg', 'rgb(' + c0.map(function (v, i) { return Math.round(v + (c1[i] - v) * p); }).join(',') + ')');

    scene.classList.toggle('on', S.heater === true);

    $('st-garam').textContent = txt('garam');
    $('st-suhu').textContent = txt('suhuAir');
    $('st-level').textContent = S.vals.level ? txt('level') : '≈ ' + w + '%';
    $('st-lampu').textContent = S.heater === null ? '—' : S.heater ? 'MENYALA' : 'MATI';
  }

  function renderLevel() {
    var L = S.vals.level, p = levelPct(), st = levelStatus(p);
    tag($('lvl-status'), st[0], st[1]);
    var f = $('lvl-fill');
    f.style.height = (p === null ? 0 : p) + '%';
    f.className = 'lvl-fill' + (st[0] === 'bad' ? ' bad' : st[0] === 'warn' ? ' warn' : '');
    $('lvl-low-line').style.bottom = CFG.levelLow + '%';
    $('lvl-val').textContent = L ? L.num : '—';
    $('lvl-unit').textContent = L ? L.unit : '';
    $('lvl-key').textContent = L ? 'ESP32: ' + L.key : 'menunggu data';
    var base = load('telur-level-base', null), d = $('lvl-delta');
    if (p === null) { d.className = 'delta'; d.textContent = L ? 'Satuan bukan %, gauge tidak dihitung' : 'Menunggu data sensor'; }
    else if (base === null) { d.className = 'delta'; d.textContent = 'Titik awal siklus dicatat'; }
    else {
      var diff = Math.round((base - p) * 10) / 10;
      if (diff > 0) { d.className = 'delta down'; d.textContent = '▼ Turun ' + diff + '% sejak awal siklus'; }
      else if (diff < 0) { d.className = 'delta up'; d.textContent = '▲ Naik ' + Math.abs(diff) + '% sejak awal siklus'; }
      else { d.className = 'delta'; d.textContent = 'Belum berkurang'; }
    }
    $('lvl-base').textContent = 'Awal siklus: ' + (base === null ? '—' : base + '%') + ' · batas peringatan ' + CFG.levelLow + '%';
  }

  function renderLamp() {
    var on = S.heater, card = $('lamp-card'), btn = $('lamp-btn');
    var pending = S.pending && Date.now() - S.pending < 4000;
    card.classList.toggle('on', on === true);
    btn.classList.toggle('on', on === true);
    btn.classList.toggle('pending', !!pending);
    btn.setAttribute('aria-checked', on === true ? 'true' : 'false');
    $('lamp-state').textContent = on === null ? '—' : on ? 'MENYALA' : 'MATI';
    tag($('lamp-tag'), on === null ? 'idle' : on ? 'warn' : 'idle', on === null ? '—' : on ? 'ON' : 'OFF');
    $('lamp-note').textContent = !S.mqtt ? 'Tidak terhubung ke broker'
      : pending ? 'Mengirim perintah, menunggu ESP32...'
      : on === null ? 'Belum ada data dari ESP32'
      : 'Tekan tombol untuk ' + (on ? 'mematikan' : 'menyalakan');
  }

  function renderTemp() {
    var t = num('suhuAir'), st = tempStatus(t), c = tempColor(t), card = $('temp-marker').closest('.card');
    tag($('temp-tag'), st[0], st[1]);
    $('temp-val').textContent = t === null ? '—' : fmtNum(t);
    card.style.setProperty('--tc', c);
    var m = $('temp-marker');
    m.style.left = (t === null ? 0 : clamp((t - 10) / 40, 0, 1) * 100) + '%';
    m.classList.toggle('has', t !== null);
    $('mini-thermo-fill').style.height = (t === null ? 0 : clamp(t / 50, 0, 1) * 100) + '%';
    card.style.setProperty('--heat', t === null ? 0 : clamp((t - 26) / 14, 0, 1).toFixed(2));
    $('temp-key').textContent = S.vals.suhuAir ? 'ESP32: ' + S.vals.suhuAir.key : 'menunggu data';
  }

  function renderHum() {
    [['humIn', 'in'], ['humOut', 'out']].forEach(function (x) {
      var h = num(x[0]), st = humStatus(h);
      $('hum-' + x[1] + '-val').textContent = h === null ? '—' : Math.round(h);
      $('ring-' + x[1]).style.strokeDashoffset = (251.3 * (1 - (h === null ? 0 : clamp(h, 0, 100) / 100))).toFixed(1);
      $('hum-' + x[1] + '-box').style.setProperty('--h', h === null ? .12 : clamp(h / 100, .1, 1).toFixed(2));
      tag($('hum-' + x[1] + '-tag'), st[0], st[1]);
      $('hum-' + x[1] + '-key').textContent = S.vals[x[0]] ? 'ESP32: ' + S.vals[x[0]].key + ' (Slave ' + S.vals[x[0]].slave + ')' : 'menunggu data';
    });
    $('room-temp').textContent = txt('suhuRuang');
  }

  function renderGaram() {
    var G = S.vals.garam, g = num('garam');
    $('garam-val').textContent = G ? G.num : '—';
    $('garam-unit').textContent = G ? G.unit : '';
    var p = g === null ? 0 : clamp(g / CFG.garamMax, 0, 1);
    $('garam-bar').style.width = (p * 100) + '%';
    $('shaker').style.setProperty('--pile', (8 + p * 60) + '%');
    $('shaker').style.opacity = g === null ? .5 : 1;
    tag($('garam-tag'), g === null ? 'idle' : p < .3 ? 'info' : p < .7 ? 'ok' : 'warn', g === null ? 'Menunggu' : p < .3 ? 'Encer' : p < .7 ? 'Sedang' : 'Pekat');
    $('garam-note').textContent = 'Skala indikator 0 – ' + CFG.garamMax + (G && G.unit ? ' ' + G.unit : '');
    $('garam-key').textContent = G ? 'ESP32: ' + G.key : 'menunggu data';
  }

  function renderMqtt() {
    var sig = $('sig'), k = S.mqtt ? 'ok' : S.connecting ? 'wait' : 'bad';
    sig.className = 'sig ' + k + (sig.classList.contains('flash') ? ' flash' : '');
    tag($('mq-tag'), k, S.mqtt ? 'Online' : S.connecting ? 'Menyambung' : 'Terputus');
    $('mq-broker').textContent = S.mqtt ? 'Terhubung' : S.connecting ? 'Menyambung...' : 'Terputus, mencoba lagi';
    $('mq-esp').textContent = S.esp === true ? 'Online' : S.esp === false ? 'Offline' : 'Menunggu';
    $('mq-count').textContent = S.msgCount;
    $('mq-last').textContent = S.lastMsg ? ago(S.lastMsg) + ' · ' + S.lastTopic : '—';
    $('mq-host').textContent = 'wss://' + CFG.host + ':' + CFG.port;
  }

  function slaveStatus(n) {
    var sl = S.slave[n];
    if (sl.ok === false) return ['bad', 'No Respon'];
    if (!sl.t) return ['idle', 'Menunggu'];
    if (Date.now() - sl.t > CFG.staleSec * 1000) return ['warn', 'Terlambat'];
    return ['ok', 'Aktif'];
  }
  function renderDevices() {
    $('dev-list').innerHTML = DEVICES.map(function (d) {
      var sl = S.slave[d.n], st = slaveStatus(d.n);
      var rows = d.items.map(function (it) {
        var v = S.vals[it.id], val, key;
        if (it.id === 'heater') { val = S.heater === null ? '—' : S.heater ? 'MENYALA' : 'MATI'; key = S.heaterKey || 'telur/slave/led'; }
        else { val = v ? v.num + (v.unit ? ' ' + v.unit : '') : '—'; key = v ? v.key + (v.slave !== d.n ? ' (dari Slave ' + v.slave + ')' : '') : 'belum ada data'; }
        return '<li class="dev-item"><div class="dev-ic" style="--c:' + META[it.id].color + '">' + ICON[META[it.id].icon] + '</div>' +
          '<div class="dev-tx"><b>' + esc(it.alat) + '</b><p>' + esc(it.fungsi) + '</p><p class="mono">kunci data: ' + esc(key) + '</p></div>' +
          '<div class="dev-val mono">' + esc(val) + '</div></li>';
      }).join('');
      var ex = Object.keys(sl.extra);
      var extra = ex.length ? '<p class="dev-extra">Data lain: ' + ex.map(function (k) { return '<b>' + esc(k) + '</b> = ' + esc(sl.extra[k]); }).join(' · ') + '</p>' : '';
      return '<article class="card dev-card">' +
        '<div class="dev-head"><div class="dev-badge ' + d.color + '">' + d.n + '</div><div><h3>' + esc(d.name) + '</h3><p>' + esc(d.role) + '</p></div>' +
        '<span class="tag ' + st[0] + '">' + st[1] + '</span></div>' +
        '<p class="dev-place">' + esc(d.place) + '</p><ul class="dev-items">' + rows + '</ul>' + extra +
        '<div class="dev-foot"><span>Topik: <code>telur/slave/' + d.n + '</code></span><span>Terakhir: ' + (sl.t ? hhmmss(new Date(sl.t)) : '—') + '</span></div>' +
        '</article>';
    }).join('');
    $('raw-1').textContent = S.slave[1].raw;
    $('raw-2').textContent = S.slave[2].raw;
  }

  function renderAll() {
    renderPill(); renderTank(); renderLevel(); renderLamp(); renderTemp();
    renderHum(); renderGaram(); renderMqtt(); renderDevices(); checkLevelAlert();
  }

  /* =====================================================================
     DATA MASUK DARI SLAVE
     ===================================================================== */
  function setVal(id, key, val, n) {
    if (id === 'heater') { S.heater = isOn(val); S.heaterKey = key + ' (Slave ' + n + ')'; S.pending = 0; return; }
    var v = splitVal(val);
    S.vals[id] = { num: v.num, n: v.n, unit: v.unit || META[id].unit, key: key, slave: n, t: Date.now() };
    if (id === 'level') {
      var p = levelPct();
      if (p !== null && load('telur-level-base', null) === null) save('telur-level-base', Math.round(p * 10) / 10);
    }
  }
  function pickSlot(n, k, i, used) {
    if (/^Data \d+$/.test(k)) { var o = ORDER[n][i]; return o && !used[o] ? o : null; }
    for (var a = 0; a < SPECIFIC.length; a++) if (!used[SPECIFIC[a][0]] && SPECIFIC[a][1](k)) return SPECIFIC[a][0];
    var g = GENERIC[n];
    for (var b = 0; b < g.length; b++) if (!used[g[b][0]] && g[b][1].test(k)) return g[b][0];
    return null;
  }
  function handleSlave(n, raw) {
    var sl = S.slave[n];
    sl.raw = raw + '  (' + hhmmss() + ')';
    if (/^\s*NO RESPON\s*$/i.test(raw)) { sl.ok = false; renderAll(); return; }
    sl.ok = true; sl.t = Date.now(); S.esp = true;
    var used = {};
    parsePairs(raw).forEach(function (kv, i) {
      if (/^(hari|day)$/i.test(kv[0])) { var dn = parseInt(kv[1], 10); if (dn > 0) { S.espDay = dn; cycle(); } return; }
      var id = pickSlot(n, kv[0], i, used);
      if (id) { used[id] = 1; setVal(id, kv[0], kv[1], n); } else sl.extra[kv[0]] = kv[1];
    });
    renderAll();
    maybeSample();
  }

  /* =====================================================================
     LAMPU
     ===================================================================== */
  $('lamp-btn').addEventListener('click', function () {
    if (!S.mqtt || !client) { toast('Tidak terhubung ke broker'); renderLamp(); return; }
    var on = !S.heater;
    var msg = new Paho.MQTT.Message(on ? 'ON' : 'OFF');
    msg.destinationName = CFG.cmd; msg.qos = 1;
    try { client.send(msg); } catch (e) { toast('Gagal mengirim perintah'); return; }
    S.heater = on; S.pending = Date.now();   // diperbarui lagi oleh respons slave (telur/slave/led)
    renderAll();
  });

  /* =====================================================================
     JAM ESP32 & SIKLUS HARI (sama seperti program sebelumnya)
     ===================================================================== */
  function setEspTime(t) {
    var m = t.match(/(\d+):(\d+):(\d+)/); if (!m) return;
    var d = new Date();
    S.espOffset = (+m[1] * 3600 + +m[2] * 60 + +m[3]) - (d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds());
  }
  function cycle() {
    var st; try { st = localStorage.getItem('cycleStart'); } catch (e) {}
    if (!st) { st = new Date().toDateString(); try { localStorage.setItem('cycleStart', st); } catch (e) {} }
    var day = S.espDay !== null ? S.espDay : Math.floor((new Date(new Date().toDateString()) - new Date(st)) / 864e5) + 1;
    if (!(day >= 1)) day = 1;
    S.day = day;
    var total = S.totalDays;
    $('day-badge').textContent = 'DAY - ' + day;
    $('day-num').textContent = day;
    $('day-total').textContent = total;
    $('cycle-eta').textContent = day > total ? 'Siklus selesai' : day === total ? 'Estimasi Panen: hari ini' : 'Estimasi Panen: ' + (total - day) + ' Hari Lagi';
    $('cycle-bar').style.width = clamp(day / total, 0, 1) * 100 + '%';
    var pips = '';
    if (total <= 21) for (var i = 1; i <= total; i++) pips += '<span class="pip ' + (i < day ? 'done' : i === day ? 'now' : '') + '">' + i + '</span>';
    $('pips').innerHTML = pips;
    renderTank();
    checkDayAlert();
  }
  function askDay() {
    var n = parseInt(prompt('Hari ke berapa sekarang? (1-' + S.totalDays + ')', S.day), 10);
    if (!(n >= 1)) return;
    var d = new Date(); d.setDate(d.getDate() - (n - 1));
    try { localStorage.setItem('cycleStart', d.toDateString()); } catch (e) {}
    S.espDay = null; cycle();
  }
  $('day-badge').addEventListener('click', askDay);
  $('day-set').addEventListener('click', askDay);
  $('cycle-text').addEventListener('click', function () {
    var n = parseInt(prompt('Lama siklus pengasinan (hari)?', S.totalDays), 10);
    if (!(n >= 1)) return;
    S.totalDays = n;
    try { localStorage.setItem('cycleDays', String(n)); } catch (e) {}
    cycle();
  });

  /* =====================================================================
     PERINGATAN (hari ke-7 & air rendah) — hanya bisa ditutup dengan tombol Close
     ===================================================================== */
  var DAY_KEY = 'day7-alert-closed', lowArmed = true;
  function isOpen(id) { return $(id).classList.contains('is-open'); }
  function anyOpen() { return isOpen('day7-overlay') || isOpen('lvl-overlay') || isOpen('reset-overlay'); }
  function openOv(id, focusId, vib) {
    if (isOpen(id)) return;
    var o = $(id); o.classList.add('is-open'); o.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    try { if (vib && navigator.vibrate) navigator.vibrate(vib); } catch (e) {}
    $(focusId).focus();
  }
  function closeOv(id) {
    var o = $(id); o.classList.remove('is-open'); o.setAttribute('aria-hidden', 'true');
    if (!anyOpen()) document.body.style.overflow = '';
  }
  function checkDayAlert() {
    if (S.day !== CFG.alertDay) { try { sessionStorage.removeItem(DAY_KEY); } catch (e) {} return; }
    var closed; try { closed = sessionStorage.getItem(DAY_KEY) === '1'; } catch (e) {}
    if (!closed) {
      $('day7-kicker').textContent = 'DAY - ' + CFG.alertDay;
      $('day7-title').textContent = 'Peringatan Hari ke-' + CFG.alertDay;
      $('day7-desc').textContent = 'Siklus pengasinan telur sudah mencapai hari ke-' + CFG.alertDay + '. Segera periksa kondisi telur dan kepekatan larutan garam.';
      openOv('day7-overlay', 'day7-close', [200, 100, 200]);
    }
  }
  $('day7-close').addEventListener('click', function () {
    closeOv('day7-overlay');
    try { sessionStorage.setItem(DAY_KEY, '1'); } catch (e) {}
    setTimeout(checkLevelAlert, 150);
  });
  function checkLevelAlert() {
    var p = levelPct(); if (p === null) return;   // tunggu data asli dari sensor
    if (p >= CFG.levelReset) lowArmed = true;
    $('lvl-now').textContent = txt('level') + ' (' + Math.round(p) + '%)';
    if (isOpen('lvl-overlay')) return;
    if (p < CFG.levelLow && lowArmed && !isOpen('day7-overlay')) openOv('lvl-overlay', 'lvl-close', [300, 150, 300]);
  }
  $('lvl-close').addEventListener('click', function () { closeOv('lvl-overlay'); lowArmed = false; });
  document.addEventListener('keydown', function (e) {
    if (!isOpen('day7-overlay') && !isOpen('lvl-overlay')) {
      if (e.key === 'Escape' && isOpen('reset-overlay')) closeOv('reset-overlay');
      return;
    }
    if (e.key === 'Escape' || e.key === 'Tab') e.preventDefault();
  });

  /* =====================================================================
     RIWAYAT DATA — 3x sehari, digabung terus dari hari ke hari
     ===================================================================== */
  var HKEY = 'telur-history';
  function history() { return load(HKEY, []); }
  function sesiNow(d) {
    d = d || new Date();
    var h = d.getHours() + d.getMinutes() / 60, list = CFG.sesi, idx = -1, date = new Date(d), prev = false;
    for (var i = 0; i < list.length; i++) if (h >= list[i].from) idx = i;
    if (idx < 0) { idx = list.length - 1; date.setDate(date.getDate() - 1); prev = true; }   // dini hari = sesi malam kemarin
    return { idx: idx, name: list[idx].name, date: ymd(date), key: ymd(date) + '#' + idx, prev: prev };
  }
  function fresh() {
    var t = Math.max(S.slave[1].t, S.slave[2].t);
    return t && Date.now() - t < 10 * 60e3 && FIELDS.some(function (f) { return num(f) !== null; });
  }
  function maybeSample(force) {
    var s = sesiNow(), H = history();
    if (!force && H.some(function (r) { return r.key === s.key; })) return;
    if (!force && !fresh()) return;
    var rec = { key: force ? s.key + '#m' + Date.now() : s.key, t: new Date().toISOString(), date: s.date, sesi: s.name,
      day: s.prev && S.espDay === null ? Math.max(1, S.day - 1) : S.day };
    FIELDS.forEach(function (f) { rec[f] = num(f); });
    rec.garamUnit = S.vals.garam ? S.vals.garam.unit : '';
    rec.lampu = S.heater === null ? null : S.heater ? 1 : 0;
    H.push(rec);
    if (H.length > 2000) H = H.slice(-2000);
    save(HKEY, H);
    renderHistory();
    toast('Data sesi ' + s.name + ' tersimpan');
  }

  function renderHistory() {
    var H = history();
    tag($('hist-count'), H.length ? 'ok' : 'idle', H.length + ' data');
    var rows = H.slice().reverse().slice(0, 60).map(function (r) {
      var d = new Date(r.t), f = function (v) { return v === null || v === undefined ? '—' : fmtNum(v); };
      return '<tr><td>' + ymd(d) + ' ' + hhmm(d) + '</td><td>' + r.day + '</td><td>' + esc(r.sesi) + '</td><td>' + f(r.garam) + '</td><td>' + f(r.suhuAir) +
        '</td><td>' + f(r.level) + '</td><td>' + f(r.humIn) + '</td><td>' + f(r.humOut) + '</td><td>' + f(r.suhuRuang) + '</td><td>' +
        (r.lampu === null ? '—' : r.lampu ? 'ON' : 'OFF') + '</td></tr>';
    }).join('');
    $('hist-body').innerHTML = rows || '<tr><td class="empty" colspan="10">Belum ada data tersimpan</td></tr>';
    renderSesi(H);
    renderChart();
  }
  function renderSesi(H) {
    var now = sesiNow();
    $('sesi-info').textContent = 'Disimpan 3× sehari: ' + CFG.sesi.map(function (s) { return s.name + ' ' + pad(s.from) + '.00'; }).join(' · ');
    $('sesi-row').innerHTML = CFG.sesi.map(function (s, i) {
      var rec = H.filter(function (r) { return r.key === now.date + '#' + i; })[0], cls = '', st;
      if (rec) { cls = 'done'; st = '✓ Tersimpan ' + hhmm(new Date(rec.t)); }
      else if (i === now.idx) { cls = 'now'; st = 'Berjalan, menunggu data'; }
      else if (i < now.idx) st = 'Terlewat (halaman tertutup)';
      else st = 'Mulai ' + pad(s.from) + '.00';
      return '<div class="sesi ' + cls + '"><b>' + s.name + '</b><em>' + st + '</em></div>';
    }).join('');
  }

  /* ============ GRAFIK ============ */
  var chart = null, group = load('telur-chart-group', 'suhu');
  var bgPlugin = { id: 'bg', beforeDraw: function (c) { var x = c.ctx; x.save(); x.globalCompositeOperation = 'destination-over'; x.fillStyle = '#0c1324'; x.fillRect(0, 0, c.width, c.height); x.restore(); } };
  function buildTabs() {
    $('chart-tabs').innerHTML = GROUPS.map(function (g) {
      return '<button type="button" role="tab" data-g="' + g.id + '" class="' + (g.id === group ? 'is-active' : '') + '">' + g.label + '</button>';
    }).join('');
    $('chart-tabs').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      group = b.dataset.g; save('telur-chart-group', group);
      Array.prototype.forEach.call(this.children, function (x) { x.classList.toggle('is-active', x === b); });
      renderChart();
    });
  }
  function renderChart() {
    var H = history(), g = GROUPS.filter(function (x) { return x.id === group; })[0] || GROUPS[0];
    var empty = $('chart-empty');
    if (typeof Chart === 'undefined') { empty.textContent = 'Grafik tidak bisa dimuat (library Chart.js gagal diunduh). Periksa koneksi internet.'; empty.style.display = 'flex'; return; }
    empty.style.display = H.length ? 'none' : 'flex';
    var unit = g.id === 'garam' ? ((H.length && H[H.length - 1].garamUnit) || '') : g.unit;
    var labels = H.map(function (r) { return 'H' + r.day + ' ' + r.sesi; });
    var ds = g.fields.map(function (f) {
      return { label: META[f].label, data: H.map(function (r) { return r[f] === undefined ? null : r[f]; }),
        borderColor: META[f].color, backgroundColor: META[f].color + '30', pointBackgroundColor: META[f].color,
        fill: g.fields.length === 1, tension: .35, borderWidth: 2.5, pointRadius: 3.5, pointHoverRadius: 6, spanGaps: true };
    });
    if (!chart) {
      Chart.defaults.font.family = "'Plus Jakarta Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
      chart = new Chart($('chart'), {
        type: 'line', data: { labels: labels, datasets: ds }, plugins: [bgPlugin],
        options: {
          responsive: true, maintainAspectRatio: false, animation: { duration: 700 },
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { labels: { color: '#cbd5e1', boxWidth: 12, boxHeight: 12, usePointStyle: true, font: { weight: '600' } } },
            tooltip: { backgroundColor: 'rgba(15,23,42,.95)', borderColor: 'rgba(148,163,184,.3)', borderWidth: 1, padding: 10,
              callbacks: { title: function (it) { var r = history()[it[0].dataIndex]; if (!r) return ''; var d = new Date(r.t); return 'Hari ' + r.day + ' · ' + r.sesi + ' (' + ymd(d) + ' ' + hhmm(d) + ')'; } } }
          },
          scales: {
            x: { ticks: { color: '#94a3b8', maxRotation: 0, autoSkip: true }, grid: { color: 'rgba(148,163,184,.08)' } },
            y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148,163,184,.08)' }, title: { display: true, color: '#94a3b8', text: '' } }
          }
        }
      });
    }
    chart.data.labels = labels; chart.data.datasets = ds;
    chart.options.scales.y.title.text = g.label + (unit ? ' (' + unit + ')' : '');
    chart.options.scales.y.min = g.min; chart.options.scales.y.max = g.max;
    chart.update();
  }

  /* ============ DOWNLOAD ============ */
  function download(name, blob) {
    var a = document.createElement('a'), url = URL.createObjectURL(blob);
    a.href = url; a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 500);
  }
  $('dl-csv').addEventListener('click', function () {
    var H = history();
    if (!H.length) { toast('Belum ada data untuk di-download'); return; }
    var gu = (H[H.length - 1].garamUnit || '').trim();
    var head = ['Tanggal', 'Jam', 'Hari ke', 'Sesi', 'Kepekatan Garam' + (gu ? ' (' + gu + ')' : ''), 'Suhu Air (°C)', 'Ketinggian Air (%)',
      'Kelembaban Dalam (%)', 'Kelembaban Luar (%)', 'Suhu Ruang (°C)', 'Lampu'];
    var cell = function (v) { return v === null || v === undefined ? '' : String(fmtNum(v, 2)); };
    var lines = [head.join(';')].concat(H.map(function (r) {
      var d = new Date(r.t);
      return [ymd(d), hhmm(d).replace('.', ':'), r.day, r.sesi, cell(r.garam), cell(r.suhuAir), cell(r.level), cell(r.humIn), cell(r.humOut), cell(r.suhuRuang),
        r.lampu === null ? '' : r.lampu ? 'ON' : 'OFF'].map(function (v) { return String(v).replace('.', ','); }).join(';');
    }));
    download('data-telur-asin_' + ymd(new Date()) + '.csv', new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }));
    toast('File CSV di-download');
  });
  $('dl-png').addEventListener('click', function () {
    if (!chart || !history().length) { toast('Belum ada grafik untuk di-download'); return; }
    var a = document.createElement('a');
    a.href = chart.toBase64Image('image/png', 1);
    a.download = 'grafik-' + group + '_' + ymd(new Date()) + '.png';
    document.body.appendChild(a); a.click(); a.remove();
    toast('Gambar grafik di-download');
  });

  /* ============ RESET ============ */
  $('btn-reset').addEventListener('click', function () { openOv('reset-overlay', 'reset-cancel'); });
  $('reset-cancel').addEventListener('click', function () { closeOv('reset-overlay'); });
  $('reset-overlay').addEventListener('click', function (e) { if (e.target === this) closeOv('reset-overlay'); });
  $('reset-ok').addEventListener('click', function () {
    try {
      localStorage.removeItem(HKEY);
      localStorage.removeItem('telur-level-base');
      localStorage.setItem('cycleStart', new Date().toDateString());
      sessionStorage.removeItem(DAY_KEY);
    } catch (e) {}
    S.espDay = null; lowArmed = true;
    var p = levelPct(); if (p !== null) save('telur-level-base', Math.round(p * 10) / 10);
    closeOv('reset-overlay');
    cycle(); renderAll(); renderHistory();
    toast('Hari dan semua data sudah di-reset');
  });

  /* =====================================================================
     NAVIGASI HALAMAN
     ===================================================================== */
  /* Halaman berbentuk slide: geser kiri/kanan (HP), tombol menu bawah,
     atau tombol panah ← → di keyboard (desktop). */
  var PAGES = ['dashboard', 'grafik', 'perangkat'], cur = 0;
  var slider = $('slider'), track = $('track');
  function pageEl(i) { return $('page-' + PAGES[i]); }
  function fitHeight() { slider.style.height = pageEl(cur).offsetHeight + 'px'; }
  function moveGlider() {
    var b = document.querySelectorAll('.bn')[cur], g = $('bn-glider');
    if (!b) return;
    g.style.width = b.offsetWidth + 'px';
    g.style.transform = 'translateX(' + (b.offsetLeft - 6) + 'px)';
  }
  function go(p, fromHash) {
    var i = typeof p === 'number' ? p : PAGES.indexOf(p);
    if (i < 0) i = 0;
    i = clamp(i, 0, PAGES.length - 1);
    var changed = i !== cur; cur = i;
    track.style.transform = 'translateX(' + (-100 * cur) + '%)';
    PAGES.forEach(function (x, k) {
      var el = pageEl(k), on = k === cur;
      el.classList.toggle('is-active', on);
      el.setAttribute('aria-hidden', on ? 'false' : 'true');
      if (on) el.removeAttribute('inert'); else el.setAttribute('inert', '');
    });
    document.querySelectorAll('.bn').forEach(function (b, k) { b.classList.toggle('is-active', k === cur); });
    document.querySelectorAll('#slide-dots i').forEach(function (d, k) { d.classList.toggle('is-active', k === cur); });
    moveGlider();
    if (PAGES[cur] === 'grafik') { renderHistory(); if (chart) chart.resize(); }
    fitHeight();
    if (!fromHash && location.hash.slice(1) !== PAGES[cur]) { try { history_.replaceState(null, '', '#' + PAGES[cur]); } catch (e) {} }
    if (changed) window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  var history_ = window.history;
  document.querySelectorAll('.bn').forEach(function (b) {
    b.addEventListener('click', function () { go(b.dataset.page); });
  });
  window.addEventListener('hashchange', function () { go(location.hash.slice(1), true); });
  window.addEventListener('resize', function () { fitHeight(); moveGlider(); });
  if (window.ResizeObserver) PAGES.forEach(function (x, k) { new ResizeObserver(function () { if (k === cur) fitHeight(); }).observe(pageEl(k)); });
  document.addEventListener('keydown', function (e) {
    if (anyOpen() || /input|textarea|select/i.test((e.target || {}).tagName || '')) return;
    if (e.key === 'ArrowRight') go(cur + 1);
    if (e.key === 'ArrowLeft') go(cur - 1);
  });

  // Geser dengan jari (atau tarik dengan mouse)
  (function swipe() {
    var x0 = 0, y0 = 0, dx = 0, dragging = false, decided = false, horiz = false, w = 1;
    function start(x, y, target) {
      if (target.closest('[data-noswipe], button, a, input')) return false;
      x0 = x; y0 = y; dx = 0; dragging = true; decided = false; horiz = false; w = slider.offsetWidth || 1;
      return true;
    }
    function move(x, y, e) {
      if (!dragging) return;
      var mx = x - x0, my = y - y0;
      if (!decided) {
        if (Math.abs(mx) < 8 && Math.abs(my) < 8) return;
        decided = true; horiz = Math.abs(mx) > Math.abs(my) * 1.2;
        if (!horiz) { dragging = false; return; }
        track.classList.add('dragging');
      }
      if (e && e.cancelable) e.preventDefault();
      dx = mx;
      if ((cur === 0 && dx > 0) || (cur === PAGES.length - 1 && dx < 0)) dx *= .3;   // efek mentok di ujung
      track.style.transform = 'translateX(calc(' + (-100 * cur) + '% + ' + dx + 'px))';
    }
    function end() {
      if (!dragging) return;
      dragging = false; track.classList.remove('dragging');
      if (!horiz) return;
      var th = Math.min(90, w * .18);
      if (dx < -th) go(cur + 1); else if (dx > th) go(cur - 1); else go(cur);
    }
    slider.addEventListener('touchstart', function (e) { var t = e.touches[0]; start(t.clientX, t.clientY, e.target); }, { passive: true });
    slider.addEventListener('touchmove', function (e) { var t = e.touches[0]; move(t.clientX, t.clientY, e); }, { passive: false });
    slider.addEventListener('touchend', end);
    slider.addEventListener('touchcancel', end);
    slider.addEventListener('mousedown', function (e) { if (e.button === 0 && start(e.clientX, e.clientY, e.target)) e.preventDefault(); });
    window.addEventListener('mousemove', function (e) { move(e.clientX, e.clientY, null); });
    window.addEventListener('mouseup', end);
  })();

  /* =====================================================================
     MQTT
     ===================================================================== */
  function flash() {
    var s = $('sig'), p = $('mqtt-pill');
    s.classList.add('flash'); p.classList.add('flash');
    setTimeout(function () { s.classList.remove('flash'); p.classList.remove('flash'); }, 350);
  }
  function onMsg(m) {
    var tail = m.destinationName.split('/').pop(), t = m.payloadString;
    S.msgCount++; S.lastMsg = Date.now(); S.lastTopic = tail; flash();
    if (tail === 'status') { S.esp = /online/i.test(t); renderAll(); return; }
    if (m.retained) { renderMqtt(); return; }        // abaikan data lama di broker
    if (tail === 'siklus') {
      var mm = t.match(/HARI:(\d+).*TARGET:(\d+)/i);
      if (mm) { S.espDay = parseInt(mm[1], 10); S.totalDays = parseInt(mm[2], 10); cycle(); }
      renderMqtt(); return;
    }
    if (tail === 'time') { setEspTime(t); renderMqtt(); return; }
    if (tail === 'led') { S.heater = isOn(t); S.heaterKey = 'telur/slave/led'; S.pending = 0; renderAll(); return; }
    if (tail === '1' || tail === '2') handleSlave(+tail, t);
  }
  function connect() {
    if (typeof Paho === 'undefined') { S.connecting = false; renderAll(); toast('Library MQTT gagal dimuat, periksa internet'); return; }
    S.connecting = true; renderAll();
    client = new Paho.MQTT.Client(CFG.host, CFG.port, 'web_' + Math.random().toString(16).slice(2, 10));
    client.onConnectionLost = function () { S.mqtt = false; S.connecting = false; S.esp = null; renderAll(); setTimeout(connect, 5000); };
    client.onMessageArrived = onMsg;
    client.connect({
      useSSL: true, userName: CFG.user, password: CFG.pass, keepAliveInterval: 30, timeout: 10,
      onSuccess: function () { S.mqtt = true; S.connecting = false; renderAll(); client.subscribe(CFG.sub, { qos: 0 }); },
      onFailure: function () { S.mqtt = false; S.connecting = false; renderAll(); setTimeout(connect, 8000); }
    });
  }

  /* =====================================================================
     JAM & PEMERIKSAAN BERKALA
     ===================================================================== */
  var lastDate = new Date().toDateString(), tickN = 0;
  function tick() {
    var d = new Date();
    $('live-header-clock').textContent = hhmmss(d) + ' WIB';
    if (S.espOffset !== null) {
      var s = ((d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds() + S.espOffset) % 86400 + 86400) % 86400;
      $('live-footer-clock').textContent = pad(Math.floor(s / 3600)) + '.' + pad(Math.floor(s / 60) % 60) + '.' + pad(s % 60) + ' WIB';
    }
    if (d.toDateString() !== lastDate) { lastDate = d.toDateString(); cycle(); }   // ganti hari tengah malam
    if (S.pending && Date.now() - S.pending >= 4000) { S.pending = 0; renderLamp(); }
    if (++tickN % 5 === 0) { renderMqtt(); renderDevices(); }
    if (tickN % 30 === 0) { maybeSample(); renderSesi(history()); }
  }

  /* ============ MULAI ============ */
  buildScene(); buildTabs();
  cycle(); renderAll(); renderHistory();
  go(location.hash.slice(1));
  tick(); setInterval(tick, 1000);
  connect();

  // Untuk uji coba lewat Console browser:
  window.showDay7Alert = function () { openOv('day7-overlay', 'day7-close', [200, 100, 200]); };
  window.showLevelAlert = function () { openOv('lvl-overlay', 'lvl-close', [300, 150, 300]); };
  window.simpanSekarang = function () { maybeSample(true); };                 // simpan 1 data sekarang
  window.uji = function (n, teks) { handleSlave(n, teks); };                   // contoh: uji(1, 'garam:22,suhu:29.5,level:64')
})();
