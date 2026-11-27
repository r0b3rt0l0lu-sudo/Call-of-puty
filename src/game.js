import * as THREE from 'three';
import { Sfx } from './audio.js';
import { loadAll, Char, IDS } from './models.js';
import { buildWorld } from './world.js';
import { createAI } from './ai.js';
import { createCine } from './cinematics.js';
import { NIGHTS, NOTES, CALLS, HINTS, NAMES, MEMORIES, ENDINGS } from './story.js';

const $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rnd = (a, b) => a + Math.random() * (b - a);
const params = new URLSearchParams(location.search);
const HOUR = params.has('fast') ? 6 : 60;           // segundos reales por hora de juego
const DEBUG = params.has('debug');
const NOLOCK = params.has('nolock');           // pruebas: sin bloqueo de ratón
let LOCKFAIL = false;                           // el navegador (p. ej. dentro de un iframe) no permite capturar el ratón: se mira arrastrando

/* ================= ajustes y guardado ================= */
const DEFAULTS = { vol: 0.8, sens: 1, bright: 1, subs: true, hints: true };
const SAVE_KEY = 'museo_cera_v1';
let SAVE = { night: 1, notes: [false, false, false, false, false], endings: {}, seenIntro: false, opts: { ...DEFAULTS } };
try { const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); if (s) { SAVE = Object.assign(SAVE, s); SAVE.opts = Object.assign({}, DEFAULTS, s.opts); } } catch (e) { }
const persist = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(SAVE)); } catch (e) { } };
const O = SAVE.opts;
const notesFound = () => SAVE.notes.filter(Boolean).length;

/* ================= renderer y escena ================= */
let renderer;
try { renderer = new THREE.WebGLRenderer({ canvas: $('gl'), antialias: true, powerPreference: 'high-performance' }); }
catch (e) { $('noWebgl').classList.remove('hidden'); $('loading').classList.add('hidden'); throw e; }
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
scene.fog = new THREE.FogExp2(0x000000, 0.03);
const camera = new THREE.PerspectiveCamera(72, 1, 0.04, 90); camera.rotation.order = 'YXZ';
const viewCam = new THREE.PerspectiveCamera(62, 1, 0.1, 90);
const scareCam = new THREE.PerspectiveCamera(62, 1, 0.02, 60);
const post = (() => {
  const rt = new THREE.WebGLRenderTarget(4, 4, { samples: 4 }); rt.texture.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.ShaderMaterial({
    uniforms: { tDiffuse: { value: rt.texture }, time: { value: 0 }, amt: { value: 0 }, flash: { value: 0 }, invert: { value: 0 }, res: { value: new THREE.Vector2(1, 1) } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `uniform sampler2D tDiffuse; uniform float time, amt, flash, invert; uniform vec2 res; varying vec2 vUv;
      float rnd(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
      void main(){
        vec2 uv = vUv;
        float band = floor(uv.y * 26.0 + floor(time * 24.0));
        float g = step(0.84, rnd(vec2(band, floor(time * 16.0)))) * amt;
        uv.x += (rnd(vec2(band, time)) - 0.5) * 0.14 * g;
        uv += (vec2(rnd(vec2(time, 1.0)), rnd(vec2(time, 2.0))) - 0.5) * 0.012 * amt;
        float ca = 0.003 + 0.022 * amt;
        vec3 c = vec3(texture2D(tDiffuse, uv + vec2(ca, 0.0)).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - vec2(ca, 0.0)).b);
        c = pow(max(c, 0.0), vec3(1.0 / 2.2));
        c = (c - 0.5) * (1.0 + 0.7 * amt) + 0.5; c.r *= 1.0 + 0.3 * amt; c.gb *= 1.0 - 0.15 * amt;
        c *= 0.9 + 0.1 * sin(uv.y * res.y * 1.6);
        c += (rnd(uv * res + time) - 0.5) * 0.22 * amt;
        c *= mix(1.0, smoothstep(0.95, 0.2, distance(uv, vec2(0.5))), 0.7);
        c = mix(c, 1.0 - c, invert); c += flash;
        gl_FragColor = vec4(c, 1.0);
      }`, depthTest: false, depthWrite: false });
  const sc = new THREE.Scene(), cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1); sc.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat));
  return { rt, mat, sc, cam, resize() { const v = new THREE.Vector2(); renderer.getDrawingBufferSize(v); rt.setSize(v.x, v.y); mat.uniforms.res.value.copy(v); } };
})();
function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); post.resize(); camera.aspect = viewCam.aspect = scareCam.aspect = w / h; camera.updateProjectionMatrix(); viewCam.updateProjectionMatrix(); scareCam.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();

/* ================= estado ================= */
const G = {
  state: 'loading', paused: false, modal: false, night: 1, t: 0, power: 100,
  light: { L: false, R: false }, cam: false, camIdx: 0,
  powerOut: false, outT: 0, outStage: 0,
  boxCharge: 1, boxOn: true, winding: false,
  hidden: false, breath: 1, holding: false,
  furnace: 0, furnaceLit: false, furnaceHeld: false,
  phoneRinging: false, ghostCall: false, callOn: false, scare: null, shake: 0, danger: 0, notesThisRun: 0, lastEvent: 0, lockerOpen: false,
};
const P = { pos: new THREE.Vector3(0, 0, 1.7), yaw: 0, pitch: 0, eye: 1.62, bob: 0, vel: new THREE.Vector3() };
const threat = { condesa: 0, payaso: 0, nino: 0, verdugo: 0 };
const keys = {};

/* ================= mundo y personajes ================= */
const W = buildWorld(scene);
const actors = {}, decoys = [];
class Actor {
  constructor(id) { this.id = id; this.char = new Char(id); scene.add(this.char.group); this.target = null; this.speed = 1.2; this.idle = 'Idle'; this.moveClip = 'Walk'; this.rotT = null; this.name = NAMES[id]; }
  teleport(x, y, z, ry = 0) { this.char.place(x, y, z, ry); this.target = null; }
  goTo(p, speed, ry, clip) { this.target = new THREE.Vector3(p[0], p[1], p[2]); this.speed = speed; this.moveClip = clip || 'Walk'; this.finalRy = ry; }
  update(dt) {
    if (!this.char.group.visible) return;
    const g = this.char.group, c = this.char;
    if (this.target) {
      const dx = this.target.x - g.position.x, dz = this.target.z - g.position.z, dist = Math.hypot(dx, dz);
      if (dist < 0.08) { g.position.x = this.target.x; g.position.z = this.target.z; g.position.y = this.target.y; this.target = null; }
      else {
        const step = Math.min(dist, this.speed * dt); g.position.x += dx / dist * step; g.position.z += dz / dist * step; g.position.y += (this.target.y - g.position.y) * Math.min(1, dt * 4);
        const want = Math.atan2(dx, dz); let d = want - g.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); g.rotation.y += clamp(d, -dt * 7, dt * 7);
        c.play(this.moveClip, { speed: clamp(this.speed / (this.moveClip === 'Run' ? 3.2 : 1.0), 0.5, 2.4), fade: 0.15 });
      }
    }
    if (!this.target) {
      if (this.rotT !== null && this.rotT !== undefined) { let d = this.rotT - g.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); g.rotation.y += clamp(d, -dt * 4, dt * 4); }
      if (c.clip !== 'Melt' || this.idle !== 'Melt') { if (!(c.clip === 'Melt' && c.cur.actions.Melt && c.cur.actions.Melt.isRunning())) c.play(this.idle, { fade: 0.35 }); }
    }
    c.update(dt);
  }
}
function setupCharacters() {
  IDS.forEach(id => { actors[id] = new Actor(id); });
  W.decoySpots.forEach(([id, x, z, ry], i) => {
    const ch = new Char(id, { decoy: true }); ch.place(x, 0, z, ry); ch.setVariant(i % 3 === 0 ? 'damaged' : 'normal');
    ch.freezePose('Idle', Math.random() * 6); ch.group.userData.decoy = true; scene.add(ch.group); decoys.push({ char: ch });
  });
}

