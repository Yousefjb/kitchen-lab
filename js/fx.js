// Canvas particles: sparkles, splats, puffs and confetti.
import { $, rnd, reducedMotion, EMOJI_FONT } from './util.js';

export const FX = (() => {
  const cv = $('#fx');
  const cx = cv.getContext('2d');
  let W = 0, H = 0, parts = [], raf = 0, last = 0;
  const COLORS = ['#ffcf3f', '#ff6f9c', '#7cc4ff', '#5cc9a0', '#b8a4ff', '#ffffff', '#ffb44c'];
  const amount = n => Math.round(n * (reducedMotion.matches ? .3 : 1));
  const pick = arr => arr[(Math.random() * arr.length) | 0];

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    cv.style.width = W + 'px';
    cv.style.height = H + 'px';
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function spawn(p) {
    p.max = p.life;
    parts.push(Object.assign({ vx: 0, vy: 0, g: 0, drag: .98, size: 6, rot: 0, vr: 0, grow: 0, color: '#fff', type: 'dot' }, p));
    if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); }
  }

  function ring(n, fn) {
    n = amount(n);
    for (let i = 0; i < n; i++) fn(rnd(0, Math.PI * 2), i);
  }

  function star(x, y, r, rot) {
    cx.beginPath();
    for (let i = 0; i < 10; i++) {
      const rr = i % 2 ? r * .45 : r;
      const a = rot + i * Math.PI / 5;
      cx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    cx.closePath();
    cx.fill();
  }

  function draw(p) {
    const k = p.life / p.max;
    cx.globalAlpha = p.type === 'confetti' ? Math.min(1, k * 3) : p.type === 'smoke' ? .4 * k : Math.min(1, k * 1.6);
    cx.fillStyle = p.color;
    switch (p.type) {
      case 'star':
        star(p.x, p.y, p.size * (.7 + .3 * Math.sin(p.rot * 3)), p.rot);
        break;
      case 'goop': {
        const sp = Math.hypot(p.vx, p.vy);
        cx.save();
        cx.translate(p.x, p.y);
        cx.rotate(Math.atan2(p.vy, p.vx));
        cx.beginPath();
        cx.ellipse(0, 0, p.size * (1 + Math.min(1.2, sp / 700)), p.size, 0, 0, Math.PI * 2);
        cx.fill();
        cx.restore();
        break;
      }
      case 'confetti':
        cx.save();
        cx.translate(p.x, p.y);
        cx.rotate(p.rot);
        cx.scale(Math.cos(p.rot * 2), 1);
        cx.fillRect(-p.size / 2, -p.size * .8, p.size, p.size * 1.6);
        cx.restore();
        break;
      case 'emoji':
        cx.save();
        cx.translate(p.x, p.y);
        cx.rotate(p.rot);
        cx.font = `${p.size}px ${EMOJI_FONT}`;
        cx.textAlign = 'center';
        cx.textBaseline = 'middle';
        cx.fillText(p.ch, 0, 0);
        cx.restore();
        break;
      default: // dot & smoke
        cx.beginPath();
        cx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        cx.fill();
        if (p.type === 'dot') {
          cx.globalAlpha *= .3;
          cx.beginPath();
          cx.arc(p.x, p.y, p.size * 2.2, 0, Math.PI * 2);
          cx.fill();
        }
    }
  }

  function tick(now) {
    const dt = Math.min(.05, (now - last) / 1000);
    last = now;
    cx.clearRect(0, 0, W, H);
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life -= dt;
      if (p.life <= 0 || p.y > H + 60) { parts.splice(i, 1); continue; }
      const f = Math.pow(p.drag, dt * 60);
      p.vx *= f;
      p.vy = p.vy * f + p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      p.size += p.grow * dt;
      draw(p);
    }
    cx.globalAlpha = 1;
    raf = parts.length ? requestAnimationFrame(tick) : 0;
    if (!raf) cx.clearRect(0, 0, W, H);
  }

  return {
    resize,
    sparkle(x, y, emoji) {
      ring(36, a => {
        const s = rnd(160, 540);
        spawn({ type: Math.random() < .6 ? 'star' : 'dot', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 140, g: 440, drag: .95, life: rnd(.7, 1.3), size: rnd(4, 11), color: pick(COLORS), rot: rnd(0, 6), vr: rnd(-8, 8) });
      });
      if (emoji) ring(7, a => {
        const s = rnd(200, 380);
        spawn({ type: 'emoji', ch: emoji, x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 220, g: 620, drag: .97, life: rnd(.9, 1.4), size: rnd(18, 28), rot: rnd(-1, 1), vr: rnd(-4, 4) });
      });
    },
    splat(x, y, color) {
      ring(30, a => {
        const s = rnd(140, 460);
        spawn({ type: 'goop', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 280, g: 950, drag: .97, life: rnd(.8, 1.4), size: rnd(5, 12), color: Math.random() < .55 ? color : pick(['#9fd67f', '#7fb85e', '#c7e6a8']) });
      });
      ring(8, () => spawn({ type: 'smoke', x: x + rnd(-30, 30), y, vx: rnd(-40, 40), vy: rnd(-90, -30), g: -20, drag: .97, life: rnd(.9, 1.4), size: rnd(10, 18), grow: 34, color: '#a8998c' }));
    },
    puff(x, y, color = '#bba99a') {
      ring(12, a => spawn({ type: 'smoke', x: x + Math.cos(a) * 30, y: y + Math.sin(a) * 10, vx: Math.cos(a) * rnd(20, 70), vy: rnd(-80, -20), g: -20, drag: .97, life: rnd(.8, 1.3), size: rnd(10, 18), grow: 38, color }));
    },
    // Bits of food flying off a big bite.
    crumbs(x, y, color = '#d9a06b') {
      ring(10, a => {
        const s = rnd(80, 240);
        spawn({ type: 'dot', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 160, g: 900, drag: .97, life: rnd(.5, .9), size: rnd(3, 6), color: Math.random() < .6 ? color : '#f3d9a4' });
      });
    },
    mini(x, y) {
      ring(14, a => {
        const s = rnd(90, 260);
        spawn({ type: Math.random() < .5 ? 'star' : 'dot', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 60, g: 300, drag: .94, life: rnd(.4, .8), size: rnd(3, 7), color: pick(COLORS), rot: rnd(0, 6), vr: rnd(-6, 6) });
      });
    },
    confetti() {
      const n = amount(170);
      for (let i = 0; i < n; i++) {
        spawn({ type: 'confetti', x: rnd(0, W), y: rnd(-H * .4, -10), vx: rnd(-70, 70), vy: rnd(60, 240), g: 260, drag: .99, life: rnd(2.6, 4.2), size: rnd(6, 11), color: pick(COLORS.slice(0, 5)), rot: rnd(0, 6), vr: rnd(-9, 9) });
      }
    },
  };
})();
