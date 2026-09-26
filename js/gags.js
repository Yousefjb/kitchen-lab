// The silly stuff: customers eating (and burping), tickling the mascot and the
// customers, flour on the screen, the pot lid that lands on the mascot's head,
// soot after a burn, and the rare surprises (a dish that runs away,
// a cat thief, a parade of chicks). The words live in data/phrases.js and
// data/customers.js; main.js decides when each gag happens.
import { el, fillEmo, wait, rnd, pick, reducedMotion, anim } from './util.js';
import { Sound } from './sound.js';
import { FX } from './fx.js';
import { GAG_LINES } from '../data/phrases.js';
import { castKey, stripTags } from './voice-lines.js';

const center = r => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
// Every one-shot animation class (css/game.css names each keyframe after its class).
export const ONE_SHOT = ['squish', 'giggle', 'sneeze', 'giggle-hard', 'hic', 'puff-up', 'burp', 'toot-hop', 'roll', 'cough', 'spit',
  'chomp', 'toot-jump', 'sway', 'roar', 'doze', 'backflip', 'twirl', 'land', 'bulge', 'poke1', 'poke2', 'poke3', 'poke4', 'yuck', 'jump', 'windy'];
const T = (x, y, s = 1, r = 0) => `translate(${x}px, ${y}px) scale(${s}) rotate(${r}deg)`;