/* ================= UI helpers ================= */
const show = id => $(id).classList.remove('hidden');
const hide = id => $(id).classList.add('hidden');
const isHidden = id => $(id).classList.contains('hidden');
let subTimer = 0, hintTimer = 0; const hintCool = {};
function sub(text, secs = 3) { if (!O.subs) return; const e = $('subs'); e.textContent = text; show('subs'); clearTimeout(subTimer); subTimer = setTimeout(() => hide('subs'), secs * 1000); }
function hint(text, key, secs = 4) {
  if (!O.hints) return; const t = performance.now();
  if (hintCool[key] && t - hintCool[key] < 14000) return; hintCool[key] = t;
  const e = $('hintLine'); e.textContent = text; show('hintLine'); clearTimeout(hintTimer); hintTimer = setTimeout(() => hide('hintLine'), secs * 1000);
}
function screenFlash(o = 0.9, col = '#b00') { const f = $('flash'); f.style.background = col; f.style.transition = 'none'; f.style.opacity = o; requestAnimationFrame(() => { f.style.transition = 'opacity .6s'; f.style.opacity = 0; }); }
function faceFlash() {
  const c = $('faceFlash'), g = c.getContext('2d'), w = c.width, h = c.height;
  g.fillStyle = '#000'; g.fillRect(0, 0, w, h); g.fillStyle = '#cfc7a8'; g.beginPath(); g.ellipse(w / 2, h / 2, w * 0.2, h * 0.38, 0, 0, 7); g.fill();
  g.fillStyle = '#000'; g.beginPath(); g.ellipse(w * 0.43, h * 0.4, 14, 20, 0, 0, 7); g.ellipse(w * 0.57, h * 0.4, 14, 20, 0, 0, 7); g.fill();
  g.beginPath(); g.ellipse(w / 2, h * 0.64, 30, 52, 0, 0, 7); g.fill();
  show('faceFlash'); setTimeout(() => hide('faceFlash'), 110);
}
function applyBright() { $('gl').style.filter = `brightness(${1 + (O.bright - 1) * 0.7})`; }

/* ================= entorno compartido con la IA ================= */
const eyePos = () => camera.position.clone();
const forward = () => { const v = new THREE.Vector3(); camera.getWorldDirection(v); return v; };
const X = {
  G, W, P, Sfx, actors, decoys, HOUR, threat, hint, sub, faceFlash, eyePos, forward,
  shake: v => { G.shake = Math.max(G.shake, v); },
  setDanger: v => { G.danger = v; },
  jumpscare: id => jumpscare(id),
  canStartEvent: () => G.state === 'play' && !G.modal && !G.powerOut && (G.t - G.lastEvent > 8)
    && ['off', 'wait'].includes(AI.verdugo.state) && ['idle', 'cool'].includes(AI.nino.phase) && AI.payaso.state === 'vitrine' && G.boxCharge > 0.3,
};
let AI = null, Cine = null;

/* ================= entrada: ratón / teclado ================= */
const canvas = $('gl');
const lockOn = () => document.pointerLockElement === canvas;
function needLockCheck() { setTimeout(() => { if (G.state === 'play' && !G.cam && !G.modal && !G.paused && !lockOn() && !NOLOCK && !LOCKFAIL) show('resume'); }, 450); }
function lockPointer() { if (NOLOCK || LOCKFAIL) return; try { const r = canvas.requestPointerLock(); if (r && r.catch) r.catch(() => { }); } catch (e) { } }
function unlockPointer() { G.intentUnlock = true; try { document.exitPointerLock(); } catch (e) { } setTimeout(() => { G.intentUnlock = false; }, 200); }
document.addEventListener('pointerlockerror', () => { LOCKFAIL = true; hide('resume'); hint('Tu navegador no deja capturar el ratón: mira arrastrando con el botón izquierdo.', 'lockfail', 7); });
document.addEventListener('pointerlockchange', () => {
  if (lockOn()) hide('resume');
  if (!lockOn() && !G.intentUnlock && G.state === 'play' && !G.cam && !G.modal && !G.paused) pauseGame(true);
});
addEventListener('mousemove', e => {
  if (G.state !== 'play' || G.cam || G.modal || G.paused) return;
  if (!lockOn() && !(e.buttons & 1) && !NOLOCK) return;
  const s = 0.0022 * O.sens; P.yaw -= e.movementX * s; P.pitch = clamp(P.pitch - e.movementY * s, -1.35, 1.35);
  if (G.hidden) P.yaw = clamp(P.yaw, Math.PI - 0.7, Math.PI + 0.7);
});
canvas.addEventListener('mousedown', e => { if (e.button === 0) { if (G.state === 'play' && !lockOn() && !G.cam && !G.modal && !G.paused && !NOLOCK && !LOCKFAIL) { lockPointer(); return; } usePress(); } });
addEventListener('mouseup', e => { if (e.button === 0) useRelease(); });
addEventListener('keydown', e => {
  if (e.repeat) { if (e.code === 'Space') e.preventDefault(); return; }
  keys[e.code] = true;
  if (G.state === 'menu') return menuKey(e);
  if (['over', 'win', 'choice', 'end'].includes(G.state) || isHidden('noteReader') === false || isHidden('archive') === false) { if (e.code === 'Escape' || e.code === 'KeyE' || e.code === 'Enter') { if (!isHidden('noteReader')) closeNote(); else if (!isHidden('archive') && G.state === 'play') closeArchive(); else if (G.state === 'win' && e.code === 'Enter') $('btnNext').click(); else if (G.state === 'over' && e.code === 'Enter') $('btnRetry').click(); } return; }
  if (G.state === 'cine') { if (e.code === 'Escape' || e.code === 'Space' || e.code === 'Enter') Cine.skip(); return; }
  if (G.state !== 'play') return;
  if (e.code === 'Escape') { if (G.cam) exitCams(); else if (!G.paused) pauseGame(true); else resumeGame(); return; }
  if (G.paused || G.modal) return;
  if (e.code === 'KeyE') usePress();
  else if (e.code === 'Space') { e.preventDefault(); if (G.cam) exitCams(); else tryCams(); }
  else if (G.cam && e.code.startsWith('Digit')) { const n = parseInt(e.code.slice(5), 10) - 1; if (n >= 0 && n < W.CAMS.length) selectCam(n); }
  else if (G.cam && (e.code === 'KeyF')) $('btnFind').click();
  else if (e.code === 'KeyM') endCall(true);
});
addEventListener('keyup', e => { keys[e.code] = false; if (e.code === 'KeyE') useRelease(); });
addEventListener('blur', () => { Object.keys(keys).forEach(k => keys[k] = false); useRelease(); if (G.state === 'play' && !G.cam && !G.modal && !G.paused) pauseGame(true); });

