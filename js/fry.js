// Frying: the dish sizzles in a pan and turns from pale to golden to burnt.
// The child taps the pan while it is golden (the star on the meter) to lift it out.
// main.js decides which dishes are fried (the kitchen's `cook.fry` list) and what
// the mascot says; this file only handles the timing and the picture.
//
// Nobody fails: tapping too early just says "not yet", and burning it starts the
// pan again, a little slower each time. On the third try the mascot lifts it for them.
import { clamp, fillEmo } from './util.js';

export const READY = [.55, .82];  // the golden part of the meter
const COOK_MS = 4800;             // pale to burnt on the first try
const SLOWER = 1.35;              // each retry cooks this much slower
const HELP_TRY = 3;               // on this try the mascot lifts the pan by itself
const SIZZLE_MS = 260;
const BURNT_PAUSE = 1700;         // smoke clears before the next try
const LIFT_MS = 520;

const lerp = (a, b, t) => a + (b - a) * t;

// Pale and washed out, then golden, then dark and brown.
function foodFilter(p) {
  const [a, b] = READY;
  if (p < a) {
    const t = p / a;
    return `saturate(${lerp(.2, 1, t).toFixed(2)}) brightness(${lerp(1.45, 1, t).toFixed(2)})`;
  }
  if (p <= b) return 'saturate(1.15) brightness(1.02) drop-shadow(0 0 10px rgba(255, 190, 40, .95))'; // a golden glow, even on white food
  const t = (p - b) / (1 - b);
  return `saturate(${lerp(1.1, .55, t).toFixed(2)}) brightness(${lerp(1, .38, t).toFixed(2)}) sepia(${lerp(0, .6, t).toFixed(2)})`;
}

// on(event, info): 'start' | 'sizzle' (p) | 'ready' | 'overdone' | 'early' | 'burnt' | 'help' | 'lift'
export function createFryer({ root, paused = () => false, on = () => {} }) {
  const pan = root.querySelector('.fry-pan');
  const food = root.querySelector('.fry-food');
  const needle = root.querySelector('.fry-needle');

  let job = null;

  function draw() {
    const p = job.p;
    food.style.filter = foodFilter(p);
    food.style.setProperty('--p', p.toFixed(3));
    needle.style.insetInlineStart = `${(p * 100).toFixed(1)}%`;
    root.classList.toggle('ready', p >= READY[0] && p <= READY[1]);
    root.classList.toggle('smoky', p > READY[1]);
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
      if (job.attempt >= HELP_TRY && job.p >= (READY[0] + READY[1]) / 2) { on('help'); lift(); return; }
      if (now - job.sizzleAt > SIZZLE_MS) { job.sizzleAt = now; on('sizzle', job.p); }
      if (job.p >= 1) burn();
      draw();
    }
    job.raf = requestAnimationFrame(frame);
  }

  function burn() {
    job.waiting = true;
    root.classList.add('burnt');
    on('burnt', { attempt: job.attempt });
    job.timer = setTimeout(() => {
      if (!job) return;
      job.attempt++;
      job.ms *= SLOWER;
      job.p = 0;
      job.waiting = false;
      root.classList.remove('burnt');
      draw();
    }, BURNT_PAUSE);
  }

  function lift() {
    job.waiting = true;
    cancelAnimationFrame(job.raf);
    root.classList.add('lift');
    on('lift');
    const { done } = job;
    job.timer = setTimeout(() => { clear(); done(true); }, LIFT_MS);
  }

  function onTap() {
    if (!job || job.waiting) return;
    const p = job.p;
    if (p < READY[0]) {
      on('early');
      pan.classList.remove('nudge');
      void pan.offsetWidth;
      pan.classList.add('nudge');
    } else if (p <= READY[1]) {
      lift();
    } else {
      job.p = 1;
      draw();
      burn();
    }
  }
  pan.addEventListener('click', onTap);

  // Fry one dish. Resolves true once it is lifted out, false if cancelled.
  function run({ id, emoji }) {
    cancel();
    fillEmo(food, emoji, id);
    root.hidden = false;
    root.classList.remove('ready', 'smoky', 'burnt', 'lift');
    pan.classList.remove('nudge');
    return new Promise(done => {
      const now = performance.now();
      job = { p: 0, ms: COOK_MS, attempt: 1, last: now, sizzleAt: now, waiting: false, raf: 0, timer: 0, done };
      draw();
      on('start');
      try { pan.focus({ preventScroll: true }); } catch (e) { /* not critical */ }
      job.raf = requestAnimationFrame(frame);
    });
  }

  function clear() {
    if (!job) return;
    cancelAnimationFrame(job.raf);
    clearTimeout(job.timer);
    job = null;
    root.hidden = true;
    root.classList.remove('ready', 'smoky', 'burnt', 'lift');
  }

  function cancel() {
    if (!job) return;
    const { done } = job;
    clear();
    done(false);
  }

  return { run, cancel, active: () => !!job };
}
