// Sound effects and background chimes, synthesized with Web Audio (no audio files).
import { rnd } from './util.js';

export const Sound = (() => {
  let ctx = null, master, sfxBus, musicBus, voiceBus, echoIn, noiseBuf;
  let sfxOn = true, musicOn = false, timer = null, nextT = 0, step = 0;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended' && !document.hidden) ctx.resume().catch(() => {});
      return ctx;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try {
      ctx = new AC();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      master = ctx.createGain();
      master.gain.value = .85;
      master.connect(comp);
      comp.connect(ctx.destination);
      sfxBus = ctx.createGain();
      sfxBus.gain.value = .75;
      sfxBus.connect(master);
      musicBus = ctx.createGain();
      musicBus.gain.value = 0;
      musicBus.connect(master);
      // sparkly echo send for the discovery jingle
      echoIn = ctx.createGain();
      const delay = ctx.createDelay(1);
      delay.delayTime.value = .17;
      const fb = ctx.createGain();
      fb.gain.value = .32;
      const wet = ctx.createGain();
      wet.gain.value = .4;
      echoIn.connect(sfxBus);
      echoIn.connect(delay);
      delay.connect(fb); fb.connect(delay);
      delay.connect(wet); wet.connect(sfxBus);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const ch = noiseBuf.getChannelData(0);
      for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    } catch (e) {
      console.warn('[CookieLab] Web Audio unavailable', e);
      ctx = null;
    }
    return ctx;
  }

  function tone(o) {
    const T = o.at != null ? o.at : ctx.currentTime + (o.t || 0);
    const dur = o.dur || .2;
    const vol = o.vol == null ? .3 : o.vol;
    const atk = Math.min(o.attack || .005, dur * .5);
    const osc = ctx.createOscillator();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.f, T);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.f2), T + (o.glide || dur));
    const g = ctx.createGain();
    g.gain.setValueAtTime(.0001, T);
    g.gain.linearRampToValueAtTime(vol, T + atk);
    g.gain.exponentialRampToValueAtTime(.0001, T + dur);
    let out = osc;
    if (o.filter) {
      const fl = ctx.createBiquadFilter();
      fl.type = o.filter.type || 'lowpass';
      fl.frequency.setValueAtTime(o.filter.f, T);
      if (o.filter.f2) fl.frequency.exponentialRampToValueAtTime(o.filter.f2, T + dur);
      fl.Q.value = o.filter.q || 1;
      osc.connect(fl);
      out = fl;
    }
    if (o.vib) {
      const lfo = ctx.createOscillator();
      const lg = ctx.createGain();
      lfo.frequency.value = o.vibRate || 6;
      lg.gain.value = o.vib;
      lfo.connect(lg);
      lg.connect(osc.frequency);
      lfo.start(T);
      lfo.stop(T + dur + .1);
    }
    out.connect(g);
    g.connect(o.dest || sfxBus);
    osc.start(T);
    osc.stop(T + dur + .1);
  }

  function noise(o) {
    const T = ctx.currentTime + (o.t || 0);
    const dur = o.dur || .2;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const fl = ctx.createBiquadFilter();
    fl.type = o.type || 'lowpass';
    fl.frequency.setValueAtTime(o.f || 1000, T);
    if (o.f2) fl.frequency.exponentialRampToValueAtTime(o.f2, T + dur);
    fl.Q.value = o.q || .7;
    const g = ctx.createGain();
    g.gain.setValueAtTime(.0001, T);
    g.gain.linearRampToValueAtTime(o.vol || .2, T + Math.min(o.attack || .005, dur * .5));
    g.gain.exponentialRampToValueAtTime(.0001, T + dur);
    src.connect(fl);
    fl.connect(g);
    g.connect(o.dest || sfxBus);
    src.start(T, Math.random() * .9);
    src.stop(T + dur + .05);
  }

  function bell(f, t, vol, dest) {
    [[1, 1, 1.6], [2.76, .32, .8], [5.4, .14, .4], [8.93, .05, .2]].forEach(([m, v, d]) =>
      tone({ type: 'sine', f: f * m, t, dur: d, vol: vol * v, attack: .002, dest }));
  }

  const play = fn => {
    if (!sfxOn || !ensure()) return;
    try { fn(); } catch (e) { console.warn('[CookieLab] sound error', e); }
  };

  // --- background chimes ---
  const midi = m => 440 * Math.pow(2, (m - 69) / 12);
  const STEP = 60 / 88 / 2; // eighth notes at 88 bpm
  const CHORDS = [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]]; // C Am F G
  const RHYTHM = [1, 0, 1, 1, 0, 1, 0, 1];
  const MELODY = [0, 2, 1, 2, 0, 1, 2, 0];
  const hash = s => { const x = Math.sin(s * 12.9898) * 43758.5453; return x - Math.floor(x); };

  function scheduleStep(t, s) {
    const bar = Math.floor(s / 8) % 4;
    const i = s % 8;
    const chord = CHORDS[bar];
    if (i === 0) {
      tone({ at: t, type: 'sine', f: midi(chord[0] - 12), dur: STEP * 8, vol: .09, attack: .25, dest: musicBus });
      tone({ at: t, type: 'triangle', f: midi(chord[0] - 24), dur: STEP * 4, vol: .06, attack: .05, dest: musicBus });
    }
    if (RHYTHM[i] && hash(s) > .18) {
      const lift = (Math.floor(s / 32) % 2 && i >= 4) ? 12 : 0;
      const n = chord[MELODY[i]] + 12 + lift;
      tone({ at: t, type: 'sine', f: midi(n), dur: 1.2, vol: .1, attack: .01, dest: musicBus });
      tone({ at: t, type: 'sine', f: midi(n) * 3, dur: .35, vol: .012, attack: .005, dest: musicBus });
    }
  }

  function scheduler() {
    if (!ctx) return;
    if (nextT < ctx.currentTime - .1) nextT = ctx.currentTime + .05;
    while (nextT < ctx.currentTime + .25) {
      scheduleStep(nextT, step++);
      nextT += STEP;
    }
  }

  function setMusic(on) {
    musicOn = on;
    if (on) {
      if (!ensure()) return;
      if (!timer) {
        nextT = ctx.currentTime + .1;
        step = 0;
        timer = setInterval(scheduler, 60);
      }
      musicBus.gain.cancelScheduledValues(ctx.currentTime);
      musicBus.gain.setTargetAtTime(.55, ctx.currentTime, .6);
    } else if (ctx) {
      musicBus.gain.cancelScheduledValues(ctx.currentTime);
      musicBus.gain.setTargetAtTime(0, ctx.currentTime, .2);
      setTimeout(() => { if (!musicOn && timer) { clearInterval(timer); timer = null; } }, 900);
    }
  }

  return {
    ensure,
    setSfx(on) { sfxOn = on; },
    // Output for recorded voice clips (independent of the sound-effects switch).
    voiceDest() {
      if (!ensure()) return null;
      if (!voiceBus) {
        voiceBus = ctx.createGain();
        voiceBus.gain.value = 1;
        voiceBus.connect(master);
      }
      return voiceBus;
    },
    // Lower the music while someone is talking.
    duck(on) {
      if (!ctx || !musicOn) return;
      musicBus.gain.cancelScheduledValues(ctx.currentTime);
      musicBus.gain.setTargetAtTime(on ? .18 : .55, ctx.currentTime, .15);
    },
    setMusic,
    suspend() { if (ctx && ctx.state === 'running') ctx.suspend().catch(() => {}); },
    resume() { if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {}); },
    pop: () => play(() => {
      tone({ type: 'sine', f: 380, f2: 1000, dur: .1, vol: .32 });
      tone({ type: 'triangle', f: 1600, f2: 2300, dur: .05, vol: .05, t: .02 });
    }),
    tap: () => play(() => tone({ type: 'sine', f: 900, f2: 700, dur: .05, vol: .12 })),
    drop: () => play(() => {
      tone({ type: 'sine', f: 640, f2: 150, dur: .17, vol: .42 });
      noise({ dur: .06, vol: .16, type: 'lowpass', f: 900 });
    }),
    boing: () => play(() => tone({ type: 'triangle', f: 210, f2: 520, dur: .18, vol: .2, vib: 30, vibRate: 22 })),
    stir: () => play(() => {
      noise({ dur: 1, vol: .12, type: 'bandpass', f: 300, f2: 2400, q: 2.5, attack: .2 });
      for (let i = 0; i < 7; i++) {
        const f = rnd(280, 640);
        tone({ type: 'sine', f, f2: f * 1.6, t: .1 + i * .12, dur: .07, vol: .1 });
      }
    }),
    // One quarter turn of the spoon; the blip climbs as the stir nears the end.
    stirTick: (p = 0) => play(() => {
      noise({ dur: .18, vol: .07, type: 'bandpass', f: 500, f2: 1400, q: 2, attack: .05 });
      const f = 320 + p * 420 + rnd(-25, 25);
      tone({ type: 'sine', f, f2: f * 1.6, dur: .07, vol: .1 });
    }),
    ovenDing: () => play(() => bell(1318.5, 0, .26)),
    // Frying: crackles that get busier as the pan heats up (p goes 0 → 1).
    sizzle: (p = 0) => play(() => {
      noise({ dur: .3, vol: .03 + p * .04, type: 'highpass', f: 4500, attack: .04 });
      const n = 2 + Math.round(p * 5);
      for (let i = 0; i < n; i++) noise({ t: rnd(0, .24), dur: rnd(.012, .03), vol: rnd(.08, .18), type: 'highpass', f: rnd(2500, 6000) });
    }),
    // Boiling: bloops that come faster and bigger as the water heats up.
    bubble: (p = 0) => play(() => {
      const n = 1 + Math.round(p * 3);
      for (let i = 0; i < n; i++) {
        const f = rnd(160, 260) + p * 120;
        tone({ type: 'sine', f, f2: f * 2.2, t: rnd(0, .22), dur: rnd(.05, .09), vol: .07 + p * .06 });
      }
      noise({ dur: .28, vol: .015 + p * .03, type: 'bandpass', f: 900, q: .8, attack: .08 });
    }),
    // Baking: the oven timer ticks; a soft warm hum under it.
    ovenTick: (p = 0) => play(() => {
      tone({ type: 'square', f: 2400, dur: .018, vol: .035, filter: { type: 'highpass', f: 1500 } });
      noise({ dur: .3, vol: .012 + p * .012, type: 'lowpass', f: 260, attack: .1 });
    }),
    // Melting: slow, thick blups and a faint sizzle.
    simmer: (p = 0) => play(() => {
      if (Math.random() < .45 + p * .4) {
        const f = rnd(110, 170);
        tone({ type: 'sine', f, f2: f * 1.8, t: rnd(0, .15), dur: .12, vol: .1 });
      }
      noise({ dur: .3, vol: .012 + p * .02, type: 'highpass', f: 5000, attack: .05 });
    }),
    // Boiled over: a big hiss and a splash.
    boilOver: () => play(() => {
      noise({ dur: .9, vol: .3, type: 'highpass', f: 2500, f2: 900, attack: .03 });
      noise({ t: .05, dur: .35, vol: .3, type: 'lowpass', f: 1200, f2: 250 });
      [0, .08, .16].forEach(t => tone({ type: 'sine', f: rnd(300, 420), f2: 900, t, dur: .08, vol: .12 }));
    }),
    // The dish is ready: now is the moment.
    ready: () => play(() => {
      bell(1568, 0, .16);
      bell(2093, .12, .14);
    }),
    // Burnt: a puff of smoke.
    poof: () => play(() => {
      noise({ dur: .55, vol: .34, type: 'lowpass', f: 1600, f2: 180, attack: .02 });
      tone({ type: 'sine', f: 220, f2: 70, dur: .35, vol: .3 });
    }),
    // Lifting the pan: a quick whoosh up.
    lift: () => play(() => {
      noise({ dur: .28, vol: .16, type: 'bandpass', f: 500, f2: 2600, q: 1.5, attack: .05 });
      tone({ type: 'sine', f: 420, f2: 980, dur: .2, vol: .2 });
    }),
    magic: () => play(() => {
      [1046.5, 1318.5, 1568, 2093, 2637].forEach((f, i) => {
        tone({ type: 'triangle', f, t: i * .075, dur: .42, vol: .18, dest: echoIn });
        tone({ type: 'sine', f: f * 2, t: i * .075, dur: .25, vol: .04, dest: echoIn });
      });
      noise({ t: .05, dur: .7, vol: .04, type: 'highpass', f: 7000 });
    }),
    splat: () => play(() => {
      tone({ type: 'sawtooth', f: 620, f2: 70, dur: .6, vol: .15, vib: 50, vibRate: 11, filter: { type: 'lowpass', f: 1800, f2: 400 } });
      noise({ t: .42, dur: .3, vol: .38, type: 'lowpass', f: 1400, f2: 140 });
      tone({ type: 'sine', f: 190, f2: 45, t: .42, dur: .24, vol: .45 });
    }),
    nope: () => play(() => {
      tone({ type: 'triangle', f: 392, f2: 370, dur: .26, vol: .2 });
      tone({ type: 'triangle', f: 311, f2: 247, t: .28, dur: .55, vol: .2, vib: 7, vibRate: 6 });
    }),
    giggle: () => play(() => {
      [0, .1, .2, .3].forEach((t, i) => tone({ type: 'sine', f: 820 + i * 60, f2: 1150 + i * 40, t, dur: .08, vol: .22, vib: 25, vibRate: 30 }));
    }),
    sneeze: () => play(() => {
      tone({ type: 'triangle', f: 260, f2: 620, dur: .38, vol: .16, attack: .2 });
      noise({ t: .42, dur: .28, vol: .42, type: 'highpass', f: 1800 });
      tone({ type: 'square', f: 420, f2: 160, t: .42, dur: .18, vol: .08 });
    }),
    gift: () => play(() => {
      [784, 988, 1175, 1568].forEach((f, i) => tone({ type: 'triangle', f, t: i * .06, dur: .3, vol: .16, dest: echoIn }));
      bell(2093, .3, .12, echoIn);
    }),
    coin: () => play(() => {
      tone({ type: 'square', f: 988, dur: .09, vol: .12 });
      tone({ type: 'square', f: 1319, t: .08, dur: .35, vol: .12 });
      bell(2637, .1, .06);
    }),
    fanfare: () => play(() => {
      [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5, 1318.5].forEach((f, i) =>
        tone({ type: 'triangle', f, t: i * .11, dur: i === 6 ? 1.2 : .3, vol: .2, dest: echoIn }));
      [523.25, 659.25, 783.99].forEach(f => tone({ type: 'sine', f, t: .77, dur: 1.4, vol: .1 }));
    }),
  };
})();
