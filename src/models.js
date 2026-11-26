import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

export const IDS = ['condesa', 'verdugo', 'nino', 'payaso'];
const store = {};

export async function loadAll(onProgress) {
  const loader = new GLTFLoader();
  const jobs = [];
  IDS.forEach(id => ['normal', 'damaged'].forEach(v => jobs.push([id, v, `models/${id}${v === 'damaged' ? '_damaged' : ''}.glb`])));
  let done = 0;
  for (const [id, v, url] of jobs) {                 // en serie: progreso suave y poca memoria punta
    const g = await loader.loadAsync(url);
    (store[id] = store[id] || {})[v] = g;
    onProgress && onProgress(++done / jobs.length);
  }
}

const tmpM = new THREE.Matrix4(), tmpI = new THREE.Matrix4();

export class Char {
  constructor(id, opts = {}) {
    this.id = id; this.decoy = !!opts.decoy;
    this.group = new THREE.Group(); this.group.name = 'char_' + id;
    this.v = {}; this.variant = 'normal'; this.clip = null; this.cur = null;
    this.faceOff = id === 'nino' ? Math.PI : 0;       // el Niño tiene la cabeza girada 180°: se le gira el cuerpo para mostrar su cara
    for (const name of ['normal', 'damaged']) {
      const g = store[id][name];
      const model = SkeletonUtils.clone(g.scene);
      const eyes = [];
      model.traverse(o => {
        if (o.isMesh) {
          o.frustumCulled = false;
          o.material = o.material.clone();
          if (o.material.name === 'Eyes_Glow') eyes.push(o.material);
          if (this.decoy && o.material.name === 'Fire_Glow') { o.material.emissiveIntensity = 0; o.material.emissive.set(0x000000); o.material.color.set(0x14110c); }
        }
      });
      eyes.forEach(m => {
        m.userData.base = m.emissiveIntensity;
        if (this.decoy) { m.color.set(0x14110c); m.emissive.set(0x000000); m.emissiveIntensity = 0; }
      });
      const mixer = new THREE.AnimationMixer(model);
      const actions = {};
      g.animations.forEach(c => { actions[c.name] = mixer.clipAction(c); });
      model.visible = name === 'normal';
      this.group.add(model);
      this.v[name] = { model, mixer, actions, eyes, cam: model.getObjectByName('JumpscareCam') };
    }
    this.cur = this.v.normal;
    this.play('Idle', { fade: 0 });
  }
  setVariant(name) {
    if (name === this.variant) return;
    this.v[this.variant].model.visible = false; this.variant = name; this.cur = this.v[name];
    this.cur.model.visible = true; const c = this.clip; this.clip = null; this.play(c || 'Idle', { fade: 0 });
  }
  play(name, o = {}) {
    const a = this.cur.actions[name]; if (!a) return null;
    const fade = o.fade ?? 0.3;
    if (this.clip === name && !o.restart) { a.setEffectiveTimeScale(o.speed ?? 1); return a; }
    const prev = this.clip && this.cur.actions[this.clip];
    a.reset();
    a.setLoop(o.once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity); a.clampWhenFinished = !!o.once;
    a.setEffectiveTimeScale(o.speed ?? 1); a.setEffectiveWeight(1);
    if (o.at) a.time = o.at;
    if (prev && prev !== a && fade > 0) { prev.fadeOut(fade); a.fadeIn(fade); } else if (prev && prev !== a) prev.stop();
    a.play(); this.clip = name; return a;
  }
  stopAll() { this.cur.mixer.stopAllAction(); this.clip = null; }
  freezePose(name = 'Idle', t = 0) { this.stopAll(); const a = this.play(name, { fade: 0 }); a.time = t; a.paused = true; this.cur.mixer.update(0); }
  update(dt) { this.cur.mixer.update(dt); }
  setEyes(k) { this.cur.eyes.forEach(m => { m.emissiveIntensity = (m.userData.base ?? 1) * k; }); }
  place(x, y, z, ry = 0) { this.group.position.set(x, y, z); this.group.rotation.set(0, ry + this.faceOff, 0); }
  faceToward(x, z, withFace = true) { this.group.rotation.y = Math.atan2(x - this.group.position.x, z - this.group.position.z) + (withFace ? this.faceOff : 0); }
  get visible() { return this.group.visible; }
  set visible(v) { this.group.visible = v; }
  /* ---- jumpscare con la JumpscareCam animada del propio .glb ---- */
  jumpscareBegin(playerMatrixWorld) {
    const v = this.cur; this.stopAll();
    const a = v.actions.Jumpscare; a.reset(); a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; a.setEffectiveTimeScale(1); a.setEffectiveWeight(1); a.play();
    this.clip = 'Jumpscare'; v.mixer.update(0);
    tmpM.compose(v.cam.position, v.cam.quaternion, v.cam.scale);
    this._final = playerMatrixWorld.clone().multiply(tmpI.copy(tmpM).invert());   // transformación final del grupo
    this._final.decompose(this.group.position, this.group.quaternion, this.group.scale);
    this.group.scale.set(1, 1, 1); this._fp = this.group.position.clone();
    this.jt = 0;
  }
  jumpscareStep(dt, offset, outCam) {
    const v = this.cur; this.jt += dt; v.mixer.update(dt);
    this.group.position.copy(this._fp).add(offset);
    tmpM.compose(v.cam.position, v.cam.quaternion, v.cam.scale);
    const m = this._final.clone().multiply(tmpM);
    m.decompose(outCam.position, outCam.quaternion, new THREE.Vector3());
    outCam.fov = v.cam.fov || 62; outCam.updateProjectionMatrix();
  }
}