/* ================= jugador ================= */
const tmpV = new THREE.Vector3();
function collides(x, z, r = 0.28) {
  const b = W.bounds; if (x < b[0] || z < b[1] || x > b[2] || z > b[3]) return true;
  for (const c of W.colliders) if (x > c[0] - r && x < c[2] + r && z > c[1] - r && z < c[3] + r) return true;
  return false;
}
function updatePlayer(dt) {
  if (G.hidden) {
    camera.position.set(W.locker.pos[0], W.locker.pos[1], W.locker.pos[2]);
    camera.rotation.set(P.pitch * 0.5, P.yaw, 0); return;
  }
  if (G.cam || G.modal) { camera.position.set(P.pos.x, P.eye, P.pos.z); camera.rotation.set(P.pitch, P.yaw, 0); return; }
  let mx = 0, mz = 0;
  if (keys.KeyW || keys.ArrowUp) mz -= 1; if (keys.KeyS || keys.ArrowDown) mz += 1; if (keys.KeyA || keys.ArrowLeft) mx -= 1; if (keys.KeyD || keys.ArrowRight) mx += 1;
  const len = Math.hypot(mx, mz) || 1; mx /= len; mz /= len;
  const sp = 2.1, sin = Math.sin(P.yaw), cos = Math.cos(P.yaw);
  const wx = (mx * cos + mz * sin) * sp, wz = (-mx * sin + mz * cos) * sp;
  P.vel.x += (wx - P.vel.x) * Math.min(1, dt * 12); P.vel.z += (wz - P.vel.z) * Math.min(1, dt * 12);
  const nx = P.pos.x + P.vel.x * dt, nz = P.pos.z + P.vel.z * dt;
  if (!collides(nx, P.pos.z)) P.pos.x = nx; else P.vel.x = 0;
  if (!collides(P.pos.x, nz)) P.pos.z = nz; else P.vel.z = 0;
  const moving = Math.hypot(P.vel.x, P.vel.z) > 0.3; P.bob += dt * (moving ? 8 : 1.2);
  camera.position.set(P.pos.x, P.eye + Math.sin(P.bob) * (moving ? 0.025 : 0.004), P.pos.z);
  camera.rotation.set(P.pitch, P.yaw, 0);
}

/* ================= interacción ================= */
const ray = new THREE.Raycaster(); let focus = null;
function enabled(u) {
  if (!u) return false;
  if (G.modal || G.cam || G.paused) return false;
  if (G.hidden) return u.id === 'locker';
  if (G.powerOut && u.id !== 'locker') return false;
  if (u.id === 'phone') return G.phoneRinging;
  return true;
}
function updateFocus() {
  focus = null;
  if (G.state === 'play') {
    ray.setFromCamera({ x: 0, y: 0 }, camera); ray.far = 3.2;
    const hits = ray.intersectObjects(W.targets, false);
    for (const h of hits) { const u = h.object.userData; if (enabled(u) && h.distance <= u.range) { focus = u; break; } }
  }
  const p = $('prompt');
  if (focus) {
    let label = focus.label, key = '[E]';
    if (focus.id === 'locker' && G.hidden) label = 'Salir de la taquilla';
    if (focus.id === 'musicbox') label = `Mantén para dar cuerda · ${Math.round(G.boxCharge * 100)}%`;
    if (focus.id.startsWith('door')) label = (W.doorBroken[focus.side] ? 'Puerta destrozada' : (W.doorClosed[focus.side] ? 'Abrir ' : 'Cerrar ') + focus.label.toLowerCase());
    if (focus.id.startsWith('light')) label = (G.light[focus.side] ? 'Apagar ' : 'Encender ') + focus.label.toLowerCase();
    p.textContent = `${key} ${label}`; show('prompt'); $('cross').classList.add('act');
  } else { hide('prompt'); $('cross').classList.remove('act'); }
}
function usePress() {
  if (G.state !== 'play' || G.paused || G.cam) { return; }
  if (G.modal) return;
  if (!focus) return;
  const u = focus;
  if (u.id === 'musicbox') { G.holdId = 'musicbox'; return; }
  if (u.id === 'door' + u.side) toggleDoor(u.side);
  else if (u.id === 'light' + u.side) toggleLight(u.side);
  else if (u.id === 'monitor') tryCams();
  else if (u.id === 'locker') toggleLocker();
  else if (u.id === 'phone') answerPhone();
  else if (u.id === 'cabinet') openArchive(true);
  else if (u.id.startsWith('note')) pickNote(u.noteIdx);
}
function useRelease() { G.holdId = null; G.winding = false; }
function updateHold(dt) {
  if (G.holdId === 'musicbox' && focus && focus.id === 'musicbox' && !G.hidden && !G.powerOut) {
    G.winding = true; G.windT = (G.windT || 0) - dt; if (G.windT <= 0) { G.windT = 0.2; Sfx.crank(W.musicBox.pos); }
    show('holdBar'); $('holdFill').style.width = Math.round(G.boxCharge * 100) + '%';
  } else { G.winding = false; hide('holdBar'); }
}
function toggleDoor(side) {
  const p = [side === 'L' ? -2.9 : 2.9, 1.5, 1.4];
  if (W.doorBroken[side]) { Sfx.buzzer(); sub('(la puerta está destrozada)', 2); return; }
  W.doorClosed[side] = !W.doorClosed[side]; Sfx.door(p, W.doorClosed[side]); updatePanels();
}
function toggleLight(side) {
  const p = [side === 'L' ? -2.9 : 2.9, 1.2, 1.4], o = side === 'L' ? 'R' : 'L';
  G.light[side] = !G.light[side]; if (G.light[side]) G.light[o] = false; Sfx.flash(G.light[side], p); updatePanels(); updateLightsFx();
  if (G.light[side]) { const who = whoAtDoor(side); if (who) { Sfx.sting('metal', p); } }
}
function whoAtDoor(side) { const x = side === 'L' ? -4.1 : 4.1; return Object.values(actors).find(a => a.char.group.visible && Math.abs(a.char.group.position.x - x) < 0.6 && Math.abs(a.char.group.position.z) < 0.7); }
function updateLightsFx() {
  W.L.flashL.intensity = G.light.L && !G.powerOut ? 3.4 : 0; W.L.flashR.intensity = G.light.R && !G.powerOut ? 3.4 : 0;
  Sfx.buzz((G.light.L || G.light.R) && !G.powerOut);
}
function updatePanels() {
  ['L', 'R'].forEach(s => {
    const p = W.panels[s], cl = W.doorClosed[s], br = W.doorBroken[s];
    p.door.mat.color.set(br ? 0xff7a00 : (cl ? 0xff2020 : 0x1f6a2a)); p.light.mat.color.set(G.light[s] ? 0xffd24d : 0x3a3000);
  });
}
function toggleLocker() {
  if (!G.hidden) {
    G.hidden = true; P.pos.set(2.3, 0, -1.3); P.yaw = Math.PI; P.pitch = 0; G.lockerOpen = false; Sfx.locker(false, [2.3, 1.2, -1.3]); Sfx.fanMuffle(true);
    show('lockerOverlay'); G.holding = false; hint('Mantén SHIFT para aguantar la respiración cuando se acerque.', 'breath', 5);
  } else {
    G.hidden = false; G.holding = false; G.lockerOpen = true; P.pos.set(2.2, 0, -0.5); P.yaw = 0; Sfx.locker(true, [2.3, 1.2, -1.3]); Sfx.fanMuffle(false); hide('lockerOverlay'); hide('breath'); setTimeout(() => { G.lockerOpen = false; }, 400);
  }
}
function pickNote(i) {
  if (SAVE.notes[i]) return; SAVE.notes[i] = true; persist(); W.showNote(i, false); Sfx.pick(); G.notesThisRun++; openNote(i);
}
function openNote(i) {
  G.modal = true; unlockPointer(); const n = NOTES[i];
  $('nrTitle').textContent = n.title; $('nrFrom').textContent = n.from; $('nrBody').textContent = n.body; show('noteReader'); useRelease();
}
function closeNote() { hide('noteReader'); G.modal = false; if (G.state === 'play' && !G.cam) { lockPointer(); needLockCheck(); } Sfx.uiBack(); }
function openArchive(ingame) {
  G.modal = true; if (ingame) unlockPointer(); renderArchive(); show('archive'); useRelease();
}
function closeArchive() { hide('archive'); G.modal = false; if (G.state === 'play') { lockPointer(); needLockCheck(); } Sfx.uiBack(); }
function renderArchive() {
  const l = $('archList'); l.innerHTML = '';
  NOTES.forEach((n, i) => { const b = document.createElement('button'); b.className = 'arch-item' + (SAVE.notes[i] ? '' : ' locked'); b.textContent = SAVE.notes[i] ? `${i + 1}. ${n.title}` : `${i + 1}. ???`; b.disabled = !SAVE.notes[i]; b.onclick = () => { showArch(i); Sfx.ui(); }; l.appendChild(b); });
  const e = SAVE.endings; $('archEnds').textContent = `Finales vistos: ${['leave', 'curator', 'free'].filter(k => e[k]).length}/3 · Notas: ${notesFound()}/5`;
  const first = SAVE.notes.findIndex(Boolean); if (first >= 0) showArch(first); else { $('archTitle').textContent = 'Archivo vacío'; $('archBody').textContent = 'Todavía no has encontrado ninguna nota.\nBusca papeles escondidos en la garita durante las noches.'; }
}
function showArch(i) { const n = NOTES[i]; $('archTitle').textContent = n.title + ' — ' + n.from; $('archBody').textContent = n.body; }
$('btnNrClose').onclick = closeNote; $('btnArchBack').onclick = () => { if (G.state === 'menu') { hide('archive'); show('menu'); } else closeArchive(); };

