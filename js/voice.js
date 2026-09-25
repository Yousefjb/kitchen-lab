// Narration: recorded voice clips (voice/manifest.json), with the device's
// built-in Arabic speech engine as a fallback for lines without a clip.
import { wait } from './util.js';
import { Sound } from './sound.js';
import { speakable } from './voice-lines.js';

/* =====================================================================
   Voice — Arabic narration with the device's built-in speech engine
   ===================================================================== */
export const Voice = (() => {
  const synth = 'speechSynthesis' in window ? window.speechSynthesis : null;
  const QUALITY = /natural|neural|enhanced|premium|online/i;
  const LIKED = /majed|maged|tarik|hoda|naayf|hamed|zariyah|salma|shakir|laila|mariam|google/i;
  let voice = null, enabled = true, unlocked = false;

  const api = {
    onchange: null,
    get supported() { return !!synth; },
    get available() { return !!voice; },
    get name() { return voice ? voice.name : ''; },
    setEnabled(on) { enabled = on; if (!on) api.stop(); },
    // iOS/Safari only allow speech after a user gesture; call this from one.
    unlock() {
      if (!synth || unlocked) return;
      unlocked = true;
      try {
        const u = new SpeechSynthesisUtterance(' ');
        u.volume = 0;
        if (voice) { u.voice = voice; u.lang = voice.lang; }
        synth.speak(u);
      } catch (e) { /* ignore */ }
    },
    stop() { try { if (synth) synth.cancel(); } catch (e) { /* ignore */ } },
    speak(text, { interrupt = true, onstart, onend, force = false, rate = .95, pitch = 1 } = {}) {
      const t = speakable(text || '');
      if (!synth || (!enabled && !force) || !voice || !t) { if (onend) onend(); return false; }
      try {
        if (interrupt) synth.cancel();
        const u = new SpeechSynthesisUtterance(t);
        u.voice = voice;
        u.lang = voice.lang || 'ar-SA';
        u.rate = rate;
        u.pitch = pitch;
        let done = false;
        const finish = () => { if (done) return; done = true; if (onend) onend(); };
        u.onstart = () => { if (onstart) onstart(); };
        u.onend = finish;
        u.onerror = finish;
        setTimeout(finish, 2500 + t.length * 120); // some engines never fire onend
        if (synth.paused) synth.resume();
        synth.speak(u);
        return true;
      } catch (e) {
        console.warn('[KitchenLab] speech failed', e);
        if (onend) onend();
        return false;
      }
    },
  };

  function choose() {
    if (!synth) return;
    let all = [];
    try { all = synth.getVoices(); } catch (e) { return; }
    const ar = all.filter(v => /^ar([-_]|$)/i.test(v.lang || ''));
    voice = ar.find(v => QUALITY.test(v.name))
      || ar.find(v => v.localService && LIKED.test(v.name))
      || ar.find(v => v.localService)
      || ar.find(v => LIKED.test(v.name))
      || ar[0] || null;
    if (api.onchange) api.onchange();
  }
  if (synth) {
    choose();
    try { synth.addEventListener('voiceschanged', choose); } catch (e) { synth.onvoiceschanged = choose; }
  }
  return api;
})();

/* =====================================================================
   Clips — natural recorded/AI voice files listed in voice/manifest.json
   (made with tools/make-voice.mjs). Keyed by the exact spoken text.
   ===================================================================== */
