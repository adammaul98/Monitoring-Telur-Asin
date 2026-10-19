/* ============================================================
   js/config.js
   AquaMonitor IoT Dashboard – Konfigurasi MQTT
   ============================================================

   ⚙️  UBAH NILAI DI BAWAH INI SESUAI KEBUTUHAN ANDA
   Tidak perlu menyentuh file lain untuk mengganti konfigurasi.
   ============================================================ */

const MQTT_CONFIG = {
  host: 'v28c2407.ala.asia-southeast1.emqxsl.com',   // Alamat host broker MQTT
  port: 8084,                // Port WebSocket (non-TLS: 8083 | TLS: 8084)
  useTLS: true,               // Ganti ke true untuk koneksi aman (wss://)
  clientId: "web_dashboard_" + Math.random().toString(16).substr(2, 8),
  username: "Telur-asin", // Username dari Access Control EMQX
  password: "TELURASIN12345",
  keepalive: 30,                  // Interval keepalive dalam detik

  // Topik Subscribe – menerima data telemetri sensor akuarium
  // Format JSON: {"suhu_air":28.5,"suhu_udara":30.2,"ketinggian_air":80,"kadar_garam":32,"lampu":"OFF"}
  topicSub: 'akuarium/monitoring/telemetry',

  // Topik Publish – mengirimkan perintah kontrol lampu (string "ON" atau "OFF")
  topicLamp: 'akuarium/control/lampu',
};