/* ================= cámaras de seguridad ================= */
function tryCams() {
  if (G.state !== 'play' || G.powerOut || G.hidden || G.modal) return;
  const d = Math.hypot(P.pos.x - 0, P.pos.z - 0.9);
  if (d > 2.4 || P.pos.z < 0.7) { hint('Acércate al escritorio para usar las cámaras.', 'desk', 3); Sfx.buzzer(); return; }
  enterCams();
}
function enterCams() {
  G.cam = true; G.light.L = G.light.R = false; updatePanels(); updateLightsFx(); show('monitor'); unlockPointer(); Sfx.camOpen(); selectCam(G.camIdx, true); G.staticBurst = 1; useRelease();
  Sfx.staticLoop(0.08);
}
function exitCams() { G.cam = false; hide('monitor'); Sfx.camClose(); Sfx.staticLoop(0); G.furnaceHeld = false; lockPointer(); needLockCheck(); }
function selectCam(i, quiet) {
  G.camIdx = i; const c = W.CAMS[i];
  $('camLabel').innerHTML = `CAM ${c.id}<small>${c.name}</small>`; $('camOff').style.display = c.audioOnly ? 'flex' : 'none';
  [...$('camMap').querySelectorAll('button')].forEach((b, j) => b.classList.toggle('sel', j === i));
  G.staticBurst = 0.8; if (!quiet) Sfx.camSwitch(); refreshCamActions();
}
function refreshCamActions() {
  const c = W.CAMS[G.camIdx];
  $('btnLock').classList.toggle('hidden', c.id !== '1C');
  $('lockBar').classList.toggle('hidden', c.id !== '1C');
  const f = G.night >= 5 && c.id === '5'; $('btnFurnace').classList.toggle('hidden', !f); $('furnBar').classList.toggle('hidden', !f);
  $('btnFind').classList.toggle('hidden', !(G.night >= 2 && AI && AI.nino.phase === 'count'));
}
(function buildCamMap() {
  const m = $('camMap'); W.CAMS.forEach((c, i) => { const b = document.createElement('button'); b.textContent = 'CAM ' + c.id; b.style.left = c.btn[0] + 'px'; b.style.top = c.btn[1] + 'px'; b.onclick = e => { e.stopPropagation(); selectCam(i); }; m.appendChild(b); });
  const you = document.createElement('div'); you.className = 'you'; you.textContent = '[ GARITA ]'; m.appendChild(you);
})();
$('btnLock').onclick = () => AI.reinforce();
$('btnFind').onclick = () => { if (AI.found(G.camIdx)) refreshCamActions(); };
$('camExit').onclick = exitCams;
['pointerdown'].forEach(ev => $('btnFurnace').addEventListener(ev, e => { e.preventDefault(); if (SAVE.notes.every(Boolean)) { G.furnaceHeld = true; } else { Sfx.buzzer(); hint('Necesitas la llave del horno: encuentra las 5 notas escondidas en la garita.', 'key', 5); } }));
['pointerup', 'pointerleave'].forEach(ev => $('btnFurnace').addEventListener(ev, () => { G.furnaceHeld = false; }));

/* ================= teléfono / llamadas ================= */
let callTimer = null;
function ringPhone() { if (G.night > 5) return; G.phoneRinging = true; G.ghostCall = false; Sfx.phoneRing(true); G.ringT = 22; hint('Suena el teléfono del escritorio. Acércate y contesta (E).', 'ring', 5); }
function answerPhone() {
  if (!G.phoneRinging) return; G.phoneRinging = false; Sfx.phoneRing(false); Sfx.pickup();
  if (G.ghostCall) { G.ghostCall = false; Sfx.sting('static'); setTimeout(() => { Sfx.whisper([0.3, 1, 0.4], 1.2, 0.5); sub('(estática… una respiración)', 3); }, 500); setTimeout(() => Sfx.sting('metal'), 1900); return; }
  startCall();
}
function startCall() {
  const c = CALLS[G.night]; if (!c) return; G.callOn = true; let i = 0; show('muteCall');
  const next = () => {
    if (!G.callOn || G.state !== 'play') { endCall(); return; }
    if (i >= c.lines.length) { endCall(); return; }
    const line = c.lines[i++]; sub(`${c.who}: «${line}»`, Math.max(4, line.length * 0.07));
    Sfx.tape(true); Sfx.say(line, { pitch: c.pitch, rate: c.rate, vol: 0.9, onend: () => { if (G.callOn) callTimer = setTimeout(next, 600); } }) || (callTimer = setTimeout(next, Math.max(4000, line.length * 75)));
  };
  next();
}
function endCall(user) { G.callOn = false; clearTimeout(callTimer); Sfx.shutUp(); hide('muteCall'); if (user) hide('subs'); }
$('muteCall').onclick = () => endCall(true);

