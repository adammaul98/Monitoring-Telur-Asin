/* ============================================================
   js/app.js
   AquaMonitor IoT Dashboard – Entry Point & Inisialisasi App
   Tanggung jawab:
     - Inisialisasi mini chart saat DOM siap
     - Memulai koneksi MQTT
     - Mengelola Demo Mode (fallback jika MQTT tidak tersedia)
   Dependensi: config.js, ui.js, sensor.js, lamp.js, mqtt.js
   ============================================================ */

'use strict';

var demoTimer = null;

/* ============================================================
   DEMO MODE
   Menghasilkan data simulasi setiap 3 detik.
   Otomatis aktif jika MQTT tidak terhubung dalam 12 detik.
   Dihentikan begitu koneksi MQTT berhasil (dipanggil dari mqtt.js).
============================================================ */
function startDemo() {
  addLog('⚡ Demo mode aktif – data simulasi setiap 3 detik.', 'warn');
  showToast('Mode Demo aktif (MQTT tidak terjangkau)', 'warn');

  function tick() {
    processData(JSON.stringify({
      suhu_air      : +(26 + Math.random() * 6).toFixed(1),
      suhu_udara    : +(28 + Math.random() * 7).toFixed(1),
      ketinggian_air: +(35 + Math.random() * 55).toFixed(0),
      kadar_garam   : +(30 + Math.random() * 10).toFixed(1),
      lampu         : lampOn ? 'ON' : 'OFF',
    }));
  }

  tick(); // langsung tampilkan data pertama
  demoTimer = setInterval(tick, 3000);
}

function stopDemo() {
  if (demoTimer) {
    clearInterval(demoTimer);
    demoTimer = null;
    addLog('📡 Demo mode dihentikan – menggunakan data MQTT nyata.', 'success');
  }
}

/* ============================================================
   INISIALISASI APLIKASI
============================================================ */
document.addEventListener('DOMContentLoaded', function () {
  // Inisialisasi mini sparkline chart (buat batang kosong)
  initChart('chart-suhu-air');
  initChart('chart-suhu-udara');
  initChart('chart-garam');

  addLog('🚀 Dashboard diinisialisasi.', 'info');

  // Mulai koneksi MQTT
  connectMQTT();

  // Fallback: aktifkan demo mode jika tidak terhubung dalam 12 detik
  setTimeout(function () {
    if (!isConnected && !demoTimer) {
      addLog('⏱️ Timeout – beralih ke demo mode.', 'warn');
      startDemo();
    }
  }, 12000);
});
