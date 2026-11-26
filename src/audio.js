/* Motor de audio procedural con sonido 3D (HRTF) y reverb de sala.
   Sin archivos externos: todo se sintetiza con WebAudio. */
let ctx = null, master, comp, sfxBus, musicBus, revIn, conv, noiseBuf, pinkBuf;
let vol = 0.8;
const S = { amb: null, fan: null, buzz: null, phone: null, static_: null, heart: null, waltz: null, clown: null, nextAmb: 0, ready: false };
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

function init() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 5; comp.attack.value = 0.003; comp.release.value = 0.2;
    master = ctx.createGain(); master.gain.value = vol;
    comp.connect(master); master.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.connect(comp);
    musicBus = ctx.createGain(); musicBus.gain.value = 0.9; musicBus.connect(comp);
    // reverb de sala (respuesta al impulso sintética)
    conv = ctx.createConvolver();
    const len = Math.floor(ctx.sampleRate * 2.6), ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c); let lp = 0;
      for (let i = 0; i < len; i++) { lp += ((Math.random() * 2 - 1) - lp) * 0.35; d[i] = lp * Math.pow(1 - i / len, 3.2); }
    }
    conv.buffer = ir;
    revIn = ctx.createGain(); revIn.gain.value = 1;
    const wet = ctx.createGain(); wet.gain.value = 0.55;
    revIn.connect(conv); conv.connect(wet); wet.connect(comp);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
    const n = noiseBuf.getChannelData(0); for (let i = 0; i < n.length; i++) n[i] = Math.random() * 2 - 1;
    pinkBuf = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
    const p = pinkBuf.getChannelData(0); let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < p.length; i++) { const w = Math.random() * 2 - 1; b0 = 0.99765 * b0 + w * 0.099; b1 = 0.963 * b1 + w * 0.2965; b2 = 0.57 * b2 + w * 1.05; p[i] = (b0 + b1 + b2 + w * 0.18) * 0.22; }
    S.ready = true;
  }
  if (ctx.state === 'suspended') ctx.resume();
  return true;
}

/* ---------- ruteo espacial ---------- */
function setPos(p, pos) {
  if (p.positionX) { p.positionX.value = pos[0]; p.positionY.value = pos[1]; p.positionZ.value = pos[2]; }
  else p.setPosition(pos[0], pos[1], pos[2]);
}
function route(pos, wet = 0.25, bus = sfxBus) {
  const inp = ctx.createGain();
  let panner = null;
  if (pos) {
    panner = ctx.createPanner(); panner.panningModel = 'HRTF'; panner.distanceModel = 'inverse';
    panner.refDistance = 2.5; panner.rolloffFactor = 1.3; panner.maxDistance = 80; setPos(panner, pos);
    inp.connect(panner); panner.connect(bus);
    if (wet) { const w = ctx.createGain(); w.gain.value = wet; panner.connect(w); w.connect(revIn); }
  } else {
    inp.connect(bus);
    if (wet) { const w = ctx.createGain(); w.gain.value = wet; inp.connect(w); w.connect(revIn); }
  }
  return { inp, panner };
}
function listener(cam) {
  if (!ctx) return;
  const L = ctx.listener, p = cam.position;
  const f = new Float32Array(3), u = new Float32Array(3);
  const e = cam.matrixWorld.elements;
  f[0] = -e[8]; f[1] = -e[9]; f[2] = -e[10]; u[0] = e[4]; u[1] = e[5]; u[2] = e[6];
  if (L.positionX) {
    L.positionX.value = p.x; L.positionY.value = p.y; L.positionZ.value = p.z;
    L.forwardX.value = f[0]; L.forwardY.value = f[1]; L.forwardZ.value = f[2];
    L.upX.value = u[0]; L.upY.value = u[1]; L.upZ.value = u[2];
  } else { L.setPosition(p.x, p.y, p.z); L.setOrientation(f[0], f[1], f[2], u[0], u[1], u[2]); }
}