/* ================= HUD ================= */
function usageNow() { return 1 + (W.doorClosed.L ? 1 : 0) + (W.doorClosed.R ? 1 : 0) + (G.light.L || G.light.R ? 1 : 0) + (G.cam ? 1 : 0); }
const cache = {};
const setT = (id, v) => { if (cache[id] !== v) { cache[id] = v; $(id).textContent = v; } };
function updateHud() {
  const h = Math.floor(G.t / HOUR); setT('hudNight', G.night > 5 ? 'Pesadilla' : 'Noche ' + G.night); setT('hudTime', (h === 0 ? 12 : h) + ' AM');
  const p = Math.max(0, Math.ceil(G.power)); setT('hudPower', 'Energía: ' + p + '%'); $('hudPower').classList.toggle('low', p <= 20);
  const u = usageNow(); if (cache.u !== u) { cache.u = u; $('bars').innerHTML = [0, 1, 2, 3, 4].map(i => `<i class="${i < u ? 'on ' + (u >= 4 ? 'hi' : u >= 3 ? 'mid' : '') : ''}"></i>`).join(''); }
  $('breath').classList.toggle('hidden', !G.hidden); if (G.hidden) $('breathFill').style.width = Math.round(G.breath * 100) + '%';
  $('dangerVig').style.opacity = G.danger > 0.05 ? clamp(G.danger, 0, 1) * 0.9 : 0;
  // barras de cámara
  if (G.cam) { $('lockFill').style.width = Math.round(AI.payaso.lock * 100) + '%'; $('lockFill').classList.toggle('low', AI.payaso.lock < 0.35); $('furnFill').style.width = Math.round(G.furnace * 100) + '%'; $('btnFind').classList.toggle('hidden', !(G.night >= 2 && AI.nino.phase === 'count')); }
}

/* ================= flujo de noche ================= */
function resetNight() {
  Object.assign(G, { t: 0, power: 100, light: { L: false, R: false }, cam: false, camIdx: 0, powerOut: false, outT: 0, outStage: 0, boxCharge: 1, winding: false, hidden: false, breath: 1, holding: false, furnace: 0, furnaceLit: false, furnaceHeld: false, phoneRinging: false, ghostCall: false, callOn: false, scare: null, shake: 0, danger: 0, notesThisRun: 0, modal: false, lastEvent: 0 });
  W.doorClosed.L = W.doorClosed.R = false; W.doorAnim.L = W.doorAnim.R = 0;
  P.pos.set(0, 0, 1.7); P.yaw = 0; P.pitch = 0; P.vel.set(0, 0, 0);
  const dmg = G.night >= 4;
  Object.values(actors).forEach(a => { a.char.setVariant(dmg ? 'damaged' : 'normal'); a.char.group.visible = true; });
  AI.reset(); W.setPowerOut(false); W.setVitrine(0); updatePanels(); updateLightsFx(); hide('monitor'); hide('lockerOverlay'); hide('holdBar'); Sfx.stopAmbient(); endCall();
  W.notes.forEach((n, i) => W.showNote(i, false));
  if (G.night <= 5 && !SAVE.notes[G.night - 1]) W.showNote(G.night - 1, true);
  W.L.ambient.intensity = 0.75; W.L.lamp.intensity = 2.0; camera.fov = 72; camera.updateProjectionMatrix();
  W.exitDoor.setOpen(0); hide('dangerVig');
}
async function startNight(n) {
  Sfx.init(); G.night = n; G.state = 'card'; hideScreens(); unlockPointer(); hide('hud'); resetNight();
  const nt = NIGHTS[Math.min(n, 6)]; $('ncN').textContent = n > 5 ? 'Noche extra' : 'Noche ' + n; $('ncT').textContent = '12:00 AM'; $('ncS').textContent = nt.title; show('nightCard');
  setTimeout(() => {
    if (G.state !== 'card') return; hide('nightCard'); show('hud'); G.state = 'play'; G.lastEvent = 0;
    Sfx.startAmbient(); Sfx.fan(true); lockPointer(); needLockCheck(); updatePanels(); hint('WASD para moverte · E / clic para interactuar · Espacio en el escritorio: cámaras', 'ctrl', 7);
    if (n <= 5) setTimeout(() => { if (G.state === 'play') ringPhone(); }, 3500);
  }, 3200);
}
function hideScreens() { ['menu', 'nightCard', 'gameOver', 'win', 'choice', 'ending', 'options', 'archive', 'pause', 'noteReader', 'resume', 'credits'].forEach(hide); }

/* ================= apagón ================= */
function triggerPowerOut() {
  G.powerOut = true; G.outT = 0; G.outStage = 0; G.light.L = G.light.R = false; W.doorClosed.L = W.doorClosed.R = false; if (G.cam) exitCams(); updatePanels(); updateLightsFx();
  Sfx.buzz(false); Sfx.fan(false); Sfx.powerDown(); endCall(); W.setPowerOut(true); Sfx.waltzSet(0.12); Sfx.waltzPause(false); G.winding = false;
  Object.values(actors).forEach(a => { a.char.visible = false; });
  const c = actors.condesa; c.teleport(-4.05, 0, 0, Math.PI / 2); c.idle = 'Stare'; c.char.visible = false; sub('(se fue la luz)', 3); hint('Sin energía… no hagas ruido.', 'out', 4);
  if (G.hidden) toggleLocker();
}
function updatePowerOut(dt) {
  G.outT += dt; const c = actors.condesa;
  if (G.outStage === 0 && G.outT > 3) { G.outStage = 1; Sfx.heelRun([-4.4, 0.1, -6], 14, 0.2, 1.1); }
  if (G.outStage >= 1) {
    c.char.visible = Math.sin(G.outT * 3.3) > -0.3 && Math.sin(G.outT * 13) > -0.7; c.char.setEyes(1.3);
    if (G.outStage === 1 && G.outT > 12 + (G.night % 3) * 2) { G.outStage = 2; Sfx.waltzPause(true); Sfx.silenceStinger([-3.4, 1.2, 0]); Sfx.heelRun([-3.8, 0.1, 0.2], 10, 0.15, 1.4); }
    if (G.outStage === 2) { c.char.visible = Math.random() > 0.35; if (G.outT > 18 + (G.night % 3) * 2) jumpscare('condesa', 'outage'); }
  }
  Sfx.waltzSet(G.outStage === 1 ? 0.14 + Math.sin(G.outT) * 0.02 : 0.1);
}

/* ================= jumpscare ================= */
/* Secuencia de muerte: aviso (silencio, luces fuera, la cabeza gira hacia la figura) → golpe con
   efectos de imagen y la animación del .glb → segundo golpe → corte a negro con zumbido de oídos. */
