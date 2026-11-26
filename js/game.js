/* Cinco Noches en Puty's — juego de terror 3D (Three.js) */
(() => {
'use strict';
const $ = id => document.getElementById(id);
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const params = new URLSearchParams(location.search);
const HOUR_SEC = params.has('fast') ? 5 : 45;     // segundos reales por "hora" de juego
const H = 3.2;                                    // altura de techo

/* ------------------------------------------------------------------ */
/* Renderer / escena                                                   */
/* ------------------------------------------------------------------ */
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas: $('gl'), antialias: true, powerPreference: 'high-performance' });
} catch (e) {
  $('noWebgl').classList.remove('hidden'); $('menu').classList.add('hidden'); return;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
scene.fog = new THREE.FogExp2(0x000000, 0.035);

const camera = new THREE.PerspectiveCamera(72, 1, 0.05, 80);
camera.rotation.order = 'YXZ';
const EYE = new THREE.Vector3(0, 1.35, 1.7);
camera.position.copy(EYE);
const viewCam = new THREE.PerspectiveCamera(62, 1, 0.1, 80);

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = viewCam.aspect = w / h;
  camera.updateProjectionMatrix(); viewCam.updateProjectionMatrix();
}
window.addEventListener('resize', resize); resize();

/* ------------------------------------------------------------------ */
/* Texturas procedurales                                               */
/* ------------------------------------------------------------------ */
function canvasTex(w, h, draw, rep) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
  return t;
}
const floorTex = canvasTex(128, 128, (g, w, h) => {
  g.fillStyle = '#d9d2c3'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#1b1b22'; g.fillRect(0, 0, w / 2, h / 2); g.fillRect(w / 2, h / 2, w / 2, h / 2);
  for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * .08})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
}, [16, 14]);
const wallTexBase = canvasTex(128, 128, (g, w, h) => {
  g.fillStyle = '#4a3a66'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#3a2c52'; for (let x = 0; x < w; x += 32) g.fillRect(x, 0, 16, h);
  g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, h * .78, w, h * .22);
  for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * .1})`; g.fillRect(Math.random() * w, Math.random() * h, 3, 3); }
});
const wallCache = {};
function wallMat(len) {
  const k = Math.round(len);
  if (!wallCache[k]) {
    const t = wallTexBase.clone(); t.needsUpdate = true;
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(Math.max(1, k / 1.6), 2);
    wallCache[k] = new THREE.MeshLambertMaterial({ map: t });
  }
  return wallCache[k];
}
function posterTex(text, bg, fg, sub) {
  return canvasTex(256, 360, (g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.strokeStyle = fg; g.lineWidth = 8; g.strokeRect(10, 10, w - 20, h - 20);
    g.fillStyle = fg; g.textAlign = 'center'; g.font = 'bold 42px Arial';
    const words = text.split(' ');
    words.forEach((wd, i) => g.fillText(wd, w / 2, 90 + i * 52));
    if (sub) { g.font = '20px Arial'; g.fillText(sub, w / 2, h - 50); }
    g.beginPath(); g.arc(w / 2, h - 110, 28, 0, 7); g.fill();
  });
}
function bannerTex(text) {
  return canvasTex(512, 96, (g, w, h) => {
    g.fillStyle = '#7a1022'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#ffd24d'; g.font = 'bold 54px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, w / 2, h / 2 + 3);
    g.strokeStyle = '#ffd24d'; g.lineWidth = 4; g.strokeRect(4, 4, w - 8, h - 8);
  });
}

/* ------------------------------------------------------------------ */
/* Utilidades de construcción                                          */
/* ------------------------------------------------------------------ */
const lam = (c, extra) => new THREE.MeshLambertMaterial(Object.assign({ color: c }, extra || {}));
const bas = c => new THREE.MeshBasicMaterial({ color: c });
function box(w, h, d, x, y, z, m, parent) {
  const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  o.position.set(x, y, z); (parent || scene).add(o); return o;
}
function cyl(rt, rb, h, x, y, z, m, parent, seg) {
  const o = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg || 14), m);
  o.position.set(x, y, z); (parent || scene).add(o); return o;
}
function sph(r, x, y, z, m, parent) {
  const o = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), m);
  o.position.set(x, y, z); (parent || scene).add(o); return o;
}
// Pared alineada a ejes entre (ax,az) y (bx,bz); y0..y1 opcional
function wall(ax, az, bx, bz, y0, y1) {
  y0 = y0 || 0; y1 = y1 || H;
  const len = Math.hypot(bx - ax, bz - az), t = 0.2;
  const horiz = Math.abs(bz - az) < 0.01;
  const w = horiz ? len : t, d = horiz ? t : len;
  return box(w, y1 - y0, d, (ax + bx) / 2, (y0 + y1) / 2, (az + bz) / 2, wallMat(len));
}
function poster(tex, w, h, x, y, z, ry) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshLambertMaterial({ map: tex }));
  m.position.set(x, y, z); m.rotation.y = ry || 0; scene.add(m); return m;
}

/* ------------------------------------------------------------------ */
/* Mapa del local                                                      */
/* ------------------------------------------------------------------ */
// Suelo y techo
const floor = new THREE.Mesh(new THREE.PlaneGeometry(24, 21), new THREE.MeshLambertMaterial({ map: floorTex }));
floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, -7.5); scene.add(floor);
const ceil = new THREE.Mesh(new THREE.PlaneGeometry(24, 21), lam(0x15131c, { side: THREE.DoubleSide }));
ceil.rotation.x = Math.PI / 2; ceil.position.set(0, H, -7.5); scene.add(ceil);

// Oficina x[-3,3] z[-2,3]
wall(-3, -2, 3, -2); wall(-3, 3, 3, 3);
const DOOR_HALF = 0.78;
[-3, 3].forEach(x => {
  wall(x, -2, x, -DOOR_HALF); wall(x, DOOR_HALF, x, 3);
  box(0.2, H - 2.4, DOOR_HALF * 2, x, (H + 2.4) / 2, 0, wallMat(2));
});
// Pasillo oeste
wall(-6.2, -10, -6.2, -6); wall(-6.2, -2, -6.2, 1.2); wall(-6.2, 1.2, -3, 1.2); wall(-3.1, -10, -3.1, -2);
// Pasillo este
wall(6.2, -10, 6.2, 1.2); wall(6.2, 1.2, 3, 1.2); wall(3.1, -10, 3.1, -2);
// Comedor x[-7,7] z[-18,-10]
wall(-7, -18, 7, -18);
wall(-7, -10, -6.2, -10); wall(-3.1, -10, 3.1, -10); wall(6.2, -10, 7, -10);
wall(7, -18, 7, -16); wall(7, -12, 7, -10);                 // abertura a cocina
wall(-7, -11, -7, -10);                                     // abertura a cove
// Cocina x[7,12] z[-18,-10]
wall(7, -18, 12, -18); wall(12, -18, 12, -10); wall(7, -10, 12, -10);
// Almacén x[-9.5,-6.2] z[-6,-2]
wall(-9.5, -6, -6.2, -6); wall(-9.5, -6, -9.5, -2); wall(-9.5, -2, -6.2, -2);
// Cove pirata x[-12,-7] z[-18,-11]
wall(-12, -18, -7, -18); wall(-12, -18, -12, -11); wall(-12, -11, -7, -11);

// Escenario
const stageMat = lam(0x3a2a1d);
box(9, 0.5, 3, 0, 0.25, -16.5, stageMat);
box(9.2, 0.08, 3.2, 0, 0.52, -16.5, lam(0x5a3d26));
[-1, 1].forEach(s => { box(1.6, 3, 0.15, s * 3.7, 1.5, -17.8, lam(0x8c1020)); });
box(5.6, 3, 0.1, 0, 1.5, -17.88, lam(0x241a30));
poster(bannerTex("¡PUTY'S PIZZA!"), 5.4, 0.95, 0, 2.7, -17.8, 0);

// Mesas del comedor
function table(x, z, c) {
  cyl(0.9, 0.9, 0.08, x, 0.78, z, lam(c));
  cyl(0.1, 0.1, 0.78, x, 0.39, z, lam(0x888888));
  cyl(0.45, 0.45, 0.05, x, 0.04, z, lam(0x888888));
  for (let i = 0; i < 3; i++) {
    const a = i * 2.1 + x;
    const h = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.28, 8), lam([0xff4477, 0x44ccff, 0xffdd33][i]));
    h.position.set(x + Math.cos(a) * 0.5, 0.96, z + Math.sin(a) * 0.5); scene.add(h);
  }
}
[[-4, -13.5, 0x3a6ea5], [4, -13.5, 0xa5453a], [-1.6, -11.4, 0x5aa56a], [1.8, -12.2, 0xd2b13a], [-4.6, -16, 0xa53aa0]].forEach(a => table(...a));
// Globos y carteles
[[-6.5, -17, 0xff3355], [6.5, -17.2, 0x33aaff], [-6.2, -12, 0xffcc33], [6.3, -11.5, 0x44dd77]].forEach(([x, z, c]) => {
  sph(0.3, x, 2.4, z, lam(c)); box(0.01, 1.4, 0.01, x, 1.7, z, lam(0xdddddd));
});
poster(posterTex('FELIZ CUMPLE', '#2a5a8a', '#ffe08a', 'Puty\'s'), 1.3, 1.8, -6.9, 1.7, -14, Math.PI / 2);
poster(posterTex('CELEBRA CON NOSOTROS', '#8a2a4a', '#fff', '¡Pizza!'), 1.3, 1.8, 6.9, 1.7, -14.5, -Math.PI / 2);

// Cocina
box(4, 1, 1, 9.8, 0.5, -17.3, lam(0x9a9a9a)); box(1, 1, 3.5, 11.4, 0.5, -14, lam(0x8a8a8a));
cyl(0.3, 0.3, 0.4, 9, 1.2, -17.3, lam(0x555555)); cyl(0.25, 0.25, 0.3, 10.4, 1.15, -17.3, lam(0x666666));
box(1.5, 2, 0.8, 8, 1, -10.6, lam(0xb0b0b0));

// Almacén: estanterías
box(0.5, 2.2, 2.6, -9.1, 1.1, -4, lam(0x4a3a2a)); box(1.2, 1, 1, -7.2, 0.5, -5.3, lam(0x7a5a3a)); box(0.8, 0.8, 0.8, -8.2, 0.4, -2.7, lam(0x6a4a2a));
// Mascarilla vieja en el almacén
sph(0.28, -9.3, 1.9, -4.5, lam(0xcfcfcf));

// Cove pirata: cortinas + cartel
const curtMat = lam(0x9a1228, { side: THREE.DoubleSide });
const curtA = box(0.12, 3, 2.5, -7.2, 1.5, -13.25, curtMat);
const curtB = box(0.12, 3, 2.5, -7.2, 1.5, -15.75, curtMat);
poster(posterTex('FUERA DE SERVICIO', '#222', '#e8e8e8', '¡Vuelve pronto!'), 1.1, 1.5, -7.0, 1.6, -17.4, -Math.PI / 2 + 0.0);
const shipWheel = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.06, 6, 14), lam(0x6a4a2a));
shipWheel.position.set(-11.8, 2, -14); shipWheel.rotation.y = Math.PI / 2; scene.add(shipWheel);

/* ------------------------------------------------------------------ */
/* Oficina: mobiliario                                                 */
/* ------------------------------------------------------------------ */
const deskMat = lam(0x5b4a3a);
box(3.0, 0.08, 1.2, 0, 0.8, 0.3, deskMat);
box(3.0, 0.8, 0.1, 0, 0.4, 0.82, lam(0x3a2f26)); box(0.1, 0.8, 1.1, -1.45, 0.4, 0.3, lam(0x3a2f26)); box(0.1, 0.8, 1.1, 1.45, 0.4, 0.3, lam(0x3a2f26));
// Monitores
const scrMat = new THREE.MeshBasicMaterial({ color: 0x0b2a14 });
[[-0.55, 0.1], [0.55, -0.1]].forEach(([x, ry]) => {
  const g = new THREE.Group(); g.position.set(x, 0.84, 0.15); g.rotation.y = ry; scene.add(g);
  box(0.6, 0.45, 0.35, 0, 0.3, 0, lam(0x1a1a1a), g);
  box(0.5, 0.35, 0.02, 0, 0.3, 0.18, scrMat, g);
});
// Ventilador
const fan = new THREE.Group(); fan.position.set(1.15, 1.02, 0.1); scene.add(fan);
cyl(0.12, 0.16, 0.06, 0, -0.17, 0, lam(0x222222), fan);
box(0.03, 0.2, 0.03, 0, -0.07, 0, lam(0x222222), fan);
const fanHead = new THREE.Group(); fanHead.position.y = 0.05; fan.add(fanHead);
cyl(0.05, 0.05, 0.1, 0, 0, 0, lam(0x333333), fanHead).rotation.x = Math.PI / 2;
const blades = new THREE.Group(); blades.position.z = 0.07; fanHead.add(blades);
for (let i = 0; i < 3; i++) { const b = box(0.04, 0.26, 0.01, 0, 0, 0, lam(0x9a9a9a), blades); b.rotation.z = i * 2.094; b.position.set(Math.sin(i * 2.094) * -0.12, Math.cos(i * 2.094) * 0.12, 0); }
// Teléfono, vaso, peluche
box(0.3, 0.1, 0.22, -1.1, 0.89, 0.45, lam(0x2a2a2a));
cyl(0.05, 0.04, 0.12, 0.2, 0.9, 0.55, lam(0xcc2244));
sph(0.1, -1.2, 0.95, 0.1, lam(0x8a5a2a)); sph(0.07, -1.2, 1.07, 0.1, lam(0x8a5a2a));
// Silla (detrás de cámara)
box(0.7, 0.1, 0.7, 0, 0.5, 1.9, lam(0x222222));
// Posters oficina
poster(posterTex('¡DIVIERTETE!', '#d9b43a', '#5a1a1a', 'Puty\'s'), 1.1, 1.55, -1.7, 1.7, -1.88, 0);
poster(posterTex('NO CORRER', '#2f5f8f', '#fff', 'en el local'), 1.1, 1.55, 1.7, 1.7, -1.88, 0);
poster(posterTex('REGLAS', '#3a3a3a', '#d0d0d0', 'Turno nocturno'), 0.9, 1.3, 0, 1.9, -1.88, 0);
// Cinta dibujo infantil
poster(posterTex('MI AMIGO PUTY', '#e7d9a8', '#7a2a2a', ''), 0.9, 1.25, -2.88, 1.9, 2.0, Math.PI / 2);

// Puertas deslizantes
const doorMat = lam(0x707883);
function makeDoor(x) {
  const d = new THREE.Group(); d.position.set(x, 0, 0); scene.add(d);
  const slab = box(0.14, 2.45, DOOR_HALF * 2 + 0.06, 0, 1.225, 0, doorMat, d);
  for (let i = 0; i < 6; i++) box(0.16, 0.05, DOOR_HALF * 2 + 0.08, 0, 0.3 + i * 0.4, 0, lam(0xc8a020), d);
  return d;
}
const doors = { L: makeDoor(-3), R: makeDoor(3) };
const doorAnim = { L: 0, R: 0 };          // 0 abierta .. 1 cerrada
// Cajas de botones junto a las puertas
[-2.87, 2.87].forEach(x => {
  box(0.2, 0.55, 0.3, x, 1.3, 1.25, lam(0x333333));
  box(0.04, 0.12, 0.12, x * 0.99, 1.4, 1.25, bas(x < 0 ? 0xcc2020 : 0x20aa30));
});

/* ------------------------------------------------------------------ */
/* Luces                                                               */
/* ------------------------------------------------------------------ */
const ambient = new THREE.AmbientLight(0x2a2a40, 0.55); scene.add(ambient);
const lamp = new THREE.PointLight(0xffd9a0, 1.5, 11, 1.6); lamp.position.set(0, 2.7, 0.6); scene.add(lamp);
const lampBulb = sph(0.1, 0, 2.95, 0.6, bas(0xfff0c8));
function plight(c, i, d, x, y, z) { const l = new THREE.PointLight(c, i, d, 1.6); l.position.set(x, y, z); scene.add(l); return l; }
const roomLights = {
  stage: plight(0xffe0a8, 0.9, 13, 0, 3.0, -15),
  dining: plight(0xffd7a0, 0.55, 14, 0, 3.0, -12),
  kitchen: plight(0xcfe8ff, 0.5, 9, 9.5, 3.0, -14),
  whall: plight(0xb8c8ff, 0.28, 9, -4.6, 2.9, -5),
  ehall: plight(0xb8c8ff, 0.28, 9, 4.6, 2.9, -5),
  cove: plight(0xff8866, 0.45, 8, -9.5, 2.8, -14.5),
};
const flashL = plight(0xfff1c8, 0, 9, -4.4, 2.1, 0.1);
const flashR = plight(0xfff1c8, 0, 9, 4.4, 2.1, 0.1);

/* ------------------------------------------------------------------ */
/* Animatrónicos                                                       */
/* ------------------------------------------------------------------ */
function buildAnimatronic(kind) {
  const col = { teddy: 0x6e4220, bunny: 0x5a4a9a, chicken: 0xd9b623, fox: 0xa62d1c }[kind];
  const light = { teddy: 0xb08050, bunny: 0xb8b0d8, chicken: 0xf5e08a, fox: 0xd8b090 }[kind];
  const g = new THREE.Group();
  const body = lam(col), lite = lam(light), dark = lam(0x111111), white = lam(0xf0f0f0);
  // Cuerpo
  cyl(0.38, 0.5, 1.0, 0, 1.0, 0, body, g, 18);
  cyl(0.3, 0.36, 0.7, 0, 1.05, 0.04, lite, g, 18).scale.set(1, 1, 0.8);
  // Piernas y pies
  [-0.2, 0.2].forEach(x => { cyl(0.14, 0.16, 0.6, x, 0.32, 0, body, g); box(0.26, 0.1, 0.38, x, 0.05, 0.08, dark, g); });
  // Brazos
  const arms = [];
  [-1, 1].forEach(s => {
    const a = new THREE.Group(); a.position.set(s * 0.55, 1.42, 0); g.add(a);
    cyl(0.1, 0.09, 0.85, 0, -0.38, 0, body, a); sph(0.11, 0, -0.85, 0, lite, a);
    a.rotation.z = s * 0.12; arms.push(a);
  });
  // Cabeza
  const head = new THREE.Group(); head.position.set(0, 1.92, 0); g.add(head);
  const skull = sph(0.4, 0, 0, 0, body, head); skull.scale.set(1.05, 0.92, 0.95);
  const muzzle = sph(0.22, 0, -0.1, 0.26, lite, head); muzzle.scale.set(1.1, 0.75, 0.9);
  sph(0.055, 0, -0.03, 0.46, dark, head);                                // nariz
  // Ojos brillantes
  const eyes = [];
  [-1, 1].forEach(s => {
    const e = sph(0.095, s * 0.16, 0.1, 0.32, bas(0xffffff), head);
    sph(0.045, s * 0.16, 0.1, 0.41, bas(0x000000), head);
    eyes.push(e);
  });
  // Mandíbula
  const jaw = new THREE.Group(); jaw.position.set(0, -0.2, 0.18); head.add(jaw);
  box(0.32, 0.07, 0.3, 0, -0.03, 0.08, lam(0x330508), jaw);
  for (let i = -2; i <= 2; i++) box(0.04, 0.05, 0.03, i * 0.065, 0.02, 0.22, white, jaw);
  // Rasgos propios
  if (kind === 'teddy') {
    [-1, 1].forEach(s => { sph(0.14, s * 0.34, 0.3, 0, body, head); sph(0.08, s * 0.34, 0.3, 0.06, lite, head); });
    cyl(0.2, 0.2, 0.3, 0, 0.5, 0, dark, head, 16); cyl(0.32, 0.32, 0.03, 0, 0.36, 0, dark, head, 16);
    [-1, 1].forEach(s => { const c = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.14, 8), dark); c.position.set(s * 0.09, 1.55, 0.37); c.rotation.z = s * -Math.PI / 2; g.add(c); });
    sph(0.04, 0, 1.55, 0.37, dark, g);
  } else if (kind === 'bunny') {
    [-1, 1].forEach(s => {
      const ear = box(0.11, 0.75, 0.06, s * 0.2, 0.62, -0.02, body, head); ear.rotation.z = s * -0.18;
      const inner = box(0.05, 0.6, 0.02, s * 0.2, 0.62, 0.02, lam(0xd890b8), head); inner.rotation.z = s * -0.18;
    });
    const bt = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.14, 8), lam(0xaa1133));
    bt.position.set(-0.08, 1.55, 0.37); bt.rotation.z = Math.PI / 2; g.add(bt);
    const bt2 = bt.clone(); bt2.position.x = 0.08; bt2.rotation.z = -Math.PI / 2; g.add(bt2);
  } else if (kind === 'chicken') {
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.28, 8), lam(0xe8801c));
    beak.position.set(0, -0.07, 0.5); beak.rotation.x = Math.PI / 2; head.add(beak);
    [-1, 0, 1].forEach(i => { const c = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.2, 6), lam(0xd02020)); c.position.set(i * 0.1, 0.45, 0); head.add(c); });
    const bib = box(0.5, 0.35, 0.03, 0, 1.45, 0.38, lam(0xf6f1e4), g);
    // pico superior brillante
    sph(0.05, 0, 0.0, 0.52, lam(0xffa040), head);
  } else if (kind === 'fox') {
    [-1, 1].forEach(s => { const c = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.32, 8), body); c.position.set(s * 0.27, 0.42, 0); c.rotation.z = s * -0.25; head.add(c); });
    const snout = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.42, 8), lite); snout.position.set(0, -0.08, 0.42); snout.rotation.x = Math.PI / 2; head.add(snout);
    // parche en el ojo
    const patch = sph(0.13, -0.16, 0.1, 0.3, dark, head); patch.scale.set(1, 1, 0.5);
    // garfio
    const hook = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.03, 6, 12, Math.PI * 1.4), lam(0xc8c8c8));
    hook.position.set(0, -0.98, 0); hook.rotation.y = Math.PI / 2; arms[1].add(hook);
    // jirones
    box(0.12, 0.5, 0.02, 0.15, 0.9, 0.34, lam(0x701010), g);
  }
  g.userData = { head, jaw, eyes, arms, kind };
  return g;
}

// Ubicaciones: p base, spread por animatrónico, rotación
const LOC = {
  stage:   { p: [0, 0.55, -16.6], s: [2.8, 0],    r: 0 },
  dining:  { p: [0, 0, -12.8],    s: [3.3, 0.7],  r: 0 },
  kitchen: { p: [9.4, 0, -14],    s: [1.4, 1.2],  r: Math.PI / 2 },
  whall:   { p: [-4.6, 0, -6],    s: [0.7, 0.6],  r: 0 },
  closet:  { p: [-8.0, 0, -4],    s: [0, 0.8],    r: Math.PI / 2 },
  wcorner: { p: [-4.1, 0, 0],     s: [0, 0],      r: Math.PI / 2 },
  ehall:   { p: [4.6, 0, -6],     s: [0.7, 0.6],  r: 0 },
  ecorner: { p: [4.1, 0, 0],      s: [0, 0],      r: -Math.PI / 2 },
  cove:    { p: [-10, 0, -14.75], s: [0, 0],      r: Math.PI / 2 },
};
const SPREAD = { teddy: 0, bunny: -1, chicken: 1, fox: 0 };
const GRAPH = {
  stage:   { dining: 3 },
  dining:  { whall: 3, ehall: 3, kitchen: 1 },
  kitchen: { ehall: 3, dining: 1 },
  whall:   { wcorner: 3, closet: 2, dining: 1 },
  closet:  { wcorner: 3, whall: 1 },
  ehall:   { ecorner: 3, kitchen: 1, dining: 1 },
};
const ALLOWED = {
  teddy: ['stage', 'dining', 'kitchen', 'whall', 'ehall', 'closet', 'wcorner', 'ecorner'],
  bunny: ['stage', 'dining', 'whall', 'closet', 'wcorner'],
  chicken: ['stage', 'dining', 'kitchen', 'ehall', 'ecorner'],
};
const NIGHT_AI = [            // teddy, bunny, chicken, fox
  [1, 3, 2, 0],
  [3, 5, 4, 2],
  [5, 7, 6, 5],
  [8, 9, 9, 8],
  [12, 13, 12, 12],
];
const AN = [
  { id: 'teddy', name: 'Don Teddy', interval: 6.0 },
  { id: 'bunny', name: 'Coni el Conejo', interval: 5.0 },
  { id: 'chicken', name: 'Pipa la Pollita', interval: 5.5 },
  { id: 'fox', name: 'Capitán Colmillo', interval: 5.0 },
];
AN.forEach(a => {
  a.group = buildAnimatronic(a.id); scene.add(a.group);
  a.loc = a.id === 'fox' ? 'cove' : 'stage'; a.acc = 0; a.ai = 0; a.arrived = 0;
});
const byId = id => AN.find(a => a.id === id);
const fox = byId('fox');
fox.stage = 0; fox.state = 'cove'; fox.runT = 0; fox.runDur = 4.6;

function placeAt(a) {
  const L = LOC[a.loc], k = SPREAD[a.id] || 0;
  a.group.position.set(L.p[0] + L.s[0] * k, L.p[1], L.p[2] + L.s[1] * k);
  a.group.rotation.set(0, L.r, 0);
  a.group.visible = true;
}

/* ------------------------------------------------------------------ */
/* Cámaras de seguridad                                                */
/* ------------------------------------------------------------------ */
const CAMS = [
  { id: '1A', name: 'ESCENARIO', pos: [0, 3.0, -11.4], look: [0, 1.2, -17], locs: ['stage'], btn: [118, 6] },
  { id: '1B', name: 'COMEDOR', pos: [6.4, 3.0, -17.2], look: [-2.5, 0.8, -11.8], locs: ['dining'], btn: [118, 52] },
  { id: '1C', name: 'COVE PIRATA', pos: [-3.2, 2.9, -13.6], look: [-9.5, 1.1, -14.7], locs: ['cove'], btn: [24, 52] },
  { id: '2A', name: 'PASILLO OESTE', pos: [-4.6, 2.7, -9.6], look: [-4.6, 0.9, 0], locs: ['whall', 'wcorner'], btn: [40, 120] },
  { id: '2B', name: 'ALMACÉN', pos: [-9.2, 2.7, -2.4], look: [-7.4, 0.8, -5.2], locs: ['closet'], btn: [8, 168] },
  { id: '4A', name: 'PASILLO ESTE', pos: [4.6, 2.7, -9.6], look: [4.6, 0.9, 0], locs: ['ehall', 'ecorner'], btn: [196, 120] },
  { id: '5', name: 'COCINA', pos: [11.6, 2.8, -10.6], look: [8.5, 0.9, -15], locs: ['kitchen'], btn: [232, 52], audioOnly: true },
];

/* ------------------------------------------------------------------ */
/* Estado del juego                                                    */
/* ------------------------------------------------------------------ */
const G = {
  state: 'menu', night: 1, t: 0, power: 100,
  doorL: false, doorR: false, lightL: false, lightR: false,
  cam: false, camIdx: 0, powerOut: false, outT: 0, outStage: 0,
  scareT: 0, scareA: null, staticBurst: 0, lastHour: -1, callOn: false, callTimer: null, muted: false,
};
let yaw = 0, pitch = 0, tYaw = 0, tPitch = 0, mouseX = 0.5, mouseY = 0.5;

const save = {
  get() { try { return clamp(parseInt(localStorage.getItem('putys_night') || '1', 10) || 1, 1, 5); } catch (e) { return 1; } },
  set(n) { try { localStorage.setItem('putys_night', String(n)); } catch (e) {} },
};

function show(id) { $(id).classList.remove('hidden'); }
function hide(id) { $(id).classList.add('hidden'); }
function hideAllScreens() { ['menu', 'nightCard', 'gameOver', 'win', 'ending'].forEach(hide); }

function resetWorld() {
  AN.forEach(a => {
    a.loc = a.id === 'fox' ? 'cove' : 'stage'; a.acc = rnd(0, a.interval); a.arrived = 0;
    a.group.scale.set(1, 1, 1); a.group.userData.jaw.rotation.x = 0;
  });
  fox.stage = 0; fox.state = 'cove'; fox.runT = 0;
  AN.forEach(placeAt);
  Object.assign(G, { t: 0, power: 100, doorL: false, doorR: false, lightL: false, lightR: false, cam: false, camIdx: 0,
    powerOut: false, outT: 0, outStage: 0, scareT: 0, scareA: null, staticBurst: 0, lastHour: -1 });
  doorAnim.L = doorAnim.R = 0;
  Sfx.stopAll();
  flashL.intensity = flashR.intensity = 0;
  ambient.intensity = 0.55; lamp.intensity = 1.5; lampBulb.visible = true;
  hide('monitor'); camera.position.copy(EYE);
  syncAI();
}
function syncAI() {
  const base = NIGHT_AI[G.night - 1];
  const h = Math.floor(G.t / HOUR_SEC);
  const bonus = (h >= 3 ? 1 : 0) + (h >= 5 ? 1 : 0);
  AN.forEach((a, i) => { a.ai = base[i] + (base[i] > 0 ? bonus : 0); });
}

function startNight(n) {
  Sfx.init();
  G.night = n; resetWorld(); hideAllScreens();
  $('ncN').textContent = 'Noche ' + n; $('ncT').textContent = '12:00 AM';
  show('nightCard'); hide('hud'); G.state = 'card';
  setTimeout(() => {
    if (G.state !== 'card') return;
    hide('nightCard'); show('hud'); G.state = 'play';
    Sfx.startAmbient(); updateHud(true);
    startCall();
  }, 3000);
}

/* ------------------------------------------------------------------ */
/* Llamada telefónica                                                  */
/* ------------------------------------------------------------------ */
const CALLS = [
  ['¿Hola? ¿Hola? Bueno, si estás oyendo esto, ya empezaste tu primera noche en Puty\'s.',
   'Ejem… los personajes pueden moverse un poco por la noche. Es por los servos, se traban si se quedan quietos.',
   'Si alguno aparece en tu puerta, cierra la puerta. Pero ojo con la energía.',
   'Buena suerte. Y no mires a Colmillo… mucho tiempo.'],
  ['Hola de nuevo. Ayer sobreviviste, lo cual es… estadísticamente raro.',
   'Pipa se queda quieta si la estás mirando por la cámara. Don Teddy solo se mueve cuando miras la pantalla.',
   'Colmillo corre por el pasillo oeste si lo ignoras demasiado.'],
  ['Estooo… yo ya no debería estar al teléfono. Tú tampoco deberías estar ahí.',
   'Revisa las luces de los pasillos. Los ojos brillan en la oscuridad. Eso es… normal. Creo.'],
  ['Mira, si te quedas sin energía… escucha la música. No hagas ruido.'],
  ['Es la última noche. Han pasado… cosas. Solo sobrevive hasta las seis.'],
];
function startCall() {
  const lines = CALLS[G.night - 1] || [];
  G.callOn = lines.length > 0; if (!G.callOn) return;
  const subs = $('subs'), mute = $('muteCall');
  let i = 0;
  const next = () => {
    if (!G.callOn || G.state !== 'play') { endCall(); return; }
    if (i >= lines.length) { endCall(); return; }
    subs.textContent = lines[i]; subs.classList.remove('hidden'); mute.classList.remove('hidden');
    let dur = 3200 + lines[i].length * 55;
    if ('speechSynthesis' in window && !G.muted) {
      try {
        const u = new SpeechSynthesisUtterance(lines[i]);
        u.lang = 'es-ES'; u.rate = 0.95; u.pitch = 0.75; u.volume = 0.9;
        window.speechSynthesis.speak(u);
      } catch (e) {}
    }
    i++; G.callTimer = setTimeout(next, dur);
  };
  G.callTimer = setTimeout(next, 2500);
}
function endCall() {
  G.callOn = false; clearTimeout(G.callTimer);
  try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (e) {}
  hide('subs'); hide('muteCall');
}
$('muteCall').addEventListener('click', () => { Sfx.ui(); endCall(); });

/* ------------------------------------------------------------------ */
/* HUD                                                                 */
/* ------------------------------------------------------------------ */
let hudCache = {};
function setText(id, v) { if (hudCache[id] !== v) { hudCache[id] = v; $(id).textContent = v; } }
function usage() { return 1 + (G.doorL ? 1 : 0) + (G.doorR ? 1 : 0) + (G.lightL ? 1 : 0) + (G.lightR ? 1 : 0) + (G.cam ? 1 : 0); }
function updateHud(force) {
  const h = Math.floor(G.t / HOUR_SEC);
  setText('hudNight', 'Noche ' + G.night);
  setText('hudTime', (h === 0 ? 12 : h) + ' AM');
  const p = Math.max(0, Math.ceil(G.power));
  setText('hudPower', 'Energía: ' + p + '%');
  $('hudPower').classList.toggle('low', p <= 20);
  const u = usage(); const key = 'u' + u;
  if (hudCache.bars !== key || force) {
    hudCache.bars = key;
    $('bars').innerHTML = [0, 1, 2, 3, 4].map(i => `<i class="${i < u ? 'on ' + (u >= 4 ? 'hi' : u >= 3 ? 'mid' : '') : ''}"></i>`).join('');
  }
  $('btnDoorL').classList.toggle('on', G.doorL); $('btnDoorR').classList.toggle('on', G.doorR);
  $('btnLightL').classList.toggle('on', G.lightL); $('btnLightR').classList.toggle('on', G.lightR);
  ['btnDoorL', 'btnDoorR', 'btnLightL', 'btnLightR'].forEach(b => { $(b).disabled = G.powerOut; });
  $('camBar').disabled = G.powerOut;
}
['btnLightL', 'btnLightR'].forEach(id => $(id).classList.add('lit'));

/* ------------------------------------------------------------------ */
/* Controles                                                           */
/* ------------------------------------------------------------------ */
function canAct() { return G.state === 'play' && !G.powerOut; }
function toggleDoor(side) {
  if (!canAct()) return;
  const k = 'door' + side; G[k] = !G[k];
  if (G[k]) { G['light' + side] = false; }
  Sfx.door(side === 'L' ? -0.8 : 0.8); updateLights();
}
function toggleLight(side) {
  if (!canAct()) return;
  const k = 'light' + side;
  if (G.cam) return;
  G[k] = !G[k];
  if (G[k]) { G[side === 'L' ? 'lightR' : 'lightL'] = false; }       // una luz a la vez (como en el original)
  updateLights();
  if (G[k]) {
    const who = AN.find(a => a.loc === (side === 'L' ? 'wcorner' : 'ecorner'));
    if (who) { Sfx.stinger(); if (who.id === 'teddy') Sfx.laugh(); }
  }
}
function updateLights() {
  flashL.intensity = G.lightL && !G.powerOut ? 3.2 : 0;
  flashR.intensity = G.lightR && !G.powerOut ? 3.2 : 0;
  Sfx.setBuzz((G.lightL || G.lightR) && !G.powerOut);
}
function toggleCam(force) {
  if (!canAct() && !(force === false)) return;
  if (G.state !== 'play') return;
  const on = force === undefined ? !G.cam : force;
  if (on === G.cam) return;
  G.cam = on;
  if (on) {
    G.lightL = G.lightR = false; updateLights();
    show('monitor'); Sfx.camOn(); selectCam(G.camIdx, true); G.staticBurst = 1;
  } else {
    hide('monitor'); Sfx.camOn();
  }
}
function selectCam(i, quiet) {
  G.camIdx = i; const c = CAMS[i];
  $('camLabel').innerHTML = `CAM ${c.id}<small>${c.name}</small>`;
  $('camOff').style.display = c.audioOnly ? 'flex' : 'none';
  [...$('camMap').querySelectorAll('button')].forEach((b, j) => b.classList.toggle('sel', j === i));
  G.staticBurst = 0.8; if (!quiet) Sfx.camSwitch();
}
// Mapa de cámaras
(() => {
  const m = $('camMap');
  CAMS.forEach((c, i) => {
    const b = document.createElement('button'); b.textContent = 'CAM ' + c.id;
    b.style.left = c.btn[0] + 'px'; b.style.top = c.btn[1] + 'px';
    b.addEventListener('click', e => { e.stopPropagation(); selectCam(i); });
    m.appendChild(b);
  });
  const you = document.createElement('div'); you.className = 'you'; you.textContent = '[ TÚ ]'; m.appendChild(you);
})();

$('btnDoorL').onclick = () => toggleDoor('L'); $('btnDoorR').onclick = () => toggleDoor('R');
$('btnLightL').onclick = () => toggleLight('L'); $('btnLightR').onclick = () => toggleLight('R');
$('camBar').onclick = () => toggleCam();
window.addEventListener('keydown', e => {
  if (e.repeat) return;
  const k = e.key.toLowerCase();
  if (k === 'q') toggleDoor('L'); else if (k === 'e') toggleDoor('R');
  else if (k === 'a') toggleLight('L'); else if (k === 'd') toggleLight('R');
  else if (k === ' ') { e.preventDefault(); toggleCam(); }
  else if (k === 'm') endCall();
  else if (k >= '1' && k <= '7' && G.cam) selectCam(parseInt(k, 10) - 1);
});
function onPointer(e) {
  const t = e.touches ? e.touches[0] : e;
  mouseX = t.clientX / window.innerWidth; mouseY = t.clientY / window.innerHeight;
}
window.addEventListener('mousemove', onPointer);
window.addEventListener('touchmove', onPointer, { passive: true });
window.addEventListener('touchstart', onPointer, { passive: true });

/* ------------------------------------------------------------------ */
/* IA                                                                  */
/* ------------------------------------------------------------------ */
function camShows(loc) { return G.cam && CAMS[G.camIdx].locs.includes(loc); }
function occupied(loc) { return AN.some(a => a.loc === loc); }

function pickNext(a) {
  const opts = GRAPH[a.loc]; if (!opts) return null;
  const allowed = ALLOWED[a.id];
  const cand = Object.keys(opts).filter(l => allowed.includes(l) && !((l === 'wcorner' || l === 'ecorner') && occupied(l)));
  if (!cand.length) return null;
  let sum = cand.reduce((s, l) => s + opts[l], 0), r = Math.random() * sum;
  for (const l of cand) { r -= opts[l]; if (r <= 0) return l; }
  return cand[0];
}
function panOf(loc) { return clamp(LOC[loc].p[0] / 7, -1, 1); }
function moveSound(a, to) {
  const near = to === 'wcorner' || to === 'ecorner' || to === 'whall' || to === 'ehall';
  if (to === 'kitchen') Sfx.clang(0.2);
  else Sfx.step(panOf(to), near ? 0.4 : 0.14);
}
function attempt(a) {
  if (a.id === 'fox') return foxTick(a);
  if (a.id === 'teddy' && !G.cam && !G.powerOut) return;           // Teddy solo se mueve con las cámaras abiertas
  if (a.id === 'chicken' && camShows(a.loc)) return;               // Pipa se congela si la miras
  if (Math.random() * 20 >= a.ai) return;
  if (a.loc === 'wcorner' || a.loc === 'ecorner') {
    if (G.t - a.arrived < 3) return;                                // margen de reacción
    const closed = a.loc === 'wcorner' ? G.doorL : G.doorR;
    if (closed) {
      Sfx.thud(panOf(a.loc)); a.loc = 'dining'; placeAt(a); a.arrived = G.t;
      if (G.cam) G.staticBurst = 1;
    } else jumpscare(a);
    return;
  }
  const to = pickNext(a); if (!to) return;
  a.loc = to; a.arrived = G.t; placeAt(a); moveSound(a, to);
  if (G.cam && (camShows(to) || camShows(to))) G.staticBurst = 0.9;
  if (a.id === 'teddy' && Math.random() < 0.35) Sfx.laugh();
}
function foxTick(a) {
  if (a.state !== 'cove' || a.ai <= 0) return;
  if (Math.random() * 20 >= a.ai) return;
  if (camShows('cove') && Math.random() < 0.6) return;              // mirarlo lo retrasa
  a.stage++;
  if (a.stage >= 4) {
    a.state = 'run'; a.runT = 0; a.runDur = Math.max(2.6, 4.8 - G.night * 0.35);
    Sfx.run(-0.8);
  }
}
function updateFox(dt) {
  const a = fox;
  if (a.state === 'cove') {
    const open = clamp(a.stage / 3, 0, 1), s = 1 - open * 0.78;
    curtA.scale.z = s; curtA.position.z = -12 - 2.5 * s / 2 - 0.0;
    curtB.scale.z = s; curtB.position.z = -17 + 2.5 * s / 2 + 0.0;
    a.group.position.set(-10 + Math.min(a.stage, 3) * 0.55, 0, -14.75);
    a.group.rotation.y = Math.PI / 2 + Math.sin(G.t * 0.7) * 0.12;
    a.group.visible = true;
    return;
  }
  if (a.state === 'run') {
    a.runT += dt; const k = clamp(a.runT / a.runDur, 0, 1);
    a.group.position.set(-4.7, 0, -10 + k * 10);
    a.group.rotation.y = 0; a.group.visible = true;
    a.group.position.y = Math.abs(Math.sin(a.runT * 14)) * 0.12;
    a.loc = k < 0.55 ? 'whall' : 'wcorner';
    if (k >= 1) {
      if (G.doorL) {
        Sfx.thud(-0.9); Sfx.thud(-0.9);
        G.power = Math.max(0, G.power - (2 + G.night * 1.5));
        a.state = 'cove'; a.stage = 1; a.loc = 'cove'; a.group.position.y = 0;
        if (G.cam) G.staticBurst = 1;
      } else jumpscare(a);
    }
  }
}

/* ------------------------------------------------------------------ */
/* Jumpscare                                                           */
/* ------------------------------------------------------------------ */
function jumpscare(a) {
  if (G.state !== 'play') return;
  G.state = 'dead'; G.scareT = 0; G.scareA = a;
  toggleCam(false); G.cam = false; hide('monitor');
  G.lightL = G.lightR = false; updateLights(); Sfx.stopAll(); endCall();
  Sfx.jumpscare(); a.group.visible = true;
  const f = $('flash'); f.style.transition = 'none'; f.style.opacity = 0.9;
  requestAnimationFrame(() => { f.style.transition = 'opacity 1.2s'; f.style.opacity = 0; });
  hide('hud');
}
function updateScare(dt) {
  G.scareT += dt;
  const a = G.scareA, t = G.scareT;
  const dir = new THREE.Vector3(); camera.getWorldDirection(dir); dir.y = 0; dir.normalize();
  const sc = 1.0 + Math.min(t, 0.2) * 1.6;
  a.group.scale.setScalar(sc);
  a.group.position.set(EYE.x + dir.x * 1.35, EYE.y - 1.92 * sc + 0.02, EYE.z + dir.z * 1.35);
  a.group.lookAt(EYE.x, a.group.position.y, EYE.z);
  const j = a.group.userData.jaw; j.rotation.x = -(0.25 + Math.abs(Math.sin(t * 38)) * 0.75);
  a.group.userData.head.rotation.set(Math.sin(t * 50) * 0.08, 0, Math.sin(t * 43) * 0.1);
  camera.position.set(EYE.x + (Math.random() - 0.5) * 0.12, EYE.y + (Math.random() - 0.5) * 0.12, EYE.z);
  ambient.intensity = 1.6;
  flashL.position.set(EYE.x + dir.x * 0.4, EYE.y + 0.3, EYE.z + dir.z * 0.4); flashL.intensity = 5;
  if (t > 1.9 && G.state === 'dead') {
    G.state = 'over'; ambient.intensity = 0.55; flashL.intensity = 0; flashL.position.set(-4.4, 2.1, 0.1); a.group.scale.setScalar(1);
    a.group.userData.head.rotation.set(0, 0, 0); camera.position.copy(EYE);
    $('goWho').textContent = `${a.name} te encontró · Noche ${G.night}`;
    show('gameOver');
  }
}

/* ------------------------------------------------------------------ */
/* Apagón                                                              */
/* ------------------------------------------------------------------ */
function triggerPowerOut() {
  G.powerOut = true; G.outT = 0; G.outStage = 0;
  G.doorL = G.doorR = G.lightL = G.lightR = false; updateLights();
  toggleCam(false); G.cam = false; hide('monitor');
  Sfx.setBuzz(false); Sfx.stopAmbient(); Sfx.powerDown(); endCall();
  lamp.intensity = 0; lampBulb.visible = false; ambient.intensity = 0.08;
  Object.values(roomLights).forEach(l => l.intensity = 0);
  AN.forEach(a => { if (a.id !== 'teddy') a.group.visible = false; });
  const t = byId('teddy'); t.loc = 'wcorner'; placeAt(t);
  t.group.visible = false;
  updateHud(true);
}
function updatePowerOut(dt) {
  G.outT += dt;
  const t = byId('teddy');
  if (G.outStage === 0 && G.outT > 3) { G.outStage = 1; Sfx.musicBox(true); }
  if (G.outStage >= 1) {
    // Los ojos de Teddy parpadean en la puerta
    t.group.visible = Math.sin(G.outT * 3.1) > -0.2 && Math.sin(G.outT * 11) > -0.6;
    if (G.outStage === 1 && G.outT > 13 + (G.night % 3) * 2) { G.outStage = 2; Sfx.musicBox(false); Sfx.laugh(); }
    if (G.outStage === 2) { t.group.visible = Math.random() > 0.3; if (G.outT > 19 + (G.night % 3) * 2) jumpscare(t); }
  }
}

/* ------------------------------------------------------------------ */
/* Final de noche                                                      */
/* ------------------------------------------------------------------ */
function winNight() {
  G.state = 'win'; Sfx.stopAll(); endCall(); toggleCam(false); G.cam = false; hide('monitor'); hide('hud');
  updateLights(); Sfx.chime();
  hide('btnNext');
  $('winMsg').textContent = G.night >= 5 ? '¡Última noche superada!' : 'Has sobrevivido a la noche ' + G.night + '.';
  show('win');
  setTimeout(() => {
    show('btnNext');
    $('btnNext').textContent = G.night >= 5 ? 'CONTINUAR' : 'SIGUIENTE NOCHE';
  }, 2500);
  if (G.night < 5) save.set(G.night + 1); else save.set(1);
}

/* ------------------------------------------------------------------ */
/* Bucle principal                                                     */
/* ------------------------------------------------------------------ */
const nz = $('noise'), nzc = nz.getContext('2d'), nzImg = nzc.createImageData(160, 90);
const cs = $('camStatic'), csc = cs.getContext('2d'), csImg = csc.createImageData(160, 90);
function drawNoise(ctx, img) {
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) { const v = Math.random() * 255; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
  ctx.putImageData(img, 0, 0);
}

const clock = new THREE.Clock();
let flick = 0, noiseTick = 0;
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.1), time = clock.elapsedTime;

  // --- lógica
  if (G.state === 'play') {
    G.t += dt;
    const h = Math.floor(G.t / HOUR_SEC);
    if (h !== G.lastHour) { G.lastHour = h; syncAI(); }
    if (!G.powerOut) {
      G.power -= 0.1 * usage() * (1 + (G.night - 1) * 0.08) * (45 / HOUR_SEC) * dt;
      if (G.power <= 0) { G.power = 0; triggerPowerOut(); }
    }
    if (G.powerOut) updatePowerOut(dt);
    else AN.forEach(a => { a.acc += dt; while (a.acc >= a.interval) { a.acc -= a.interval; attempt(a); if (G.state !== 'play') break; } });
    if (G.state === 'play') { updateFox(dt); updateHud(); }
    if (G.state === 'play' && G.t >= HOUR_SEC * 6) winNight();
  } else if (G.state === 'dead') {
    updateScare(dt);
  } else if (G.state === 'menu') {
    G.t += dt;
  }

  // --- puertas
  ['L', 'R'].forEach(s => {
    const target = G['door' + s] ? 1 : 0;
    doorAnim[s] += clamp(target - doorAnim[s], -dt * 4, dt * 4);
    doors[s].position.y = (1 - doorAnim[s]) * 2.6;
  });

  // --- animaciones de ambiente
  blades.rotation.z += dt * 16;
  fanHead.rotation.y = Math.sin(time * 0.6) * 0.7;
  shipWheel.rotation.z += dt * 0.2;
  if (!G.powerOut) {
    flick -= dt;
    if (flick <= 0) { flick = rnd(0.05, 1.8); lamp.intensity = Math.random() < 0.12 ? rnd(0.3, 0.9) : 1.5; lampBulb.visible = lamp.intensity > 1; }
    ['whall', 'ehall'].forEach(k => { roomLights[k].intensity = 0.28 + (Math.random() < 0.03 ? -0.2 : 0); });
    if (G.cam) ambient.intensity = 2.3; else if (G.state !== 'dead') ambient.intensity = 0.55;
  }
  if (G.lightL) flashL.intensity = Math.random() < 0.04 ? 0.5 : 3.2;
  if (G.lightR) flashR.intensity = Math.random() < 0.04 ? 0.5 : 3.2;

  // --- cabezas siguen a la cámara; ojos brillan
  AN.forEach(a => {
    if (G.state === 'dead' && a === G.scareA) return;
    const u = a.group.userData, p = a.group.position;
    const camP = G.cam ? new THREE.Vector3(...CAMS[G.camIdx].pos) : camera.position;
    const ang = Math.atan2(camP.x - p.x, camP.z - p.z) - a.group.rotation.y;
    const wrapped = Math.atan2(Math.sin(ang), Math.cos(ang));
    u.head.rotation.y += (clamp(wrapped, -0.9, 0.9) - u.head.rotation.y) * Math.min(1, dt * 2);
    u.head.rotation.z = Math.sin(time * 0.9 + a.interval) * 0.04;
    a.group.rotation.z = Math.sin(time * 1.1 + a.interval) * 0.015;
    u.arms.forEach((m, i) => { m.rotation.x = Math.sin(time * 1.3 + i) * 0.05; });
  });

  // --- cámara del jugador
  if (G.state !== 'dead') {
    const dz = 0.14, ex = (v) => Math.sign(v) * Math.pow(clamp((Math.abs(v) - dz) / (1 - dz), 0, 1), 1.2);
    tYaw = -ex(mouseX * 2 - 1) * 0.98;
    tPitch = -(mouseY * 2 - 1) * 0.1;
    yaw += (tYaw - yaw) * Math.min(1, dt * 5); pitch += (tPitch - pitch) * Math.min(1, dt * 5);
    const bob = Math.sin(time * 0.8) * 0.004;
    camera.position.set(EYE.x, EYE.y + bob, EYE.z);
    camera.rotation.set(pitch, yaw, 0);
  } else camera.rotation.set(0, 0, 0);

  // --- render
  if (G.cam && G.state === 'play') {
    const c = CAMS[G.camIdx];
    if (!c.audioOnly) {
      const sway = Math.sin(time * 0.35) * 0.9;
      viewCam.position.set(...c.pos);
      viewCam.lookAt(c.look[0] + Math.cos(Math.atan2(c.look[2] - c.pos[2], c.look[0] - c.pos[0]) + Math.PI / 2) * sway, c.look[1],
        c.look[2] + Math.sin(Math.atan2(c.look[2] - c.pos[2], c.look[0] - c.pos[0]) + Math.PI / 2) * sway);
      renderer.render(scene, viewCam);
    } else renderer.clear();
    // cocina: sonidos
    if (c.audioOnly && Math.random() < dt * 0.6 && AN.some(a => a.loc === 'kitchen')) Sfx.clang(0.25);
    G.staticBurst = Math.max(0, G.staticBurst - dt * 2.2);
    cs.style.opacity = 0.06 + G.staticBurst * 0.75;
    noiseTick += dt; if (noiseTick > 0.04) { noiseTick = 0; drawNoise(csc, csImg); }
    $('rec').style.visibility = Math.floor(time * 1.5) % 2 ? 'hidden' : 'visible';
    $('gl').style.filter = 'grayscale(.75) contrast(1.15) brightness(1.35) sepia(.25) hue-rotate(60deg)';
  } else {
    $('gl').style.filter = '';
    renderer.render(scene, camera);
  }
  // ruido general
  if (Math.random() < 0.35) drawNoise(nzc, nzImg);
  nz.style.opacity = G.state === 'dead' ? 0.06 : (G.powerOut ? 0.05 : 0.025);
}

/* ------------------------------------------------------------------ */
/* Menús                                                               */
/* ------------------------------------------------------------------ */
function goMenu() {
  G.state = 'menu'; endCall(); Sfx.stopAll(); hideAllScreens(); hide('hud'); hide('monitor');
  resetWorld(); G.state = 'menu';
  AN.forEach(a => { a.group.visible = false; });
  const n = save.get();
  $('btnCont').classList.toggle('hidden', n <= 1); $('contN').textContent = n;
  show('menu');
}
$('btnNew').onclick = () => { save.set(1); startNight(1); };
$('btnCont').onclick = () => startNight(save.get());
$('btnRetry').onclick = () => startNight(G.night);
$('btnToMenu').onclick = goMenu;
$('btnEndMenu').onclick = goMenu;
$('btnNext').onclick = () => {
  if (G.night >= 5) { hide('win'); show('ending'); } else startNight(G.night + 1);
};
document.addEventListener('visibilitychange', () => { clock.getDelta(); });

window.__game = { G, AN, CAMS, startNight, jumpscare, triggerPowerOut, byId, LOC, placeAt, toggleCam, selectCam, toggleDoor, toggleLight, camera };

goMenu();
frame();
})();