/* ---------- primitivas ---------- */
function noise(o) {
  if (!ctx) return;
  const t = ctx.currentTime + (o.delay || 0), dur = o.dur || 0.3;
  const s = ctx.createBufferSource(); s.buffer = o.pink ? pinkBuf : noiseBuf; s.loop = true;
  if (o.rate) s.playbackRate.value = o.rate;
  const f = ctx.createBiquadFilter(); f.type = o.type || 'lowpass';
  f.frequency.setValueAtTime(o.f || 800, t); if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t + dur);
  f.Q.value = o.q || 1;
  const g = ctx.createGain(); const a = o.a || 0.005;
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(o.g || 0.3, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  const r = route(o.pos, o.wet === undefined ? 0.25 : o.wet, o.bus);
  s.connect(f); f.connect(g); g.connect(r.inp);
  s.start(t, Math.random() * 2); s.stop(t + dur + 0.05);
}
function tone(o) {
  if (!ctx) return;
  const t = ctx.currentTime + (o.delay || 0), dur = o.dur || 0.3;
  const osc = ctx.createOscillator(); osc.type = o.type || 'sine';
  osc.frequency.setValueAtTime(o.f, t); if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, t + dur);
  if (o.detune) osc.detune.value = o.detune;
  if (o.vib) { const l = ctx.createOscillator(); l.frequency.value = o.vib[0]; const lg = ctx.createGain(); lg.gain.value = o.vib[1]; l.connect(lg); lg.connect(osc.frequency); l.start(t); l.stop(t + dur + 0.1); }
  const g = ctx.createGain(); const a = o.a || 0.005;
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(o.g || 0.2, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let node = osc;
  if (o.lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; osc.connect(f); node = f; }
  const r = route(o.pos, o.wet === undefined ? 0.25 : o.wet, o.bus);
  node.connect(g); g.connect(r.inp);
  osc.start(t); osc.stop(t + dur + 0.05);
}
// Campana / caja de música: parciales inarmónicos
function bell(f, dur, g, pos, o = {}) {
  tone({ f, dur, g, pos, a: 0.003, wet: o.wet ?? 0.5, bus: o.bus, delay: o.delay, detune: o.detune });
  tone({ f: f * 2.76, dur: dur * 0.55, g: g * 0.35, pos, a: 0.002, wet: o.wet ?? 0.5, bus: o.bus, delay: o.delay, detune: o.detune });
  tone({ f: f * 5.4, dur: dur * 0.25, g: g * 0.15, pos, a: 0.002, wet: o.wet ?? 0.5, bus: o.bus, delay: o.delay, detune: o.detune });
}
// "Voz" fantasmal con formantes (susurros)
function whisper(pos, dur = 1.4, g = 0.25, delay = 0) {
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const s = ctx.createBufferSource(); s.buffer = pinkBuf; s.loop = true;
  const r = route(pos, 0.6);
  const out = ctx.createGain(); out.gain.setValueAtTime(0.0001, t);
  const syl = Math.floor(dur / 0.22);
  for (let i = 0; i < syl; i++) {
    const tt = t + i * 0.22 + rnd(0, 0.05);
    out.gain.linearRampToValueAtTime(g * rnd(0.5, 1), tt + 0.05); out.gain.linearRampToValueAtTime(g * 0.1, tt + 0.17);
  }
  out.gain.linearRampToValueAtTime(0.0001, t + dur);
  [[700, 8], [1200, 10], [2600, 12]].forEach(([f, q]) => {
    const b = ctx.createBiquadFilter(); b.type = 'bandpass'; b.Q.value = q;
    b.frequency.setValueAtTime(f * rnd(0.85, 1.15), t); b.frequency.linearRampToValueAtTime(f * rnd(0.8, 1.2), t + dur);
    s.connect(b); b.connect(out);
  });
  out.connect(r.inp); s.start(t, Math.random()); s.stop(t + dur + 0.1);
}

/* ---------- Música: vals de la caja (tempo y afinación variables) ---------- */
const WALTZ_M = [[76, 81, 84], [86, 84, 81], [83, 80, 76], [81, 0, 76], [77, 81, 84], [86, 81, 77], [80, 83, 76], [81, 0, 0]];
const WALTZ_C = [[45, 57, 60, 64], [38, 53, 57, 62], [40, 56, 59, 62], [45, 57, 60, 64], [41, 53, 57, 60], [38, 53, 57, 62], [40, 56, 59, 62], [45, 57, 60, 64]];
function waltzUpdate() {
  const w = S.waltz; if (!w || !w.on) return;
  const horizon = ctx.currentTime + 0.25;
  while (w.next < horizon) {
    const beatLen = 0.46 / clamp(w.tempo, 0.3, 1.4);
    const bar = w.step % 8, beat = w.beat;
    const cents = w.detune + Math.sin(w.step * 1.7) * w.wobble;
    const pos = w.pos, bus = musicBus, d = Math.max(0, w.next - ctx.currentTime);
    const m = WALTZ_M[bar][beat], ch = WALTZ_C[bar];
    const vv = w.level;
    if (beat === 0) bell(mtof(ch[0]), 1.6, 0.16 * vv, pos, { delay: d, detune: cents, bus });
    else { bell(mtof(ch[1]), 0.9, 0.07 * vv, pos, { delay: d, detune: cents, bus }); bell(mtof(ch[2 + (beat === 2 ? 0 : 0)]), 0.9, 0.06 * vv, pos, { delay: d, detune: cents, bus }); }
    if (m) bell(mtof(m + (w.ghost && Math.random() < 0.25 ? -1 : 0)), 1.2, 0.13 * vv, pos, { delay: d, detune: cents, bus });
    if (w.dread > 0) tone({ f: mtof(ch[0] - 12) * (beat === 0 ? 1 : 1.0595), dur: beatLen * 1.1, g: 0.05 * w.dread * vv, type: 'sawtooth', lp: 220, pos, delay: d, wet: 0.5, bus });
    w.next += beatLen; w.beat = (beat + 1) % 3; if (w.beat === 0) w.step++;
  }
}
/* ---------- Música: caja sorpresa del Payaso ---------- */
const CLOWN_M = [60, 62, 64, 60, 64, 65, 67, 0, 67, 69, 67, 65, 64, 60, 62, 55];
function clownUpdate() {
  const c = S.clown; if (!c || !c.on) return;
  const horizon = ctx.currentTime + 0.25;
  while (c.next < horizon) {
    const len = 0.3 / clamp(c.tempo, 0.4, 2.6), d = Math.max(0, c.next - ctx.currentTime);
    const m = CLOWN_M[c.step % CLOWN_M.length];
    if (m) {
      const f = mtof(m + 12 + (c.broken ? (Math.random() < 0.3 ? 1 : 0) : 0));
      tone({ f, dur: 0.22, g: 0.1 * c.level, type: 'square', lp: 2200, pos: c.pos, delay: d, wet: 0.35, bus: musicBus, detune: c.detune });
      tone({ f: f * 2, dur: 0.1, g: 0.04 * c.level, type: 'triangle', pos: c.pos, delay: d, wet: 0.35, bus: musicBus });
    }
    c.next += len; c.step++;
  }
}