const PRE = { condesa: 1.4, verdugo: 1.0, nino: 1.1, payaso: 0.9 };
const shortest = d => Math.atan2(Math.sin(d), Math.cos(d));
const ease3 = t => t * t * (3 - 2 * t);
function jumpscare(id, cause) {
  if (G.state !== 'play') return;
  G.state = 'dead'; endCall(); if (G.cam) { G.cam = false; hide('monitor'); }
  G.light.L = G.light.R = false; updateLightsFx(); Sfx.stopAmbient(); Sfx.heart(0); Sfx.staticLoop(0);
  hide('lockerOverlay'); hide('hud'); hide('prompt'); hide('hintLine'); hide('subs'); hide('dangerVig'); hide('breath'); hide('holdBar'); hide('muteCall');
  Object.values(actors).forEach(a => { if (a.id !== id) a.char.visible = false; });
  const a = actors[id]; a.target = null; a.char.visible = true;
  if (id === 'condesa' && cause !== 'outage') { a.teleport(-2.2, 0, 0.3, Math.PI / 2); a.idle = 'Stare'; a.char.play('Stare', { fade: 0 }); }   // aparece dentro de la garita, a tu lado
  a.char.setEyes(2.4);
  camera.updateMatrixWorld(true);
  const head = a.char.group.position.clone().add(new THREE.Vector3(0, 1.5, 0)), d = head.sub(camera.position);
  const S = G.scare = { id, cause: cause || id, t: 0, phase: 'pre', pre: PRE[id] || 1, th: 0, tc: 0, hit2: false, shown: false,
    yaw0: camera.rotation.y, pit0: camera.rotation.x, yaw1: Math.atan2(-d.x, -d.z), pit1: clamp(Math.atan2(d.y, Math.hypot(d.x, d.z)), -0.45, 0.45),
    fwd: forward(), light: new THREE.PointLight(0xfff0d8, 0, 7, 1.5) };
  S.dyaw = shortest(S.yaw1 - S.yaw0); scene.add(S.light);
  W.L.lamp.intensity = 0; W.L.ambient.intensity = 0.3; scene.fog.density = 0.03;
  S.light.color.setHex(0x9fb0ff); S.light.position.copy(a.char.group.position).add(new THREE.Vector3(0.6 * Math.sign(camera.position.x - a.char.group.position.x || 1), 1.7, 0.9)); S.light.distance = 7;   // luz fría y débil: se intuye su silueta en la oscuridad
  Sfx.dropAll(); Sfx.preScare(id, S.pre); unlockPointer();
}
function startHit() {
  const S = G.scare, a = actors[S.id]; S.phase = 'hit'; S.th = 0;
  camera.updateMatrixWorld(true); S.fwd = forward();
  a.char.group.visible = true; a.char.jumpscareBegin(camera.matrixWorld.clone()); a.char.setEyes(2.2);
  W.L.ambient.intensity = 0.55; scene.fog.density = 0.02; S.light.intensity = 3; S.light.color.setHex(0xfff0d8); S.light.distance = 7;
  Sfx.jumpscare(S.id); post.mat.uniforms.invert.value = 1; post.mat.uniforms.flash.value = 0.9; screenFlash(0.55, '#a00');
}
const jOff = new THREE.Vector3();
function updateScare(dt) {
  const S = G.scare, a = actors[S.id], U = post.mat.uniforms; S.t += dt; U.time.value = time;
  U.flash.value = Math.max(0, U.flash.value - dt * 6);
  if (S.phase === 'pre') {
    const k = ease3(clamp(S.t / 0.55, 0, 1));                                   // la cabeza gira sola hacia la figura
    camera.rotation.set(S.pit0 + (S.pit1 - S.pit0) * k, S.yaw0 + S.dyaw * k, (Math.random() - 0.5) * 0.02 * (S.t / S.pre));
    W.L.lamp.intensity = Math.random() < 0.12 ? 0.35 : 0;                        // luces que mueren y parpadean
    a.char.setEyes(1.4 + Math.random() * 2.2); S.light.intensity = (Math.random() < 0.22 ? 0.2 : 2.4) * (0.5 + S.t / S.pre);
    const k2 = S.t / S.pre; U.amt.value = 0.1 + 0.35 * k2; U.invert.value = Math.random() < 0.015 * k2 * 4 ? 1 : 0;
    if (S.t >= S.pre) startHit();
    return;
  }
  if (S.phase === 'hit') {
    S.th += dt; const th = S.th;
    const k = clamp(th / 0.12, 0, 1), dist = 3.2 * (1 - k * k);                  // embestida
    jOff.copy(S.fwd).multiplyScalar(dist);
    a.char.jumpscareStep(th < 0.06 ? 0 : dt, jOff, scareCam);                    // 60 ms de "hit-stop"
    // cámara: sacudida fuerte + golpe de FOV + segundo golpe
    const sh = 0.07 * Math.exp(-th * 1.2); scareCam.position.x += (Math.random() - 0.5) * sh; scareCam.position.y += (Math.random() - 0.5) * sh;
    scareCam.rotateZ((Math.random() - 0.5) * 0.12 * Math.exp(-th * 1.5));
    let punch = 38 * Math.exp(-th * 7);
    if (!S.hit2 && th > 1.3) { S.hit2 = true; Sfx.jumpscare2(S.id); U.invert.value = 1; U.flash.value = 1; screenFlash(0.8, '#fff'); S.t2 = th; }
    if (S.hit2) { const t2 = th - S.t2; punch += 30 * Math.exp(-t2 * 8); scareCam.translateZ(-0.7 * Math.exp(-t2 * 6)); }
    scareCam.fov = (a.char.cur.cam ? a.char.cur.cam.fov : 62) + punch; scareCam.updateProjectionMatrix();
    S.light.position.copy(scareCam.position); S.light.intensity = Math.random() < 0.1 ? 0.4 : 3.2;
    a.char.setEyes(2 + Math.random() * 1.5);
    U.amt.value = th < 0.5 ? 1 : 0.55 + (S.hit2 ? 0.4 : 0.1) * Math.random();
    U.invert.value = (th < 0.3 && Math.floor(th * 40) % 3 === 0) || (S.hit2 && th - S.t2 < 0.12 && Math.floor((th - S.t2) * 40) % 2 === 0) ? 1 : 0;
    a.char.group.visible = !(th < 1.7 && Math.random() < 0.05);                  // parpadeo de la figura
    $('noise').style.opacity = 0.12;
    if (th > 2.3) { S.phase = 'cut'; S.tc = 0; a.char.group.visible = false; scene.remove(S.light); Sfx.tinnitus(); U.invert.value = 0; U.amt.value = 0; }
    return;
  }
  // corte a negro: silencio roto solo por el zumbido; luego aparece el texto
  S.tc += dt;
  if (S.tc > 1.8 && !S.shown) {
    S.shown = true; G.state = 'over'; a.char.group.visible = true; W.L.ambient.intensity = 0.75; W.L.lamp.intensity = 2.0; scene.fog.density = 0.03;
    $('goWho').textContent = `${NAMES[S.cause === 'outage' ? 'outage' : S.id]} te atrapó · Noche ${G.night > 5 ? 'extra' : G.night}`; $('goHint').textContent = HINTS[S.cause] || HINTS[S.id]; show('gameOver');
  }
}

