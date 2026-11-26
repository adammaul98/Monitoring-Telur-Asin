/* =====================================================================
   SaltingEgg IoT — kotak pengasinan 3D (Three.js)
   Membaca kondisi dari window.TELUR3D_STATE yang diisi oleh program utama.
   ===================================================================== */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

function init() {
  const host = document.getElementById('scene');
  if (!host) return;

  /* ---------- renderer ---------- */
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (e) { console.warn('WebGL tidak tersedia, memakai tampilan 2D'); return; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.className = 'three';
  host.prepend(renderer.domElement);
  host.classList.add('is-3d');
  host.setAttribute('data-noswipe', '');   // geser di sini = memutar 3D, bukan pindah halaman

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);

  /* ---------- ukuran kotak ---------- */
  const W = 4, D = 2.6, H = 2.4;          // lebar, dalam, tinggi kotak
  const IW = W - 0.06, ID = D - 0.06;     // ukuran air di dalam

  /* ---------- cahaya ---------- */
  const hemi = new THREE.HemisphereLight(0xa5d8ff, 0x0b1222, 1.1);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(4, 7, 5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: 1, far: 20 });
  scene.add(sun);
  const rim = new THREE.DirectionalLight(0x67e8f9, 0.6);
  rim.position.set(-5, 3, -4);
  scene.add(rim);

  /* ---------- meja ---------- */
  const table = new THREE.Mesh(
    new THREE.BoxGeometry(7.2, 0.18, 4.4),
    new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.75, metalness: 0.1 })
  );
  table.position.y = -0.17;
  table.receiveShadow = true;
  scene.add(table);
  const tableEdge = new THREE.Mesh(
    new THREE.BoxGeometry(7.24, 0.04, 4.44),
    new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xf59e0b, emissiveIntensity: 0.25, roughness: 0.4 })
  );
  tableEdge.position.y = -0.27;
  scene.add(tableEdge);

  /* ---------- kotak kaca ---------- */
  const tank = new THREE.Group();
  scene.add(tank);
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(W + 0.12, 0.08, D + 0.12),
    new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.5, metalness: 0.3 })
  );
  base.position.y = -0.04;
  base.receiveShadow = true;
  tank.add(base);

  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xcff4ff, transparent: true, opacity: 0.12, roughness: 0.05, metalness: 0,
    clearcoat: 1, side: THREE.DoubleSide, depthWrite: false, emissive: 0x22d3ee, emissiveIntensity: 0
  });
  const walls = [
    [W, H, [0, H / 2, D / 2], 0], [W, H, [0, H / 2, -D / 2], 0],
    [D, H, [W / 2, H / 2, 0], Math.PI / 2], [D, H, [-W / 2, H / 2, 0], Math.PI / 2]
  ];
  walls.forEach(([w, h, p, ry]) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), glassMat);
    m.position.set(...p); m.rotation.y = ry; m.renderOrder = 5;
    tank.add(m);
  });
  const edgeMat = new THREE.LineBasicMaterial({ color: 0xbae6fd, transparent: true, opacity: 0.75 });
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(W, H, D)), edgeMat);
  edges.position.y = H / 2;
  tank.add(edges);
  // bibir atas kotak
  const rimMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.3, metalness: 0.6 });
  [[W + 0.06, 0.05, 0.06, 0, D / 2], [W + 0.06, 0.05, 0.06, 0, -D / 2], [0.06, 0.05, D, W / 2, 0], [0.06, 0.05, D, -W / 2, 0]].forEach(([a, b, c, x, z]) => {
    const r = new THREE.Mesh(new THREE.BoxGeometry(a, b, c), rimMat);
    r.position.set(x, H, z);
    tank.add(r);
  });

  /* ---------- telur ---------- */
  const eggPts = [];
  for (let i = 0; i <= 28; i++) {
    const t = (i / 28) * Math.PI;
    eggPts.push(new THREE.Vector2(Math.sin(t) * 0.74 * (1 + 0.13 * Math.cos(t)), -Math.cos(t)));
  }
  const eggGeo = new THREE.LatheGeometry(eggPts, 32);
  const eggMat = new THREE.MeshStandardMaterial({ color: 0xe9f3ef, roughness: 0.55, metalness: 0 });
  const eggs = [];
  const S = 0.26;   // ukuran telur
  function addEgg(x, y, z) {
    const e = new THREE.Mesh(eggGeo, eggMat);
    e.scale.setScalar(S);
    e.rotation.set(0, Math.random() * Math.PI, Math.PI / 2 + (Math.random() - 0.5) * 0.3);
    e.position.set(x, y, z);
    e.castShadow = true; e.receiveShadow = true;
    e.userData = { y, ph: Math.random() * 6.28 };
    tank.add(e); eggs.push(e);
  }
  [-0.78, 0, 0.78].forEach(z => [-1.2, -0.6, 0, 0.6, 1.2].forEach(x => addEgg(x + (Math.random() - 0.5) * 0.06, 0.2, z + (Math.random() - 0.5) * 0.08)));
  [-0.4, 0.4].forEach(z => [-0.9, -0.3, 0.3, 0.9].forEach(x => addEgg(x, 0.52, z)));

  /* ---------- air garam ---------- */
  const waterMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.45, roughness: 0.1, metalness: 0.1, depthWrite: false });
  const water = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), waterMat);
  water.renderOrder = 3;
  tank.add(water);
  const surfGeo = new THREE.PlaneGeometry(IW, ID, 48, 30);
  surfGeo.rotateX(-Math.PI / 2);
  const surfBase = surfGeo.attributes.position.array.slice();
  const surfMat = new THREE.MeshStandardMaterial({ emissive: 0x60a5fa, emissiveIntensity: 0, color: 0x7dd3fc, transparent: true, opacity: 0.6, roughness: 0.05, metalness: 0.25, side: THREE.DoubleSide, depthWrite: false });
  const surface = new THREE.Mesh(surfGeo, surfMat);
  surface.renderOrder = 4;
  tank.add(surface);

  /* ---------- butiran garam (makin pekat makin banyak) ---------- */
  const NS = 420;
  const saltPos = new Float32Array(NS * 3), saltSeed = [];
  for (let i = 0; i < NS; i++) saltSeed.push([(Math.random() - 0.5) * (IW - 0.2), Math.random(), (Math.random() - 0.5) * (ID - 0.2), Math.random() * 6.28]);
  const saltGeo = new THREE.BufferGeometry();
  saltGeo.setAttribute('position', new THREE.BufferAttribute(saltPos, 3));
  const salt = new THREE.Points(saltGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.035, transparent: true, opacity: 0.85, depthWrite: false }));
  salt.renderOrder = 4;
  tank.add(salt);

  /* ---------- gelembung (makin panas makin cepat) ---------- */
  const NB = 34;
  const bubbles = new THREE.InstancedMesh(new THREE.SphereGeometry(0.03, 10, 8), new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, roughness: 0, depthWrite: false }), NB);
  bubbles.renderOrder = 4;
  const bubSeed = [];
  for (let i = 0; i < NB; i++) bubSeed.push([(Math.random() - 0.5) * (IW - 0.4), (Math.random() - 0.5) * (ID - 0.4), Math.random(), 0.6 + Math.random() * 0.8, 0.5 + Math.random()]);
  tank.add(bubbles);

  /* ---------- embun di kaca (kelembaban dalam) ---------- */
  const ND = 90;
  const dropMat = new THREE.MeshStandardMaterial({ emissive: 0x22d3ee, emissiveIntensity: 0, color: 0xe0f2fe, transparent: true, opacity: 0.4, roughness: 0, metalness: 0.2, depthWrite: false });
  const drops = new THREE.InstancedMesh(new THREE.SphereGeometry(0.022, 8, 6), dropMat, ND);
  const dropSeed = [];
  for (let i = 0; i < ND; i++) {
    const side = i % 2 ? 1 : -1;
    dropSeed.push([(Math.random() - 0.5) * (W - 0.2), Math.random(), side * (D / 2 - 0.015), 0.7 + Math.random() * 0.8, Math.random()]);
  }
  drops.renderOrder = 6;
  tank.add(drops);

  /* ---------- sensor ketinggian air: batang + pelampung + penggaris ---------- */
  const metal = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.25, metalness: 0.9 });
  const LX = -W / 2 + 0.22, LZ = D / 2 - 0.25;
  const rodMat = metal.clone(); rodMat.emissive = new THREE.Color(0x60a5fa); rodMat.emissiveIntensity = 0;
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, H + 0.3, 12), rodMat);
  rod.position.set(LX, (H + 0.3) / 2, LZ);
  tank.add(rod);
  const float = new THREE.Group();
  const fTop = new THREE.Mesh(new THREE.SphereGeometry(0.11, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xf43f5e, roughness: 0.35, emissive: 0xf43f5e, emissiveIntensity: 0.15 }));
  const fBot = new THREE.Mesh(new THREE.SphereGeometry(0.11, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4, emissive: 0x60a5fa, emissiveIntensity: 0 }));
  float.add(fTop, fBot);
  float.position.set(LX, 1, LZ);
  fTop.castShadow = true;
  tank.add(float);

  function rulerTexture(low) {
    const c = document.createElement('canvas'); c.width = 128; c.height = 512;
    const g = c.getContext('2d');
    g.clearRect(0, 0, 128, 512);
    g.fillStyle = 'rgba(2,6,23,0.55)'; g.fillRect(0, 0, 128, 512);
    for (let v = 0; v <= 100; v += 5) {
      const y = 500 - v * 4.88;
      const major = v % 25 === 0;
      g.fillStyle = major ? '#e2e8f0' : 'rgba(226,232,240,0.6)';
      g.fillRect(0, y - 1.5, major ? 56 : (v % 10 === 0 ? 38 : 24), major ? 4 : 2.5);
      if (major) { g.font = 'bold 30px monospace'; g.fillText(String(v), 62, y + 10); }
    }
    const ly = 500 - low * 4.88;
    g.fillStyle = '#fb7185'; g.fillRect(0, ly - 2, 128, 4);
    g.font = 'bold 22px monospace'; g.fillText('BATAS', 52, ly - 8);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    return t;
  }
  const rulerMat = new THREE.MeshBasicMaterial({ map: rulerTexture(20), transparent: true, depthWrite: false });
  const ruler = new THREE.Mesh(new THREE.PlaneGeometry(0.42, H * 0.98), rulerMat);
  ruler.position.set(-W / 2 + 0.012, H * 0.49 + 0.02, -0.35);
  ruler.rotation.y = Math.PI / 2;
  ruler.renderOrder = 6;
  tank.add(ruler);

  /* ---------- termometer (suhu air) ---------- */
  const TX = W / 2 - 0.25, TZ = D / 2 - 0.3;
  const tubeMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.25, roughness: 0, side: THREE.DoubleSide, depthWrite: false, emissive: 0xf59e0b, emissiveIntensity: 0 });
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 1.7, 16, 1, true), tubeMat);
  tube.position.set(TX, 0.25 + 0.85, TZ);
  tube.renderOrder = 6;
  tank.add(tube);
  const mercMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x22c55e, emissiveIntensity: 0.5, roughness: 0.3 });
  const merc = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 1, 12), mercMat);
  merc.position.set(TX, 0.25, TZ);
  tank.add(merc);
  const tbulb = new THREE.Mesh(new THREE.SphereGeometry(0.1, 20, 14), mercMat);
  tbulb.position.set(TX, 0.2, TZ);
  tank.add(tbulb);
  const tcap = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.1, 16), metal);
  tcap.position.set(TX, 1.98, TZ);
  tank.add(tcap);

  /* ---------- sensor TDS: probe + kabel + alat ukur di meja ---------- */
  const PX = W / 2 - 0.35, PZ = -D / 2 + 0.35, TIP = H * 0.3;
  const probeMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.4, metalness: 0.4, emissive: 0xf472b6, emissiveIntensity: 0 });
  const probe = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.95, 20), probeMat);
  probe.position.set(PX, TIP + 0.12 + 0.475, PZ);
  probe.castShadow = true;
  tank.add(probe);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.072, 0.05, 20), new THREE.MeshStandardMaterial({ color: 0xf472b6, emissive: 0xf472b6, emissiveIntensity: 0.6 }));
  band.position.set(PX, TIP + 0.75, PZ);
  tank.add(band);
  [-0.025, 0.025].forEach(dx => {
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.14, 8), metal);
    pin.position.set(PX + dx, TIP + 0.06, PZ);
    tank.add(pin);
  });
  const cableCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(PX, TIP + 1.07, PZ), new THREE.Vector3(PX, H + 0.45, PZ),
    new THREE.Vector3(PX + 0.45, H + 0.55, PZ - 0.1), new THREE.Vector3(W / 2 + 0.55, H - 0.2, PZ - 0.3),
    new THREE.Vector3(W / 2 + 0.75, 0.25, PZ - 0.2)
  ]);
  tank.add(new THREE.Mesh(new THREE.TubeGeometry(cableCurve, 60, 0.018, 8), probeMat));
  // denyut sinyal dari ujung probe
  const pulses = [0, 0.5].map(off => {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.06, 0.085, 40), new THREE.MeshBasicMaterial({ color: 0xf472b6, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.set(PX, TIP, PZ); m.userData.off = off; m.renderOrder = 6;
    tank.add(m); return m;
  });
  // alat ukur TDS di meja dengan layar angka
  const meterCanvas = document.createElement('canvas'); meterCanvas.width = 256; meterCanvas.height = 128;
  const meterTex = new THREE.CanvasTexture(meterCanvas); meterTex.colorSpace = THREE.SRGBColorSpace;
  const meter = new THREE.Group();
  const meterMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.5, metalness: 0.3, emissive: 0xf472b6, emissiveIntensity: 0 });
  const meterBody = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 0.18), meterMat);
  meterBody.castShadow = true;
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.78, 0.39), new THREE.MeshBasicMaterial({ map: meterTex, toneMapped: false }));
  screen.position.z = 0.091;
  meter.add(meterBody, screen);
  meter.position.set(W / 2 + 0.85, 0.25, PZ + 0.35);
  meter.rotation.set(-0.15, -0.55, 0);
  scene.add(meter);
  let meterKey = '';
  function drawMeter(st) {
    const key = [st.tdsText, st.tdsUnit, st.dry, Math.round(st.tdsPct * 5)].join('|');
    if (key === meterKey) return; meterKey = key;
    const g = meterCanvas.getContext('2d');
    g.fillStyle = '#04120d'; g.fillRect(0, 0, 256, 128);
    g.fillStyle = '#f9a8d4'; g.font = 'bold 22px monospace'; g.fillText('TDS', 12, 28);
    g.fillStyle = st.dry ? '#fbbf24' : '#a7f3d0'; g.font = 'bold 54px monospace';
    g.textAlign = 'right'; g.fillText(st.dry ? 'KERING' : String(st.tdsText), 244, 84); g.textAlign = 'left';
    g.fillStyle = '#94a3b8'; g.font = 'bold 18px monospace'; g.fillText(st.dry ? 'probe' : (st.tdsUnit || 'ppm'), 12, 52);
    const n = st.tdsKnown ? Math.max(1, Math.ceil(st.tdsPct * 5)) : 0;
    for (let i = 0; i < 5; i++) { g.fillStyle = i < n ? '#f472b6' : '#1f2937'; g.fillRect(12 + i * 47, 100, 40, 14); }
    meterTex.needsUpdate = true;
  }

  /* ---------- lampu ---------- */
  const LAMP_Y = 3.75;
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 2, 6), new THREE.MeshStandardMaterial({ color: 0x334155 }));
  cord.position.set(0, LAMP_Y + 1.25, 0);
  scene.add(cord);
  const shadeMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.4, metalness: 0.5, side: THREE.DoubleSide });
  const shade = new THREE.Mesh(new THREE.ConeGeometry(0.6, 0.5, 40, 1, true), shadeMat);
  shade.position.set(0, LAMP_Y + 0.12, 0);
  scene.add(shade);
  const bulbMat = new THREE.MeshStandardMaterial({ color: 0x64748b, emissive: 0xfde68a, emissiveIntensity: 0, roughness: 0.2 });
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 24, 16), bulbMat);
  bulb.position.set(0, LAMP_Y - 0.12, 0);
  scene.add(bulb);
  const spot = new THREE.SpotLight(0xffd27a, 0, 12, 0.62, 0.55, 1.4);
  spot.position.set(0, LAMP_Y - 0.15, 0);
  spot.target.position.set(0, 0, 0);
  spot.castShadow = true;
  spot.shadow.mapSize.set(1024, 1024);
  scene.add(spot, spot.target);
  const glow = new THREE.PointLight(0xffc96b, 0, 4, 1.5);
  glow.position.copy(bulb.position);
  scene.add(glow);
  const beam = new THREE.Mesh(
    new THREE.ConeGeometry(2.3, LAMP_Y - 0.2, 48, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfde68a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
  );
  beam.position.set(0, (LAMP_Y - 0.2) / 2, 0);
  beam.renderOrder = 7;
  scene.add(beam);

  /* ---------- kamera & kontrol ---------- */
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 1.45, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.enableZoom = false;              // agar scroll halaman tidak tertahan
  controls.minPolarAngle = 0.75;
  controls.maxPolarAngle = 1.42;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.6;
  renderer.domElement.style.touchAction = 'pan-y';   // geser atas-bawah tetap menggulir halaman
  let idleT;
  const hint = document.getElementById('hud-hint');
  let dragging = false;
  controls.addEventListener('start', () => {
    dragging = true;
    controls.autoRotate = false; clearTimeout(idleT);
    if (hint) hint.classList.add('hide');
  });
  controls.addEventListener('end', () => { dragging = false; idleT = setTimeout(() => { if (!focus) controls.autoRotate = true; }, 8000); });

  let radius = 10;
  function placeCamera(az, el) {
    camera.position.set(radius * Math.cos(el) * Math.sin(az), controls.target.y + radius * Math.sin(el), radius * Math.cos(el) * Math.cos(az));
    camera.lookAt(controls.target);
  }
  function resize() {
    const w = host.clientWidth || 300, h = host.clientHeight || 300;
    renderer.setSize(w, h, false);
    const aspect = w / h;
    camera.aspect = aspect;
    const hfov = (aspect < 1.1 ? 37 : 45) * Math.PI / 180;
    camera.fov = THREE.MathUtils.clamp(2 * Math.atan(Math.tan(hfov / 2) / aspect) * 180 / Math.PI, 28, 60);
    camera.updateProjectionMatrix();
  }
  resize();
  placeCamera(0.62, 0.38);
  if (window.ResizeObserver) new ResizeObserver(resize).observe(host);
  else window.addEventListener('resize', resize);

  /* ---------- kondisi (diperhalus) ---------- */
  const cur = { level: 70, temp: 28, tds: 0.3, hum: 0.5, lamp: 0, eggP: 0, low: 0 };
  let st = { level: 70, temp: null, tempColor: '#38bdf8', tdsPct: 0.3, tdsKnown: false, dry: false, tdsText: '—', tdsUnit: 'ppm', hum: null, lamp: false, eggP: 0, low: false, lowLine: 20 };
  let lowLine = 20;
  const waterCold = new THREE.Color(0x38bdf8), waterWarm = new THREE.Color(0xf59e0b), milky = new THREE.Color(0xf1f5f9);
  const eggA = new THREE.Color(0xe9f3ef), eggB = new THREE.Color(0xa9c9bc);
  const edgeNormal = new THREE.Color(0xbae6fd), edgeRed = new THREE.Color(0xfb7185);
  const tmpC = new THREE.Color(), tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpS = new THREE.Vector3(), tmpP = new THREE.Vector3();

  function update(s) {
    if (!s) return;
    st = s;
    if (s.lowLine !== lowLine) { lowLine = s.lowLine; rulerMat.map.dispose(); rulerMat.map = rulerTexture(lowLine); rulerMat.needsUpdate = true; }
    drawMeter(s);
  }
  /* ---------- sorot bagian (ketuk indikator) ---------- */
  const FOCUS = {
    level: { color: 0x60a5fa, az: -0.6, el: 0.3 },
    tds:   { color: 0xf472b6, az: 1.25, el: 0.38 },
    temp:  { color: 0xf59e0b, az: 0.8, el: 0.28 },
    hum:   { color: 0x22d3ee, az: 0.1, el: 0.3 },
    lamp:  { color: 0xfde68a, az: null, el: 0.62 }
  };
  let focus = null, haloKey = null;
  const fcur = { level: 0, tds: 0, temp: 0, hum: 0, lamp: 0 };
  const haloCanvas = document.createElement('canvas'); haloCanvas.width = haloCanvas.height = 128;
  (() => {
    const g = haloCanvas.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  })();
  const haloMat = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(haloCanvas), color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false });
  const halo = new THREE.Sprite(haloMat);
  halo.renderOrder = 20;
  scene.add(halo);
  function setFocus(k) {
    focus = FOCUS[k] ? k : null;
    if (focus) { haloKey = focus; haloMat.color.setHex(FOCUS[focus].color); controls.autoRotate = false; clearTimeout(idleT); }
    else idleT = setTimeout(() => { if (!focus && !dragging) controls.autoRotate = true; }, 1500);
  }
  const sph = new THREE.Spherical(), off = new THREE.Vector3();

  window.TELUR3D = { update, focus: setFocus };
  update(window.TELUR3D_STATE);

  /* ---------- animasi ---------- */
  const clock = new THREE.Clock();
  let visible = true;
  if (window.IntersectionObserver) new IntersectionObserver(es => { visible = es[0].isIntersecting; }).observe(host);
  const dashPage = document.getElementById('page-dashboard');

  function frame() {
    requestAnimationFrame(frame);
    if (!visible || document.hidden || (dashPage && !dashPage.classList.contains('is-active'))) { clock.getDelta(); return; }
    const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime, k = 1 - Math.pow(0.02, dt);

    cur.level += ((st.level ?? 70) - cur.level) * k;
    cur.temp += ((st.temp ?? 28) - cur.temp) * k;
    cur.tds += ((st.tdsKnown ? st.tdsPct : 0.25) - cur.tds) * k;
    cur.hum += ((st.hum == null ? 0.3 : THREE.MathUtils.clamp((st.hum - 30) / 70, 0.05, 1)) - cur.hum) * k;
    cur.lamp += ((st.lamp ? 1 : 0) - cur.lamp) * k * 1.5;
    cur.eggP += ((st.eggP || 0) - cur.eggP) * k;
    cur.low += ((st.low ? 1 : 0) - cur.low) * k;

    // air
    const wh = Math.max(0.03, THREE.MathUtils.clamp(cur.level, 0, 100) / 100 * (H - 0.06));
    water.scale.set(IW, wh, ID);
    water.position.y = wh / 2;
    const warm = THREE.MathUtils.clamp((cur.temp - 30) / 12, 0, 0.6);
    tmpC.copy(waterCold).lerp(waterWarm, warm).lerp(milky, cur.tds * 0.28);
    waterMat.color.copy(tmpC);
    waterMat.opacity = 0.42 + cur.tds * 0.18;
    surfMat.color.copy(tmpC).lerp(milky, 0.3);
    surface.position.y = wh;
    const pa = surfGeo.attributes.position.array;
    for (let i = 0; i < pa.length; i += 3) {
      const x = surfBase[i], z = surfBase[i + 2];
      pa[i + 1] = Math.sin(x * 2.6 + t * 1.8) * 0.022 + Math.cos(z * 3.4 + t * 1.3) * 0.018 + Math.sin((x + z) * 5 + t * 2.6) * 0.006;
    }
    surfGeo.attributes.position.needsUpdate = true;
    surfGeo.computeVertexNormals();

    // garam
    const ns = Math.round(NS * Math.max(0.06, cur.tds));
    for (let i = 0; i < ns; i++) {
      const s = saltSeed[i];
      saltPos[i * 3] = s[0] + Math.sin(t * 0.4 + s[3]) * 0.05;
      saltPos[i * 3 + 1] = 0.03 + ((s[1] + Math.sin(t * 0.25 + s[3]) * 0.03 + 1) % 1) * (wh - 0.06);
      saltPos[i * 3 + 2] = s[2] + Math.cos(t * 0.35 + s[3]) * 0.05;
    }
    saltGeo.setDrawRange(0, ns);
    saltGeo.attributes.position.needsUpdate = true;

    // gelembung
    const speed = 0.12 + THREE.MathUtils.clamp((cur.temp - 20) / 20, 0, 1) * 0.35;
    for (let i = 0; i < NB; i++) {
      const b = bubSeed[i];
      const f = (b[2] + t * speed * b[3]) % 1;
      tmpP.set(b[0] + Math.sin(t * 2 + i) * 0.03, 0.05 + f * (wh - 0.08), b[1]);
      tmpS.setScalar(b[4] * (0.6 + f * 0.6) * (wh > 0.15 ? 1 : 0));
      tmpM.compose(tmpP, tmpQ.identity(), tmpS);
      bubbles.setMatrixAt(i, tmpM);
    }
    bubbles.instanceMatrix.needsUpdate = true;

    // embun di kaca di atas permukaan air
    dropMat.opacity = 0.08 + cur.hum * 0.55;
    for (let i = 0; i < ND; i++) {
      const d = dropSeed[i];
      const slide = ((d[4] + t * 0.02 * d[3]) % 1);
      const y = wh + 0.08 + (1 - ((d[1] + slide * 0.3) % 1)) * Math.max(0, H - wh - 0.15);
      tmpP.set(d[0], y, d[2]);
      tmpS.set(d[3], d[3] * 1.35, 0.4);
      tmpM.compose(tmpP, tmpQ.identity(), tmpS);
      drops.setMatrixAt(i, tmpM);
    }
    drops.instanceMatrix.needsUpdate = true;

    // pelampung sensor level
    float.position.y = wh + 0.02 + Math.sin(t * 2.2) * 0.012;
    float.rotation.z = Math.sin(t * 1.7) * 0.12;

    // termometer
    const tp = THREE.MathUtils.clamp(cur.temp / 50, 0.02, 1);
    merc.scale.y = 1.6 * tp;
    merc.position.y = 0.25 + (1.6 * tp) / 2;
    mercMat.color.set(st.tempColor || '#22c55e');
    mercMat.emissive.set(st.tempColor || '#22c55e');

    // probe TDS
    const submerged = wh > TIP + 0.05;
    pulses.forEach(p => {
      const f = (t * 0.55 + p.userData.off) % 1;
      p.visible = submerged;
      p.scale.setScalar(1 + f * 4);
      p.material.opacity = 0.8 * (1 - f) * (0.4 + cur.tds * 0.6);
    });
    band.material.emissiveIntensity = submerged ? 0.4 + Math.sin(t * 4) * 0.3 : 0.1;

    // telur
    eggMat.color.copy(eggA).lerp(eggB, cur.eggP);
    eggs.forEach(e => {
      const sub = wh > e.userData.y + 0.1;
      e.position.y = e.userData.y + (sub ? Math.sin(t * 1.1 + e.userData.ph) * 0.012 : 0);
    });

    // lampu
    bulbMat.emissiveIntensity = cur.lamp * 3;
    bulbMat.color.set(cur.lamp > 0.5 ? 0xfef3c7 : 0x64748b);
    shadeMat.color.set(cur.lamp > 0.5 ? 0x92400e : 0x334155);
    shadeMat.emissive.setHex(0xf59e0b); shadeMat.emissiveIntensity = cur.lamp * 0.25;
    const flick = 1 + Math.sin(t * 9) * 0.015 + Math.sin(t * 23) * 0.01;
    spot.intensity = cur.lamp * 42 * flick;
    glow.intensity = cur.lamp * 6;
    beam.material.opacity = cur.lamp * 0.07 * flick;
    const sway = Math.sin(t * 0.8) * 0.03;
    shade.rotation.z = sway; bulb.position.x = -sway * 0.1;

    // peringatan air rendah: rangka kotak berkedip merah
    const pulse = cur.low * (0.5 + 0.5 * Math.sin(t * 5));
    edgeMat.color.copy(edgeNormal).lerp(edgeRed, Math.max(cur.low * 0.6, pulse));

    // ---------- efek sorot ----------
    let fmax = 0;
    for (const key in fcur) { fcur[key] += ((focus === key ? 1 : 0) - fcur[key]) * Math.min(1, k * 1.6); fmax = Math.max(fmax, fcur[key]); }
    const pl = 0.5 + 0.5 * Math.sin(t * 4.5);
    hemi.intensity = 1.1 - fmax * 0.55;
    sun.intensity = 1.6 - fmax * 0.8;
    // ketinggian air
    let e = fcur.level;
    fTop.material.emissiveIntensity = 0.15 + e * (0.9 + pl);
    fBot.material.emissiveIntensity = e * (0.5 + pl * 0.6);
    rodMat.emissiveIntensity = e * (0.5 + pl * 0.8);
    surfMat.emissiveIntensity = e * (0.15 + pl * 0.2);
    float.scale.setScalar(1 + e * 0.45);
    rulerMat.color.setScalar(1 + e * 0.6 * pl);
    // TDS
    e = fcur.tds;
    probeMat.emissiveIntensity = e * (0.35 + pl * 0.5);
    meterMat.emissiveIntensity = e * (0.25 + pl * 0.35);
    meter.scale.setScalar(1 + e * 0.18);
    band.material.emissiveIntensity += e * 1.2;
    pulses.forEach(p => { p.material.opacity = Math.min(1, p.material.opacity + e * 0.5); });
    // suhu air
    e = fcur.temp;
    mercMat.emissiveIntensity = 0.5 + e * (1.4 + pl * 1.2);
    tubeMat.emissiveIntensity = e * (0.3 + pl * 0.4);
    tubeMat.opacity = 0.25 + e * 0.25;
    tube.scale.set(1 + e * 0.35, 1, 1 + e * 0.35);
    tbulb.scale.setScalar(1 + e * 0.3);
    // kelembaban dalam
    e = fcur.hum;
    dropMat.opacity = Math.min(0.95, dropMat.opacity + e * 0.45);
    dropMat.emissiveIntensity = e * (0.6 + pl * 0.8);
    glassMat.emissiveIntensity = e * (0.12 + pl * 0.12);
    // lampu
    e = fcur.lamp;
    bulbMat.emissiveIntensity = Math.max(bulbMat.emissiveIntensity, e * (1.2 + pl * 1.8));
    if (e > 0.5 && cur.lamp < 0.5) bulbMat.color.set(0xfef3c7);
    shadeMat.emissiveIntensity += e * (0.35 + pl * 0.45);
    beam.material.opacity = Math.max(beam.material.opacity, e * 0.035 * pl);
    // cahaya sorot (halo)
    if (haloKey && fmax > 0.01) {
      const hp = { level: [LX, wh, LZ, 0.9], tds: [PX, TIP + 0.5, PZ, 1.3], temp: [TX, 1.05, TZ, 1.4],
        hum: [0, (wh + H) / 2, D / 2, 2.6], lamp: [bulb.position.x, bulb.position.y, 0, 1.4] }[haloKey];
      halo.visible = true;
      halo.position.set(hp[0], hp[1], hp[2]);
      halo.scale.setScalar(hp[3] * (1 + pl * 0.15));
      haloMat.opacity = fmax * (0.35 + pl * 0.3);
    } else halo.visible = false;
    // kamera berputar ke arah bagian yang disorot
    if (focus && !dragging) {
      const F = FOCUS[focus];
      off.copy(camera.position).sub(controls.target);
      sph.setFromVector3(off);
      if (F.az !== null) { let d = F.az - sph.theta; d = Math.atan2(Math.sin(d), Math.cos(d)); sph.theta += d * Math.min(1, k * 0.9); }
      sph.phi += ((Math.PI / 2 - F.el) - sph.phi) * Math.min(1, k * 0.9);
      off.setFromSpherical(sph);
      camera.position.copy(controls.target).add(off);
    }

    controls.update();
    renderer.render(scene, camera);
  }
  frame();
}

try { init(); } catch (e) { console.warn('Tampilan 3D gagal, memakai tampilan 2D:', e); const h = document.getElementById('scene'); if (h) h.classList.remove('is-3d'); }