/* ---------- API pública ---------- */
export const Sfx = {
  init, listener,
  setVolume(v) { vol = v; if (master) master.gain.value = v; },
  get time() { return ctx ? ctx.currentTime : 0; },
  get ready() { return S.ready; },
  suspend() { if (ctx) ctx.suspend(); },
  resume() { if (ctx) ctx.resume(); },

  /* ====== ambiente ====== */
  startAmbient() {
    if (!ctx || S.amb) return;
    const g = ctx.createGain(); g.gain.value = 0.0001; g.gain.exponentialRampToValueAtTime(0.5, ctx.currentTime + 4); g.connect(sfxBus);
    const mk = (type, f, gain, lp) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = lp || 400; const gg = ctx.createGain(); gg.gain.value = gain; o.connect(fl); fl.connect(gg); gg.connect(g); o.start(); return { o, gg, fl }; };
    const sub = mk('sine', 41.2, 0.18), fifth = mk('sine', 61.7, 0.07), dis1 = mk('sawtooth', 110, 0.0, 300), dis2 = mk('sawtooth', 116.5, 0.0, 300);
    const n = ctx.createBufferSource(); n.buffer = pinkBuf; n.loop = true;
    const nf = ctx.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 380; nf.Q.value = 0.5;
    const ng = ctx.createGain(); ng.gain.value = 0.05; n.connect(nf); nf.connect(ng); ng.connect(g); n.start();
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.09; const lg = ctx.createGain(); lg.gain.value = 0.05; lfo.connect(lg); lg.connect(ng.gain); lfo.start();
    S.amb = { g, sub, fifth, dis1, dis2, ng, nodes: [sub.o, fifth.o, dis1.o, dis2.o, n, lfo], tension: 0 };
    S.nextAmb = ctx.currentTime + 6;
  },
  setTension(t) {                               // 0..1 : sube la disonancia y el aire
    if (!S.amb) return; t = clamp(t, 0, 1); S.amb.tension = t;
    const tt = ctx.currentTime;
    S.amb.dis1.gg.gain.setTargetAtTime(0.045 * t, tt, 0.8); S.amb.dis2.gg.gain.setTargetAtTime(0.04 * t, tt, 0.8);
    S.amb.dis1.fl.frequency.setTargetAtTime(220 + 700 * t, tt, 0.8);
    S.amb.ng.gain.setTargetAtTime(0.04 + 0.08 * t, tt, 1);
  },
  stopAmbient() {
    if (S.amb) { const a = S.amb; S.amb = null; a.g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.2); setTimeout(() => a.nodes.forEach(n => { try { n.stop(); } catch (e) { } }), 1200); }
    Sfx.fan(false); Sfx.buzz(false); Sfx.phoneRing(false); Sfx.heart(0); Sfx.waltzStop(); Sfx.clownStop(); Sfx.staticLoop(0);
  },
  // sonidos ambientales aleatorios del museo (crujidos, goteo, lejanos)
  ambientEvents(night) {
    if (!ctx || !S.amb || ctx.currentTime < S.nextAmb) return;
    S.nextAmb = ctx.currentTime + rnd(7, 16) / (1 + night * 0.15);
    const pos = [rnd(-9, 9), 1.5, rnd(-16, -4)], k = Math.random();
    if (Math.random() < 0.3) { const tp = [9.5, 1.2, -15.5]; return Math.random() < 0.5 ? Sfx.clang(tp) : Sfx.bubble(tp); }   // taller de cera (se oye en la cámara 5)
    if (k < 0.3) Sfx.creak(pos);
    else if (k < 0.5) noise({ f: 180, dur: 0.25, g: 0.4, pos, wet: 0.6 }), tone({ f: 80, f2: 45, dur: 0.3, g: 0.35, pos, wet: 0.6 });
    else if (k < 0.65) Sfx.drip(pos);
    else if (k < 0.8) bell(mtof(rnd(0, 1) < 0.5 ? 88 : 91), 2.4, 0.06, [rnd(-10, 10), 2, -18], { wet: 0.9 });
    else if (k < 0.9) Sfx.wind();
    else whisper(pos, rnd(0.8, 1.6), 0.07);
  },
  clang(pos, v = 1) { tone({ f: 1400 + Math.random() * 900, dur: 0.6, g: 0.18 * v, type: 'triangle', pos, wet: 0.7 }); tone({ f: 2300 + Math.random() * 600, dur: 0.35, g: 0.1 * v, pos, wet: 0.7, delay: 0.04 }); noise({ type: 'highpass', f: 3000, dur: 0.12, g: 0.2 * v, pos, wet: 0.5 }); },
  bubble(pos) { for (let i = 0; i < 5; i++) tone({ f: 180 + Math.random() * 160, f2: 420 + Math.random() * 200, dur: 0.1, g: 0.13, pos, wet: 0.6, delay: i * 0.13 + Math.random() * 0.05 }); },
  creak(pos) { noise({ type: 'bandpass', f: rnd(250, 500), f2: rnd(120, 300), q: 14, dur: rnd(0.6, 1.3), g: 0.12, a: 0.2, pos, wet: 0.5, pink: true }); },
  drip(pos) { tone({ f: rnd(900, 1500), f2: 500, dur: 0.12, g: 0.1, pos, wet: 0.8 }); },
  wind() { noise({ type: 'bandpass', f: 300, f2: 700, q: 2, dur: 3.5, g: 0.1, a: 1.4, pink: true, wet: 0.7 }); },
  fan(on) {
    if (!ctx) return;
    if (on && !S.fan) {
      const n = ctx.createBufferSource(); n.buffer = pinkBuf; n.loop = true;
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 520; f.Q.value = 0.8;
      const g = ctx.createGain(); g.gain.value = 0.09;
      const l = ctx.createOscillator(); l.frequency.value = 5.2; const lg = ctx.createGain(); lg.gain.value = 0.035; l.connect(lg); lg.connect(g.gain);
      const r = route([0.3, 1.1, 0.2], 0.1); n.connect(f); f.connect(g); g.connect(r.inp); n.start(); l.start();
      S.fan = { n, l, g };
    } else if (!on && S.fan) { const x = S.fan; S.fan = null; x.g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.05); setTimeout(() => { try { x.n.stop(); x.l.stop(); } catch (e) { } }, 400); }
  },
  fanMuffle(m) { if (S.fan) S.fan.g.gain.setTargetAtTime(m ? 0.02 : 0.09, ctx.currentTime, 0.2); },
  buzz(on) {
    if (!ctx) return;
    if (on && !S.buzz) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 100; const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 700; const g = ctx.createGain(); g.gain.value = 0.04; o.connect(f); f.connect(g); g.connect(sfxBus); o.start(); S.buzz = { o, g }; }
    else if (!on && S.buzz) { const b = S.buzz; S.buzz = null; b.g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.03); setTimeout(() => { try { b.o.stop(); } catch (e) { } }, 250); }
  },
  heart(rate) {                                   // latidos por minuto (0 = off)
    if (!ctx) return;
    if (!rate) { if (S.heart) { clearInterval(S.heart.t); S.heart = null; } return; }
    if (S.heart && S.heart.rate === rate) return;
    if (S.heart) clearInterval(S.heart.t);
    const beat = () => { tone({ f: 58, f2: 38, dur: 0.16, g: 0.5, a: 0.004, wet: 0.1 }); tone({ f: 52, f2: 36, dur: 0.14, g: 0.38, a: 0.004, delay: 0.17, wet: 0.1 }); };
    S.heart = { rate, t: setInterval(beat, 60000 / rate) }; beat();
  },
  staticLoop(level) {                             // estática del monitor (0 = off)
    if (!ctx) return;
    if (!level) { if (S.static_) { const s = S.static_; S.static_ = null; s.g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.05); setTimeout(() => { try { s.n.stop(); } catch (e) { } }, 300); } return; }
    if (!S.static_) { const n = ctx.createBufferSource(); n.buffer = noiseBuf; n.loop = true; const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 2500; const g = ctx.createGain(); g.gain.value = 0.0001; n.connect(f); f.connect(g); g.connect(sfxBus); n.start(); S.static_ = { n, g }; }
    S.static_.g.gain.setTargetAtTime(0.012 + level * 0.14, ctx.currentTime, 0.04);
  },

  /* ====== interfaz y cabina ====== */
  ui() { tone({ f: 880, dur: 0.06, g: 0.07, type: 'square', lp: 2400, wet: 0, bus: sfxBus }); },
  uiOk() { tone({ f: 660, dur: 0.08, g: 0.07, type: 'square', lp: 2400, wet: 0 }); tone({ f: 990, dur: 0.1, g: 0.07, type: 'square', lp: 2400, wet: 0, delay: 0.07 }); },
  uiBack() { tone({ f: 500, f2: 330, dur: 0.1, g: 0.06, type: 'square', lp: 2000, wet: 0 }); },
  click(pos) { noise({ type: 'highpass', f: 2200, dur: 0.04, g: 0.35, pos, wet: 0.1 }); tone({ f: 190, dur: 0.05, g: 0.25, type: 'square', lp: 900, pos, wet: 0.1 }); },
  door(pos, closing = true) {
    noise({ f: closing ? 1500 : 300, f2: closing ? 150 : 1400, dur: 0.5, g: 0.45, pos, wet: 0.3 });
    tone({ f: 95, f2: 40, dur: 0.35, g: 0.5, type: 'square', lp: 300, pos, delay: closing ? 0.25 : 0 });
    if (closing) noise({ f: 250, dur: 0.18, g: 0.7, pos, delay: 0.3 });
  },
  flash(on, pos) { Sfx.click(pos); if (on) tone({ f: 140, f2: 110, dur: 0.12, g: 0.18, type: 'sawtooth', lp: 500, pos, delay: 0.03 }); },
  camOpen() { noise({ type: 'highpass', f: 3000, dur: 0.3, g: 0.2, wet: 0 }); tone({ f: 400, f2: 1400, dur: 0.15, g: 0.07, type: 'square', lp: 3000, wet: 0 }); tone({ f: 1800, dur: 0.05, g: 0.06, type: 'square', wet: 0, delay: 0.25 }); },
  camClose() { noise({ type: 'highpass', f: 3000, dur: 0.2, g: 0.18, wet: 0 }); tone({ f: 1200, f2: 300, dur: 0.14, g: 0.07, type: 'square', lp: 3000, wet: 0 }); },
  camSwitch() { noise({ type: 'highpass', f: 4500, dur: 0.18, g: 0.2, wet: 0 }); tone({ f: 1500, dur: 0.03, g: 0.06, type: 'square', wet: 0 }); },
  buzzer() { tone({ f: 110, dur: 0.25, g: 0.14, type: 'sawtooth', lp: 500, wet: 0 }); },
  pick() { noise({ type: 'highpass', f: 1500, f2: 6000, dur: 0.18, g: 0.2, wet: 0.1 }); },
  locker(open, pos) { noise({ f: 700, f2: open ? 200 : 900, dur: 0.35, g: 0.35, pos }); tone({ f: 120, f2: 70, dur: 0.2, g: 0.3, type: 'square', lp: 400, pos, delay: open ? 0 : 0.3 }); },
  /* teléfono */
  phoneRing(on) {
    if (!ctx) return;
    if (!on) { if (S.phone) { clearInterval(S.phone); S.phone = null; } return; }
    if (S.phone) return;
    const ring = () => { for (let i = 0; i < 6; i++) { tone({ f: 1180, dur: 0.07, g: 0.12, type: 'square', lp: 2600, pos: [0.3, 0.95, 0.3], delay: i * 0.09, wet: 0.2 }); tone({ f: 1480, dur: 0.07, g: 0.1, type: 'square', lp: 2600, pos: [0.3, 0.95, 0.3], delay: i * 0.09 + 0.045, wet: 0.2 }); } };
    ring(); S.phone = setInterval(ring, 1700);
  },
  pickup() { noise({ f: 800, dur: 0.1, g: 0.25, wet: 0 }); tone({ f: 200, dur: 0.08, g: 0.2, type: 'square', lp: 800, wet: 0 }); },
  tape(on) { if (on) noise({ type: 'bandpass', f: 3500, q: 0.6, dur: 0.5, g: 0.04, wet: 0, pink: true }); },

  /* ====== Condesa: vals de la caja de música ====== */
  waltzStart(pos) { if (!ctx) return; S.waltz = { on: true, next: ctx.currentTime + 0.1, step: 0, beat: 0, tempo: 1, detune: 0, wobble: 0, level: 1, dread: 0, ghost: false, pos }; },
  waltzSet(charge) {                              // 1 = recién dada la cuerda ; 0 = muerta
    const w = S.waltz; if (!w) return; const c = clamp(charge, 0, 1);
    w.tempo = 0.38 + 0.62 * Math.pow(c, 0.7); w.detune = -(1 - c) * 160; w.wobble = (1 - c) * 70;
    w.level = 0.5 + 0.5 * Math.min(1, c * 2.4); w.dread = clamp(0.55 - c, 0, 0.55) * 1.8; w.ghost = c < 0.3;
  },
  waltzPause(p) { const w = S.waltz; if (w) { w.on = !p; if (!p) w.next = ctx.currentTime + 0.05; } },
  waltzStop() { S.waltz = null; },
  crank(pos) { for (let i = 0; i < 3; i++) { noise({ type: 'highpass', f: 2000, dur: 0.03, g: 0.3, pos, wet: 0.1, delay: i * 0.045 }); tone({ f: 160 + i * 20, dur: 0.03, g: 0.12, type: 'square', lp: 800, pos, wet: 0.1, delay: i * 0.045 }); } },
  heel(pos, vol = 1) { noise({ type: 'highpass', f: 1800, dur: 0.05, g: 0.5 * vol, pos, wet: 0.6 }); tone({ f: 420, f2: 300, dur: 0.05, g: 0.28 * vol, type: 'triangle', pos, wet: 0.6 }); },
  heelRun(pos, n = 8, gap = 0.17, vol = 1) { for (let i = 0; i < n; i++) { noise({ type: 'highpass', f: 1800, dur: 0.05, g: 0.5 * vol, pos, wet: 0.6, delay: i * gap }); tone({ f: 420, f2: 300, dur: 0.05, g: 0.28 * vol, type: 'triangle', pos, wet: 0.6, delay: i * gap }); } },
  silenceStinger(pos) { tone({ f: 70, f2: 35, dur: 1.5, g: 0.35, pos, wet: 0.4 }); noise({ f: 200, dur: 1.2, g: 0.3, pos, wet: 0.6 }); },

  /* ====== Payaso ====== */
  clownStart(pos) { if (!ctx) return; S.clown = { on: true, next: ctx.currentTime + 0.1, step: 0, tempo: 0.6, level: 0.0, detune: 0, broken: false, pos }; },
  clownSet(danger) {                              // 0 = tranquilo (casi mudo), 1 = a punto de saltar
    const c = S.clown; if (!c) return; const d = clamp(danger, 0, 1);
    c.level = d < 0.15 ? 0 : 0.25 + d * 1.1; c.tempo = 0.6 + d * 2.0; c.detune = d * 120; c.broken = d > 0.7;
  },
  clownStop() { S.clown = null; },
  clownPop(pos) { noise({ f: 2500, f2: 300, dur: 0.35, g: 0.9, pos, wet: 0.5 }); tone({ f: 800, f2: 90, dur: 0.4, g: 0.5, type: 'square', pos, wet: 0.5 }); tone({ f: 300, f2: 1400, dur: 0.15, g: 0.3, type: 'sawtooth', lp: 3000, pos, wet: 0.4, delay: 0.25 }); },
  honk(pos, n = 1) { for (let i = 0; i < n; i++) { tone({ f: 330, dur: 0.22, g: 0.35, type: 'sawtooth', lp: 1100, pos, wet: 0.4, delay: i * 0.3, vib: [18, 12] }); tone({ f: 285, dur: 0.22, g: 0.25, type: 'square', lp: 900, pos, wet: 0.4, delay: i * 0.3 }); } },
  squeak(pos) { tone({ f: rnd(700, 1100), f2: rnd(1300, 1900), dur: 0.09, g: 0.15, pos, wet: 0.3 }); },
  clownRun(pos, n = 14) { for (let i = 0; i < n; i++) { noise({ f: 260, dur: 0.1, g: 0.5, pos, wet: 0.4, delay: i * 0.16 }); if (i % 2 === 0) tone({ f: rnd(900, 1500), f2: 500, dur: 0.07, g: 0.1, pos, wet: 0.3, delay: i * 0.16 }); } },
  bang(pos, n = 3) { for (let i = 0; i < n; i++) { noise({ f: 280, dur: 0.3, g: 0.9, pos, wet: 0.5, delay: i * 0.28 }); tone({ f: 110, f2: 38, dur: 0.35, g: 0.8, type: 'triangle', pos, wet: 0.4, delay: i * 0.28 }); } },
  clownLaugh(pos) { for (let i = 0; i < 6; i++) tone({ f: 380 - i * 14 + rnd(-10, 10), f2: 300 - i * 12, dur: 0.14, g: 0.2, type: 'sawtooth', lp: 1400, pos, wet: 0.5, delay: i * 0.17, vib: [9, 14] }); },

  /* ====== Verdugo ====== */
  stepHeavy(pos, vol = 1) { noise({ f: 150, dur: 0.22, g: 0.8 * vol, pos, wet: 0.5 }); tone({ f: 62, f2: 34, dur: 0.25, g: 0.7 * vol, type: 'triangle', pos, wet: 0.4 }); noise({ type: 'highpass', f: 3500, dur: 0.05, g: 0.12 * vol, pos, delay: 0.02 }); },
  drag(pos, vol = 1) { noise({ type: 'bandpass', f: 1800, f2: 700, q: 3, dur: 0.9, g: 0.22 * vol, a: 0.2, pos, wet: 0.5, pink: true }); tone({ f: 2400, f2: 1100, dur: 0.5, g: 0.04 * vol, type: 'sawtooth', lp: 3000, pos, wet: 0.5, a: 0.2 }); },
  chop(pos) { noise({ f: 900, f2: 120, dur: 0.35, g: 1.0, pos, wet: 0.5 }); tone({ f: 95, f2: 40, dur: 0.4, g: 0.9, type: 'triangle', pos, wet: 0.4 }); noise({ type: 'highpass', f: 4000, dur: 0.14, g: 0.4, pos, delay: 0.03 }); tone({ f: 2100, f2: 1500, dur: 0.35, g: 0.1, pos, wet: 0.7, delay: 0.04 }); },
  doorBreak(pos) { Sfx.chop(pos); noise({ f: 1200, f2: 80, dur: 1.2, g: 1.0, pos, wet: 0.6, delay: 0.1 }); tone({ f: 70, f2: 28, dur: 1.2, g: 0.9, type: 'sawtooth', lp: 200, pos, delay: 0.1 }); for (let i = 0; i < 6; i++) noise({ type: 'highpass', f: 3000, dur: 0.06, g: 0.3, pos, delay: 0.3 + i * 0.09 }); },
  sniff(pos) { noise({ type: 'bandpass', f: 1500, f2: 3000, q: 2, dur: 0.35, g: 0.25, pos, wet: 0.5, a: 0.1 }); },
  growl(pos) { tone({ f: 70, f2: 55, dur: 1.2, g: 0.4, type: 'sawtooth', lp: 250, pos, wet: 0.5, vib: [30, 8] }); noise({ f: 300, dur: 1.1, g: 0.25, pos, a: 0.3 }); },
  breathIn() { noise({ type: 'bandpass', f: 1200, f2: 2200, q: 1.2, dur: 0.5, g: 0.2, wet: 0.1, a: 0.2, pink: true }); },
  gasp() { noise({ type: 'bandpass', f: 1400, f2: 900, q: 1, dur: 0.4, g: 0.55, wet: 0.2, a: 0.03, pink: true }); },

  /* ====== Niño ====== */
  ball(pos, n = 4) { let t = 0, a = 0.5; for (let i = 0; i < n; i++) { tone({ f: 190, f2: 90, dur: 0.12, g: 0.45 * a, type: 'sine', pos, wet: 0.5, delay: t }); noise({ f: 700, dur: 0.05, g: 0.22 * a, pos, wet: 0.5, delay: t }); t += 0.5 * Math.pow(0.78, i); a *= 0.85; } },
  childLaugh(pos) { for (let i = 0; i < 5; i++) tone({ f: 640 + (i % 2) * 90 + rnd(-20, 20), f2: 520, dur: 0.13, g: 0.16, lp: 2400, pos, wet: 0.7, delay: i * 0.15, vib: [12, 16] }); },
  tinyStep(pos) { noise({ f: 900, dur: 0.05, g: 0.25, pos, wet: 0.5 }); tone({ f: 260, f2: 200, dur: 0.05, g: 0.1, pos, wet: 0.5 }); },
  found(pos) { [784, 988, 1175, 1568].forEach((f, i) => bell(f, 0.8, 0.12, pos, { delay: i * 0.09, wet: 0.5 })); },
  sadChild(pos) { tone({ f: 520, f2: 360, dur: 0.7, g: 0.12, lp: 1800, pos, wet: 0.8, vib: [6, 10] }); },

  /* ====== sustos falsos y sting ====== */
  sting(kind = 'low', pos) {
    if (!ctx) return;
    switch (kind) {
      case 'low': tone({ f: 90, f2: 30, dur: 1.4, g: 0.6, type: 'sawtooth', lp: 300, pos, wet: 0.4 }); noise({ f: 400, dur: 0.8, g: 0.5, pos }); break;
      case 'metal': noise({ type: 'bandpass', f: 4200, f2: 900, q: 1.5, dur: 0.9, g: 0.55, pos, wet: 0.5 }); tone({ f: 1830, f2: 700, dur: 0.8, g: 0.18, type: 'sawtooth', lp: 3500, pos }); tone({ f: 1170, f2: 500, dur: 0.9, g: 0.18, type: 'square', lp: 3000, pos }); break;
      case 'choir': [1, 1.06, 1.5, 1.78, 2.12].forEach((r, i) => tone({ f: 233 * r, dur: 1.8, g: 0.12, type: 'sawtooth', lp: 1400, pos, wet: 0.6, a: 0.04, vib: [5 + i, 4] })); noise({ f: 2000, dur: 0.3, g: 0.4, pos }); break;
      case 'reverse': tone({ f: 120, f2: 700, dur: 1.2, g: 0.5, type: 'sawtooth', lp: 2000, pos, a: 1.1 }); noise({ type: 'bandpass', f: 400, f2: 5000, dur: 1.2, g: 0.45, a: 1.1, pos }); break;
      case 'knock': Sfx.bang(pos || [0, 1, 0], 3); break;
      case 'bell': bell(110, 4, 0.5, pos, { wet: 0.8 }); bell(116, 4, 0.4, pos, { wet: 0.8 }); break;
      case 'static': noise({ type: 'highpass', f: 1500, dur: 0.6, g: 0.7, pos, wet: 0.1 }); tone({ f: 1000, f2: 70, dur: 0.5, g: 0.2, type: 'square', pos }); break;
      case 'glass': for (let i = 0; i < 9; i++) tone({ f: rnd(2500, 6000), dur: 0.35, g: 0.12, pos, wet: 0.6, delay: i * rnd(0.01, 0.06) }); noise({ type: 'highpass', f: 5000, dur: 0.5, g: 0.35, pos }); break;
      case 'thud': noise({ f: 120, dur: 0.6, g: 1, pos, wet: 0.7 }); tone({ f: 50, f2: 28, dur: 0.7, g: 0.9, type: 'triangle', pos, wet: 0.6 }); break;
      case 'scream': tone({ f: 900, f2: 1700, dur: 0.9, g: 0.25, type: 'sawtooth', lp: 3500, pos, vib: [14, 60], wet: 0.5 }); tone({ f: 1350, f2: 2300, dur: 0.9, g: 0.15, type: 'sawtooth', lp: 4000, pos, vib: [17, 70], wet: 0.5 }); break;
    }
  },
  whisper(pos, dur, g) { whisper(pos, dur, g); },
  jumpscare(who) {                                // chillido + golpe grave específicos
    if (!ctx) return;
    const L = [0, 0.0];
    noise({ type: 'bandpass', f: 3200, f2: 600, q: 0.7, dur: 1.6, g: 1.0, a: 0.01, wet: 0.2 });
    noise({ f: 800, dur: 1.5, g: 0.8, a: 0.01, wet: 0.2 });
    tone({ f: 60, f2: 26, dur: 1.6, g: 0.9, type: 'sawtooth', lp: 200, wet: 0.1 });
    if (who === 'condesa') { tone({ f: 700, f2: 2000, dur: 1.4, g: 0.35, type: 'sawtooth', lp: 4500, vib: [11, 90], wet: 0.2 }); tone({ f: 1050, f2: 2600, dur: 1.4, g: 0.25, type: 'sawtooth', lp: 4500, vib: [13, 90], wet: 0.2 }); }
    else if (who === 'verdugo') { Sfx.chop([0, 1.4, -1]); tone({ f: 85, f2: 40, dur: 1.2, g: 0.8, type: 'square', lp: 400, wet: 0.2 }); noise({ type: 'highpass', f: 5000, dur: 0.6, g: 0.4 }); }
    else if (who === 'nino') { tone({ f: 1500, f2: 900, dur: 1.2, g: 0.35, type: 'square', lp: 4000, vib: [20, 100], wet: 0.2 }); Sfx.childLaugh(null); }
    else { Sfx.honk(null, 2); tone({ f: 500, f2: 1900, dur: 1.3, g: 0.3, type: 'sawtooth', lp: 4500, vib: [8, 120], wet: 0.2 }); Sfx.clownPop(null); }
  },
  powerDown() { tone({ f: 220, f2: 28, dur: 1.6, g: 0.5, type: 'sawtooth', lp: 400, wet: 0.3 }); noise({ f: 500, f2: 50, dur: 1.5, g: 0.5, wet: 0.3 }); },
  chime6() { [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => bell(f, 2.4, 0.2, null, { delay: i * 0.34, wet: 0.7 })); setTimeout(() => { for (let i = 0; i < 14; i++) noise({ type: 'bandpass', f: rnd(1500, 3500), q: 4, dur: 0.15, g: 0.08, delay: rnd(0, 1.8), wet: 0.4 }); }, 1500); },
  /* ====== temas de los finales ====== */
  theme(kind) {
    if (!ctx) return;
    const seq = {
      sad:  { bpm: 56, root: 57, notes: [0, 3, 7, 12, 10, 7, 3, 0, -2, 3, 7, 10, 8, 5, 3, 0], pad: [45, 52, 57], g: 0.2 },
      hope: { bpm: 66, root: 60, notes: [0, 4, 7, 12, 11, 7, 4, 0, 2, 5, 9, 14, 12, 9, 5, 4, 7, 11, 14, 19], pad: [48, 55, 60, 64], g: 0.2 },
      dark: { bpm: 50, root: 52, notes: [0, 1, 7, 6, 0, 3, 7, 8, 5, 4, 0, -1], pad: [40, 47, 52], g: 0.2 },
    }[kind]; if (!seq) return;
    const beat = 60 / seq.bpm;
    seq.notes.forEach((n, i) => bell(mtof(seq.root + n + 12), 2.6, seq.g, null, { delay: i * beat * 0.9, wet: 0.7, bus: musicBus }));
    seq.pad.forEach(m => tone({ f: mtof(m), dur: seq.notes.length * beat * 0.9 + 2, g: 0.06, a: 3, type: 'sine', wet: 0.6, bus: musicBus, vib: [0.3, 2] }));
    if (kind !== 'hope') seq.pad.forEach(m => tone({ f: mtof(m) * 1.0045, dur: seq.notes.length * beat * 0.9 + 2, g: 0.04, a: 3, type: 'sawtooth', lp: 300, wet: 0.6, bus: musicBus }));
  },
  melt(pos) { noise({ type: 'highpass', f: 5000, f2: 1500, dur: 1.4, g: 0.3, pos, wet: 0.4 }); tone({ f: 300, f2: 60, dur: 1.1, g: 0.2, type: 'sawtooth', lp: 600, pos, wet: 0.4 }); },
  fire() { noise({ type: 'bandpass', f: 600, q: 0.6, dur: 3, g: 0.25, a: 1, pink: true, wet: 0.3 }); for (let i = 0; i < 18; i++) noise({ type: 'highpass', f: 3500, dur: 0.04, g: 0.2, delay: rnd(0, 3), wet: 0.2 }); },
  sparkle() { for (let i = 0; i < 14; i++) bell(mtof(84 + [0, 2, 4, 7, 9][i % 5] + (i > 9 ? 12 : 0)), 1.6, 0.06, null, { delay: i * 0.12, wet: 0.8 }); },

  /* ====== voz sintetizada (navegador) ====== */
  say(text, o = {}) {
    try {
      if (!('speechSynthesis' in window)) return false;
      const u = new SpeechSynthesisUtterance(text);
      u.lang = o.lang || 'es-ES'; u.rate = o.rate || 0.9; u.pitch = o.pitch || 0.8; u.volume = (o.vol ?? 0.9) * vol;
      if (o.onend) { u.onend = o.onend; u.onerror = o.onend; }
      window.speechSynthesis.speak(u); return true;
    } catch (e) { return false; }
  },
  shutUp() { try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (e) { } },

  /* se llama cada frame: planifica notas */
  update() { if (!ctx) return; waltzUpdate(); clownUpdate(); },
};