export const Clips = (() => {
  let manifest = null;
  const raw = new Map();      // text -> Promise<ArrayBuffer> (small, compressed)
  const decoded = new Map();  // text -> AudioBuffer (kept small: decoded audio is large)
  let resolveLoaded;
  const loaded = new Promise(r => { resolveLoaded = r; });

  const api = {
    loaded,
    get ready() { return !!manifest; },
    get info() { return manifest; },
    get count() { return manifest ? Object.keys(manifest.clips).length : 0; },
    has: t => !!(manifest && manifest.clips[t]),
    async load() {
      try {
        const r = await fetch('voice/manifest.json', { cache: 'no-cache' });
        if (r.ok) {
          const m = await r.json();
          if (m && m.clips && typeof m.clips === 'object') manifest = m;
        }
      } catch (e) { /* no clips (or opened as a file): use the device voice */ }
      resolveLoaded();
      return api.ready;
    },
    fetchRaw(t) {
      if (!raw.has(t)) {
        const p = fetch('voice/' + manifest.clips[t]).then(r => {
          if (!r.ok) throw new Error('clip HTTP ' + r.status);
          return r.arrayBuffer();
        });
        p.catch(() => raw.delete(t));
        raw.set(t, p);
      }
      return raw.get(t);
    },
    async buffer(ctx, t) {
      if (decoded.has(t)) {
        const b = decoded.get(t);
        decoded.delete(t);
        decoded.set(t, b);
        return b;
      }
      const ab = await api.fetchRaw(t);
      const b = await new Promise((res, rej) => {
        const p = ctx.decodeAudioData(ab.slice(0), res, rej);
        if (p && p.then) p.then(res, rej);
      });
      decoded.set(t, b);
      if (decoded.size > 40) decoded.delete(decoded.keys().next().value);
      return b;
    },
    // Fetch every clip once (small files) so the voice also works offline.
    async preloadAll() {
      if (!manifest) return;
      const list = Object.keys(manifest.clips);
      for (let i = 0; i < list.length; i += 3) {
        await Promise.all(list.slice(i, i + 3).map(t => api.fetchRaw(t).catch(() => {})));
      }
    },
  };
  return api;
})();

/* =====================================================================
   Narrator — plays a sentence made of clip pieces, one sentence at a time.
   Falls back to the device's built-in voice when a piece has no clip.
   ===================================================================== */
export const Narrator = (() => {
  let queue = [];
  let active = null;
  let gen = 0;
  let enabled = true;

  const finish = job => {
    if (job.done) return;
    job.done = true;
    if (job.onend) job.onend();
  };

  function done(job) {
    if (!active || active.job !== job) return;
    clearTimeout(active.timer);
    active = null;
    finish(job);
    if (queue.length) next();
    else Sound.duck(false);
  }

  async function next() {
    if (active || !queue.length) return;
    const job = queue.shift();
    const g = gen;
    active = { job, sources: [], timer: 0 };
    await Promise.race([Clips.loaded, wait(1500)]);
    if (g !== gen || !active || active.job !== job) return;
    const ctx = Sound.ensure();
    if (ctx && Clips.ready && job.parts.every(Clips.has)) {
      try {
        const bufs = [];
        for (const p of job.parts) bufs.push(await Clips.buffer(ctx, p));
        if (g !== gen || !active || active.job !== job) return; // interrupted while loading
        if (ctx.state === 'suspended') await ctx.resume().catch(() => {});
        const dest = Sound.voiceDest();
        let t = ctx.currentTime + .03;
        bufs.forEach((b, i) => {
          const src = ctx.createBufferSource();
          src.buffer = b;
          src.connect(dest);
          src.start(t);
          active.sources.push(src);
          t += b.duration + (i < bufs.length - 1 ? .1 : 0);
        });
        Sound.duck(true);
        if (job.onstart) job.onstart();
        active.timer = setTimeout(() => done(job), (t - ctx.currentTime) * 1000 + 60);
        return;
      } catch (e) {
        console.warn('[KitchenLab] voice clip failed, using the device voice', e);
        if (g !== gen || !active || active.job !== job) return;
      }
    }
    Sound.duck(true);
    Voice.speak(job.parts.join(' '), { interrupt: false, force: job.force, onstart: job.onstart, onend: () => done(job) });
  }

  return {
    setEnabled(on) {
      enabled = on;
      Voice.setEnabled(on);
      if (!on) this.stop();
    },
    stop() {
      gen++;
      const q = queue;
      queue = [];
      q.forEach(finish);
      if (active) {
        active.sources.forEach(src => { try { src.stop(); } catch (e) { /* already ended */ } });
        clearTimeout(active.timer);
        const j = active.job;
        active = null;
        finish(j);
      }
      Voice.stop();
      Sound.duck(false);
    },
    speak(parts, { interrupt = true, force = false, onstart, onend } = {}) {
      const list = (Array.isArray(parts) ? parts : [parts]).map(speakable).filter(Boolean);
      const job = { parts: list, force, onstart, onend };
      if (!list.length || (!enabled && !force)) { finish(job); return; }
      if (interrupt) this.stop();
      queue.push(job);
      next();
    },
  };
})();
