/* Mecánicas únicas de cada figura + director de sustos falsos.
   Cada una tiene una ruta predefinida, una pista sonora y una contramedida distinta. */
import * as THREE from 'three';

const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* Dificultad por noche (1..5 y 6 = extra) */
const DIFF = [null,
  { decay: 78, lock: 72, runT: 7.5, ninoGap: [999, 999], count: 0, vWalk: 0, vGap: 0, scare: [48, 80], power: 1.0, grace: 40 },
  { decay: 64, lock: 60, runT: 7.0, ninoGap: [70, 100], count: 20, vWalk: 0, vGap: 0, scare: [40, 70], power: 1.05, grace: 30 },
  { decay: 54, lock: 50, runT: 6.5, ninoGap: [58, 84], count: 17, vWalk: 56, vGap: 70, scare: [34, 60], power: 1.12, grace: 28 },
  { decay: 46, lock: 42, runT: 6.0, ninoGap: [46, 66], count: 14, vWalk: 40, vGap: 46, scare: [28, 48], power: 1.2, grace: 20 },
  { decay: 40, lock: 35, runT: 5.5, ninoGap: [38, 54], count: 11, vWalk: 30, vGap: 34, scare: [22, 38], power: 1.3, grace: 14 },
  { decay: 34, lock: 30, runT: 5.0, ninoGap: [30, 44], count: 9, vWalk: 22, vGap: 24, scare: [14, 30], power: 1.4, grace: 10 },
];

