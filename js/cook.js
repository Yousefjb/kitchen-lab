// Cooking after the stir: the dish goes into a pan, a pot or the oven and cooks
// from "not yet" through "ready" (the star on the meter) to "too far".
// The child taps the pan, pot or oven while it is ready to take the dish out.
// main.js decides which dishes are cooked and how (the kitchen's `cook` lists) and
// what the mascot says; this file only handles the timing and the picture.
//
// Nobody fails: tapping too early just says "not yet", and going too far (burnt,
// or boiled over) starts again, a little slower each time. On the third try the
// mascot takes it out for them.
import { clamp, fillEmo } from './util.js';

export const READY = [.55, .82];  // the star part of the meter
const SLOWER = 1.35;              // each retry cooks this much slower
const HELP_TRY = 3;               // on this try the mascot takes it out by itself
const TICK_MS = 260;              // how often the cooking sound plays
const SPOILT_PAUSE = 1700;        // smoke or foam clears before the next try
const DONE_MS = 520;

const lerp = (a, b, t) => a + (b - a) * t;
const f2 = n => n.toFixed(2);
const GLOW = 'drop-shadow(0 0 10px rgba(255, 190, 40, .95))'; // "ready", even on white food

// Pale, then golden, then dark and brown: frying and baking.
function browning(p) {
  const [a, b] = READY;
  if (p < a) { const t = p / a; return `saturate(${f2(lerp(.2, 1, t))}) brightness(${f2(lerp(1.45, 1, t))})`; }
  if (p <= b) return `saturate(1.15) brightness(1.02) ${GLOW}`;
  const t = (p - b) / (1 - b);
  return `saturate(${f2(lerp(1.1, .55, t))}) brightness(${f2(lerp(1, .38, t))}) sepia(${f2(lerp(0, .6, t))})`;
}

// Each way of cooking: how long a first try takes, and how the food looks at p (0 → 1).
// The vessel, bubbles, foam and smoke are drawn in index.html and styled per method in game.css.
const METHODS = {
  fry: { ms: 4800, food: browning },
  bake: { ms: 5600, food: browning },
  // Boiling doesn't brown: too far means the pot boils over (foam), not burnt food.
  boil: {
    ms: 5200,
    food: p => (p < READY[0]
      ? `saturate(${f2(lerp(.35, 1, p / READY[0]))}) brightness(${f2(lerp(1.3, 1, p / READY[0]))})`
      : p <= READY[1] ? `saturate(1.1) ${GLOW}` : 'saturate(1.05)'),
  },
  // Melting: lumpy and blurry at first, smooth when ready, then it catches and darkens.
  melt: {
    ms: 5000,
    food: p => {
      const [a, b] = READY;
      if (p < a) { const t = p / a; return `blur(${f2(lerp(5, 0, t))}px) saturate(${f2(lerp(.4, 1, t))}) brightness(${f2(lerp(1.3, 1, t))})`; }
      if (p <= b) return `saturate(1.1) ${GLOW}`;
      const t = (p - b) / (1 - b);
      return `brightness(${f2(lerp(1, .45, t))}) sepia(${f2(lerp(0, .55, t))})`;
    },
  },
};

// on(event, info): 'start' | 'tick' (p) | 'ready' | 'overdone' | 'early' | 'spoilt' | 'help' | 'done'
export function createCooker({ root, paused = () => false, on = () => {} }) {
  const btn = root.querySelector('.cook-btn');
  const food = root.querySelector('.cook-food');
  const needle = root.querySelector('.cook-needle');

  let job = null;

  function draw() {
    const p = job.p;
    food.style.filter = job.method.food(p);
    root.style.setProperty('--p', p.toFixed(3));
    needle.style.insetInlineStart = `${(p * 100).toFixed(1)}%`;
    root.classList.toggle('ready', p >= READY[0] && p <= READY[1]);
    root.classList.toggle('overdone', p > READY[1]);
  }

  function frame(now) {
    if (!job) return;
    const dt = Math.min(now - job.last, 50); // a hidden tab doesn't jump ahead
    job.last = now;
    if (!job.waiting && !paused()) {
      const was = job.p;
      job.p = clamp(job.p + dt / job.ms, 0, 1);
      if (was < READY[0] && job.p >= READY[0]) on('ready', { attempt: job.attempt });
      if (was <= READY[1] && job.p > READY[1]) on('overdone');
      if (job.attempt >= HELP_TRY && job.p >= (READY[0] + READY[1]) / 2) { on('help'); takeOut(); return; }
      if (now - job.tickAt > TICK_MS) { job.tickAt = now; on('tick', job.p); }
      if (job.p >= 1) spoil();
      draw();
    }
    job.raf = requestAnimationFrame(frame);
  }

  function spoil() {
    job.waiting = true;
    root.classList.add('spoilt');
    on('spoilt', { attempt: job.attempt });
    job.timer = setTimeout(() => {
      if (!job) return;
      job.attempt++;
      job.ms *= SLOWER;
      job.p = 0;
      job.waiting = false;
      root.classList.remove('spoilt');
      draw();
    }, SPOILT_PAUSE);
  }

  function takeOut() {
    job.waiting = true;
    cancelAnimationFrame(job.raf);
    root.classList.add('done');
    on('done');
    const { finish } = job;
    job.timer = setTimeout(() => { clear(); finish(true); }, DONE_MS);
  }

  function onTap() {
    if (!job || job.waiting) return;
    const p = job.p;
    if (p < READY[0]) {
      on('early');
      btn.classList.remove('nudge');
      void btn.offsetWidth;
      btn.classList.add('nudge');
    } else if (p <= READY[1]) {
      takeOut();
    } else {
      job.p = 1;
      draw();
      spoil();
    }
  }
  btn.addEventListener('click', onTap);

  // Cook one dish. Resolves true once it is taken out, false if cancelled.
  //   how    'fry' | 'boil' | 'bake' | 'melt'
  //   label  what the button says, e.g. "lift the pan"
  //   liquid colour of the water or sauce in a pot
  function run({ how, id, emoji, label, liquid }) {
    cancel();
    fillEmo(food, emoji, id);
    root.dataset.how = how;
    root.style.setProperty('--liquid', liquid);
    btn.setAttribute('aria-label', label);
    root.querySelector('.cook-label').textContent = label + ' ⬆';
    root.hidden = false;
    root.classList.remove('ready', 'overdone', 'spoilt', 'done');
    btn.classList.remove('nudge');
    return new Promise(finish => {
      const now = performance.now();
      const method = METHODS[how];
      job = { method, p: 0, ms: method.ms, attempt: 1, last: now, tickAt: now, waiting: false, raf: 0, timer: 0, finish };
      draw();
      on('start');
      try { btn.focus({ preventScroll: true }); } catch (e) { /* not critical */ }
      job.raf = requestAnimationFrame(frame);
    });
  }

  function clear() {
    if (!job) return;
    cancelAnimationFrame(job.raf);
    clearTimeout(job.timer);
    job = null;
    root.hidden = true;
    root.classList.remove('ready', 'overdone', 'spoilt', 'done');
  }

  function cancel() {
    if (!job) return;
    const { finish } = job;
    clear();
    finish(false);
  }

  return { run, cancel, active: () => !!job };
}
