/* Cinemáticas en motor: recorridos de cámara, luz, partículas y texto.
   Cada guion es una lista de planos; se pueden saltar con Esc / Espacio / Enter. */
export function createCine(E) {
  const { THREE, scene, camera, W, actors, decoys, Sfx, G, show, hide, $ } = E;
  const C = { active: false };
  let run = null, temps = [], snap = null, spirits = null;
  const lerp = (a, b, t) => a + (b - a) * t;
  const lerp3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  const ease = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  const L = () => W.L;

  /* ---------- ayudas ---------- */
  function snapshot() { const l = L(); snap = { amb: l.ambient.intensity, ambC: l.ambient.color.getHex(), lamp: l.lamp.intensity, rooms: Object.fromEntries(Object.entries(l.roomLights).map(([k, v]) => [k, [v.intensity, v.color.getHex()]])), hemi: l.hemi.intensity, fog: scene.fog.density }; }
  function restore() {
    if (!snap) return; const l = L(); l.ambient.intensity = snap.amb; l.ambient.color.setHex(snap.ambC); l.lamp.intensity = snap.lamp; l.hemi.intensity = snap.hemi; scene.fog.density = snap.fog;
    Object.entries(l.roomLights).forEach(([k, v]) => { v.intensity = snap.rooms[k][0]; v.color.setHex(snap.rooms[k][1]); }); snap = null;
    l.flashL.intensity = l.flashR.intensity = 0; W.dust.material.color.setHex(0xd8c8a0); W.dust.material.size = 0.025;
  }
  function placeAll(list) {          // [id, x, z, ry, idleClip, y]
    Object.values(actors).forEach(a => { a.char.visible = false; a.target = null; });
    list.forEach(([id, x, z, ry, clip, y]) => { const a = actors[id]; a.teleport(x, y || 0, z, ry); a.idle = clip || 'Idle'; a.rotT = null; a.char.visible = true; a.char.setEyes(1); a.char.play(clip || 'Idle', { fade: 0 }); });
  }
  function mkTemp(o) { scene.add(o); temps.push(o); return o; }
  function makeSpirits(cx, cz, n = 90, color = 0xffd890) {
    const g = new THREE.BufferGeometry(), p = new Float32Array(n * 3), v = new Float32Array(n);
    for (let i = 0; i < n; i++) { p[i * 3] = cx + (Math.random() - 0.5) * 4; p[i * 3 + 1] = Math.random() * 1.8; p[i * 3 + 2] = cz + (Math.random() - 0.5) * 2.2; v[i] = 0.2 + Math.random() * 0.8; }
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    const m = new THREE.PointsMaterial({ color, size: 0.07, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    spirits = mkTemp(new THREE.Points(g, m)); spirits.userData.v = v; return spirits;
  }
  function updateSpirits(dt, op) {
    if (!spirits) return; const a = spirits.geometry.attributes.position, v = spirits.userData.v;
    for (let i = 0; i < v.length; i++) { a.array[i * 3 + 1] += v[i] * dt * 0.9; if (a.array[i * 3 + 1] > 3.1) a.array[i * 3 + 1] = 0; a.array[i * 3] += Math.sin(a.array[i * 3 + 1] * 2 + i) * dt * 0.1; }
    a.needsUpdate = true; spirits.material.opacity += (op - spirits.material.opacity) * Math.min(1, dt * 2);
  }
  function setCap(text, big) {
    const e = $('cineCap'); e.classList.remove('on'); e.classList.toggle('big', !!big);
    if (!text) return; setTimeout(() => { e.textContent = text; e.classList.add('on'); }, 60);
  }
  function setTitle(t, s) { const e = $('cineTitle'); if (!t) { e.classList.remove('on'); return; } e.innerHTML = `${t}<small>${s || ''}</small>`; e.classList.add('on'); }
  const fade = (to, dur = 0.8, col = '#000') => { const f = $('cineFade'); f.style.background = col; f.style.transition = `opacity ${dur}s`; f.style.opacity = to; };
  function mannequin() {
    const g = new THREE.Group(), m = new THREE.MeshLambertMaterial({ color: 0xd9caa2, emissive: 0x2a2010 });
    const add = (geo, x, y, z, rx = 0, rz = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.x = rx; o.rotation.z = rz; g.add(o); return o; };
    add(new THREE.CylinderGeometry(0.2, 0.26, 0.6, 12), 0, 0.95, 0); add(new THREE.SphereGeometry(0.15, 14, 12), 0, 1.4, 0);
    add(new THREE.CylinderGeometry(0.07, 0.07, 0.5, 8), -0.28, 0.9, 0.2, 1.2, 0.2); add(new THREE.CylinderGeometry(0.07, 0.07, 0.5, 8), 0.28, 0.9, 0.2, 1.2, -0.2);
    add(new THREE.CylinderGeometry(0.09, 0.08, 0.55, 8), -0.12, 0.55, 0.2, 1.3, 0); add(new THREE.CylinderGeometry(0.09, 0.08, 0.55, 8), 0.12, 0.55, 0.2, 1.3, 0);
    const em = new THREE.MeshBasicMaterial({ color: 0xffe27a }); [-0.06, 0.06].forEach(x => { const e = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 8), em); e.position.set(x, 1.42, 0.13); g.add(e); });
    return g;
  }

  /* ---------- guiones ---------- */
  const SCRIPTS = {
    intro() {
      return {
        theme: null,
        setup() {
          placeAll([['condesa', 0, -16.7, 0, 'Idle', 0.52]]); const l = L(); l.ambient.intensity = 0.45; l.lamp.intensity = 1.2;
          Sfx.startAmbient(); Sfx.setTension(0.1); Sfx.waltzStart([0, 1.4, -16]); Sfx.waltzSet(0.8);
        },
        shots: [
          { d: 7.5, from: [-4.6, 1.55, -9.2], to: [-4.6, 1.5, -1.0], look: [[-4.6, 1.4, 0.8], [-4.6, 1.3, 2.0]], cap: 'Museo de Cera «Villa Sombría». Abierto de 9 a 18 h.', capAt: 0.8, title: ['VILLA SOMBRÍA', '1998'], fadeIn: 2 },
          { d: 6.5, from: [0.6, 1.6, -9.6], to: [0.1, 1.55, -11.8], look: [[0, 1.4, -17], [0, 1.45, -17]], cap: 'Te contrataron porque nadie más quería el turno de noche.', capAt: 0.4, on: t => { if (t > 0.45 && actors.condesa.char.cur.eyes[0] && !run.flick) { run.flick = true; Sfx.sting('low', [0, 1.5, -16]); } actors.condesa.char.setEyes(t > 0.45 ? 1 : 0); } },
          { d: 5.5, from: [0, 1.7, 2.3], to: [0.5, 1.55, 1.2], look: [[0.9, 0.95, 0.55], [0.95, 0.95, 0.55]], cap: 'Y entonces… suena el teléfono.', capAt: 0.6, enter() { Sfx.phoneRing(true); }, fadeOut: 1.2, leave() { Sfx.phoneRing(false); } },
        ],
      };
    },
    memory(args) {
      const [year, l1, l2] = args; const style = year === '1921' ? 'gold' : year === '1934' ? 'fire' : 'ash';
      return {
        setup() {
          const l = L(); Sfx.stopAmbient();
          if (style === 'gold') { l.ambient.color.setHex(0xffe0a8); l.ambient.intensity = 0.9; l.roomLights.stage.intensity = 2.2; l.roomLights.dining.intensity = 1.6; W.dust.material.color.setHex(0xffe6b0); placeAll([['condesa', 0, -16.7, 0, 'Idle', 0.52], ['nino', -1.3, -16.6, 0.1, 'Idle', 0.52], ['payaso', 1.4, -16.6, -0.1, 'Idle', 0.52]]); Sfx.theme('hope'); }
          else if (style === 'fire') { l.ambient.color.setHex(0xff7a30); l.ambient.intensity = 0.7; l.roomLights.stage.color.setHex(0xff5a1a); l.roomLights.stage.intensity = 2.4; l.roomLights.dining.color.setHex(0xff6a20); l.roomLights.dining.intensity = 1.6; scene.fog.density = 0.06; W.dust.material.color.setHex(0xff9050); W.dust.material.size = 0.05; placeAll([['nino', -0.4, -12.6, 0, 'Stare'], ['condesa', 1.2, -14.2, 0, 'Idle']]); Sfx.fire(); Sfx.theme('sad'); }
          else { l.ambient.color.setHex(0x6070a0); l.ambient.intensity = 0.4; l.roomLights.kitchen.intensity = 2.4; placeAll([['verdugo', 8.4, -15.3, Math.PI / 2, 'Idle'], ['condesa', 10.0, -14.0, -Math.PI / 2, 'Stare']]); Sfx.fire(); Sfx.theme('dark'); }
        },
        shots: style === 'ash' ? [
          { d: 6, from: [7.3, 1.7, -11.5], to: [8.0, 1.5, -13.8], look: [[9, 1.2, -17.3], [9, 1.2, -17.3]], title: [year, ''], cap: l1, capAt: 0.8, fadeIn: 1.5 },
          { d: 6, from: [8.0, 1.5, -13.8], to: [7.4, 1.8, -15.6], look: [[9, 1.1, -17.3], [9.4, 1.4, -15.2]], cap: l2, capAt: 0.4, fadeOut: 1.2 },
        ] : [
          { d: 6, from: [-5, 1.7, -10.6], to: [-1.5, 1.6, -12.4], look: [[0, 1.3, -16.5], [0, 1.3, -16.5]], title: [year, ''], cap: l1, capAt: 0.8, fadeIn: 1.5 },
          { d: 6, from: [3.2, 1.5, -12.6], to: [0.6, 1.4, -14.6], look: [[0, 1.2, -16.4], [-0.3, 1.2, -16.6]], cap: l2, capAt: 0.4, fadeOut: 1.2 },
        ],
      };
    },
    ending_leave() {
      return {
        setup() {
          Sfx.stopAmbient(); const l = L(); l.ambient.color.setHex(0xffd9b0); l.ambient.intensity = 0.8; W.exitDoor.setOpen(1);
          placeAll([['condesa', -4.2, -9.0, 0, 'Stare'], ['nino', -5.3, -8.4, 0.1, 'Stare'], ['verdugo', -4.6, -10.4, 0, 'Stare'], ['payaso', -3.7, -8.0, -0.1, 'Stare']]);
          Sfx.theme('sad'); Sfx.chime6();
        },
        shots: [
          { d: 7, from: [-4.6, 1.6, -4.5], to: [-4.6, 1.55, 0.2], look: [[-4.6, 1.5, 1.4], [-4.6, 1.5, 1.6]], cap: 'El sol sale sobre Villa Sombría. Cruzas la puerta y no miras atrás.', capAt: 0.6, fadeIn: 1.5, title: ['FIN', ''] },
          { d: 8, from: [-4.6, 1.5, 0.9], to: [-4.6, 1.45, 0.2], look: [[-4.6, 1.2, -9], [-4.6, 1.3, -9.5]], cap: 'Dicen que el museo sigue contratando guardias.', capAt: 0.5, on: t => { Object.values(actors).forEach(a => a.char.setEyes(0.4 + t * 1.2)); }, fadeOut: 2.2 },
        ],
      };
    },
    ending_curator() {
      return {
        setup() {
          Sfx.stopAmbient(); const l = L(); l.ambient.color.setHex(0x8070b0); l.ambient.intensity = 0.35; l.lamp.intensity = 0.8;
          const key = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.018, 8, 16), new THREE.MeshBasicMaterial({ color: 0xffd24d })); key.position.set(0.1, 0.9, 0.4); key.rotation.x = Math.PI / 2; mkTemp(key);
          const man = mannequin(); man.position.set(0, 0.06, 1.35); man.rotation.y = Math.PI; man.scale.setScalar(0.0001); mkTemp(man); run.man = man;
          placeAll([['condesa', -1.2, -2.6, 0, 'Stare'], ['nino', 1.2, -2.6, 0, 'Stare'], ['verdugo', -3.7, 1.0, Math.PI / 2, 'Stare'], ['payaso', 3.7, 1.0, -Math.PI / 2, 'Stare']]);
          Sfx.theme('dark'); Sfx.waltzStart([-2.3, 1, -1.4]); Sfx.waltzSet(0.7);
        },
        shots: [
          { d: 5.5, from: [0, 1.6, 1.9], to: [0.1, 1.2, 0.8], look: [[0.1, 0.9, 0.4], [0.1, 0.9, 0.4]], cap: 'Aceptas la llave de Ambrosio.', capAt: 0.4, fadeIn: 1.5, title: ['FIN', ''] },
          { d: 6, from: [0, 1.6, 2.4], to: [0, 1.5, 1.8], look: [[0, 1.3, -1.6], [0, 1.3, -2.6]], cap: 'Las figuras se arrodillan. La caja de música vuelve a sonar.', capAt: 0.4, on: t => { Object.values(actors).forEach(a => a.char.setEyes(0.6 + t)); } },
          { d: 7.5, from: [-2.4, 1.5, 2.2], to: [2.4, 1.6, 2.4], look: [[0, 1.1, 1.3], [0, 1.1, 1.3]], cap: 'Villa Sombría necesita a alguien que no duerma jamás.', capAt: 0.6, on: t => { run.man.scale.setScalar(Math.max(0.0001, Math.min(1, t * 2.4))); }, fadeOut: 2 },
        ],
      };
    },
    ending_free() {
      return {
        setup() {
          Sfx.stopAmbient(); const l = L(); l.ambient.color.setHex(0xffe0a8); l.ambient.intensity = 0.7; Sfx.fire(); Sfx.theme('hope');
          placeAll([['condesa', -1.8, -13.4, 0.2, 'Stare'], ['verdugo', 1.9, -13.6, -0.2, 'Stare'], ['payaso', 0.5, -12.4, 0, 'Stare'], ['nino', -0.4, -11.7, 0, 'Idle']]);
          makeSpirits(0, -13, 110);
        },
        shots: [
          { d: 5, from: [8.0, 1.6, -11.2], to: [9.2, 1.45, -13.2], look: [[11.5, 1.1, -14], [11.5, 1.0, -14]], cap: 'El horno ruge.', capAt: 0.4, fadeIn: 1.5, title: ['LIBRES', ''], on: t => { W.furnaceGlow.material.color.setRGB(1, 0.5 + t * 0.4, 0.2); L().roomLights.kitchen.intensity = 1 + t * 3; } },
          { d: 7, from: [0, 1.7, -9.6], to: [0, 1.6, -10.9], look: [[0, 1.2, -13.5], [0, 1.3, -13.5]], cap: 'La cera se vuelve luz.', capAt: 0.5,
            enter() { ['condesa', 'verdugo', 'payaso'].forEach((id, i) => setTimeout(() => { actors[id].char.play('Melt', { once: true, fade: 0.2 }); Sfx.melt([actors[id].char.group.position.x, 1, actors[id].char.group.position.z]); }, 1500 + i * 700)); Sfx.sparkle(); },
            on: t => { L().ambient.intensity = 0.7 + t * 0.9; if (spirits) updateSpirits(0, 0.25 + t * 0.7); } },
          { d: 7, from: [0, 1.0, -9.5], to: [0, 0.95, -10.7], look: [[0, 0.85, -11.7], [0, 0.95, -11.7]], cap: '«Gracias por escucharnos.»', capAt: 0.5,
            enter() { ['condesa', 'verdugo', 'payaso'].forEach(id => { actors[id].char.visible = false; }); actors.nino.char.play('Peek', { fade: 0.3 }); Sfx.sparkle(); Sfx.sadChild([0, 1, -11.7]); },
            on: t => { updateSpirits(0, 1); L().ambient.intensity = 1.6 + t * 0.6; if (t > 0.55) actors.nino.char.play('Melt', { once: true, fade: 0.3 }); } },
          { d: 6.5, from: [-4.6, 1.5, -3.4], to: [-4.6, 1.5, 0.5], look: [[-4.6, 1.5, 1.5], [-4.6, 1.5, 1.5]], cap: 'Villa Sombría ya es solo un museo vacío… y el amanecer, de verdad, es tuyo.', capAt: 0.4,
            enter() { actors.nino.char.visible = false; W.exitDoor.setOpen(1); Sfx.sparkle(); }, on: t => { updateSpirits(0, 0); }, fadeOut: 2.4, fadeCol: '#fff' },
        ],
      };
    },
  };

  /* ---------- ejecución ---------- */
  C.play = (name, args) => new Promise(resolve => {
    Sfx.init(); const def = SCRIPTS[name](args); snapshot();
    run = { def, i: -1, t: 0, d: 0, resolve, flick: false, shot: null };
    C.active = true; G.state = 'cine'; hideHud(); show('cine'); fade(1, 0); setCap(''); setTitle('');
    W.notes.forEach(n => { n.mesh.visible = false; n.glow.intensity = 0; });
    def.setup && def.setup(); nextShot();
  });
  function hideHud() { ['hud', 'monitor', 'lockerOverlay', 'prompt', 'subs', 'hintLine', 'dangerVig'].forEach(hide); }
  function nextShot() {
    if (run.shot && run.shot.leave) run.shot.leave();
    run.i++;
    if (run.i >= run.def.shots.length) return finish();
    const s = run.shot = run.def.shots[run.i]; run.t = 0; run.d = s.d; run.capDone = false; run.fadeOutDone = false;
    camera.fov = s.fov || 66; camera.updateProjectionMatrix();
    if (s.fadeIn !== undefined) fade(0, s.fadeIn); else fade(0, 0.6);
    if (s.title) { setTitle(s.title[0], s.title[1]); setTimeout(() => { if (run) setTitle(''); }, 4200); }
    s.enter && s.enter();
  }
  function finish() {
    const r = run; run = null; C.active = false; setCap(''); setTitle(''); hide('cine'); restore();
    temps.forEach(o => scene.remove(o)); temps = []; spirits = null; camera.fov = 72; camera.updateProjectionMatrix(); Sfx.waltzStop(); Sfx.phoneRing(false);
    Object.values(actors).forEach(a => { a.char.visible = false; a.char.setEyes(1); }); G.state = 'idle'; fade(0, 0);
    r.resolve();
  }
  C.skip = () => { if (!run) return; Sfx.shutUp(); finish(); };
  C.stop = () => { if (run) finish(); };
  C.update = dt => {
    if (!run) return; const s = run.shot; run.t += dt; const k = Math.min(1, run.t / run.d), e = ease(k);
    const p = lerp3(s.from, s.to, e), lk = lerp3(s.look[0], s.look[1], e);
    camera.position.set(p[0], p[1] + Math.sin(run.t * 0.9) * 0.012, p[2]); camera.lookAt(lk[0], lk[1], lk[2]); camera.updateMatrixWorld();
    if (!run.capDone && s.cap && run.t >= (s.capAt || 0)) { run.capDone = true; setCap(s.cap); }
    if (s.on) s.on(k);
    if (spirits) updateSpirits(dt, spirits.material.opacity > 0.05 ? spirits.material.opacity : 0);
    if (!run.fadeOutDone && s.fadeOut && run.t >= run.d - s.fadeOut) { run.fadeOutDone = true; fade(1, s.fadeOut, s.fadeCol || '#000'); }
    // parpadeo del candil
    L().lamp.intensity = Math.max(0.3, L().lamp.intensity * 0.98 + (Math.random() < 0.05 ? 0.5 : 0.04));
    if (run.t >= run.d) nextShot();
  };
  return C;
}
