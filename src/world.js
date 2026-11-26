import * as THREE from 'three';

export const H = 3.2;
const lam = (c, extra) => new THREE.MeshLambertMaterial(Object.assign({ color: c }, extra || {}));
const bas = c => new THREE.MeshBasicMaterial({ color: c });
const waxMat = () => lam(0xd9caa2, { emissive: 0x17110a });

function canvasTex(w, h, draw, rep) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
  return t;
}
function posterTex(text, bg, fg, sub) {
  return canvasTex(256, 360, (g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h); g.strokeStyle = fg; g.lineWidth = 8; g.strokeRect(10, 10, w - 20, h - 20);
    g.fillStyle = fg; g.textAlign = 'center'; g.font = 'bold 40px Georgia';
    text.split(' ').forEach((wd, i) => g.fillText(wd, w / 2, 90 + i * 52));
    if (sub) { g.font = '20px Georgia'; g.fillText(sub, w / 2, h - 50); }
    g.beginPath(); g.arc(w / 2, h - 110, 26, 0, 7); g.fill();
  });
}
function bannerTex(text) {
  return canvasTex(512, 96, (g, w, h) => {
    g.fillStyle = '#5a0c18'; g.fillRect(0, 0, w, h); g.fillStyle = '#d9b46a'; g.font = 'bold 54px Georgia'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, w / 2, h / 2 + 3); g.strokeStyle = '#d9b46a'; g.lineWidth = 4; g.strokeRect(4, 4, w - 8, h - 8);
  });
}
function labelTex(text, w = 256, h = 64, bg = '#111', fg = '#e8d9a0', size = 34) {
  return canvasTex(w, h, (g) => { g.fillStyle = bg; g.fillRect(0, 0, w, h); g.fillStyle = fg; g.font = `bold ${size}px Courier New`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, h / 2); });
}
function noteTex() {
  return canvasTex(64, 90, (g, w, h) => { g.fillStyle = '#d8cca0'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(60,40,20,.5)'; for (let i = 0; i < 9; i++) g.fillRect(8, 10 + i * 8, 40 + (i * 7) % 12, 2); });
}

export function buildWorld(scene) {
  const W = { colliders: [], targets: [], dynamic: [], doorAnim: { L: 0, R: 0 }, doorBroken: { L: false, R: false }, doorClosed: { L: false, R: false } };

  /* ---------- helpers ---------- */
  const add = (o, parent) => { (parent || scene).add(o); return o; };
  function box(w, h, d, x, y, z, m, parent) { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); return add(o, parent); }
  function cyl(rt, rb, h, x, y, z, m, parent, seg) { const o = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg || 16), m); o.position.set(x, y, z); return add(o, parent); }
  function sph(r, x, y, z, m, parent) { const o = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), m); o.position.set(x, y, z); return add(o, parent); }
  const wallTexBase = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#4a1219'; g.fillRect(0, 0, w, h); g.fillStyle = '#34101a'; for (let x = 0; x < w; x += 32) g.fillRect(x, 0, 16, h);
    g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(0, h * .78, w, h * .22);
    for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * .1})`; g.fillRect(Math.random() * w, Math.random() * h, 3, 3); }
  });
  const wallCache = {};
  const wallMat = len => { const k = Math.round(len); if (!wallCache[k]) { const t = wallTexBase.clone(); t.needsUpdate = true; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(Math.max(1, k / 1.6), 2); wallCache[k] = new THREE.MeshLambertMaterial({ map: t }); } return wallCache[k]; };
  function wall(ax, az, bx, bz, y0 = 0, y1 = H) {
    const len = Math.hypot(bx - ax, bz - az), t = 0.2, horiz = Math.abs(bz - az) < 0.01;
    return box(horiz ? len : t, y1 - y0, horiz ? t : len, (ax + bx) / 2, (y0 + y1) / 2, (az + bz) / 2, wallMat(len));
  }
  function poster(tex, w, h, x, y, z, ry = 0) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshLambertMaterial({ map: tex })); m.position.set(x, y, z); m.rotation.y = ry; return add(m);
  }
  const collider = (x0, z0, x1, z1) => W.colliders.push([Math.min(x0, x1), Math.min(z0, z1), Math.max(x0, x1), Math.max(z0, z1)]);

  /* ---------- suelo / techo ---------- */
  const floorTex = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#b8b09c'; g.fillRect(0, 0, w, h); g.fillStyle = '#121216'; g.fillRect(0, 0, w / 2, h / 2); g.fillRect(w / 2, h / 2, w / 2, h / 2);
    for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * .08})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
  }, [16, 14]);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(24, 21), new THREE.MeshLambertMaterial({ map: floorTex })); floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, -7.5); add(floor);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(24, 21), lam(0x15131c, { side: THREE.DoubleSide })); ceil.rotation.x = Math.PI / 2; ceil.position.set(0, H, -7.5); add(ceil);
  // alfombra de la garita
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(4, 3.2), lam(0x2a0c10)); rug.rotation.x = -Math.PI / 2; rug.position.set(0, 0.012, 0.9); add(rug);

  /* ---------- muros ---------- */
  const DH = 0.78;
  wall(-3, -2, 3, -2); wall(-3, 3, 3, 3);
  [-3, 3].forEach(x => { wall(x, -2, x, -DH); wall(x, DH, x, 3); box(0.2, H - 2.4, DH * 2, x, (H + 2.4) / 2, 0, wallMat(2)); });
  wall(-6.2, -10, -6.2, -6); wall(-6.2, -2, -6.2, 1.2); wall(-6.2, 1.2, -3, 1.2); wall(-3.1, -10, -3.1, -2);
  wall(6.2, -10, 6.2, 1.2); wall(6.2, 1.2, 3, 1.2); wall(3.1, -10, 3.1, -2);
  wall(-7, -18, 7, -18); wall(-7, -10, -6.2, -10); wall(-3.1, -10, 3.1, -10); wall(6.2, -10, 7, -10);
  wall(7, -18, 7, -16); wall(7, -12, 7, -10); wall(-7, -11, -7, -10);
  wall(7, -18, 12, -18); wall(12, -18, 12, -10); wall(7, -10, 12, -10);
  wall(-9.5, -6, -6.2, -6); wall(-9.5, -6, -9.5, -2); wall(-9.5, -2, -6.2, -2);
  wall(-12, -18, -7, -18); wall(-12, -18, -12, -11); wall(-12, -11, -7, -11);
  // marcos de los pasillos (molduras)
  [[-4.65, 0], [4.65, 0]].forEach(([x]) => { box(3.1, 0.12, 0.12, x, H - 0.06, 1.12, lam(0x2a1a10)); });

  /* ---------- decoración del museo ---------- */
  // Salón del trono
  box(9, 0.5, 3, 0, 0.25, -16.5, lam(0x2e1f17)); box(9.2, 0.08, 3.2, 0, 0.52, -16.5, lam(0x4a2a24));
  [-1, 1].forEach(s => box(1.6, 3, 0.15, s * 3.7, 1.5, -17.8, lam(0x6a0f1c)));
  box(5.6, 3, 0.1, 0, 1.5, -17.88, lam(0x1a1018));
  poster(bannerTex('MUSEO DE CERA'), 5.4, 0.95, 0, 2.7, -17.8, 0);
  box(1.0, 0.25, 0.9, 0, 0.9, -17.2, lam(0x5a1020)); box(1.0, 1.6, 0.15, 0, 1.6, -17.65, lam(0x3a0a14));
  box(0.12, 0.7, 0.9, -0.55, 1.1, -17.2, lam(0x2a1a10)); box(0.12, 0.7, 0.9, 0.55, 1.1, -17.2, lam(0x2a1a10));
  // Vitrinas
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x9fc4d4, transparent: true, opacity: 0.12, depthWrite: false });
  function vitrine(x, z, h) {
    box(1.2, 0.9, 1.2, x, 0.45, z, lam(0x2a2220)); box(1.3, 0.08, 1.3, x, 0.92, z, lam(0x4a3a30));
    cyl(0.12, 0.14, 0.5, x, 1.2, z, lam(0xcdbf98)); sph(0.2, x, 1.62, z, waxMat());
    box(1.1, h, 1.1, x, 0.96 + h / 2, z, glassMat);
  }
  [[-4, -13.5, 1.0], [4, -13.5, 1.0], [-1.8, -11.5, 0.9], [1.9, -12.3, 0.9], [-5.2, -16.2, 1.0]].forEach(a => vitrine(...a));
  const chandelier = new THREE.Group(); W.chandelier = chandelier; // (sin candelabro: tapaba las cámaras)
  // Retratos y carteles
  poster(posterTex('LA CONDESA', '#1c1214', '#c9b27a', '1821'), 1.3, 1.8, -5.6, 1.7, -17.88, 0);
  poster(posterTex('EL VERDUGO', '#161616', '#b04030', '1788'), 1.3, 1.8, 5.6, 1.7, -17.88, 0);
  poster(posterTex('NO TOCAR', '#2a1010', '#e0d0b0', 'Cera frágil'), 1.0, 1.4, -2.0, 1.8, -10.12, Math.PI);
  poster(posterTex('PROHIBIDO FLASH', '#101a22', '#a0c0d0', ''), 1.0, 1.4, 2.0, 1.8, -10.12, Math.PI);
  // Taller de cera
  box(4, 1, 1, 9.8, 0.5, -17.3, lam(0x3a2a20));
  const cauldron = cyl(0.45, 0.4, 0.7, 9, 1.0, -17.3, lam(0x333333)); const wax = cyl(0.4, 0.4, 0.05, 9, 1.37, -17.3, bas(0xe8a040)); W.cauldronWax = wax;
  [[10.2, -17.3], [10.9, -17.3]].forEach(([x, z]) => sph(0.17, x, 1.15, z, waxMat()));
  box(1.5, 2, 0.8, 8, 1, -10.6, lam(0x2a2a2e));
  // horno maestro (taller): puerta de hierro brillante
  const furnace = new THREE.Group(); furnace.position.set(11.55, 0, -14.0); add(furnace);
  box(0.9, 2.6, 2.4, 0, 1.3, 0, lam(0x1c1c20), furnace);
  const furnaceGlow = box(0.05, 1.3, 1.3, -0.46, 1.0, 0, bas(0x401004), furnace); W.furnaceGlow = furnaceGlow;
  box(0.08, 1.5, 0.1, -0.47, 1.0, -0.72, lam(0x555a60), furnace); box(0.08, 1.5, 0.1, -0.47, 1.0, 0.72, lam(0x555a60), furnace);
  // Almacén de cera
  box(0.5, 2.2, 2.6, -9.1, 1.1, -4, lam(0x3a2a22)); box(1.2, 1, 1, -7.2, 0.5, -5.3, lam(0x5a4030)); box(0.8, 0.8, 0.8, -8.2, 0.4, -2.7, lam(0x4a3426));
  [[-8.0, -3.0], [-7.4, -4.6], [-8.6, -5.4]].forEach(([x, z]) => { const p = sph(0.5, x, 0.02, z, lam(0xc9b98a, { emissive: 0x15100a })); p.scale.y = 0.04; });
  [[-8.7, 1.9, -4.5], [-8.7, 1.9, -3.7], [-8.7, 1.9, -3.0]].forEach(([x, y, z]) => sph(0.22, x, y, z, waxMat()));
  // Vitrina del payaso
  const curtMat = lam(0x7a0d1e, { side: THREE.DoubleSide });
  const curtA = box(0.12, 3, 2.5, -7.2, 1.5, -13.25, curtMat), curtB = box(0.12, 3, 2.5, -7.2, 1.5, -15.75, curtMat);
  poster(posterTex('FUERA DE EXPOSICIÓN', '#1a1a1a', '#d8d0c0', 'No abrir'), 1.1, 1.5, -7.0, 1.6, -17.4, -Math.PI / 2);
  box(4.6, 0.1, 6.4, -9.6, 0.05, -14.5, lam(0x2a0c10));
  W.setVitrine = open => { const s = 1 - Math.min(1, open) * 0.82; curtA.scale.z = s; curtA.position.z = -12 - 2.5 * s / 2; curtB.scale.z = s; curtB.position.z = -17 + 2.5 * s / 2; };
  // Puerta de salida (final de la galería oeste)
  const exitL = box(1.1, 2.6, 0.12, -5.15, 1.3, 1.1, lam(0x2a1a10)), exitR = box(1.1, 2.6, 0.12, -4.05, 1.3, 1.1, lam(0x2a1a10));
  const dawn = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.8), new THREE.MeshBasicMaterial({ color: 0xffe6b0 })); dawn.position.set(-4.6, 1.4, 1.5); dawn.visible = false; add(dawn);
  W.exitDoor = { L: exitL, R: exitR, light: dawn, setOpen(k) { exitL.position.x = -5.15 - 0.55 * k; exitR.position.x = -4.05 + 0.55 * k; exitL.rotation.y = -k * 1.2; exitR.rotation.y = k * 1.2; dawn.visible = k > 0; } };

  /* ---------- GARITA ---------- */
  const deskMat = lam(0x5b4a3a), dkMat = lam(0x2e251d);
  box(3.0, 0.08, 1.1, 0, 0.8, 0.25, deskMat); box(3.0, 0.76, 0.08, 0, 0.38, 0.75, dkMat); box(0.08, 0.76, 1.0, -1.46, 0.38, 0.25, dkMat); box(0.08, 0.76, 1.0, 1.46, 0.38, 0.25, dkMat);
  collider(-1.55, -0.32, 1.55, 0.82);
  // monitores (el izquierdo es el de las cámaras)
  const scrOff = new THREE.MeshBasicMaterial({ color: 0x0a2a14 });
  const scrCam = new THREE.MeshBasicMaterial({ color: 0x0f3a1c });
  [[-0.55, 0.12, scrCam], [0.55, -0.12, scrOff]].forEach(([x, ry, sm], i) => {
    const g = new THREE.Group(); g.position.set(x, 0.84, 0.3); g.rotation.y = ry; add(g);
    box(0.62, 0.46, 0.34, 0, 0.3, 0, lam(0x1a1a1a), g); const s = box(0.52, 0.36, 0.02, 0, 0.3, 0.18, sm, g);
    if (i === 0) { s.userData = { id: 'monitor', label: 'Abrir cámaras', range: 2.6 }; W.targets.push(s); W.monitorScr = s; }
  });
  W.scrMat = scrCam;
  // silla
  box(0.7, 0.1, 0.7, 0, 0.5, 1.45, lam(0x1c1c1f)); box(0.7, 0.8, 0.1, 0, 0.95, 1.8, lam(0x1c1c1f)); cyl(0.05, 0.05, 0.5, 0, 0.25, 1.45, lam(0x333333));
  // ventilador
  const fan = new THREE.Group(); fan.position.set(1.15, 0.84, 0.05); add(fan);
  cyl(0.12, 0.16, 0.06, 0, 0.03, 0, lam(0x222222), fan); box(0.03, 0.2, 0.03, 0, 0.14, 0, lam(0x222222), fan);
  const fanHead = new THREE.Group(); fanHead.position.y = 0.28; fan.add(fanHead);
  cyl(0.05, 0.05, 0.1, 0, 0, 0, lam(0x333333), fanHead).rotation.x = Math.PI / 2;
  const blades = new THREE.Group(); blades.position.z = 0.07; fanHead.add(blades);
  for (let i = 0; i < 3; i++) { const b = box(0.04, 0.26, 0.01, 0, 0, 0, lam(0x9a9a9a), blades); b.rotation.z = i * 2.094; b.position.set(Math.sin(i * 2.094) * -0.12, Math.cos(i * 2.094) * 0.12, 0); }
  W.fan = { blades, head: fanHead, on: true };
  // teléfono
  const phone = new THREE.Group(); phone.position.set(0.95, 0.84, 0.55); add(phone);
  box(0.3, 0.1, 0.24, 0, 0.05, 0, lam(0x2a2a2a), phone); const handset = box(0.26, 0.05, 0.07, 0, 0.12, 0, lam(0x1a1a1a), phone);
  const phoneHit = box(0.4, 0.3, 0.34, 0, 0.12, 0, new THREE.MeshBasicMaterial({ visible: false }), phone);
  phoneHit.userData = { id: 'phone', label: 'Contestar el teléfono', range: 2.6 }; W.targets.push(phoneHit); W.phone = { group: phone, handset, hit: phoneHit };
  // cabeza de cera y vaso
  sph(0.14, -1.2, 0.98, 0.1, waxMat()); cyl(0.05, 0.04, 0.12, 0.2, 0.9, 0.62, lam(0x6a1020));
  // pósters de la garita
  poster(posterTex('HORARIO 9-18h', '#b89a4a', '#3a1010', 'Museo'), 1.0, 1.4, -1.9, 1.7, -1.88, 0);
  poster(posterTex('REGLAS', '#2f2f33', '#d0d0d0', 'Turno nocturno'), 1.0, 1.4, 1.0, 1.7, -1.88, 0);
  poster(posterTex('SE BUSCA', '#d8cfa8', '#4a1a1a', 'guardia anterior'), 0.9, 1.25, -2.88, 1.9, 2.0, Math.PI / 2);
  // paneles de puertas / linternas
  W.panels = {};
  function panel(side) {
    const sx = side === 'L' ? -1 : 1, x = sx * 2.9, face = -sx; // cara hacia el interior
    box(0.12, 0.75, 0.5, x, 1.35, 1.4, lam(0x2a2d33)); box(0.04, 0.78, 0.54, x + face * 0.07, 1.35, 1.4, lam(0x111214));
    const mk = (y, col, id, label) => {
      const m = new THREE.MeshBasicMaterial({ color: col });
      const b = cyl(0.085, 0.085, 0.05, x + face * 0.11, y, 1.4, lam(0x7a1010), null, 20); b.rotation.z = Math.PI / 2;
      const hit = box(0.2, 0.2, 0.2, x + face * 0.1, y, 1.4, new THREE.MeshBasicMaterial({ visible: false })); hit.userData = { id, label, range: 2.6, side };
      const led = sph(0.03, x + face * 0.11, y + 0.14, 1.4, m); W.targets.push(hit); return { b, led, mat: m, hit };
    };
    const door = mk(1.55, 0x303030, 'door' + side, side === 'L' ? 'Puerta izquierda' : 'Puerta derecha');
    const light = mk(1.2, 0x303030, 'light' + side, side === 'L' ? 'Linterna izquierda' : 'Linterna derecha');
    door.b.material = lam(0xb02020); light.b.material = lam(0xc8a020);
    W.panels[side] = { door, light };
    const t = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.1), new THREE.MeshBasicMaterial({ map: labelTex(side === 'L' ? 'OESTE' : 'ESTE', 128, 32, '#0a0a0a', '#c8c8c8', 22) })); t.position.set(x + face * 0.095, 1.78, 1.4); t.rotation.y = side === 'L' ? Math.PI / 2 : -Math.PI / 2; add(t);
  }
  panel('L'); panel('R');
  // puertas deslizantes
  const doorMat = lam(0x707883);
  function makeDoor(x) {
    const d = new THREE.Group(); d.position.set(x, 0, 0); add(d);
    box(0.14, 2.45, DH * 2 + 0.06, 0, 1.225, 0, doorMat, d);
    for (let i = 0; i < 6; i++) box(0.16, 0.05, DH * 2 + 0.08, 0, 0.3 + i * 0.4, 0, lam(0xc8a020), d);
    return d;
  }
  W.doors = { L: makeDoor(-3), R: makeDoor(3) };
  // caja de música (esquina trasera izquierda)
  box(0.8, 0.82, 0.55, -2.3, 0.41, -1.4, lam(0x3a2a22)); box(0.84, 0.04, 0.6, -2.3, 0.84, -1.4, lam(0x5a4030));
  collider(-2.75, -1.72, -1.85, -1.1);
  const mb = new THREE.Group(); mb.position.set(-2.3, 0.86, -1.4); add(mb);
  box(0.36, 0.2, 0.26, 0, 0.1, 0, lam(0x7a1a2a), mb); box(0.38, 0.03, 0.28, 0, 0.215, 0, lam(0xd9b46a), mb);
  const dancer = new THREE.Group(); dancer.position.set(0, 0.26, 0); mb.add(dancer);
  cyl(0.02, 0.05, 0.1, 0, 0.05, 0, waxMat(), dancer); sph(0.025, 0, 0.13, 0, waxMat(), dancer);
  const crank = new THREE.Group(); crank.position.set(0.19, 0.1, 0); mb.add(crank);
  cyl(0.012, 0.012, 0.05, 0.03, 0, 0, lam(0xc8a020), crank).rotation.z = Math.PI / 2; box(0.02, 0.08, 0.02, 0.06, -0.03, 0, lam(0xc8a020), crank);
  const mbHit = box(0.7, 0.5, 0.6, 0, 0.2, 0, new THREE.MeshBasicMaterial({ visible: false }), mb); mbHit.userData = { id: 'musicbox', label: 'Dar cuerda a la caja de música', hold: true, range: 2.4 }; W.targets.push(mbHit);
  const mbGlow = sph(0.05, 0, 0.35, 0, bas(0xffd9a0), mb); W.musicBox = { group: mb, dancer, crank, glow: mbGlow, hit: mbHit, pos: [-2.3, 1.0, -1.4] };
  // taquilla
  const lockerG = new THREE.Group(); lockerG.position.set(2.3, 0, -1.42); add(lockerG);
  box(0.95, 2.0, 0.7, 0, 1.0, 0, lam(0x3c4650), lockerG);
  const ldoorPivot = new THREE.Group(); ldoorPivot.position.set(-0.45, 1.0, 0.36); lockerG.add(ldoorPivot);
  const ldoor = box(0.88, 1.92, 0.04, 0.44, 0, 0, lam(0x535f6b), ldoorPivot);
  for (let i = 0; i < 6; i++) box(0.5, 0.025, 0.045, 0.44, 0.55 + i * 0.07, 0.01, lam(0x14181c), ldoorPivot);
  const lockerHit = box(1.0, 2.0, 0.5, 0, 1.0, 0.45, new THREE.MeshBasicMaterial({ visible: false }), lockerG); lockerHit.userData = { id: 'locker', label: 'Esconderte en la taquilla', range: 2.4 }; W.targets.push(lockerHit);
  collider(1.8, -1.8, 2.8, -1.05);
  W.locker = { group: lockerG, pivot: ldoorPivot, pos: [2.3, 1.55, -1.3], open: 0 };
  // archivador
  box(0.8, 1.5, 0.5, -0.45, 0.75, -1.65, lam(0x4a5058)); for (let i = 0; i < 3; i++) box(0.7, 0.4, 0.02, -0.45, 0.3 + i * 0.5, -1.39, lam(0x6a7078));
  const cabHit = box(0.9, 1.5, 0.5, -0.45, 0.75, -1.5, new THREE.MeshBasicMaterial({ visible: false })); cabHit.userData = { id: 'cabinet', label: 'Revisar el archivo', range: 2.6 }; W.targets.push(cabHit);
  collider(-0.9, -1.95, 0.0, -1.35);
  // corcho
  box(1.3, 0.9, 0.03, 1.6, 1.85, -1.9, lam(0x7a5a38)); for (let i = 0; i < 5; i++) { const n = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.26), new THREE.MeshLambertMaterial({ color: 0xd8cca0 })); n.position.set(1.2 + i * 0.18, 1.85 + ((i * 37) % 5) * 0.03, -1.87); n.rotation.z = (i - 2) * 0.1; add(n); }
  // notas ocultas
  const noteSpots = [[-0.9, 0.02, 2.1, -1], [1.0, 0.02, 0.0, -1], [2.3, 2.02, -1.42, -1], [-2.72, 0.02, -0.95, -1], [0.62, 0.86, 0.05, -1]];
  W.notes = noteSpots.map((s, i) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.28), new THREE.MeshBasicMaterial({ map: noteTex(), color: 0xaaaaaa }));
    m.position.set(s[0], s[1] + 0.01, s[2]); m.rotation.x = -Math.PI / 2; m.rotation.z = i * 1.3; m.visible = false;
    const hit = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.4), new THREE.MeshBasicMaterial({ visible: false })); hit.position.copy(m.position); hit.userData = { id: 'note' + i, label: 'Recoger nota', range: 2.4, noteIdx: i };
    const glow = new THREE.PointLight(0xffe2a0, 0, 1.6, 2); glow.position.set(s[0], s[1] + 0.25, s[2]);
    add(m); add(hit); add(glow); return { mesh: m, hit, glow, pos: m.position };
  });
  W.showNote = (i, on) => { const n = W.notes[i]; if (!n) return; n.mesh.visible = on; n.glow.intensity = on ? 0.5 : 0; const k = W.targets.indexOf(n.hit); if (on && k < 0) W.targets.push(n.hit); if (!on && k >= 0) W.targets.splice(k, 1); };
  // límites de la garita
  W.bounds = [-2.62, -1.78, 2.62, 2.62];

  /* ---------- luces ---------- */
  const ambient = new THREE.AmbientLight(0x2a2a40, 0.75); scene.add(ambient);
  const lamp = new THREE.PointLight(0xffd9a0, 2.0, 12, 1.5); lamp.position.set(0, 2.7, 0.6); scene.add(lamp);
  const lampBulb = sph(0.1, 0, 2.97, 0.6, bas(0xfff0c8));
  const hemi = new THREE.HemisphereLight(0x4a4a66, 0x120a0a, 0.0); scene.add(hemi);
  const pl = (c, i, d, x, y, z) => { const l = new THREE.PointLight(c, i, d, 1.5); l.position.set(x, y, z); scene.add(l); return l; };
  const roomLights = {
    stage: pl(0xffe0a8, 1.0, 14, 0, 3.0, -15), dining: pl(0xffd7a0, 0.6, 15, 0, 3.0, -12.5),
    kitchen: pl(0xff9a3c, 0.9, 10, 9.5, 2.6, -15), whall: pl(0xb8c8ff, 0.32, 9, -4.6, 2.9, -5), ehall: pl(0xb8c8ff, 0.32, 9, 4.6, 2.9, -5),
    cove: pl(0xff8866, 0.55, 9, -9.5, 2.8, -14.5), closet: pl(0xc8d0ff, 0.25, 6, -8, 2.6, -4),
  };
  const flashL = pl(0xfff1c8, 0, 10, -4.3, 2.1, 0.1), flashR = pl(0xfff1c8, 0, 10, 4.3, 2.1, 0.1);
  W.L = { ambient, lamp, lampBulb, hemi, roomLights, flashL, flashR };

  /* ---------- polvo flotante ---------- */
  const N = 220, pg = new THREE.BufferGeometry(), pp = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { pp[i * 3] = (Math.random() - 0.5) * 22; pp[i * 3 + 1] = Math.random() * 3; pp[i * 3 + 2] = -17 + Math.random() * 20; }
  pg.setAttribute('position', new THREE.BufferAttribute(pp, 3));
  const dust = new THREE.Points(pg, new THREE.PointsMaterial({ color: 0xd8c8a0, size: 0.025, transparent: true, opacity: 0.45, depthWrite: false }));
  scene.add(dust); W.dust = dust;

  /* ---------- cámaras de seguridad ---------- */
  W.CAMS = [
    { id: '1A', name: 'SALÓN DEL TRONO', pos: [0, 3.0, -11.4], look: [0, 1.2, -17], btn: [118, 6], hide: [2.5, 0.52, -16.6, 0.2] },
    { id: '1B', name: 'SALA PRINCIPAL', pos: [6.4, 3.0, -17.2], look: [-2.5, 0.8, -11.8], btn: [118, 52], hide: [-4.9, 0, -12.1, 1.0] },
    { id: '1C', name: 'VITRINA DEL PAYASO', pos: [-3.2, 2.9, -13.6], look: [-9.5, 1.1, -14.7], btn: [24, 52], noHide: true },
    { id: '2A', name: 'GALERÍA OESTE', pos: [-4.6, 2.7, -9.6], look: [-4.6, 0.9, 0], btn: [40, 120], hide: [-5.6, 0, -5.8, 1.5] },
    { id: '2B', name: 'ALMACÉN DE CERA', pos: [-9.2, 2.7, -2.4], look: [-7.4, 0.8, -5.2], btn: [8, 168], hide: [-8.5, 0, -5.2, 1.2] },
    { id: '4A', name: 'GALERÍA ESTE', pos: [4.6, 2.7, -9.6], look: [4.6, 0.9, 0], btn: [196, 120], hide: [5.6, 0, -5.8, -1.5] },
    { id: '5', name: 'TALLER DE CERA', pos: [11.6, 2.8, -10.6], look: [8.5, 0.9, -15], btn: [232, 52], audioOnly: true, noHide: true },
  ];

  /* ---------- estatuas de adorno (se crean en game.js con Char) ---------- */
  W.decoySpots = [['condesa', -5.8, -8.6, Math.PI / 2], ['nino', 5.8, -8.3, -Math.PI / 2], ['verdugo', -6.2, -11.4, 0.3], ['payaso', 6.3, -16.2, -0.4],
    ['nino', -6.3, -15.4, 0.6], ['condesa', 6.2, -12.8, -0.5], ['verdugo', -9.0, -2.7, Math.PI / 2], ['payaso', 11.2, -11.4, -2.3]];

  /* ---------- actualización por frame ---------- */
  W.update = (dt, t, st) => {
    W.fan.blades.rotation.z += dt * (W.fan.on ? 16 : 0); W.fan.head.rotation.y = Math.sin(t * 0.6) * 0.7;
    chandelier.rotation.y += dt * 0.2; chandelier.rotation.z = Math.sin(t * 0.5) * 0.03;
    // puertas
    ['L', 'R'].forEach(s => {
      if (W.doorBroken[s]) return;
      const target = W.doorClosed[s] ? 1 : 0; W.doorAnim[s] += Math.max(-dt * 4, Math.min(dt * 4, target - W.doorAnim[s]));
      W.doors[s].position.y = (1 - W.doorAnim[s]) * 2.6;
    });
    // polvo
    const a = dust.geometry.attributes.position;
    for (let i = 0; i < N; i++) { a.array[i * 3 + 1] += Math.sin(t * 0.3 + i) * dt * 0.02; a.array[i * 3] += Math.sin(t * 0.17 + i * 2) * dt * 0.02; if (a.array[i * 3 + 1] > 3) a.array[i * 3 + 1] = 0; }
    a.needsUpdate = true;
    // caja de música: bailarina gira con la carga
    const k = st.boxCharge ?? 1; W.musicBox.dancer.rotation.y += dt * (0.2 + 3.6 * k * (st.boxOn ? 1 : 0)); W.musicBox.glow.material.color.setRGB(1, 0.85, 0.6).multiplyScalar(0.3 + 0.7 * k);
    W.musicBox.crank.rotation.x += dt * (st.winding ? 9 : 0);
    // puerta de la taquilla
    const lk = W.locker; lk.open += (( st.lockerOpen ? 1 : 0) - lk.open) * Math.min(1, dt * 7); lk.pivot.rotation.y = -lk.open * 1.9;
    // horno
    W.furnaceGlow.material.color.setRGB(0.25 + (st.furnace || 0) * 0.75, 0.06 + (st.furnace || 0) * 0.35, 0.02 + (st.furnace || 0) * 0.04);
    W.cauldronWax.material.color.setRGB(0.9, 0.55 + Math.sin(t * 2) * 0.05, 0.2);
    // notas parpadean
    W.notes.forEach((n, i) => { if (n.mesh.visible) n.glow.intensity = 0.35 + Math.sin(t * 3 + i) * 0.15; });
  };
  // puerta rota
  W.breakDoor = side => {
    W.doorBroken[side] = true; W.doorClosed[side] = false; W.doorAnim[side] = 0;
    const d = W.doors[side]; d.position.y = 0; d.rotation.z = (side === 'R' ? -1 : 1) * 1.38; d.position.x += (side === 'R' ? 0.9 : -0.9);
    for (let i = 0; i < 10; i++) { const s = box(0.1 + Math.random() * 0.2, 0.04, 0.05, (side === 'R' ? 1 : -1) * (3.4 + Math.random() * 1.4), 0.03, (Math.random() - 0.5) * 1.8, lam(0x8a8e96)); s.rotation.y = Math.random() * 3; }
  };
  W.repairDoors = () => {
    ['L', 'R'].forEach(s => { W.doorBroken[s] = false; W.doors[s].rotation.z = 0; W.doors[s].position.x = s === 'L' ? -3 : 3; });
  };
  W.setPowerOut = on => {
    const L = W.L; L.lamp.intensity = on ? 0 : 2.0; L.lampBulb.visible = !on; L.ambient.intensity = on ? 0.09 : 0.75;
    Object.values(L.roomLights).forEach(l => { l.userData.base = l.userData.base ?? l.intensity; l.intensity = on ? 0 : l.userData.base; });
    W.fan.on = !on; W.scrMat.color.set(on ? 0x000000 : 0x0f3a1c);
  };
  return W;
}
