// Small helpers shared by the game modules.
export const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Twemoji Mozilla",sans-serif';

export const $ = (s, r = document) => r.querySelector(s);
export const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};
// Sticker pictures made by tools/make-images.mjs live in img/<art>.webp.
// If a picture is missing or fails to load, the emoji shows instead.
export function fillEmo(node, emoji, art) {
  node.replaceChildren();
  if (!art) { node.textContent = emoji; return node; }
  const img = new Image();
  img.className = 'art';
  img.alt = '';
  img.draggable = false;
  img.decoding = 'async';
  img.onerror = () => { node.textContent = emoji; };
  img.src = `img/${art}.webp`;
  node.appendChild(img);
  return node;
}
export const wait = ms => new Promise(r => setTimeout(r, ms));
export const rnd = (a, b) => a + Math.random() * (b - a);
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const pick = arr => arr[(Math.random() * arr.length) | 0];
export const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
export const landscapeMQ = matchMedia('(orientation: landscape) and (min-width: 560px)');
const NUMBER = new Intl.NumberFormat('ar-EG');
export const num = n => NUMBER.format(n);
// "for X" in Arabic: ل + name, merging the article (ل + الجدة = للجدة).
export const forName = n => (n.startsWith('ال') ? 'ل' + n.slice(1) : 'ل' + n);

export function anim(node, frames, opts) {
  return new Promise(resolve => {
    const total = (opts.duration || 300) * (opts.iterations || 1) + (opts.delay || 0);
    try {
      if (node.animate) {
        const a = node.animate(frames, opts);
        a.onfinish = resolve;
        a.oncancel = resolve;
        setTimeout(resolve, total + 150); // safety net
        return;
      }
    } catch (e) { /* fall through */ }
    setTimeout(resolve, 0);
  });
}

export function mixColors(hexes) {
  if (!hexes.length) return null;
  let r = 0, g = 0, b = 0;
  for (const h of hexes) {
    const n = parseInt(h.slice(1), 16);
    r += (n >> 16) & 255; g += (n >> 8) & 255; b += n & 255;
  }
  const k = hexes.length;
  return `rgb(${Math.round(r / k)},${Math.round(g / k)},${Math.round(b / k)})`;
}

// Swap emoji that this device cannot render for the item's `alt` emoji.
export function applyEmojiFallbacks(items) {
  let ctx;
  try {
    const c = document.createElement('canvas');
    c.width = c.height = 24;
    ctx = c.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
  } catch (e) { return; }
  const render = ch => {
    ctx.clearRect(0, 0, 24, 24);
    ctx.textBaseline = 'top';
    ctx.font = '20px ' + EMOJI_FONT;
    ctx.fillText(ch, 0, 0);
    return ctx.getImageData(0, 0, 24, 24).data;
  };
  try {
    const tofu = render('\u{10FFFD}');
    for (const it of Object.values(items)) {
      if (!it.alt) continue;
      const d = render(it.emoji);
      let diff = 0;
      for (let i = 3; i < d.length; i += 4) if (d[i] !== tofu[i]) diff++;
      if (diff <= 10) it.emoji = it.alt;
    }
  } catch (e) { /* canvas read blocked — keep originals */ }
}