// ctx (from main.js):
//   station, bowlWrap, bowlSvg, orderCust, layer   DOM
//   speak(parts, { by, fx, interrupt })              narration (by: 'mascot' | 'customer' | an element)
//   setFace(face, ms), setCaption(text, warn, ms), bowlCenter()
//   dishFrom()                                       where an order's dish flies from ({ x, y })
//   toots()                                          grown-ups allow toot jokes
export function createGags(ctx) {
  const { station, bowlWrap, bowlSvg, orderCust, layer } = ctx;
  const calm = () => reducedMotion.matches;

  // A toot, unless the grown-ups switched them off: then a burp.
  const gas = (toot = 'toot', burp = 'burp') => (ctx.toots() ? toot : burp);

  // Restart a CSS animation class; it comes off again when that animation ends
  // (keyframes share the class name), or after ms. Any other one-shot animation on
  // the same element stops first, so they never block each other.
  function kick(node, cls, ms) {
    node.classList.remove(cls, ...ONE_SHOT);
    void node.getBoundingClientRect();
    node.classList.add(cls);
    if (ms) setTimeout(() => node.classList.remove(cls), ms);
    else {
      const off = e => {
        if (e.target !== node || e.animationName !== cls) return;
        node.classList.remove(cls);
        node.removeEventListener('animationend', off);
      };
      node.addEventListener('animationend', off);
    }
  }

  // A big comic word that pops up and floats away ("بُرررب!", "هِك!", "💨").
  function word(text, x, y, { size = 34, tilt = rnd(-12, 12), cls = '' } = {}) {
    const w = el('div', 'pop-word ' + cls, text);
    w.style.left = x + 'px';
    w.style.top = y + 'px';
    w.style.setProperty('--tilt', tilt + 'deg');
    w.style.fontSize = size + 'px';
    layer.appendChild(w);
    setTimeout(() => w.remove(), 1300);
  }

  const shake = (hard = false) => { if (!calm()) kick(document.body, hard ? 'shake-hard' : 'shake-soft', 600); };

  // Stars circling a head (after a bonk or a big tickle).
  function stars(rect, ms = 2200) {
    if (calm()) return;
    const o = el('div', 'orbit');
    o.style.left = rect.left + rect.width / 2 + 'px';
    o.style.top = rect.top + rect.height * .08 + 'px';
    o.style.setProperty('--w', Math.max(60, rect.width * .7) + 'px');
    for (let i = 0; i < 3; i++) o.appendChild(el('span', 'emo', '⭐'));
    layer.appendChild(o);
    setTimeout(() => { o.classList.add('out'); setTimeout(() => o.remove(), 400); }, ms);
  }

  // Each customer's trick, also used as the fourth tickle.
  const TRICK_SOUND = {
    burp: () => Sound.silly('burpBig'),
    hiccup: () => [0, .45, .9].forEach(t => Sound.silly('hiccup', { t })),
    toot: () => Sound.silly(gas('tootTiny', 'burp')), // a polite little one
    purr: () => Sound.silly('purr'),
    roar: () => Sound.silly('roar'),
    snore: () => Sound.silly('snore'),
    slurp: () => Sound.silly('slurp'),
    flip: () => Sound.silly('monkey'),
    love: () => Sound.silly('kiss'),
    rocket: () => Sound.silly(gas('tootLong', 'burpBig')),
  };
  const TRICK_WORD = {
    burp: 'بُرررب!', hiccup: 'هِك!', toot: () => (ctx.toots() ? '💨' : 'بُرب!'), purr: 'خرررر 💖', roar: 'رااااه!',
    snore: 'Zzz', slurp: 'سلُرب!', flip: 'أووو آآآ!', love: '💖💖💖', rocket: () => (ctx.toots() ? '💨💨💨' : 'بُرررب!'),
  };
  const trickWord = t => (typeof TRICK_WORD[t] === 'function' ? TRICK_WORD[t]() : TRICK_WORD[t]);

  /* ---------------------------------------------------------------
     1. A customer eats their order, then does their trick.
     --------------------------------------------------------------- */
  async function feast(c, dish) {
    const st = station.getBoundingClientRect();
    const from = orderCust.getBoundingClientRect();
    const size = Math.min(st.height * .5, st.width * .45, 230);
    const home = { x: st.left + st.width / 2 - size / 2, y: st.top + st.height * .42 - size / 2 };
    const stage = el('div', 'feast');
    // who moves around the screen; body does the tricks (so the two never fight).
    const who = el('div', 'feast-who');
    const body = fillEmo(el('div', 'feast-body emo'), c.emoji, c.art);
    who.appendChild(body);
    who.style.width = who.style.height = size + 'px';
    body.style.fontSize = size * .8 + 'px';
    const plate = fillEmo(el('div', 'feast-dish emo'), dish.emoji, dish.id);
    const ds = size * .34;
    plate.style.width = plate.style.height = ds + 'px';
    plate.style.fontSize = ds * .85 + 'px';
    stage.style.setProperty('--cx', home.x + size / 2 + 'px');
    stage.style.setProperty('--cy', home.y + size / 2 + 'px');
    stage.style.setProperty('--r', size * .95 + 'px');
    stage.append(who, plate);
    layer.appendChild(stage);
    orderCust.classList.add('away');

    const s0 = from.width / size;
    const mouth = { x: home.x + size / 2 - ds / 2, y: home.y + size * .74 - ds / 2 };
    who.style.transform = T(home.x, home.y);
    await anim(who, [
      { transform: T(from.left, from.top, s0) },
      { transform: T(home.x, home.y - 20, 1.08), offset: .7 },
      { transform: T(home.x, home.y) },
    ], { duration: calm() ? 150 : 520, easing: 'cubic-bezier(.34,1.3,.64,1)', fill: 'forwards' });

    // The dish arrives from where the order bubble shows it.
    const src = ctx.dishFrom();
    const p0 = { x: src.x - ds / 2, y: src.y - ds / 2 };
    plate.style.transform = T(mouth.x, mouth.y);
    if (c.eat === 'flip') {
      // The monkey throws it up in the air and catches it in its mouth.
      await anim(plate, [{ transform: T(p0.x, p0.y, .6) }, { transform: T(mouth.x, mouth.y + 10, 1) }], { duration: 380, fill: 'forwards' });
      Sound.silly('whistleUp');
      await anim(plate, [
        { transform: T(mouth.x, mouth.y + 10, 1, 0) },
        { transform: T(mouth.x, mouth.y - size * 1.1, 1, 360), offset: .5 },
        { transform: T(mouth.x, mouth.y, .3, 720) },
      ], { duration: calm() ? 200 : 1100, easing: 'ease-in-out', fill: 'forwards' });
      plate.remove();
      Sound.silly('gulp');
    } else if (c.eat === 'slurp') {
      // The frog's tongue shoots out and pulls the dish in.
      const far = { x: mouth.x + size * .55, y: mouth.y + size * .2 };
      await anim(plate, [{ transform: T(p0.x, p0.y, .6) }, { transform: T(far.x, far.y, 1) }], { duration: 380, fill: 'forwards' });
      const tongue = el('i', 'tongue');
      tongue.style.left = home.x + size / 2 + 'px';
      tongue.style.top = home.y + size * .74 + 'px';
      tongue.style.setProperty('--len', size * .55 + ds / 2 + 'px');
      layer.appendChild(tongue);
      Sound.silly('slurp');
      await wait(260);
      await anim(plate, [{ transform: T(far.x, far.y, 1) }, { transform: T(mouth.x, mouth.y, .2) }], { duration: 300, easing: 'ease-in', fill: 'forwards' });
      tongue.remove();
      plate.remove();
      kick(body, 'bulge', 700);
    } else {
      await anim(plate, [{ transform: T(p0.x, p0.y, .6) }, { transform: T(mouth.x, mouth.y, 1) }], { duration: calm() ? 150 : 420, easing: 'cubic-bezier(.45,0,.2,1)', fill: 'forwards' });
      // Three big bites; the dish gets smaller each time.
      Sound.silly(c.eat === 'hiccup' ? 'nibble' : 'chomp');
      kick(body, 'chomp');
      const m = center(plate.getBoundingClientRect());
      for (let i = 1; i <= 3; i++) {
        await wait(220);
        plate.style.transform = T(mouth.x, mouth.y, 1 - i / 3);
        FX.crumbs(m.x, m.y, dish.color);
      }
      plate.remove();
      Sound.silly('gulp');
    }

    // The trick.
    const face = () => center(who.getBoundingClientRect());
    const f = face();
    const top = { x: f.x, y: home.y + size * .1 };
    switch (c.eat) {
      case 'burp':
        kick(body, 'puff-up');
        await wait(calm() ? 100 : 650);
        TRICK_SOUND.burp();
        kick(body, 'burp');
        shake(true);
        word(trickWord('burp'), top.x, top.y, { size: 46 });
        FX.puff(f.x, f.y + size * .15, '#fff6d8');
        break;
      case 'hiccup':
        for (let i = 0; i < 3; i++) {
          Sound.silly('hiccup');
          kick(body, 'hic');
          word('هِك!', top.x + rnd(-40, 40), top.y, { size: 30 });
          await wait(calm() ? 150 : 480);
        }
        break;
      case 'toot':
        await wait(250);
        TRICK_SOUND.toot();
        kick(body, ctx.toots() ? 'toot-jump' : 'burp');
        word(trickWord('toot'), f.x + size * .35, f.y + size * .35, { size: 40 });
        if (ctx.toots()) FX.puff(f.x + size * .2, f.y + size * .45, '#d9ecb8');
        await wait(350);
        body.classList.add('blush');
        break;
      case 'purr':
        TRICK_SOUND.purr();
        kick(body, 'sway');
        FX.sparkle(f.x, top.y, '💖');
        word(trickWord('purr'), top.x, top.y, { size: 30 });
        break;
      case 'roar':
        kick(body, 'roar');
        await wait(200);
        TRICK_SOUND.roar();
        shake(true);
        word(trickWord('roar'), top.x, top.y, { size: 50 });
        kick(station, 'windy', 900);
        break;
      case 'snore':
        kick(body, 'doze', 10000); // stays asleep
        await wait(calm() ? 100 : 700);
        TRICK_SOUND.snore();
        word('Z', f.x + size * .3, top.y + 10, { size: 26, cls: 'zzz' });
        setTimeout(() => word('Z', f.x + size * .4, top.y - 10, { size: 34, cls: 'zzz' }), 400);
        setTimeout(() => word('Z', f.x + size * .5, top.y - 30, { size: 42, cls: 'zzz' }), 800);
        break;
      case 'slurp':
        word(trickWord('slurp'), top.x, top.y, { size: 38 });
        break;
      case 'flip':
        TRICK_SOUND.flip();
        kick(body, 'backflip');
        word(trickWord('flip'), top.x, top.y, { size: 34 });
        break;
      case 'love':
        TRICK_SOUND.love();
        kick(body, 'twirl');
        FX.sparkle(f.x, f.y, '💖');
        word('💖', top.x, top.y, { size: 50 });
        break;
      case 'rocket': {
        kick(body, 'puff-up');
        await wait(calm() ? 100 : 600);
        TRICK_SOUND.rocket();
        word(trickWord('rocket'), f.x, f.y + size * .45, { size: 42 });
        if (!calm()) {
          const trail = setInterval(() => { const p = face(); FX.puff(p.x, p.y + size * .4, ctx.toots() ? '#d9ecb8' : '#fff6d8'); }, 120);
          await anim(who, [
            { transform: T(home.x, home.y) },
            { transform: T(home.x, home.y - st.height * 1.1, 1, 20) },
          ], { duration: 900, easing: 'cubic-bezier(.5,0,.8,.4)', fill: 'forwards' });
          clearInterval(trail);
          Sound.silly('whistleDown');
          await anim(who, [
            { transform: T(home.x, home.y - st.height * 1.1, 1, -10) },
            { transform: T(home.x, home.y, 1, 0) },
          ], { duration: 800, easing: 'cubic-bezier(.3,.1,.7,1)', fill: 'forwards' });
          Sound.silly('boingBig');
          kick(body, 'land');
        }
        break;
      }
    }
    ctx.speak(castKey(c.art, c.lines.yum), { by: who, interrupt: false });
    await wait(calm() ? 900 : 2300);

    // Back to the order bar.
    const back = orderCust.getBoundingClientRect();
    await anim(who, [
      { transform: getComputedStyle(who).transform === 'none' ? T(home.x, home.y) : getComputedStyle(who).transform },
      { transform: T(back.left, back.top, back.width / size) },
    ], { duration: calm() ? 120 : 420, easing: 'ease-in', fill: 'forwards' });
    stage.classList.add('out');
    await wait(200);
    stage.remove();
    orderCust.classList.remove('away');
  }

  /* ---------------------------------------------------------------
     The customer sees a mishap: goes green, smoke from the ears.
     --------------------------------------------------------------- */
  function yuck(c) {
    kick(orderCust, 'yuck', 1800);
    Sound.silly('wahwah');
    const r = orderCust.getBoundingClientRect();
    setTimeout(() => {
      FX.puff(r.left + 4, r.top + 6, '#8f8f8f');
      FX.puff(r.right - 4, r.top + 6, '#8f8f8f');
    }, 250);
    word('إيييع!', r.left + r.width / 2, r.top, { size: 26 });
    ctx.speak(castKey(c.art, c.lines.yuck), { by: 'customer', interrupt: false });
  }

  /* ---------------------------------------------------------------
     2. Tickling: tap a customer, or tap the mascot quickly again and again.
     --------------------------------------------------------------- */
  let custPokes = { n: 0, at: 0 };
  function pokeCustomer(c) {
    if (!c || orderCust.classList.contains('away')) return;
    const now = Date.now();
    custPokes = now - custPokes.at < 2600 ? { n: custPokes.n + 1, at: now } : { n: 1, at: now };
    const n = custPokes.n;
    const r = orderCust.getBoundingClientRect();
    if (n <= 3) {
      Sound.silly(n === 1 ? 'squeak' : 'boingBig', { rate: 1 + n * .1 });
      kick(orderCust, 'poke' + n);
      ctx.speak(castKey(c.art, c.lines.poke[n - 1]), { by: 'customer' });
    } else {
      custPokes = { n: 0, at: 0 };
      TRICK_SOUND[c.eat]();
      kick(orderCust, 'poke4');
      word(trickWord(c.eat), r.left + r.width / 2, r.top, { size: 32 });
      if (c.eat === 'toot' || c.eat === 'rocket') {
        if (ctx.toots()) FX.puff(r.left + r.width / 2, r.bottom, '#d9ecb8');
      }
    }
  }

  let tickles = { n: 0, at: 0 };
  // The mascot was tapped. True when it's a tickle (a quick tap after a tap), so no hint.
  function tickle() {
    const now = Date.now();
    const quick = now - tickles.at < 900;
    tickles = { n: quick ? tickles.n + 1 : 0, at: now };
    if (!quick) return false;
    const lines = GAG_LINES.tickle;
    const lvl = Math.min(tickles.n, lines.length) - 1;
    const c = ctx.bowlCenter();
    const r = bowlWrap.getBoundingClientRect();
    if (lvl <= 2) {
      Sound.giggle();
      ctx.setFace('happy', 1500);
      kick(bowlSvg, lvl === 2 ? 'giggle-hard' : 'giggle');
      FX.mini(c.x, c.y);
      if (lvl === 2) word('هههههه!', c.x, r.top, { size: 34 });
    } else if (lvl === 3) {
      // Laughed so hard it slipped out.
      Sound.silly(gas('toot', 'burp'));
      ctx.setFace('wow', 1400);
      kick(bowlSvg, 'toot-hop');
      word(ctx.toots() ? '💨' : 'بُرب!', c.x + r.width * .3, r.bottom - r.height * .2, { size: 44 });
      if (ctx.toots()) FX.puff(c.x, r.bottom - r.height * .1, '#d9ecb8');
      setTimeout(() => bowlWrap.classList.add('blush'), 300);
      setTimeout(() => bowlWrap.classList.remove('blush'), 2600);
    } else {
      Sound.silly('boingBig');
      ctx.setFace('dizzy', 2200);
      kick(bowlSvg, 'roll');
      stars(r);
      tickles = { n: 0, at: 0 };
    }
    ctx.setCaption(stripTags(lines[lvl]), false, 2500);
    ctx.speak(lines[lvl], { fx: lvl === 4 ? 'wobbly' : null });
    return true;
  }

  /* ---------------------------------------------------------------
     3. The bowl's silly reactions to a mix that makes nothing.
     --------------------------------------------------------------- */
  async function hiccups() {
    const c = ctx.bowlCenter();
    const r = bowlWrap.getBoundingClientRect();
    ctx.setFace('wow');
    for (let i = 0; i < 4; i++) {
      Sound.silly('hiccup');
      kick(bowlSvg, 'hic');
      word('هِك!', c.x + rnd(-r.width * .3, r.width * .3), r.top + 10, { size: 30 });
      await wait(calm() ? 150 : 520);
    }
    ctx.setFace('meh', 1200);
  }

  async function burp() {
    const c = ctx.bowlCenter();
    const r = bowlWrap.getBoundingClientRect();
    ctx.setFace('wow');
    kick(bowlSvg, 'puff-up');
    await wait(calm() ? 100 : 600);
    Sound.silly('burpBig');
    kick(bowlSvg, 'burp');
    shake(true);
    word('بُرررب!', c.x, r.top, { size: 48 });
    FX.puff(c.x, c.y, '#fff6d8');
    ctx.setFace('happy', 1600);
  }

  async function toot() {
    const c = ctx.bowlCenter();
    const r = bowlWrap.getBoundingClientRect();
    ctx.setFace('wow');
    await wait(200);
    Sound.silly('toot');
    kick(bowlSvg, 'toot-hop');
    word('💨', c.x + r.width * .32, r.bottom - r.height * .2, { size: 48 });
    FX.puff(c.x, r.bottom - r.height * .1, '#d9ecb8');
    bowlWrap.classList.add('blush');
    setTimeout(() => { bowlWrap.classList.remove('blush'); ctx.setFace('happy', 1000); }, 2200);
  }

  // Flour all over the screen: the child wipes it away with a finger.
  function flour() {
    return new Promise(resolve => {
      if (calm()) { resolve(); return; }
      const cv = el('canvas', 'flour');
      const W = window.innerWidth, H = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = Math.round(W * dpr);
      cv.height = Math.round(H * dpr);
      const g = cv.getContext('2d');
      g.scale(dpr, dpr);
      g.fillStyle = 'rgba(252, 247, 238, .94)';
      g.fillRect(0, 0, W, H);
      // Soft drifts of flour, then fine dust.
      for (let i = 0; i < 40; i++) {
        const x = rnd(0, W), y = rnd(0, H), r = rnd(60, 180);
        const grad = g.createRadialGradient(x, y, 0, x, y, r);
        const tint = pick(['255,255,255', '238,228,212']);
        grad.addColorStop(0, `rgba(${tint},.7)`);
        grad.addColorStop(1, `rgba(${tint},0)`);
        g.fillStyle = grad;
        g.fillRect(x - r, y - r, r * 2, r * 2);
      }
      for (let i = 0; i < 1400; i++) {
        g.fillStyle = pick(['rgba(214,198,176,.55)', 'rgba(255,255,255,.9)', 'rgba(230,218,200,.7)']);
        g.fillRect(rnd(0, W), rnd(0, H), rnd(1, 3.5), rnd(1, 3.5));
      }
      g.font = `${Math.min(W, H) * .16}px ${getComputedStyle(document.body).getPropertyValue('--emoji') || 'sans-serif'}`;
      g.textAlign = 'center';
      g.globalAlpha = .5;
      g.fillText('👆', W / 2, H / 2);
      g.globalAlpha = 1;
      document.body.appendChild(cv);
      const COLS = 8, ROWS = 6;
      const clean = new Set();
      const brush = Math.max(46, Math.min(W, H) * .09);
      let last = null, sfxAt = 0, done = false;
      const wipe = (x, y) => {
        g.globalCompositeOperation = 'destination-out';
        g.lineCap = 'round';
        g.lineWidth = brush * 2;
        g.beginPath();
        g.moveTo(last ? last.x : x, last ? last.y : y);
        g.lineTo(x, y);
        g.stroke();
        last = { x, y };
        for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
          const cx = Math.floor((x + dx * brush * .7) / W * COLS), cy = Math.floor((y + dy * brush * .7) / H * ROWS);
          if (cx >= 0 && cy >= 0 && cx < COLS && cy < ROWS) clean.add(cx + ',' + cy);
        }
        const now = performance.now();
        if (now - sfxAt > 220) { sfxAt = now; Sound.silly('wipe'); }
        if (clean.size >= COLS * ROWS * .7) finish(true);
      };
      const finish = wiped => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        cv.classList.add('out');
        setTimeout(() => cv.remove(), 500);
        if (wiped) {
          Sound.silly('squeak');
          ctx.speak(GAG_LINES.flourDone);
          ctx.setFace('happy', 1500);
        }
        resolve();
      };
      cv.addEventListener('pointerdown', e => { last = null; wipe(e.clientX, e.clientY); try { cv.setPointerCapture(e.pointerId); } catch (err) { /* ok */ } });
      cv.addEventListener('pointermove', e => { if (e.buttons || e.pointerType === 'touch') wipe(e.clientX, e.clientY); });
      cv.addEventListener('pointerup', () => { last = null; });
      const timer = setTimeout(() => finish(false), 12000);
    });
  }

  async function sneeze() {
    const c = ctx.bowlCenter();
    ctx.setFace('wow');
    Sound.silly('sneezeBig');
    kick(bowlSvg, 'sneeze');
    await wait(calm() ? 100 : 640);
    shake(true);
    FX.puff(c.x, c.y, '#fffaf0');
    ctx.setFace('meh', 1400);
    await flour();
  }

  /* ---------------------------------------------------------------
     4. Cooking went too far.
     --------------------------------------------------------------- */
  // Burnt: smoke fills the kitchen, the alarm beeps, the mascot is covered in soot.
  function soot() {
    Sound.silly('alarm', { t: .35 });
    Sound.silly('alarm', { t: 1.3 });
    if (!calm()) {
      const smog = el('div', 'smog');
      document.body.appendChild(smog);
      setTimeout(() => smog.remove(), 3200);
      for (let i = 0; i < 6; i++) setTimeout(() => FX.puff(rnd(0, window.innerWidth), rnd(window.innerHeight * .2, window.innerHeight * .8), '#6e625a'), i * 180);
    }
    station.classList.add('mascot-show');
    bowlWrap.classList.add('sooty');
    kick(bowlSvg, 'cough', 1400);
    ctx.setFace('wow');
    setTimeout(() => { ctx.setFace('meh', 1400); FX.puff(ctx.bowlCenter().x, ctx.bowlCenter().y, '#4a4440'); }, 900);
    setTimeout(() => station.classList.remove('mascot-show'), 2800);
    setTimeout(() => bowlWrap.classList.remove('sooty'), 9000);
  }

  // Boiled over: the lid shoots up like a rocket… and comes down on the mascot's head.
  async function lidBonk(potRect) {
    station.classList.add('mascot-show');
    const lid = el('div', 'lid');
    lid.innerHTML = '<svg viewBox="0 0 120 50" aria-hidden="true"><ellipse cx="60" cy="36" rx="56" ry="13" fill="#d9534a"/><ellipse cx="60" cy="31" rx="56" ry="13" fill="#ff8f80"/><rect x="48" y="8" width="24" height="16" rx="7" fill="#7a2b2b"/><ellipse cx="42" cy="28" rx="18" ry="4" fill="#fff" opacity=".35"/></svg>';
    const w = Math.max(70, potRect.width * .45);
    lid.style.width = w + 'px';
    layer.appendChild(lid);
    const x0 = potRect.left + potRect.width / 2 - w / 2, y0 = potRect.top + potRect.height * .2;
    lid.style.transform = T(x0, y0);
    Sound.silly('whistleUp');
    await anim(lid, [{ transform: T(x0, y0, 1, 0) }, { transform: T(x0, -w * 1.5, 1, 540) }], { duration: calm() ? 150 : 650, easing: 'cubic-bezier(.2,.6,.4,1)', fill: 'forwards' });
    await wait(calm() ? 50 : 350);
    const head = bowlWrap.getBoundingClientRect();
    const x1 = head.left + head.width / 2 - w / 2, y1 = head.top + head.height * .05;
    Sound.silly('whistleDown');
    await anim(lid, [{ transform: T(x1, -w * 1.5, 1, -30) }, { transform: T(x1, y1, 1, 0) }], { duration: calm() ? 150 : 850, easing: 'cubic-bezier(.5,0,.9,.6)', fill: 'forwards' });
    Sound.silly('bonk');
    kick(bowlSvg, 'squish');
    ctx.setFace('dizzy', 2400);
    FX.mini(x1 + w / 2, y1);
    stars(bowlWrap.getBoundingClientRect(), 2400);
    await anim(lid, [{ transform: T(x1, y1, 1, 0), opacity: 1 }, { transform: T(x1 + w * 1.5, y1 + head.height, 1, 120), opacity: 0 }], { duration: 700, easing: 'ease-in', fill: 'forwards' });
    lid.remove();
    setTimeout(() => station.classList.remove('mascot-show'), 900);
  }

  /* ---------------------------------------------------------------
     5. Rare surprises.
     --------------------------------------------------------------- */
  const stRect = () => station.getBoundingClientRect();

  // The dish grows legs and runs around; tap it to catch it.
  function runaway(dish, from) {
    return new Promise(resolve => {
      const r = stRect();
      const size = Math.min(96, r.width * .22);
      const run = el('button', 'runner tap');
      run.setAttribute('aria-label', 'أمسك الطبق!');
      run.append(fillEmo(el('span', 'emo'), dish.emoji, dish.id), el('i', 'leg'), el('i', 'leg'));
      run.style.width = run.style.height = size + 'px';
      run.style.fontSize = size * .8 + 'px';
      layer.appendChild(run);
      const pts = [{ x: from.x - size / 2, y: from.y - size / 2 }];
      for (let i = 0; i < 5; i++) pts.push({ x: rnd(r.left, r.right - size), y: rnd(r.top + r.height * .25, r.bottom - size) });
      pts.push({ x: pts[pts.length - 1].x > r.left + r.width / 2 ? window.innerWidth + size : -size * 2, y: r.bottom - size * 1.2 });
      run.style.transform = T(pts[0].x, pts[0].y);
      const a = run.animate(pts.map((p, i) => ({ transform: T(p.x, p.y, 1, i % 2 ? -8 : 8) })), { duration: calm() ? 3000 : 6500, easing: 'ease-in-out', fill: 'forwards' });
      const patter = setInterval(() => Sound.silly('scurry'), 1000);
      Sound.silly('zoom');
      ctx.speak(GAG_LINES.runaway);
      ctx.setCaption(stripTags(GAG_LINES.runaway), false, 4000);
      let over = false;
      const end = caught => {
        if (over) return;
        over = true;
        clearInterval(patter);
        if (caught) {
          a.pause();
          const p = center(run.getBoundingClientRect());
          Sound.silly('squeak');
          FX.sparkle(p.x, p.y, dish.emoji);
          ctx.speak(GAG_LINES.caught);
          ctx.setFace('happy', 1600);
          run.classList.add('caught');
          setTimeout(() => run.remove(), 500);
        } else {
          run.remove();
          Sound.silly('wahwah');
          ctx.speak(GAG_LINES.escaped);
        }
        resolve(caught);
      };
      run.addEventListener('pointerdown', () => end(true));
      a.onfinish = () => end(false);
    });
  }

  // The cat sneaks in, grabs the dish and runs around the bowl; tap the cat to get it back.
  function thief(dish, from, catArt = 'cust-cat') {
    return new Promise(resolve => {
      const r = stRect();
      const size = Math.min(110, r.width * .25);
      const ds = size * .55;
      const plate = fillEmo(el('div', 'loot emo'), dish.emoji, dish.id);
      plate.style.width = plate.style.height = ds + 'px';
      plate.style.fontSize = ds * .85 + 'px';
      const spot = { x: from.x - ds / 2, y: from.y - ds / 2 };
      plate.style.transform = T(spot.x, spot.y);
      layer.appendChild(plate);
      const cat = el('button', 'cat-thief tap');
      cat.setAttribute('aria-label', 'أوقف القطّة!');
      cat.appendChild(fillEmo(el('span', 'emo'), '🐱', catArt));
      cat.style.width = cat.style.height = size + 'px';
      cat.style.fontSize = size * .8 + 'px';
      layer.appendChild(cat);
      const leftSide = Math.random() < .5;
      const start = { x: leftSide ? -size : window.innerWidth, y: from.y - size * .6 };
      const grab = { x: spot.x + ds / 2 - size / 2, y: spot.y - size * .45 };
      cat.style.transform = T(start.x, start.y);
      Sound.silly('tiptoe');
      Sound.silly('meow', { t: 1.2 });
      ctx.speak(GAG_LINES.thief);
      ctx.setCaption(stripTags(GAG_LINES.thief), false, 4000);
      let a = null, over = false, carry = 0;
      const follow = () => {
        const p = cat.getBoundingClientRect();
        plate.style.transform = T(p.left + p.width / 2 - ds / 2, p.top + p.height * .55);
        carry = requestAnimationFrame(follow);
      };
      const end = stopped => {
        if (over) return;
        over = true;
        cancelAnimationFrame(carry);
        if (a) a.pause();
        const p = cat.getBoundingClientRect();
        if (stopped) {
          Sound.silly('meow');
          ctx.speak(GAG_LINES.thiefCaught);
          ctx.setFace('happy', 1500);
          FX.sparkle(p.left + p.width / 2, p.top + p.height / 2, '💖');
          // The dish drops; the cat dashes off without it.
          anim(plate, [{ transform: plate.style.transform }, { transform: T(spot.x, spot.y, 1.2) }, { transform: T(spot.x, spot.y, 0), opacity: 0 }], { duration: 900, fill: 'forwards' }).then(() => plate.remove());
          const out = { x: leftSide ? -size * 2 : window.innerWidth + size, y: p.top };
          Sound.silly('zoom');
          anim(cat, [{ transform: T(p.left, p.top) }, { transform: T(out.x, out.y, 1, leftSide ? -20 : 20) }], { duration: 600, easing: 'ease-in', fill: 'forwards' }).then(() => cat.remove());
        } else {
          plate.remove();
          cat.remove();
          ctx.speak(GAG_LINES.thiefGone);
        }
        resolve(stopped);
      };
      cat.addEventListener('pointerdown', () => end(true));
      a = cat.animate([{ transform: T(start.x, start.y, 1, 0) }, { transform: T(grab.x, grab.y, 1, 0) }], { duration: calm() ? 600 : 1700, easing: 'ease-out', fill: 'forwards' });
      a.onfinish = () => {
        if (over) return;
        Sound.silly('scurry');
        carry = requestAnimationFrame(follow);
        const loop = [];
        const cx = r.left + r.width / 2 - size / 2, cy = r.top + r.height * .55 - size / 2;
        const rx = r.width * .32, ry = r.height * .22;
        for (let i = 0; i <= 12; i++) {
          const t = i / 12 * Math.PI * 2 * 1.5 + Math.PI / 2;
          loop.push({ transform: T(cx + rx * Math.cos(t), cy + ry * Math.sin(t), 1, Math.sin(t) * 10) });
        }
        loop.push({ transform: T(leftSide ? window.innerWidth + size : -size * 2, r.top, 1, 0) });
        a = cat.animate(loop, { duration: calm() ? 3000 : 5200, easing: 'linear', fill: 'forwards' });
        const patter = setInterval(() => { if (over) clearInterval(patter); else Sound.silly('scurry'); }, 1100);
        a.onfinish = () => { clearInterval(patter); end(false); };
      };
    });
  }

  // A line of chicks runs across the kitchen. Tap one and it jumps.
  function chicks() {
    if (calm()) return;
    const r = stRect();
    const size = Math.min(64, r.width * .14);
    const ltr = Math.random() < .5;
    const n = 5;
    Sound.silly('peep');
    ctx.speak(GAG_LINES.chicks);
    ctx.setCaption(stripTags(GAG_LINES.chicks), false, 3500);
    for (let i = 0; i < n; i++) {
      const ch = el('button', 'chick tap');
      ch.setAttribute('aria-label', 'كتكوت');
      ch.appendChild(fillEmo(el('span', 'emo'), '🐣', 'chick'));
      ch.style.width = ch.style.height = size + 'px';
      ch.style.fontSize = size * .8 + 'px';
      ch.style.top = r.bottom - size * 1.15 - (i % 2) * size * .25 + 'px';
      ch.style.setProperty('--hop', (i % 2 ? .3 : .38) + 's');
      layer.appendChild(ch);
      const x0 = ltr ? -size * 1.5 : window.innerWidth + size * .5;
      const x1 = ltr ? window.innerWidth + size * .5 : -size * 1.5;
      const a = ch.animate([{ transform: `translateX(${x0}px) scaleX(${ltr ? -1 : 1})` }, { transform: `translateX(${x1}px) scaleX(${ltr ? -1 : 1})` }],
        { duration: 4200, delay: i * 380, easing: 'linear', fill: 'both' });
      a.onfinish = () => ch.remove();
      if (i % 2) setTimeout(() => Sound.silly('peep', { rate: 1.2 }), 700 + i * 380);
      ch.addEventListener('pointerdown', () => { Sound.silly('squeak', { rate: 1.3 }); kick(ch, 'jump', 600); });
    }
  }

  return { gas, feast, yuck, pokeCustomer, tickle, hiccups, burp, toot, sneeze, soot, lidBonk, runaway, thief, chicks, word, stars, kick };
}
