/* ============================================================
   js/timer.js – Timer Pemantauan
   Tanggung jawab:
     - Mengatur kapan pemantauan dimulai (tanggal & jam)
     - Menghitung lama pemantauan (hari, jam, menit, detik)
       terus berjalan sampai pengguna menekan tombol Matikan
     - Menyimpan status di localStorage, jadi hitungan tetap
       berjalan walau halaman di-refresh atau ditutup
   Dependensi: ui.js (addLog, showToast)
   ============================================================ */
'use strict';

(function () {
    var KEY = 'aquamonitor_timer';

    /* state: start = ms waktu mulai (null = belum diatur)
              stop  = ms waktu dimatikan (null = masih aktif) */
    var st = load();

    var elInput = document.getElementById('mt-start-input');
    var elElapsed = document.getElementById('mt-elapsed');
    var elStatus = document.getElementById('mt-status');
    var elLabel = document.getElementById('mt-start-label');
    var btnStart = document.getElementById('mt-btn-start');
    var btnStop = document.getElementById('mt-btn-stop');
    var btnReset = document.getElementById('mt-btn-reset');

    if (!elInput || !elElapsed) return;   // kartu tidak ada di halaman

    function load() {
        try {
            var s = JSON.parse(localStorage.getItem(KEY));
            if (s && typeof s === 'object') return { start: s.start || null, stop: s.stop || null };
        } catch (e) { /* abaikan */ }
        return { start: null, stop: null };
    }

    function save() {
        try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* abaikan */ }
    }

    function pad(n) { return n < 10 ? '0' + n : '' + n; }

    /* ms -> "N hari HH:MM:SS" */
    function fmt(ms) {
        if (ms < 0) ms = 0;
        var s = Math.floor(ms / 1000);
        var d = Math.floor(s / 86400); s %= 86400;
        var h = Math.floor(s / 3600); s %= 3600;
        var m = Math.floor(s / 60); s %= 60;
        return d + ' hari ' + pad(h) + ':' + pad(m) + ':' + pad(s);
    }

    /* ms -> nilai untuk <input type="datetime-local"> (waktu lokal) */
    function toInputValue(ms) {
        var d = new Date(ms - new Date(ms).getTimezoneOffset() * 60000);
        return d.toISOString().slice(0, 16);
    }

    function fmtDate(ms) {
        return new Date(ms).toLocaleString('id-ID', {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit', hour12: false
        });
    }

    function isActive() { return st.start !== null && st.stop === null; }

    function setBadge(text, cls) {
        elStatus.textContent = text;
        elStatus.className = 'mt-status ' + cls;
    }

    function render() {
        var now = Date.now();
        var active = isActive();

        elInput.disabled = active;
        btnStart.disabled = active;
        btnStop.disabled = !active;
        btnReset.disabled = !(st.start !== null && st.stop !== null);

        if (st.start === null) {
            elElapsed.textContent = '0 hari 00:00:00';
            elLabel.textContent = 'Belum diatur';
            setBadge('Belum dimulai', 'idle');
            return;
        }

        elLabel.textContent = 'Mulai: ' + fmtDate(st.start);

        if (st.stop !== null) {
            elElapsed.textContent = fmt(st.stop - st.start);
            setBadge('Dimatikan', 'stopped');
        } else if (now < st.start) {
            elElapsed.textContent = 'Mulai dalam ' + fmt(st.start - now);
            setBadge('Menunggu', 'waiting');
        } else {
            elElapsed.textContent = fmt(now - st.start);
            setBadge('Berjalan', 'running');
        }
    }

    /* ---- Tombol Mulai ---- */
    btnStart.addEventListener('click', function () {
        var ts = elInput.value ? new Date(elInput.value).getTime() : Date.now();
        if (isNaN(ts)) {
            showToast('Waktu mulai tidak valid.', 'error');
            return;
        }
        st = { start: ts, stop: null };
        save();
        addLog('▶️ Pemantauan diatur mulai ' + fmtDate(ts), 'success');
        showToast('Pemantauan dimulai', 'success');
        render();
    });

    /* ---- Tombol Matikan ---- */
    btnStop.addEventListener('click', function () {
        if (!isActive()) return;
        st.stop = Math.max(Date.now(), st.start);
        save();
        addLog('⏹️ Pemantauan dimatikan. Durasi: ' + fmt(st.stop - st.start), 'warn');
        showToast('Pemantauan dimatikan', 'warn');
        render();
    });

    /* ---- Tombol Reset (hanya setelah dimatikan) ---- */
    btnReset.addEventListener('click', function () {
        st = { start: null, stop: null };
        save();
        elInput.value = toInputValue(Date.now());
        addLog('↺ Timer pemantauan di-reset.', '');
        render();
    });

    /* ---- Inisialisasi ---- */
    elInput.value = toInputValue(st.start !== null ? st.start : Date.now());
    render();
    setInterval(render, 1000);
})();