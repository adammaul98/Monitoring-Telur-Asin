/* ============================================================
   js/sensor.js
   AquaMonitor IoT Dashboard – Pemrosesan Data Sensor
   Tanggung jawab:
     - Parse payload JSON dari topik MQTT
     - Update semua card sensor (suhu air, suhu udara,
       ketinggian air, kadar garam)
     - Sinkronisasi status lampu dari data sensor
   Dependensi: ui.js (renderVal, setChip, pushHist, updateChart, markUpdate)
   ============================================================ */

'use strict';

/* ============================================================
   PROSES DATA SENSOR DARI PAYLOAD JSON
   Format: {"suhu_air":28.5,"suhu_udara":30.2,
            "ketinggian_air":80,"kadar_garam":32,"lampu":"OFF"}
============================================================ */
function processData(raw) {
  var data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    addLog('❌ Gagal parse JSON: ' + raw, 'error');
    return;
  }

  /* ---- Suhu Air ---- */
  if (data.suhu_air !== undefined) {
    var sa = parseFloat(data.suhu_air);
    renderVal('val-suhu-air', sa, 1);
    // Batas: Normal ≤28°C | Sedang ≤32°C | Tinggi >32°C
    setChip('chip-suhu-air', sa, 28, 32);
    pushHist('suhu_air', sa);
    updateChart('chart-suhu-air', history.suhu_air);
  }

  /* ---- Suhu Udara ---- */
  if (data.suhu_udara !== undefined) {
    var su = parseFloat(data.suhu_udara);
    renderVal('val-suhu-udara', su, 1);
    // Batas: Normal ≤30°C | Sedang ≤35°C | Tinggi >35°C
    setChip('chip-suhu-udara', su, 30, 35);
    pushHist('suhu_udara', su);
    updateChart('chart-suhu-udara', history.suhu_udara);
  }

  /* ---- Ketinggian Air ---- */
  if (data.ketinggian_air !== undefined) {
    var ka = parseFloat(data.ketinggian_air);
    renderVal('val-ketinggian', ka, 0);

    // Status chip khusus: Normal ≥60% | Sedang ≥30% | Rendah <30%
    var chipKa = document.getElementById('chip-ketinggian');
    chipKa.classList.remove('skeleton', 'ok', 'warn', 'danger');
    if (ka >= 60) {
      chipKa.textContent = 'Normal';
      chipKa.classList.add('ok');
    } else if (ka >= 30) {
      chipKa.textContent = 'Sedang';
      chipKa.classList.add('warn');
    } else {
      chipKa.textContent = 'Rendah';
      chipKa.classList.add('danger');
    }

    // Update progress bar
    document.getElementById('prog-fill').style.width =
      Math.min(100, Math.max(0, ka)) + '%';
    document.getElementById('prog-track').setAttribute('aria-valuenow', ka);
  }

  /* ---- Kadar Garam ---- */
  if (data.kadar_garam !== undefined) {
    var kg = parseFloat(data.kadar_garam);
    renderVal('val-garam', kg, 1);
    // Batas: Normal ≤35 PPT | Sedang ≤40 PPT | Tinggi >40 PPT
    setChip('chip-garam', kg, 35, 40);
    pushHist('kadar_garam', kg);
    updateChart('chart-garam', history.kadar_garam);
  }

  /* ---- Status Lampu (dari data sensor) ---- */
  if (data.lampu !== undefined) {
    // Sinkronkan UI tanpa publish balik ke broker
    syncLampUI(String(data.lampu).toUpperCase() === 'ON', false);
  }

  markUpdate();
}
