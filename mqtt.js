/* ============================================================
   js/mqtt.js
   AquaMonitor IoT Dashboard – Koneksi & Manajemen MQTT
   Tanggung jawab:
     - Membangun koneksi ke broker via WebSocket (Paho)
     - Subscribe ke topik telemetri sensor
     - Callback koneksi terputus & auto-reconnect
     - Callback pesan masuk → teruskan ke sensor.js
     - Mengambil nilai waktu dari ESP32 → tampilkan via ui.js
   Dependensi: config.js, ui.js (addLog, showToast, setStatus,
               updateEspTime), sensor.js (processData)
   ============================================================ */

'use strict';

/* State koneksi – dibaca oleh lamp.js dan app.js */
var mqttClient = null;
var isConnected = false;

/* Nama field / topik yang dianggap sebagai waktu dari ESP32
   (sesuaikan dengan yang dikirim ESP32) */
var ESP_TIME_KEYS = ['waktu', 'time', 'timestamp', 'ts'];

/* ============================================================
   AMBIL WAKTU ESP32 DARI PESAN
   Mendukung dua format:
     1. Payload JSON berisi field waktu, mis. {"suhu_air":27.5,"waktu":"21:05:33"}
     2. Topik khusus waktu, mis. akuarium/sensor/waktu  → payload = nilai waktu
   Mengembalikan nilai waktu, atau null bila tidak ada.
============================================================ */
function extractEspTime(topic, payload) {
  // 1. Payload JSON
  try {
    var data = JSON.parse(payload);
    if (data && typeof data === 'object') {
      for (var i = 0; i < ESP_TIME_KEYS.length; i++) {
        if (data[ESP_TIME_KEYS[i]] !== undefined) return data[ESP_TIME_KEYS[i]];
      }
    }
  } catch (e) { /* bukan JSON, lanjut ke cek topik */ }

  // 2. Topik khusus waktu
  var lastSegment = topic.split('/').pop().toLowerCase();
  if (ESP_TIME_KEYS.indexOf(lastSegment) !== -1) return payload.trim();

  return null;
}

/* ============================================================
   CALLBACK: Koneksi Terputus
============================================================ */
function onConnLost(resp) {
  isConnected = false;
  setStatus('disconnected');
  addLog('🔴 Koneksi terputus: ' + (resp.errorMessage || 'unknown'), 'error');
  showToast('Koneksi MQTT terputus. Mencoba ulang...', 'error');
  // Auto-reconnect setelah 5 detik
  setTimeout(connectMQTT, 5000);
}

/* ============================================================
   CALLBACK: Pesan Masuk
============================================================ */
function onMsgArrived(msg) {
  // Abaikan pesan retained (data lama yang tersimpan di broker)
  if (msg.retained) return;
  var topic = msg.destinationName;
  var payload = msg.payloadString;
  addLog('📨 [' + topic + '] ' + payload, '');

  // Tampilkan waktu dari ESP32 (jika ada)
  var espTime = extractEspTime(topic, payload);
  if (espTime !== null) updateEspTime(espTime);

  processData(topic, payload);
}

/* ============================================================
   KONEKSI KE BROKER MQTT
============================================================ */
function connectMQTT() {
  try {
    setStatus('connecting');
    addLog('🔄 Menghubungkan ke ' + MQTT_CONFIG.host + ':' + MQTT_CONFIG.port + '...', 'info');

    mqttClient = new Paho.MQTT.Client(
      MQTT_CONFIG.host,
      Number(MQTT_CONFIG.port),
      MQTT_CONFIG.clientId
    );

    mqttClient.onConnectionLost = onConnLost;
    mqttClient.onMessageArrived = onMsgArrived;

    mqttClient.connect({
      useSSL: MQTT_CONFIG.useTLS,
      userName: MQTT_CONFIG.username,
      password: MQTT_CONFIG.password,
      keepAliveInterval: MQTT_CONFIG.keepalive,
      timeout: 10,

      onSuccess: function () {
        isConnected = true;
        setStatus('connected');
        addLog('✅ Berhasil terhubung ke broker MQTT!', 'success');
        showToast('Terhubung ke broker MQTT', 'success');

        // Subscribe ke topik telemetri sensor
        mqttClient.subscribe(MQTT_CONFIG.topicSub, {
          qos: 1,
          onSuccess: function () {
            addLog('✅ Subscribe → ' + MQTT_CONFIG.topicSub, 'success');
          },
          onFailure: function (e) {
            addLog('❌ Gagal subscribe: ' + e.errorMessage, 'error');
          },
        });
      },

      onFailure: function (e) {
        isConnected = false;
        setStatus('disconnected');
        addLog('❌ Gagal terhubung: ' + e.errorMessage, 'error');
        showToast('Gagal terhubung ke broker', 'error');
        // Coba lagi setelah 8 detik
        setTimeout(connectMQTT, 8000);
      },
    });
  } catch (e) {
    isConnected = false;
    setStatus('disconnected');
    addLog('❌ Error MQTT: ' + e.message, 'error');
  }
}