export function createAI(X) {
  const { G, W, Sfx, actors, decoys, P } = X;
  const A = { DIFF };
  const diff = () => DIFF[Math.min(G.night, 6)];
  A.diff = diff;
  const hf = () => 1 + Math.floor(G.t / X.HOUR) * 0.07;
  const doorPos = s => [s === 'L' ? -3.4 : 3.4, 1.2, 0];

  /* ================= LA CONDESA — caja de música ================= */
  const C = { stage: 0, zeroT: 0, stepT: 0, said: 0, lastC: 1 };
  const CP = [[0, 0.52, -16.7, 0], [0, 0, -13.4, 0], [-4.6, 0, -5.2, 0], [-4.05, 0, 0.0, Math.PI / 2]];
  A.condesa = C;
  function condesaTo(s, instant) {
    const a = actors.condesa, p = CP[s];
    if (instant) { a.teleport(p[0], p[1], p[2], p[3]); } else a.goTo([p[0], p[1], p[2]], s === 3 ? 2.6 : 1.9, p[3]);
    a.idle = s === 0 ? 'Idle' : 'Stare';
  }
  function resetCondesa() { C.stage = 0; C.zeroT = 0; C.stepT = 0; C.said = 0; G.boxCharge = 1; condesaTo(0, true); Sfx.waltzStart(W.musicBox.pos); Sfx.waltzSet(1); }
  function updateCondesa(dt) {
    const d = diff();
    if (!G.powerOut) {
      if (G.winding) G.boxCharge = Math.min(1, G.boxCharge + dt * 0.5);
      else if (G.t > d.grace) G.boxCharge = Math.max(0, G.boxCharge - dt * hf() / d.decay);
    }
    const c = G.boxCharge; G.boxOn = c > 0.001;
    Sfx.waltzSet(G.warble > 0 ? 0.22 : c); Sfx.waltzPause(c <= 0.001);
    const st = c >= 0.55 ? 0 : c >= 0.32 ? 1 : c >= 0.12 ? 2 : 3;
    if (st !== C.stage) {
      const up = st > C.stage; C.stage = st; condesaTo(st);
      if (up && st >= 2) { Sfx.sting('metal', [CP[st][0], 1.4, CP[st][2]]); if (G.t > 20) X.hint('♪ El vals se arrastra… la Condesa se acerca. Da cuerda a la caja.', 'wind', 4); }
    }
    if (st >= 1) { C.stepT -= dt; if (C.stepT <= 0) { C.stepT = st === 3 ? 0.9 : st === 2 ? 1.4 : 2.4; Sfx.heel([actors.condesa.char.group.position.x, 0.1, actors.condesa.char.group.position.z], st === 1 ? 0.5 : 1); } }
    if (c <= 0.001 && !G.powerOut) {
      C.zeroT += dt;
      if (C.zeroT - dt <= 0) { Sfx.silenceStinger(doorPos('L')); Sfx.heelRun([-4.4, 0.1, -3], 16, 0.16, 1.2); X.hint('Silencio… ¡DALE CUERDA A LA CAJA!', 'wind0', 3); }
      if (C.zeroT > 2.4 && C.said < 1) { C.said = 1; Sfx.whisper([-1.5, 1.4, 0.8], 1.6, 0.4); }
      if (C.zeroT > 3.6 && C.said < 2) { C.said = 2; Sfx.heelRun([-3.6, 0.1, 0.4], 8, 0.14, 1.4); }
      if (C.zeroT > 5.4) X.jumpscare('condesa');
    } else C.zeroT = Math.max(0, C.zeroT - dt * 2);
    // tensión sonora global según la caja
    X.threat.condesa = clamp((0.5 - c) * 2, 0, 1);
  }

  /* ================= EL PAYASO — cerrojo desde la cámara 1C ================= */
  const K = { state: 'vitrine', lock: 1, side: 'L', path: [], i: 0, total: 0, t: 0, thumpT: 0, stepT: 0, cool: 0, honked: false };
  A.payaso = K;
  const VP = [-10, 0, -14.75];
  const PATH = {
    L: [[-8.2, 0, -14.4], [-6.0, 0, -12.6], [-4.6, 0, -10.0], [-4.6, 0, -3.0], [-4.1, 0, 0.0]],
    R: [[-8.2, 0, -14.4], [-3.0, 0, -12.6], [0, 0, -12.2], [3.6, 0, -11.2], [4.6, 0, -9.5], [4.6, 0, -3.0], [4.1, 0, 0.0]],
  };
  const plen = pts => { let s = 0, p = VP; pts.forEach(q => { s += Math.hypot(q[0] - p[0], q[2] - p[2]); p = q; }); return s; };
  function resetPayaso() { Object.assign(K, { state: 'vitrine', lock: 1, i: 0, t: 0, thumpT: 0, cool: 0, honked: false }); const a = actors.payaso; a.teleport(VP[0], 0, VP[2], Math.PI / 2); a.idle = 'Idle'; a.char.visible = true; W.setVitrine(0); Sfx.clownStart([-9.5, 1.2, -14.7]); Sfx.clownSet(0); }
  A.reinforce = () => {
    if (K.state !== 'vitrine' || K.cool > 0) { Sfx.buzzer(); return; }
    K.lock = Math.min(1, K.lock + 0.5); K.cool = 0.6; Sfx.click(); Sfx.camSwitch(); Sfx.bang([-8.5, 1, -14.7], 1);
  };
  function payasoRun() {
    K.state = 'run'; K.side = (G.night <= 2) ? 'L' : (Math.random() < 0.5 ? 'L' : 'R');
    K.path = PATH[K.side]; K.i = 0; K.total = plen(K.path); K.honked = false; K.stepT = 0;
    X.stats.clownRuns++; Sfx.clownPop([-9.5, 1.2, -14.7]); Sfx.clownSet(0); W.setVitrine(1);
    const a = actors.payaso; a.idle = 'Idle'; a.goTo(K.path[0], K.total / diff().runT, null, 'Run'); a.char.visible = true;
    X.hint('¡Se soltó el Payaso! Escucha la bocina: cierra esa puerta.', 'clownrun', 5);
  }
  function updatePayaso(dt) {
    const a = actors.payaso, d = diff();
    K.cool = Math.max(0, K.cool - dt);
    if (K.state === 'vitrine') {
      if (G.t > d.grace + 15) K.lock = Math.max(0, K.lock - dt * hf() / d.lock);
      const danger = 1 - K.lock;
      Sfx.clownSet(danger < 0.35 ? 0 : (danger - 0.2) / 0.8);
      W.setVitrine(clamp((0.55 - K.lock) * 2.2, 0, 1));
      a.idle = K.lock < 0.45 ? 'Peek' : 'Idle';
      if (K.lock < 0.32) { K.thumpT -= dt; if (K.thumpT <= 0) { K.thumpT = rnd(1.4, 2.4) * (0.4 + K.lock * 2); Sfx.bang([-8.2, 1, -14.7], 1 + (Math.random() < 0.4 ? 1 : 0)); } }
      if (K.lock < 0.28) X.hint('El cerrojo del Payaso cede. Cámara 1C: reforzar cerrojo.', 'lock', 3);
      if (K.lock <= 0) payasoRun();
      X.threat.payaso = clamp(danger - 0.3, 0, 1);
    } else if (K.state === 'run') {
      const p = a.char.group.position;
      K.stepT -= dt; if (K.stepT <= 0) { K.stepT = 0.17; Sfx.clownRun([p.x, 0.1, p.z], 1); if (Math.random() < 0.3) Sfx.squeak([p.x, 1, p.z]); }
      if (!K.honked && Math.abs(p.x) > 3.5 && p.z > -11) { K.honked = true; Sfx.honk([K.side === 'L' ? -4.6 : 4.6, 1.2, -9], 2); }
      if (!a.target) {
        K.i++;
        if (K.i >= K.path.length) { K.state = 'door'; K.t = 0; a.idle = 'Stare'; a.rotT = K.side === 'L' ? Math.PI / 2 : -Math.PI / 2; Sfx.bang(doorPos(K.side), 2); }
        else a.goTo(K.path[K.i], K.total / d.runT, null, 'Run');
      }
      X.threat.payaso = 1;
    } else if (K.state === 'door') {
      K.t += dt; X.threat.payaso = 1;
      if (K.t < 1.7 && Math.floor(K.t * 3) !== Math.floor((K.t - dt) * 3)) Sfx.bang(doorPos(K.side), 1);
      if (K.t >= 1.7) {
        const closed = W.doorClosed[K.side] && !W.doorBroken[K.side], lit = G.light[K.side];
        if (closed) { Sfx.bang(doorPos(K.side), 3); Sfx.honk(doorPos(K.side), 1); payasoBack(0.6); }
        else if (lit) { X.event('melt'); a.char.play('Melt', { once: true }); Sfx.melt(doorPos(K.side)); G.power = Math.max(0, G.power - 3); K.state = 'dazzled'; K.t = 0; X.hint('La luz derrite al Payaso… pero gastó energía.', 'dazzle', 3); }
        else X.jumpscare('payaso');
      }
    } else if (K.state === 'dazzled') {
      K.t += dt; if (K.t > 3.2) { actors.payaso.char.play('Idle', { fade: 0.1 }); payasoBack(0.5); }
    } else if (K.state === 'retreat') {
      if (!a.target) {
        if (K.bi >= K.back.length) { K.state = 'vitrine'; a.teleport(VP[0], 0, VP[2], Math.PI / 2); a.idle = 'Idle'; W.setVitrine(0); Sfx.clownLaugh([-9.5, 1.2, -14.7]); }
        else a.goTo(K.back[K.bi++], 3.0, null, 'Run');
      }
      X.threat.payaso = 0.3;
    }
  }
  function payasoBack(lock) { K.state = 'retreat'; K.lock = lock; K.back = K.path.slice(0, -1).reverse().concat([VP]); K.bi = 0; actors.payaso.idle = 'Idle'; }

  /* ================= EL NIÑO — escondidas: encuéntralo en las cámaras ================= */
  const N = { phase: 'idle', timer: 0, count: 0, n: 0, spot: -1, step: 0, seen: 0, vanish: 0, tiny: 0 };
  A.nino = N;
  const NHOME = [-3.0, 0.52, -16.7];
  const ninoHide = () => { const a = actors.nino; a.teleport(NHOME[0], NHOME[1], NHOME[2], 0); a.idle = 'Idle'; a.char.visible = G.night >= 2; };
  function resetNino() { Object.assign(N, { phase: 'idle', timer: G.night >= 2 ? rnd(...diff().ninoGap) * 0.6 : 9999, n: 0, spot: -1, seen: 0 }); ninoHide(); }
  A.ninoSpot = () => N.phase === 'count' ? N.spot : -1;
  A.found = camIdx => {
    if (N.phase !== 'count') { Sfx.buzzer(); return false; }
    if (camIdx === N.spot) {
      X.event('found'); Sfx.found([0, 1.2, -6]); X.sub('Niño: «¡Me encontraste! ¡Otra vez!»', 3); N.phase = 'cool'; N.timer = rnd(...diff().ninoGap); ninoHide();
      Sfx.shutUp(); return true;
    }
    Sfx.buzzer(); N.step = Math.max(0, N.step - 0.0); N.n = Math.min(diff().count, N.n + 2); X.sub('Ahí no está… (el Niño sigue contando)', 2); return false;
  };
  function ninoStart() {
    const d = diff(); const opts = W.CAMS.map((c, i) => i).filter(i => !W.CAMS[i].noHide && !(G.cam && G.camIdx === i));
    N.spot = opts[Math.floor(Math.random() * opts.length)];
    const h = W.CAMS[N.spot].hide, a = actors.nino;
    a.teleport(h[0], h[1], h[2], h[3] + Math.PI * 0 ); a.idle = 'Peek'; a.char.visible = true; a.char.play('Peek');
    N.phase = 'count'; N.n = 0; N.step = 0; G.lastEvent = G.t;
    Sfx.ball([0, 1, -9], 4); Sfx.childLaugh([rnd(-4, 4), 1.4, -12]);
    Sfx.say('¡Vamos a jugar a las escondidas!', { pitch: 1.9, rate: 1.0, vol: 0.8 });
    X.sub('Niño: «¡Vamos a jugar a las escondidas!»', 3); X.hint('El Niño se esconde. Abre las cámaras, búscalo y pulsa «¡Te encontré!».', 'hide', 5);
  }
  function ninoChase() {
    N.phase = 'chase'; N.seen = 0; N.vanish = 0; const a = actors.nino, side = Math.random() < 0.5 ? -1 : 1;
    a.teleport(side * 2.6, 0, -0.4, side < 0 ? Math.PI / 2 : -Math.PI / 2); a.idle = 'Stare'; a.char.visible = true; a.char.play('Stare');
    Sfx.sting('choir', [side * 2.6, 1.2, -0.4]); Sfx.childLaugh([side * 2.6, 1.1, -0.4]);
    X.sub('Niño: «Te toca… ¡Ya voy!»', 3); X.hint('¡El Niño está en la garita! MÍRALE y no dejes de mirarlo.', 'chase', 6);
  }
  function updateNino(dt) {
    const d = diff(), a = actors.nino, g = a.char.group.position;
    if (G.night < 2) { X.threat.nino = 0; return; }
    if (N.phase === 'idle' || N.phase === 'cool') {
      if (G.t > d.grace) N.timer -= dt;
      if (N.timer <= 0 && !G.powerOut && X.canStartEvent()) ninoStart();
      X.threat.nino = 0;
    } else if (N.phase === 'count') {
      N.step += dt;
      const gap = 0.9;
      if (N.step >= gap) {
        N.step -= gap; N.n++;
        if (N.n <= d.count) { Sfx.shutUp(); Sfx.say(String(N.n), { pitch: 1.9, rate: 1.15, vol: 0.55 }); X.sub(`Niño: «…${N.n}…»`, 1.2); if (N.n % 4 === 0) Sfx.childLaugh([rnd(-5, 5), 1.3, -rnd(8, 14)]); }
        else if (N.n === d.count + 1) { Sfx.shutUp(); Sfx.say('¡Voy a buscarte!', { pitch: 1.9, rate: 1.0, vol: 0.8 }); }
        else { ninoChase(); }
      }
      X.threat.nino = clamp(N.n / d.count, 0, 1) * 0.8;
    } else if (N.phase === 'chase') {
      const eye = X.eyePos(), toN = new THREE.Vector3(g.x - eye.x, 0, g.z - eye.z), dist = toN.length();
      const f = X.forward(); f.y = 0; f.normalize();
      const seen = !G.cam && !G.hidden && dist < 9 && f.dot(toN.clone().normalize()) > 0.80;
      X.threat.nino = clamp(1 - dist / 5, 0.3, 1);
      if (G.hidden) {                                                 // te escondes: se queda esperando y se aburre
        N.vanish += dt; a.char.play('Idle'); if (dist > 1.4) { const v = toN.clone().normalize().multiplyScalar(-1); g.x += v.x * dt * 1.0; g.z += v.z * dt * 1.0; a.char.faceToward(P.pos.x, P.pos.z); }
        if (N.vanish > 9) ninoGone(true);
      } else if (seen) {
        a.char.play('Stare'); N.seen += dt; a.char.faceToward(eye.x, eye.z);
        if (N.seen > 6) { Sfx.childLaugh([g.x, 1, g.z]); X.sub('Niño: «¡Ja ja! ¡Qué aburrido eres!»', 3); ninoGone(false); }
      } else {
        const speed = (G.cam ? 1.9 : 1.05) + G.night * 0.08;
        a.char.play('Walk', { speed: speed / 1.0 }); a.char.faceToward(eye.x, eye.z, false);
        const v = toN.clone().normalize().multiplyScalar(-speed * dt); g.x += v.x; g.z += v.z;
        N.tiny -= dt; if (N.tiny <= 0) { N.tiny = 0.45 / (speed * 0.9); Sfx.tinyStep([g.x, 0.1, g.z]); }
        if (dist < 0.9) X.jumpscare('nino');
      }
    }
  }
  function ninoGone(bored) { N.phase = 'cool'; N.timer = rnd(...diff().ninoGap) * (bored ? 1 : 1.3); Sfx.sadChild([g0().x, 1, g0().z]); ninoHide(); X.threat.nino = 0; }
  const g0 = () => actors.nino.char.group.position;

  /* ================= EL VERDUGO — taquilla + aguantar la respiración ================= */
  const V = { state: 'off', t: 0, i: 0, path: [], total: 0, side: 'R', chops: 0, chopT: 0, danger: 0, stepT: 0, dragT: 0, visits: 0, inT: 0, wp: 0, pause: 0, caught: 0, near: false };
  A.verdugo = V;
  const VPATH = {
    R: [[9.6, 0, -14.2], [6.0, 0, -12.0], [4.6, 0, -8.8], [4.6, 0, -4.4], [4.15, 0, -0.1]],
    L: [[9.6, 0, -14.2], [4.5, 0, -12.8], [0, 0, -12.2], [-4.6, 0, -9.4], [-4.6, 0, -4.4], [-4.15, 0, -0.1]],
  };
  const VIN = { R: [[3.3, 0, 0.0], [2.0, 0, 0.3], [0.9, 0, 1.3], [0.1, 0, 1.4, 3.2], [-1.0, 0, 0.9], [-1.8, 0, 0.1, 1.8], [-0.6, 0, 1.2], [2.0, 0, 0.3], [3.5, 0, 0.0]] };
  VIN.L = VIN.R.map(p => [-p[0], p[1], p[2], p[3]]);
  const vlen = (pts, from) => { let s = 0, p = from; pts.forEach(q => { s += Math.hypot(q[0] - p[0], q[2] - p[2]); p = q; }); return s; };
  function resetVerdugo() {
    Object.assign(V, { state: G.night >= 3 ? 'wait' : 'off', t: 0, i: 0, visits: 0, danger: 0, caught: 0 });
    V.t = G.night >= 3 ? diff().vWalk * 0.5 + 10 : 0;
    G.breath = 1; G.holding = false; actors.verdugo.char.visible = false; actors.verdugo.teleport(9.6, 0, -14.2, 0);
  }
  function verdugoStart() {
    V.side = V.visits % 2 === 0 ? 'R' : 'L'; V.visits++;
    V.path = VPATH[V.side]; V.i = 0; V.total = vlen(V.path, [9.6, 0, -14.2]); V.state = 'walk'; G.lastEvent = G.t;
    const a = actors.verdugo; a.teleport(9.6, 0, -14.2, 0); a.char.visible = true; a.idle = 'Idle';
    const sp = V.total / diff().vWalk; a.goTo(V.path[0], sp, null, 'Walk');
    Sfx.sting('metal', [9.6, 1.2, -14.2]); Sfx.growl([9.6, 1.2, -14.2]);
    X.hint('Arrastre de metal… El Verdugo viene. Prepárate para esconderte en la taquilla.', 'verd', 6);
  }
  function endVerdugo() { if (V.state === 'leave') X.event('verdugoPassed'); V.state = 'wait'; V.t = diff().vGap * rnd(0.8, 1.2); actors.verdugo.char.visible = false; G.holding = false; X.threat.verdugo = 0; }
  function updateVerdugoMain(dt) {
    const a = actors.verdugo, d = diff(), g = a.char.group.position;
    // respiración (se usa solo cuando estás en la taquilla)
    if (G.hidden && G.holding && G.breath > 0) { G.breath = Math.max(0, G.breath - dt / 6.5); if (G.breath <= 0) { G.holding = false; Sfx.gasp(); V.danger += 0.45; V.recover = 2.2; } }
    else if (!G.holding) G.breath = Math.min(1, G.breath + dt * (V.recover > 0 ? 0.0 : 0.35));
    V.recover = Math.max(0, (V.recover || 0) - dt);
    if (V.state === 'off') return;
    if (V.state === 'wait') { V.t -= dt; if (V.t <= 0 && !G.powerOut && X.canStartEvent()) verdugoStart(); X.threat.verdugo = 0; return; }
    const sp = V.total / d.vWalk;
    if (V.state === 'walk') {
      V.stepT -= dt; V.dragT -= dt;
      if (V.stepT <= 0) { V.stepT = 1.15; Sfx.stepHeavy([g.x, 0.1, g.z], 1); }
      if (V.dragT <= 0) { V.dragT = 2.3; Sfx.drag([g.x, 0.3, g.z], 1); }
      if (!a.target) {
        V.i++;
        if (V.i >= V.path.length) {
          if (W.doorBroken[V.side]) { V.state = 'enter'; startEnter(); }
          else { V.state = 'chop'; V.chops = 0; V.chopT = 1.0; a.idle = 'Stare'; a.rotT = V.side === 'L' ? Math.PI / 2 : -Math.PI / 2; X.hint('Está hachando la puerta. ¡Cerrarla no sirve! ¡A la taquilla!', 'chop', 5); }
        } else a.goTo(V.path[V.i], sp, null, 'Walk');
      }
      const dist = Math.hypot(g.x, g.z - 0.5); X.threat.verdugo = clamp(1 - dist / 14, 0, 1);
    } else if (V.state === 'chop') {
      V.chopT -= dt; X.threat.verdugo = 0.9;
      if (V.chopT <= 0) {
        V.chops++; Sfx.chop(doorPos(V.side)); X.shake(0.25); V.chopT = Math.max(1.0, 2.0 - G.night * 0.18);
        a.char.play('Twitch', { once: true, fade: 0.1 });
        if (V.chops >= 3) { Sfx.doorBreak(doorPos(V.side)); W.breakDoor(V.side); X.shake(0.7); V.state = 'enter'; startEnter(); }
      }
    } else if (V.state === 'enter') {
      updateEnter(dt);
    } else if (V.state === 'leave') {
      if (!a.target) { V.i++; if (V.i >= V.inPath.length) endVerdugo(); else a.goTo(V.inPath[V.i], 1.6, null, 'Walk'); }
      X.threat.verdugo = 0.5;
    }
  }
  function startEnter() {
    const a = actors.verdugo; V.inPath = VIN[V.side]; V.wp = 0; V.pause = 0; V.danger = 0; V.caught = 0; V.inT = 0;
    a.teleport(V.inPath[0][0] + (V.side === 'R' ? 0.8 : -0.8), 0, 0, V.side === 'R' ? -Math.PI / 2 : Math.PI / 2); a.char.visible = true; a.idle = 'Stare'; a.rotT = null;
    a.goTo(V.inPath[0], 1.3, null, 'Walk'); Sfx.growl([V.side === 'R' ? 3.4 : -3.4, 1.2, 0]);
  }
  function updateEnter(dt) {
    const a = actors.verdugo, g = a.char.group.position; V.inT += dt;
    // pasos
    V.stepT -= dt; if (V.stepT <= 0 && a.target) { V.stepT = 0.85; Sfx.stepHeavy([g.x, 0.1, g.z], 1.2); if (Math.random() < 0.5) Sfx.sniff([g.x, 1.5, g.z]); }
    // patrulla
    if (!a.target) {
      if (V.pause > 0) { V.pause -= dt; if (V.pause <= 0) { V.wp++; nextWp(); } }
      else { const w = V.inPath[V.wp]; if (w && w[3]) { V.pause = w[3]; a.char.play('Twitch', { once: true }); Sfx.sniff([g.x, 1.5, g.z]); Sfx.growl([g.x, 1.2, g.z]); } else { V.wp++; nextWp(); } }
    }
    const eye = X.eyePos(), dist = Math.hypot(g.x - P.pos.x, g.z - P.pos.z);
    X.threat.verdugo = clamp(1.1 - dist / 5, 0.4, 1);
    if (!G.hidden) {                                                  // te ha visto
      V.caught += dt * (dist < 3 ? 1.6 : 1.0);
      if (V.caught > 1.5) X.jumpscare('verdugo');
    } else {
      const lk = new THREE.Vector3(2.3, 0, -1.3), near = Math.hypot(g.x - lk.x, g.z - lk.z) < 3.6; V.near = near;
      if (near) {
        if (G.holding) V.danger = Math.max(0, V.danger - dt * 0.7); else V.danger += dt * 0.5;
        if (!G.holding && Math.floor(V.inT * 2) !== Math.floor((V.inT - dt) * 2)) Sfx.breathIn();
        if (V.danger >= 1) { a.goTo([2.3, 0, -0.5], 3, null, 'Run'); V.state = 'found'; }
      } else V.danger = Math.max(0, V.danger - dt * 0.6);
    }
    X.setDanger(V.danger);
  }
  function nextWp() {
    const a = actors.verdugo;
    if (V.wp >= V.inPath.length) { V.state = 'leave'; V.i = 0; V.inPath = [[V.side === 'R' ? 3.4 : -3.4, 0, 0], [V.side === 'R' ? 5.0 : -5.0, 0, 0]]; a.goTo(V.inPath[0], 1.6, null, 'Walk'); X.setDanger(0); X.hint('Se marcha… pero la puerta ya no volverá a cerrarse.', 'left', 4); return; }
    a.goTo(V.inPath[V.wp], 1.15, null, 'Walk');
  }
  function updateFoundVerdugo(dt) { if (!actors.verdugo.target || Math.hypot(actors.verdugo.char.group.position.x - 2.3, actors.verdugo.char.group.position.z + 0.5) < 0.8) X.jumpscare('verdugo'); }
  function updateVerdugo(dt) { if (V.state === 'found') updateFoundVerdugo(dt); else updateVerdugoMain(dt); }

  /* ================= director de sustos falsos (no letales) ================= */
  const Dr = { next: 0, busy: 0, restore: [] };
  A.director = Dr;
  const pickDecoyIdx = () => { const free = decoys.map((d, i) => i).filter(i => !decoys[i].walker); return free[Math.floor(Math.random() * free.length)]; };
  const decoyAt = (i, x, z, ry) => { const d = decoys[i]; d.home = d.home || d.char.group.position.clone(); d.homeRy = d.homeRy ?? d.char.group.rotation.y; d.char.group.position.set(x, 0, z); d.char.group.rotation.y = ry; return d; };
  const decoyHome = d => { if (d.home) { d.char.group.position.copy(d.home); d.char.group.rotation.y = d.homeRy; } d.char.glow(false); d.char.setEyes(0); };
  const behind = () => { const f = X.forward(); return [P.pos.x - f.x * 1.6, 1.4, P.pos.z - f.z * 1.6]; };
  const EVENTS = [
    { id: 'knock', n: 1, run() { const s = Math.random() < 0.5 ? 'L' : 'R'; Sfx.bang(doorPos(s), 3); X.sub('(golpes en la puerta)', 2.5); Dr.busy = 2; } },
    { id: 'whisper', n: 1, run() { Sfx.whisper(behind(), 1.8, 0.45); X.sub('(un susurro a tu espalda)', 2.5); Dr.busy = 2; } },
    { id: 'bell', n: 1, run() { Sfx.sting('bell', [rnd(-6, 6), 3, -12]); X.sub('(una campana, lejos)', 2.5); Dr.busy = 3; } },
    { id: 'fan', n: 1, run() { Sfx.fan(false); W.fan.on = false; X.sub('(el ventilador se detiene)', 2.5); Dr.busy = 5; setTimeout(() => { Sfx.sting('thud', [0, 1.2, -1.8]); setTimeout(() => { if (G.state === 'play' && !G.powerOut) { Sfx.fan(true); W.fan.on = true; } }, 1500); }, 3200); } },
    { id: 'eyes', n: 1, run() { const side = Math.random() < 0.5 ? -1 : 1, d = decoyAt(pickDecoyIdx(), side * 4.2, 0, side < 0 ? Math.PI / 2 : -Math.PI / 2); d.char.glow(true); d.char.setEyes(1); W.L.lamp.intensity = 0.3; Sfx.sting('low', [side * 4.2, 1.5, 0]); Dr.busy = 2; Dr.restore.push([1.0, () => { decoyHome(d); }]); } },
    { id: 'laugh', n: 2, run() { Sfx.childLaugh([rnd(-8, 8), 1.2, -rnd(6, 14)]); X.sub('(risas infantiles)', 2.5); Dr.busy = 2; } },
    { id: 'ceiling', n: 2, run() { for (let i = 0; i < 4; i++) setTimeout(() => Sfx.sting('thud', [(i - 1.5) * 1.2, 4.5, -0.3 * i]), i * 650); X.sub('(pasos sobre el techo)', 3); Dr.busy = 4; } },
    { id: 'shadow', n: 2, run() { const side = Math.random() < 0.5 ? -1 : 1, d = decoyAt(pickDecoyIdx(), side * 4.0, 0.2, side < 0 ? Math.PI / 2 : -Math.PI / 2); W.L.lamp.intensity = 0; Sfx.sting('static', [side * 3.8, 1.2, 0]); Dr.busy = 1.5; Dr.restore.push([0.3, () => { decoyHome(d); W.L.lamp.intensity = 2.0; }]); } },
    { id: 'phone', n: 2, run() { if (G.phoneRinging || G.cam) return false; G.ghostCall = true; G.phoneRinging = true; Sfx.phoneRing(true); Dr.busy = 14; Dr.restore.push([13, () => { if (G.ghostCall) { G.ghostCall = false; G.phoneRinging = false; Sfx.phoneRing(false); } }]); } },
    { id: 'face', n: 2, run() { if (!G.cam) return false; X.faceFlash(); Sfx.sting('static'); Sfx.whisper([0, 1.4, 0.2], 0.9, 0.5); Dr.busy = 2; } },
    { id: 'glass', n: 3, run() { Sfx.sting('glass', [rnd(-5, 5), 1.4, -rnd(8, 14)]); X.sub('(cristales rotos)', 2.5); Dr.busy = 2; } },
    { id: 'statue', n: 3, run() { const i = pickDecoyIdx(), d = decoys[i]; d.home = d.home || d.char.group.position.clone(); d.homeRy = d.homeRy ?? d.char.group.rotation.y; W.L.lamp.intensity = 0.2; Sfx.creak(d.char.group.position.toArray()); Sfx.sting('low'); d.char.group.position.x += rnd(-1.2, 1.2) * 0.6; d.char.group.position.z += rnd(0.8, 1.6); d.char.group.rotation.y = Math.atan2(P.pos.x - d.char.group.position.x, P.pos.z - d.char.group.position.z); d.home = d.char.group.position.clone(); d.homeRy = d.char.group.rotation.y; Dr.busy = 2; Dr.restore.push([0.5, () => { W.L.lamp.intensity = 2.0; }]); } },
    { id: 'lampdie', n: 4, run() { const side = Math.random() < 0.5 ? -1 : 1; W.L.lamp.intensity = 0; Sfx.fan(false); W.fan.on = false; Sfx.powerDown(); Dr.busy = 6; const d = decoys[pickDecoyIdx()]; Dr.restore.push([3.2, () => { decoyAt(decoys.indexOf(d), side * 3.7, 0.1, side < 0 ? Math.PI / 2 : -Math.PI / 2); d.char.glow(true); d.char.setEyes(1); W.L.lamp.intensity = 2.0; Sfx.fan(true); W.fan.on = true; Sfx.sting('choir', [side * 3.7, 1.4, 0]); }], [4.4, () => { decoyHome(d); }]); } },
  ];
  function scareDirector(dt) {
    // restauraciones programadas
    for (let i = Dr.restore.length - 1; i >= 0; i--) { const r = Dr.restore[i]; r[0] -= dt; if (r[0] <= 0) { Dr.restore.splice(i, 1); r[1](); } }
    Dr.busy = Math.max(0, Dr.busy - dt); Dr.next -= dt;
    if (Dr.next > 0 || Dr.busy > 0 || G.powerOut || !X.canStartEvent() || G.t < diff().grace) return;
    const pool = EVENTS.filter(e => e.n <= G.night && !(e.id === 'face' && !G.cam));
    const ev = pool[Math.floor(Math.random() * pool.length)];
    if (ev.run() === false) { Dr.next = 3; return; }
    G.lastEvent = G.t; Dr.next = rnd(...diff().scare) / (1 + (G.t / X.HOUR) * 0.04);
  }



  /* ================= estatuas que caminan: solo se mueven cuando no las miras ================= */
  const ST = { list: [] };
  A.statues = ST;
  const sideKeyOf = x => (x < 0 ? 'L' : 'R');
  function restoreStatue(s) { const g = s.d.char.group; g.position.copy(s.home); g.rotation.y = s.homeRy; g.scale.set(1, 1, 1); g.visible = true; s.d.char.glow(false); s.d.char.setEyes(0); }
  function resetStatues() {
    ST.list.forEach(s => { restoreStatue(s); s.d.walker = false; }); ST.list = [];
    const n = { 3: 1, 4: 2, 5: 3, 6: 4 }[Math.min(G.night, 6)] || 0; if (!n) return;
    const pool = decoys.map((d, i) => i).sort(() => Math.random() - 0.5).slice(0, n);
    pool.forEach(i => {
      const d = decoys[i], g = d.char.group; d.home = d.home || g.position.clone(); d.homeRy = d.homeRy ?? g.rotation.y; d.walker = true;
      const side = Math.abs(d.home.x) < 1 ? (Math.random() < 0.5 ? -1 : 1) : Math.sign(d.home.x);
      ST.list.push({ d, home: d.home.clone(), homeRy: d.homeRy, side, key: side < 0 ? 'L' : 'R', state: 'walk', wp: 0, hop: rnd(8, 16), lit: 0, meltT: 0, respawn: 0, noticed: false,
        path: [[side * 4.6, -9.6], [side * 4.6, -4.8], [side * 4.12, -0.1]] });
    });
  }
  A.statuesAtDoor = () => ST.list.filter(s => s.state === 'door').length;
  function hopStatue(s) {
    const g = s.d.char.group, tgt = s.path[s.wp], dx = tgt[0] - g.position.x, dz = tgt[1] - g.position.z, dist = Math.hypot(dx, dz), step = Math.min(dist, rnd(1.6, 2.8));
    if (dist < 0.25) { s.wp++; if (s.wp >= s.path.length) { arrive(s); return; } return hopStatue(s); }
    g.position.x += dx / dist * step; g.position.z += dz / dist * step; g.position.y = 0; g.rotation.y = Math.atan2(dx, dz);
    if (Math.random() < 0.6) Sfx.scrape([g.position.x, 0.4, g.position.z], 0.9);
    s.d.char.glow(true); s.d.char.setEyes(Math.hypot(g.position.x, g.position.z) < 6 ? 0.9 : 0.3);
    s.hop = rnd(3.5, 7) / (1 + 0.12 * (G.night - 3));
  }
  function arrive(s) {
    const g = s.d.char.group, slot = ST.list.filter(o => o !== s && o.state === 'door' && o.side === s.side).length; g.position.set(s.side * 4.12, 0, -0.1 + (slot % 2 ? 0.55 : -0.55) * Math.ceil(slot / 2)); g.rotation.y = s.side < 0 ? Math.PI / 2 : -Math.PI / 2; s.state = 'door'; s.lit = 0; s.noticed = false;
    s.d.char.glow(true); s.d.char.setEyes(1.1);
  }
  function meltStatue(s) {
    s.state = 'melt'; s.meltT = 0; const g = s.d.char.group; Sfx.melt([g.position.x, 1, g.position.z]); X.event('melt'); X.event('statueMelt'); G.light[s.key] = G.light[s.key];
  }
  function updateStatues(dt) {
    if (!ST.list.length || G.powerOut || G.t < diff().grace + 25) return;
    for (const s of ST.list) {
      const g = s.d.char.group, pos = new THREE.Vector3(g.position.x, 1.3, g.position.z);
      if (s.state === 'melt') { s.meltT += dt; const k = clamp(s.meltT / 1.8, 0, 1); g.scale.y = 1 - 0.88 * k; g.scale.x = g.scale.z = 1 + 0.25 * k; if (k >= 1) { s.state = 'away'; s.respawn = rnd(35, 50); g.visible = false; g.scale.set(1, 1, 1); } continue; }
      if (s.state === 'away') { s.respawn -= dt; if (s.respawn <= 0) { restoreStatue(s); s.state = 'walk'; s.wp = 0; s.hop = rnd(6, 12); } continue; }
      if (s.state === 'door') {
        if (!s.noticed && X.observed(pos)) { s.noticed = true; Sfx.sting('metal', [pos.x, 1.4, pos.z]); X.sub('(una estatua te mira desde la puerta)', 3.5); X.hint('Una estatua en tu puerta gasta energía. Ilumínala con la linterna de ese lado para derretirla.', 'statuedoor', 6); }
        if (G.light[s.key]) { s.lit += dt; if (s.lit > 1.6) meltStatue(s); } else s.lit = Math.max(0, s.lit - dt * 0.5);
        continue;
      }
      if (X.observed(pos)) { s.hop = Math.max(s.hop, 1.0); continue; }       // te ha visto: se queda quieta
      s.hop -= dt; if (s.hop <= 0) hopStatue(s);
    }
  }

  /* ================= sonidos fantasma: de repente, sin avisar; algunos significan algo y otros no ================= */
  const PH = { next: 0, last: '' };
  const earPos = () => { const yaw = P.yaw, side = Math.random() < 0.5 ? -1 : 1; return [P.pos.x + Math.cos(yaw) * side * 0.4, 1.55, P.pos.z - Math.sin(yaw) * side * 0.4]; };
  const nearPos = (r, y = 1.4) => { const a = Math.random() * 6.283; return [P.pos.x + Math.cos(a) * r, y, P.pos.z + Math.sin(a) * r]; };
  const calm = () => A.verdugo.state === 'off' || A.verdugo.state === 'wait';
  const PHANTOMS = [
    // ---- puros sustos (no significan nada)
    { id: 'ear_whisper', n: 1, w: 3, run() { Sfx.whisper(earPos(), 1.5, 0.6); X.sub('(un susurro pegado a tu oreja)', 2.5); } },
    { id: 'breath', n: 1, w: 2, run() { Sfx.breathe(earPos()); X.sub('(alguien respira a tu lado)', 3); } },
    { id: 'slam', n: 1, w: 3, run() { Sfx.slamFar(nearPos(11, 1.2)); X.sub('(un portazo, lejos)', 2.5); } },
    { id: 'tick', n: 1, w: 1.5, run() { Sfx.clockTick(nearPos(3), 4); X.sub('(un reloj que no existe)', 3); } },
    { id: 'music_ghost', n: 1, w: 2, run() { Sfx.musicGhost(nearPos(5)); X.sub('(una caja de música… que no es la tuya)', 3.5); } },
    { id: 'run_by', n: 2, w: 2, run() { const f = Math.random() < 0.5; Sfx.runBy(f ? [-7, 0, -1.6] : [7, 0, -1.6], f ? [7, 0, -1.6] : [-7, 0, -1.6]); X.sub('(pasos veloces al otro lado de la pared)', 3); } },
    { id: 'hum', n: 2, w: 2, run() { Sfx.hum(nearPos(8)); X.sub('(alguien tararea una nana)', 4); } },
    { id: 'cry', n: 2, w: 1.5, run() { Sfx.cry(nearPos(7)); X.sub('(un niño llora)', 3.5); } },
    { id: 'scrape', n: 2, w: 2, run() { Sfx.scrape([P.pos.x + (Math.random() - 0.5) * 3, 3.6, P.pos.z - 1 - Math.random() * 2], 3); X.sub('(algo arrastra metal por el techo)', 3); } },
    { id: 'laugh_close', n: 2, w: 2, run() { const e = earPos(); Sfx.childLaugh(e); Sfx.sting('low', e); X.sub('(una risa infantil, demasiado cerca)', 3); } },
    { id: 'drawer', n: 2, w: 1, run() { Sfx.drawer([-0.45, 1.1, -1.5]); X.sub('(el archivador se abre solo)', 3); } },
    { id: 'bulb', n: 2, w: 1, run() { Sfx.bulbPop([0, 3, 0.6]); W.L.lamp.intensity = 0.1; Dr.restore.push([0.5, () => { W.L.lamp.intensity = 2.0; }]); } },
    { id: 'voice', n: 2, w: 1, run() { const t = ['Detrás de ti.', 'No mires.', 'Sal de aquí.', 'Ya vienen.', 'Duerme.'][Math.floor(Math.random() * 5)]; Sfx.say(t, { pitch: 0.25, rate: 0.55, vol: 0.45 }); X.sub(`(una voz grave, sin cuerpo: «${t}»)`, 3.5); } },
    { id: 'scream_far', n: 3, w: 2, run() { Sfx.distantScream(nearPos(14, 1.6)); X.sub('(un grito, a lo lejos)', 3); } },
    { id: 'lullaby', n: 3, w: 1, run() { Sfx.creepyLullaby(nearPos(6)); X.sub('(una nana desafinada)', 4.5); } },
    { id: 'reverse', n: 3, w: 1.5, run() { Sfx.reverseLaugh(nearPos(2.5)); X.sub('(una risa que suena al revés)', 3); } },
    { id: 'knock_locker', n: 3, w: 1, ok: () => !G.hidden, run() { Sfx.bang([2.3, 1.1, -1.3], 2); X.sub('(golpes dentro de la taquilla)', 3); } },
    { id: 'false_chime', n: 3, w: 0.7, ok: () => G.t < X.HOUR * 4.5, run() { Sfx.falseChime(); X.sub('(campanadas… ¿ya son las seis?)', 5); } },
    // ---- señuelos: imitan una pista real y no significan nada (te hacen perder tiempo y energía)
    { id: 'fake_heels', n: 1, w: 2, ok: () => G.boxCharge > 0.5, run() { Sfx.heelRun([-4.4, 0.1, -9], 6, 0.38, 1); X.sub('(tacones que se acercan… y se paran)', 3.5); } },
    { id: 'fake_warble', n: 1, w: 1.5, ok: () => G.boxCharge > 0.6 && !G.powerOut, run() { G.warble = 2.4; X.sub('(el vals se arrastra un instante)', 3); } },
    { id: 'fake_honk', n: 2, w: 2, ok: () => A.payaso.state === 'vitrine' && A.payaso.lock > 0.5, run() { Sfx.honk([Math.random() < 0.5 ? -4.6 : 4.6, 1.2, -8], 1); X.sub('(una bocina, en una galería)', 3); } },
    { id: 'fake_count', n: 2, w: 1.5, ok: () => ['idle', 'cool'].includes(A.nino.phase), run() { Sfx.say('uno… dos… tres…', { pitch: 1.9, rate: 0.85, vol: 0.4 }); X.sub('Niño: «…uno… dos… tres…»', 3); } },
    { id: 'fake_drag', n: 3, w: 2, ok: calm, run() { const x = Math.random() < 0.5 ? -4.6 : 4.6; Sfx.drag([x, 0.3, -7], 1); Sfx.stepHeavy([x, 0.1, -6.5], 1); X.sub('(arrastre de metal… ¿o no?)', 3); } },
    { id: 'fake_chop', n: 3, w: 1.5, ok: calm, run() { Sfx.chop([Math.random() < 0.5 ? -3.6 : 3.6, 1.2, 0]); X.sub('(un hachazo, en alguna puerta)', 3); } },
  ];
  function phantomDirector(dt) {
    G.warble = Math.max(0, (G.warble || 0) - dt);
    PH.next -= dt; if (PH.next > 0 || G.powerOut || G.t < diff().grace) return;
    const crit = ['chop', 'enter', 'leave', 'found'].includes(A.verdugo.state) || A.nino.phase === 'chase' || ['run', 'door', 'dazzled'].includes(A.payaso.state);
    if (crit) { PH.next = 4; return; }
    const pool = PHANTOMS.filter(e => e.n <= G.night && e.id !== PH.last && (!e.ok || e.ok()));
    const tot = pool.reduce((a, e) => a + e.w, 0); let r = Math.random() * tot, ev = pool[0];
    for (const e of pool) { r -= e.w; if (r <= 0) { ev = e; break; } }
    PH.last = ev.id;
    const lead = Math.random() < 0.4 ? 1.3 : 0;                      // a veces el ambiente se apaga un instante antes: silencio y… ¡eso!
    if (lead) { Sfx.hush(lead + 1.2); Dr.restore.push([lead, () => ev.run()]); } else ev.run();
    const g = { 1: [32, 55], 2: [26, 46], 3: [20, 38], 4: [15, 30], 5: [11, 22], 6: [8, 16] }[Math.min(G.night, 6)];
    PH.next = Math.random() < 0.25 ? rnd(2.5, 5) : rnd(g[0], g[1]);   // a veces, otro seguido
  }
  A.phantoms = PHANTOMS; A.phantomRun = id => PHANTOMS.find(e => e.id === id).run();

  /* ================= API ================= */
  A.reset = () => { resetStatues(); PH.next = diff().grace + 18; G.warble = 0; resetCondesa(); resetPayaso(); resetNino(); resetVerdugo(); Dr.next = diff().grace + 12; Dr.busy = 0; Dr.restore.length = 0; decoys.forEach(decoyHome); W.repairDoors(); X.threat.condesa = X.threat.payaso = X.threat.nino = X.threat.verdugo = 0; };
  A.update = dt => {
    if (G.powerOut) return;
    updateCondesa(dt); updatePayaso(dt); updateNino(dt); updateVerdugo(dt); updateStatues(dt); scareDirector(dt); phantomDirector(dt);
  };
  A.furnaceLit = () => G.furnace >= 1;
  return A;
}