/* ================= final de noche ================= */
function winNight() {
  G.state = 'win'; endCall(); Sfx.stopAmbient(); Sfx.heart(0); if (G.cam) { G.cam = false; hide('monitor'); } if (G.hidden) hide('lockerOverlay'); hide('hud'); hide('prompt'); hide('hintLine'); hide('subs'); hide('dangerVig'); hide('holdBar'); unlockPointer();
  Sfx.chime6(); $('winMsg').textContent = G.night >= 5 ? '¡Has sobrevivido a la última noche!' : `Has sobrevivido a la noche ${G.night}.`; hide('btnNext'); show('win');
  if (G.night < 5) SAVE.night = Math.max(SAVE.night, G.night + 1); else SAVE.night = 5; persist();
  setTimeout(() => { show('btnNext'); $('btnNext').textContent = 'CONTINUAR  [Enter]'; }, 2600);
}
async function afterWin() {
  hide('win');
  if (G.night > 5) return goMenu();
  if (G.night >= 5) return finalChoice();
  const m = MEMORIES[G.night]; if (m) { G.state = 'cine'; await Cine.play('memory', m); }
  startNight(G.night + 1);
}
function finalChoice() {
  G.state = 'choice';
  if (G.furnaceLit) return playEnding('free');
  const canStay = notesFound() >= 3;
  $('choiceTxt').textContent = canStay ? 'Amanece. La llave de Ambrosio brilla sobre el escritorio. Las figuras te miran desde el fondo de la galería. ¿Qué haces?' : 'Amanece. El turno ha terminado. La puerta de la galería oeste se abre sola.';
  $('btnStay').classList.toggle('hidden', !canStay); show('choice');
}
async function playEnding(kind) {
  hide('choice'); G.state = 'cine'; SAVE.endings[kind] = true; if (kind === 'free' || kind === 'leave' || kind === 'curator') SAVE.extra = true; persist();
  await Cine.play('ending_' + kind);
  const e = ENDINGS[kind]; $('endTitle').textContent = e.title; $('endLines').textContent = e.lines.join('\n'); G.state = 'end'; show('ending');
}

/* ================= menú y pausa ================= */
function menuKey(e) {
  if (!isHidden('options')) { if (e.code === 'Escape') $('btnOptBack').click(); return; }
  if (!isHidden('archive')) { if (e.code === 'Escape') $('btnArchBack').click(); return; }
  if (!isHidden('credits')) { hide('credits'); show('menu'); return; }
  const k = e.code; if (k === 'KeyN') $('btnNew').click(); else if (k === 'KeyC' && !isHidden('btnCont')) $('btnCont').click(); else if (k === 'KeyA') $('btnArchive').click(); else if (k === 'KeyO') $('btnOptions').click(); else if (k === 'KeyX' && !$('btnExtra').classList.contains('hidden')) $('btnExtra').click();
}
function goMenu() {
  G.state = 'menu'; G.paused = false; G.modal = false; hideScreens(); hide('hud'); hide('monitor'); hide('lockerOverlay'); unlockPointer(); Sfx.stopAmbient(); endCall(); Cine && Cine.stop();
  G.night = 1; resetNight(); Object.values(actors).forEach(a => { a.char.visible = false; }); decoys.forEach(d => { d.char.group.visible = true; });
  W.L.lamp.intensity = 2.0; Sfx.setTension(0);
  $('btnCont').classList.toggle('hidden', SAVE.night <= 1); $('contN').textContent = SAVE.night; $('btnExtra').classList.toggle('hidden', !SAVE.extra);
  show('menu'); $('btnNew').focus && $('btnNew').focus();
}
function pauseGame() {
  if (G.paused || G.state !== 'play') return; G.paused = true; show('pause'); hide('prompt'); useRelease(); Sfx.shutUp(); unlockPointer(); Sfx.suspend();
}
function resumeGame() { if (!G.paused) return; G.paused = false; Sfx.resume(); hide('pause'); hide('resume'); lockPointer(); needLockCheck(); }
$('btnResume').onclick = resumeGame; $('btnPauseMenu').onclick = () => { G.paused = false; goMenu(); };
$('btnPauseOpt').onclick = () => { hide('pause'); show('options'); G.fromPause = true; };
$('btnNew').onclick = async () => { Sfx.init(); Sfx.uiOk(); SAVE.night = 1; SAVE.notes = [false, false, false, false, false]; persist(); hideScreens(); if (!SAVE.seenIntro) { SAVE.seenIntro = true; persist(); G.state = 'cine'; await Cine.play('intro'); } startNight(1); };
$('btnCont').onclick = () => { Sfx.init(); Sfx.uiOk(); startNight(SAVE.night); };
$('btnExtra').onclick = () => { Sfx.init(); Sfx.uiOk(); startNight(6); };
$('btnArchive').onclick = () => { Sfx.init(); Sfx.ui(); hide('menu'); renderArchive(); show('archive'); };
$('btnOptions').onclick = () => { Sfx.init(); Sfx.ui(); hide('menu'); show('options'); };
$('btnOptBack').onclick = () => { Sfx.uiBack(); hide('options'); if (G.fromPause) { G.fromPause = false; show('pause'); } else show('menu'); };
$('btnCredits').onclick = () => { Sfx.ui(); hide('menu'); show('credits'); setTimeout(() => { if (!isHidden('credits')) { } }, 100); };
$('credits').onclick = () => { hide('credits'); show('menu'); };
$('btnRetry').onclick = () => { Sfx.uiOk(); startNight(G.night); };
$('btnToMenu').onclick = () => { Sfx.uiBack(); goMenu(); };
$('btnNext').onclick = () => { Sfx.uiOk(); afterWin(); };
$('btnLeave').onclick = () => { Sfx.uiOk(); playEnding('leave'); };
$('btnStay').onclick = () => { Sfx.uiOk(); playEnding('curator'); };
$('btnEndMenu').onclick = () => { Sfx.uiBack(); hide('ending'); goMenu(); };
$('resume').onclick = () => { hide('resume'); lockPointer(); };
// opciones
const bindOpt = (id, key, apply, isCheck) => { const e = $(id); if (isCheck) e.checked = O[key]; else e.value = O[key]; e.oninput = e.onchange = () => { O[key] = isCheck ? e.checked : parseFloat(e.value); apply && apply(); persist(); }; };
bindOpt('optVol', 'vol', () => Sfx.setVolume(O.vol)); bindOpt('optSens', 'sens'); bindOpt('optBright', 'bright', applyBright); bindOpt('optSubs', 'subs', null, true); bindOpt('optHints', 'hints', null, true);
Sfx.setVolume(O.vol); applyBright();
// botón de pausa por clic (por si el navegador sale del bloqueo del puntero)
addEventListener('visibilitychange', () => { if (document.hidden && G.state === 'play' && !G.paused && !G.cam && !G.modal) pauseGame(); });

