/* Audio procedural (WebAudio): sin archivos externos. */
const Sfx = (() => {
  let ctx = null, master = null, nb = null;
  let amb = null, buzz = null, musicTimer = null, musicStep = 0;

  function init() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.9;
      master.connect(ctx.destination);
      nb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = nb.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume();
  }

  function out(pan) {
    if (!pan || !ctx.createStereoPanner) return master;
    const p = ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    p.connect(master);
    return p;
  }

  function noise(o) {
    if (!ctx) return;
    const t = ctx.currentTime + (o.delay || 0);
    const s = ctx.createBufferSource();
    s.buffer = nb; s.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = o.type || 'lowpass';
    f.frequency.setValueAtTime(o.f || 800, t);
    if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t + o.dur);
    f.Q.value = o.q || 1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.g || 0.3, t + (o.a || 0.01));
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    s.connect(f); f.connect(g); g.connect(out(o.pan));
    s.start(t, Math.random());
    s.stop(t + o.dur + 0.05);
  }

  function tone(o) {
    if (!ctx) return;
    const t = ctx.currentTime + (o.delay || 0);
    const osc = ctx.createOscillator();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.f, t);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, t + o.dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.g || 0.2, t + (o.a || 0.01));
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    let node = osc;
    if (o.lp) {
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp;
      osc.connect(f); node = f;
    }
    node.connect(g); g.connect(out(o.pan));
    osc.start(t); osc.stop(t + o.dur + 0.05);
  }

  function startAmbient() {
    if (!ctx || amb) return;
    const g = ctx.createGain(); g.gain.value = 0.0001;
    g.gain.exponentialRampToValueAtTime(0.5, ctx.currentTime + 3);
    g.connect(master);
    const nodes = [];
    const o1 = ctx.createOscillator(); o1.type = 'sine'; o1.frequency.value = 52;
    const g1 = ctx.createGain(); g1.gain.value = 0.10; o1.connect(g1); g1.connect(g);
    const o2 = ctx.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = 104.6;
    const f2 = ctx.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = 260;
    const g2 = ctx.createGain(); g2.gain.value = 0.035; o2.connect(f2); f2.connect(g2); g2.connect(g);
    const n = ctx.createBufferSource(); n.buffer = nb; n.loop = true;
    const nf = ctx.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 500; nf.Q.value = 0.6;
    const ng = ctx.createGain(); ng.gain.value = 0.025; n.connect(nf); nf.connect(ng); ng.connect(g);
    // ventilador: ruido modulado
    const lfo = ctx.createOscillator(); lfo.frequency.value = 5.5;
    const lg = ctx.createGain(); lg.gain.value = 0.012; lfo.connect(lg); lg.connect(ng.gain);
    [o1, o2, n, lfo].forEach(x => x.start());
    nodes.push(o1, o2, n, lfo);
    amb = { g, nodes };
  }
  function stopAmbient() {
    if (!amb) return;
    const a = amb; amb = null;
    a.g.gain.cancelScheduledValues(ctx.currentTime);
    a.g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.15);
    setTimeout(() => a.nodes.forEach(n => { try { n.stop(); } catch (e) {} }), 800);
  }

  function setBuzz(on) {
    if (!ctx) return;
    if (on && !buzz) {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 100;
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 700;
      const g = ctx.createGain(); g.gain.value = 0.035;
      o.connect(f); f.connect(g); g.connect(master); o.start();
      buzz = { o, g };
    } else if (!on && buzz) {
      const b = buzz; buzz = null;
      b.g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.03);
      setTimeout(() => { try { b.o.stop(); } catch (e) {} }, 300);
    }
  }

  const api = {
    init, startAmbient, stopAmbient, setBuzz,
    ui() { tone({ f: 880, dur: 0.07, g: 0.08, type: 'square', lp: 2000 }); },
    door(pan) {
      noise({ f: 1200, f2: 150, dur: 0.45, g: 0.5, pan, type: 'lowpass' });
      tone({ f: 90, f2: 45, dur: 0.35, g: 0.4, pan, type: 'square', lp: 300 });
    },
    step(pan, vol, delay) {
      vol = vol || 0.3;
      noise({ f: 220, dur: 0.16, g: vol, pan, delay });
      tone({ f: 70, f2: 45, dur: 0.16, g: vol * 0.8, pan, lp: 200, delay });
    },
    run(pan) {
      for (let i = 0; i < 14; i++) api.step(pan, 0.2 + i * 0.03, i * 0.3);
    },
    thud(pan) {
      noise({ f: 300, dur: 0.35, g: 0.9, pan });
      tone({ f: 120, f2: 35, dur: 0.4, g: 0.8, pan, type: 'triangle' });
    },
    clang(vol) {
      vol = vol || 0.15;
      tone({ f: 1400 + Math.random() * 900, dur: 0.5, g: vol, type: 'triangle' });
      tone({ f: 2300 + Math.random() * 600, dur: 0.3, g: vol * 0.6, type: 'sine', delay: 0.04 });
      noise({ f: 3000, type: 'highpass', dur: 0.12, g: vol * 0.8 });
    },
    melt(pan) {
      noise({ f: 5000, f2: 1500, type: 'highpass', dur: 1.2, g: 0.3, pan });
      tone({ f: 300, f2: 60, dur: 1.0, g: 0.2, pan, type: 'sawtooth', lp: 600 });
    },
    laugh() {
      for (let i = 0; i < 4; i++)
        tone({ f: 170 - i * 12, f2: 110 - i * 8, dur: 0.22, g: 0.25, type: 'sawtooth', lp: 500, delay: i * 0.3 });
    },
    stinger() {
      tone({ f: 380, f2: 90, dur: 0.5, g: 0.28, type: 'sawtooth', lp: 1500 });
      noise({ f: 2500, type: 'bandpass', dur: 0.4, g: 0.3 });
    },
    breath(pan) {
      noise({ f: 600, f2: 1200, type: 'bandpass', dur: 0.8, a: 0.4, g: 0.08, pan });
    },
    jumpscare() {
      noise({ f: 3000, f2: 500, type: 'bandpass', q: 0.7, dur: 1.5, g: 1.0, a: 0.02 });
      noise({ f: 900, dur: 1.4, g: 0.8, a: 0.02 });
      tone({ f: 220, f2: 55, dur: 1.5, g: 0.6, type: 'sawtooth', a: 0.02 });
      tone({ f: 1300, f2: 300, dur: 1.2, g: 0.35, type: 'square', a: 0.02 });
      tone({ f: 1750, f2: 400, dur: 1.2, g: 0.25, type: 'square', a: 0.02 });
    },
    chime() {
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
        tone({ f, dur: 1.6, g: 0.2, delay: i * 0.35, a: 0.02 }));
    },
    powerDown() {
      tone({ f: 200, f2: 30, dur: 1.4, g: 0.4, type: 'sawtooth', lp: 400 });
      noise({ f: 400, f2: 60, dur: 1.4, g: 0.4 });
    },
    camOn() { noise({ f: 4000, type: 'highpass', dur: 0.25, g: 0.18 }); tone({ f: 600, f2: 1200, dur: 0.12, g: 0.06, type: 'square' }); },
    camSwitch() { noise({ f: 5000, type: 'highpass', dur: 0.18, g: 0.15 }); },
    musicBox(on) {
      if (!ctx) return;
      if (on && !musicTimer) {
        const mel = [659, 622, 659, 622, 659, 494, 587, 523, 440, 0, 262, 330, 440, 494, 0, 330, 415, 494, 523, 0];
        musicStep = 0;
        musicTimer = setInterval(() => {
          const f = mel[musicStep++ % mel.length];
          if (f) {
            tone({ f, dur: 0.9, g: 0.16, a: 0.005 });
            tone({ f: f * 2, dur: 0.5, g: 0.04, a: 0.005 });
          }
        }, 330);
      } else if (!on && musicTimer) {
        clearInterval(musicTimer); musicTimer = null;
      }
    },
    stopAll() { api.stopAmbient(); api.setBuzz(false); api.musicBox(false); },
  };
  return api;
})();
