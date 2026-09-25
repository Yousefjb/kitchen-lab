// Stirring: once the bowl is full, the child turns the spoon around it. Swirls of
// each ingredient's colour turn with the spoon and melt into the new dish's colour.
// main.js decides what is being mixed; this file only handles the gesture and the picture.
//
// Any circling counts, in either direction, and even a wobbly back-and-forth adds up.
// A plain tap on the bowl arrives in main.js as a click, which calls autoStir().
import { clamp, reducedMotion } from './util.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const GOAL = 2 * Math.PI * 2; // two full turns finish a stir
const DEAD = 12;              // px around the centre where the angle jumps about: ignored
const TAP = 8;                // px: a gesture shorter than this is a tap, not a stir
const MAX_STEP = 1.2;         // radians one pointer event can add (stops sudden jumps)
const AUTO_MS = 1100;
const R = 104;                // swirl radius, drawn in a circle then squashed onto the liquid
const deg = rad => rad * 180 / Math.PI;
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
const smooth = t => t * t * (3 - 2 * t);

export function createStirrer({ bowlWrap, center, onTick = () => {}, onGrab = () => {} }) {
  const svg = bowlWrap.querySelector('svg');
  const spoon = svg.querySelector('.spoon');
  const spin = svg.querySelector('.swirl-spin');
  const shine = svg.querySelector('.swirl-shine');
  const blend = svg.querySelector('.swirl-blend');

  let job = null;  // the stir in progress
  let ptr = null;  // the pointer doing the stirring
  let swallowClick = false;
  let moveTimer = 0;

  const progress = () => (job ? clamp(job.total / GOAL, 0, 1) : 0);

  // One arm of the swirl: a wedge from the centre to the rim that twists as it goes out.
  function armPath(a0, width, twist) {
    const N = 10;
    const at = (r, a) => `${(r * Math.cos(a)).toFixed(1)} ${(r * Math.sin(a)).toFixed(1)}`;
    const out = [], back = [];
    for (let k = 0; k <= N; k++) {
      out.push(at(R * k / N, a0 + twist * k / N));
      back.unshift(at(R * k / N, a0 + width + twist * k / N));
    }
    return `M${out.join(' L')} A${R} ${R} 0 0 1 ${back[0]} L${back.slice(1).join(' L')}Z`;
  }

  function draw() {
    if (!job) return;
    const p = progress();
    const step = Math.PI * 2 / job.arms.length;
    const twist = .8 + p * 4.5; // the swirl tightens the more you stir
    job.arms.forEach((a, i) => a.setAttribute('d', armPath(i * step, step, twist)));
    spin.setAttribute('transform', `rotate(${deg(job.angle).toFixed(1)})`);
    shine.setAttribute('transform', `rotate(${deg(job.angle * 1.6).toFixed(1)})`);
    blend.style.opacity = p < .2 ? 0 : smooth((p - .2) / .8).toFixed(3);
    // The spoon's bowl rides round the liquid; the handle leans with it.
    const c = Math.cos(job.angle), s = Math.sin(job.angle);
    spoon.style.transform = `translate(${(58 * c + 6).toFixed(1)}px, ${(12 * s - 12).toFixed(1)}px) rotate(${(-14 * c).toFixed(1)}deg)`;
  }

  function schedule() {
    if (job && !job.raf) job.raf = requestAnimationFrame(() => { if (job) { job.raf = 0; draw(); } });
  }

  // Add stirring; report every quarter turn and finish at the goal.
  function advance(amount) {
    job.total += amount;
    while (job.total >= (job.ticks + 1) * Math.PI / 2 && job.ticks < 8) {
      job.ticks++;
      onTick(progress());
    }
    bowlWrap.classList.add('stir-moving');
    clearTimeout(moveTimer);
    moveTimer = setTimeout(() => bowlWrap.classList.remove('stir-moving'), 220);
    if (job.total >= GOAL - 1e-6) finish();
    else schedule();
  }

  function start({ colors, target, onDone }) {
    cancel();
    const arms = [...colors, ...colors].map(color => {
      const a = document.createElementNS(SVG_NS, 'path');
      a.setAttribute('fill', color);
      return a;
    });
    spin.replaceChildren(...arms);
    blend.setAttribute('fill', target);
    job = { arms, target, onDone, total: 0, angle: -Math.PI / 2, ticks: 0, raf: 0, auto: 0 };
    bowlWrap.classList.add('stirring');
    draw();
  }

  function finish() {
    const { onDone, target } = job;
    cancelAnimationFrame(job.raf);
    cancelAnimationFrame(job.auto);
    job.total = GOAL;
    draw();
    ptr = null;
    onDone(target);
    clear();
  }

  function clear() {
    job = null;
    spin.replaceChildren();
    blend.style.opacity = 0;
    spoon.style.transform = '';
    clearTimeout(moveTimer);
    bowlWrap.classList.remove('stirring', 'stir-moving');
  }

  function cancel() {
    if (!job) return;
    cancelAnimationFrame(job.raf);
    cancelAnimationFrame(job.auto);
    ptr = null;
    clear();
  }

  // Stir by itself: for a tap, the keyboard, or reduced motion.
  function autoStir() {
    if (!job || job.auto) return;
    onGrab();
    const from = job.total, a0 = job.angle, t0 = performance.now();
    const dur = reducedMotion.matches ? 450 : Math.max(350, AUTO_MS * (1 - from / GOAL));
    const frame = now => {
      if (!job) return;
      const k = clamp((now - t0) / dur, 0, 1);
      const want = k === 1 ? GOAL : from + (GOAL - from) * smooth(k);
      job.angle = a0 + (want - from);
      job.auto = k < 1 ? requestAnimationFrame(frame) : 0;
      advance(Math.max(0, want - job.total));
    };
    job.auto = requestAnimationFrame(frame);
  }

  function angleAt(e) {
    const c = center();
    const dx = e.clientX - c.x, dy = e.clientY - c.y;
    return Math.hypot(dx, dy) < DEAD ? null : Math.atan2(dy, dx);
  }

  bowlWrap.addEventListener('pointerdown', e => {
    if (!job || job.auto || e.button > 0) return;
    ptr = { id: e.pointerId, sx: e.clientX, sy: e.clientY, moved: 0, last: null };
    try { bowlWrap.setPointerCapture(e.pointerId); } catch (err) { /* not critical */ }
    const a = angleAt(e);
    if (a != null) {
      job.angle += wrap(a - job.angle); // the spoon jumps to the finger
      ptr.last = a;
      schedule();
    }
    onGrab();
  });

  bowlWrap.addEventListener('pointermove', e => {
    if (!ptr || e.pointerId !== ptr.id || !job || job.auto) return;
    if (e.cancelable) e.preventDefault();
    ptr.moved = Math.max(ptr.moved, Math.hypot(e.clientX - ptr.sx, e.clientY - ptr.sy));
    const a = angleAt(e);
    if (a == null) return;
    if (ptr.last == null) { ptr.last = a; return; }
    const d = clamp(wrap(a - ptr.last), -MAX_STEP, MAX_STEP);
    ptr.last = a;
    job.angle += d;
    advance(Math.abs(d));
  }, { passive: false });

  const release = e => {
    if (!ptr || e.pointerId !== ptr.id) return;
    // A real stir must not also count as a tap on the bowl (the click that follows).
    if (ptr.moved >= TAP) {
      swallowClick = true;
      setTimeout(() => { swallowClick = false; }, 400);
    }
    ptr = null;
  };
  bowlWrap.addEventListener('pointerup', release);
  bowlWrap.addEventListener('pointercancel', release);
  bowlWrap.addEventListener('lostpointercapture', release);
  document.addEventListener('click', e => {
    if (swallowClick && bowlWrap.contains(e.target)) {
      swallowClick = false;
      e.stopImmediatePropagation();
    }
  }, true);

  return { start, cancel, autoStir, progress, active: () => !!job };
}