/* ================= bucle principal ================= */
const clock = new THREE.Clock();
const nz = $('noise'), nzc = nz.getContext('2d'), nzImg = nzc.createImageData(160, 90);
const cs = $('camStatic'), csc = cs.getContext('2d'), csImg = csc.createImageData(160, 90);
function drawNoise(c, img) { const d = img.data; for (let i = 0; i < d.length; i += 4) { const v = Math.random() * 255; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; } c.putImageData(img, 0, 0); }
let time = 0, noiseT = 0, ambT = 0, heartRate = 0;
function tick(dt) {
  const live = G.state === 'play' && !G.paused && !G.modal;
  if (live) {
    G.t += dt;
    const h = Math.floor(G.t / HOUR);
    if (!G.powerOut) {
      G.power -= 0.1 * usageNow() * AI.diff().power * (60 / HOUR) * dt;
      if (G.power <= 0) { G.power = 0; triggerPowerOut(); }
    }
    // notas/teléfono
    if (G.phoneRinging) { G.ringT -= dt; if (G.ringT <= 0) { G.phoneRinging = false; G.ghostCall = false; Sfx.phoneRing(false); } }
    G.holding = G.hidden && !!(keys.ShiftLeft || keys.ShiftRight) && G.breath > 0 && !(AI.verdugo.recover > 0);
    if (G.holding && !G.wasHolding) Sfx.breathIn(); G.wasHolding = G.holding;
    // horno
    if (G.cam && G.furnaceHeld && W.CAMS[G.camIdx].id === '5' && G.night >= 5) { G.furnace = Math.min(1, G.furnace + dt / 10); if (Math.random() < dt * 4) Sfx.fire(); if (G.furnace >= 1 && !G.furnaceLit) { G.furnaceLit = true; Sfx.fire(); Sfx.sting('low'); hint('El horno maestro arde… Sobrevive hasta las 6 AM.', 'furn', 6); G.furnaceHeld = false; } }
    if (G.powerOut) updatePowerOut(dt); else { AI.update(dt); }
    Sfx.ambientEvents(G.night);
    // tensión / latidos
    const tmax = Math.max(threat.condesa, threat.payaso, threat.nino, threat.verdugo);
    Sfx.setTension(Math.max(tmax, G.powerOut ? 0.9 : 0, G.t / (HOUR * 6) * 0.35));
    const hr = tmax > 0.45 ? Math.round(64 + tmax * 70) : 0; if (hr !== heartRate && (hr === 0 || Math.abs(hr - heartRate) > 8)) { heartRate = hr; Sfx.heart(hr); }
    updatePlayer(dt); camera.updateMatrixWorld(); updateFocus(); updateHold(dt); updateHud();
    if (G.t >= HOUR * 6) winNight();
  } else if (G.state === 'dead') { updateScare(dt); }
  else if (G.state === 'menu') {
    const a = time * 0.15; camera.position.set(Math.sin(a) * 0.5, 1.5, 2.3); camera.lookAt(Math.sin(a * 1.3) * 1.2 - 2.4, 1.1, -1.2); camera.updateMatrixWorld();
  } else if (G.state === 'card' || G.state === 'win' || G.state === 'over' || G.state === 'choice' || G.state === 'end') { camera.updateMatrixWorld(); }
  else if (G.state === 'cine') { Cine.update(dt); }
  else if ((G.paused || G.modal) && G.state === 'play') { camera.updateMatrixWorld(); }
  if (G.state !== 'dead' && G.state !== 'cine') { Object.values(actors).forEach(a => a.update(dt)); }
  else if (G.state === 'cine') { Object.values(actors).forEach(a => a.update(dt)); }

}

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05); time += dt;
  tick(dt);
  // mundo
  W.update(dt, time, { boxCharge: G.boxCharge, boxOn: G.boxOn && !G.powerOut, winding: G.winding, lockerOpen: G.hidden || G.lockerOpen, furnace: G.furnace });
  if (!G.powerOut && G.state === 'play' && !W.L.lamp.userData.override) { ambT -= dt; if (ambT <= 0) { ambT = rnd(0.06, 2.2); W.L.lamp.intensity = Math.random() < 0.1 ? rnd(0.6, 1.3) : 2.0; W.L.lampBulb.visible = W.L.lamp.intensity > 1; } }
  if (G.light.L && !G.powerOut) W.L.flashL.intensity = Math.random() < 0.04 ? 0.6 : 3.4; if (G.light.R && !G.powerOut) W.L.flashR.intensity = Math.random() < 0.04 ? 0.6 : 3.4;
  // sacudida
  if (G.shake > 0) { camera.position.x += (Math.random() - 0.5) * G.shake * 0.12; camera.position.y += (Math.random() - 0.5) * G.shake * 0.12; G.shake = Math.max(0, G.shake - dt * 1.5); camera.updateMatrixWorld(); }
  Sfx.update();

  // render
  let cam = camera;
  if (G.state === 'dead') {
    const S = G.scare;
    if (S && S.phase === 'cut') { renderer.setRenderTarget(null); renderer.setClearColor(0x000000, 1); renderer.clear(); }
    else { renderer.setRenderTarget(post.rt); renderer.render(scene, S && S.phase === 'hit' ? scareCam : camera); renderer.setRenderTarget(null); renderer.render(post.sc, post.cam); }
    if (Math.random() < 0.35) drawNoise(nzc, nzImg);
    return;
  }
  else if (G.cam && G.state === 'play') {
    const c = W.CAMS[G.camIdx];
    if (!c.audioOnly) {
      viewCam.position.set(...c.pos); const sway = Math.sin(time * 0.35) * 0.9, ang = Math.atan2(c.look[2] - c.pos[2], c.look[0] - c.pos[0]) + Math.PI / 2;
      viewCam.lookAt(c.look[0] + Math.cos(ang) * sway, c.look[1], c.look[2] + Math.sin(ang) * sway); viewCam.updateMatrixWorld(); cam = viewCam;
    }
    W.L.ambient.intensity = G.powerOut ? 0.09 : 3.6; scene.fog.density = 0.012;
    G.staticBurst = Math.max(0, (G.staticBurst || 0) - dt * 2.2); cs.style.opacity = 0.035 + G.staticBurst * 0.75; Sfx.staticLoop(0.06 + G.staticBurst * 0.9);
    noiseT += dt; if (noiseT > 0.04) { noiseT = 0; drawNoise(csc, csImg); }
    $('rec').style.visibility = Math.floor(time * 1.5) % 2 ? 'hidden' : 'visible';
    canvas.style.filter = `grayscale(.75) contrast(1.15) brightness(${1.35 + (O.bright - 1) * 0.5}) sepia(.25) hue-rotate(60deg)`;
  } else {
    if (!G.powerOut && G.state !== 'dead' && !(Cine && Cine.active)) { scene.fog.density = 0.03; if (G.state === 'play' || G.state === 'menu' || G.state === 'card') W.L.ambient.intensity = 0.75; }
    canvas.style.filter = `brightness(${1 + (O.bright - 1) * 0.7})`;
  }
  if (cam === camera || cam === scareCam) Sfx.listener(cam === scareCam ? camera : camera);
  renderer.render(scene, cam);
  if (Math.random() < 0.35) drawNoise(nzc, nzImg);
  if (G.state !== 'dead') nz.style.opacity = G.powerOut ? 0.05 : 0.025;
}

/* ================= cinematicas y arranque ================= */
async function boot() {
  const setP = v => { $('loadFill').style.width = Math.round(v * 100) + '%'; $('loadTxt').textContent = `Cargando figuras de cera… ${Math.round(v * 100)}%`; };
  try { await loadAll(setP); } catch (e) { $('loadTxt').textContent = 'No se pudieron cargar los modelos (' + e.message + '). Abre el juego desde un servidor local: python3 -m http.server'; return; }
  setupCharacters();
  AI = createAI(X);
  Cine = createCine({ THREE, scene, camera, W, actors, decoys, Sfx, G, show, hide, $, screenFlash, resetNight, SAVE, notesFound, ENDINGS, O });
  window.__g = DEBUG ? { sim: (sec, dt = 0.05) => { for (let t = 0; t < sec; t += dt) { time += dt; tick(dt); W.update(dt, time, { boxCharge: G.boxCharge, boxOn: G.boxOn && !G.powerOut, winding: G.winding, lockerOpen: G.hidden || G.lockerOpen, furnace: G.furnace }); } }, G, P, W, actors, decoys, AI, X, Cine, camera, scene, Sfx, SAVE, startNight, jumpscare, triggerPowerOut, selectCam, enterCams, exitCams, toggleLocker, toggleDoor, toggleLight, winNight, playEnding, goMenu, THREE, renderer, pickNote } : undefined;
  hide('loading'); goMenu(); frame();
}
boot();
