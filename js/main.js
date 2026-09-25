// The Kitchen Lab: the game itself (screens, bowl, pantry, orders, album, parents' corner).
// Items and recipes live in data/, the recipe rules in js/recipes.js.
import { KITCHENS, DEFAULT_KITCHEN, checkKitchen } from './kitchens.js';
import { PHRASES, FAIL_REACTIONS, KIND_LABEL } from '../data/phrases.js';
import { CUSTOMERS } from '../data/customers.js';
import { customerAsk, voiceParts } from './voice-lines.js';
import { $, el, fillEmo, wait, clamp, pick, reducedMotion, landscapeMQ, num, forName, anim, mixColors, applyEmojiFallbacks } from './util.js';
import { Sound } from './sound.js';
import { FX } from './fx.js';
import { createStirrer } from './stir.js';
import { createFryer } from './fry.js';
import { Voice, Clips, Narrator } from './voice.js';

const PREFS_KEY = 'kitchenLab.prefs.v1';

/* =====================================================================
   Active kitchen — rebuilt by setModeData()
   ===================================================================== */
let MODE, ITEMS, COOKBOOK, IDS, IDX, TOTAL, FILTERS, bookOrder;

for (const k of Object.values(KITCHENS)) {
  const problems = checkKitchen(k);
  if (problems.length) console.warn(`[KitchenLab] ${k.key} data issues (run: node tools/check-data.mjs):`, problems);
}

function setModeData(key) {
  MODE = KITCHENS[key] || KITCHENS[DEFAULT_KITCHEN];
  ITEMS = MODE.items;
  COOKBOOK = MODE.cookbook;
  IDS = MODE.ids;
  IDX = Object.fromEntries(IDS.map((id, i) => [id, i]));
  TOTAL = IDS.length;
  FILTERS = [
    { k: 'all', l: 'الكل' },
    ...MODE.tiers.map((t, i) => ({ k: 't' + (i + 1), l: t.label })),
    { k: 'mishap', l: 'أوه لا!' },
  ];
  if (!MODE.fallbacksApplied) {
    MODE.fallbacksApplied = true;
    applyEmojiFallbacks(ITEMS);
  }
  bookOrder = IDS.slice().sort((a, b) => ITEMS[a].tier - ITEMS[b].tier || IDX[a] - IDX[b]);
}

const has = id => state.discovered.has(id);
const emoNode = (id, cls = 'emo') => fillEmo(el('span', cls), ITEMS[id].emoji, id);
const itemClasses = id => {
  const it = ITEMS[id];
  const c = ['t' + it.tier];
  if (it.kind === 'mishap' || it.kind === 'legendary') c.push(it.kind);
  return c;
};

/* =====================================================================
   Persistence
   ===================================================================== */
const Store = {
  ok: true,
  warned: false,
  read(key) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const d = JSON.parse(raw);
      return d && typeof d === 'object' ? d : null;
    } catch (e) {
      console.warn('[KitchenLab] could not read save', e);
      this.ok = false;
      return null;
    }
  },
  write(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
      this.ok = true;
    } catch (e) {
      this.ok = false;
      if (!this.warned) {
        this.warned = true;
        toast({ emoji: '💾', title: 'لا يمكن حفظ التقدّم', text: 'هذا المتصفّح يمنع الحفظ، لكن يمكنك اللعب!', kind: 'meh', duration: 5000 });
      }
    }
  },
  clear(key) { try { localStorage.removeItem(key); } catch (e) { /* ignore */ } },
};

const state = {
  mode: DEFAULT_KITCHEN,
  discovered: new Set(),
  order: [],
  unseen: new Set(),
  settings: { sfx: true, music: false, voice: true },
  stats: { mixes: 0, mishaps: 0, fried: 0 },
  stars: 0,
  served: 0,
  albumSeen: 0,
  completed: false,
  bowl: [null, null],
  pending: 0,
  busy: false,
  mixing: false,
  stirring: false,
  filter: 'all',
  bookTab: 'all',
  hint: { key: null, level: 0, at: 0 },
  orderTarget: null,
  customer: null,
};

function resetState() {
  state.discovered = new Set();
  state.order = [];
  state.unseen = new Set();
  state.stats = { mixes: 0, mishaps: 0, fried: 0 };
  state.stars = 0;
  state.served = 0;
  state.completed = false;
  state.hint = { key: null, level: 0, at: 0 };
  MODE.start.forEach(id => { state.discovered.add(id); state.order.push(id); });
  state.albumSeen = state.discovered.size;
}

function loadState() {
  resetState();
  const d = Store.read(MODE.storeKey);
  if (!d) return false;
  if (Array.isArray(d.discovered)) {
    for (const id of d.discovered) {
      if (ITEMS[id] && !state.discovered.has(id)) { state.discovered.add(id); state.order.push(id); }
    }
  }
  if (Array.isArray(d.unseen)) d.unseen.forEach(id => { if (state.discovered.has(id)) state.unseen.add(id); });
  if (d.stats && typeof d.stats === 'object') {
    for (const k of ['mixes', 'mishaps', 'fried']) {
      const v = Number(d.stats[k]);
      if (Number.isFinite(v) && v >= 0) state.stats[k] = Math.floor(v);
    }
  }
  const count = v => (Number.isFinite(Number(v)) && Number(v) >= 0 ? Math.floor(Number(v)) : 0);
  state.stars = count(d.stars);
  state.served = count(d.served);
  state.albumSeen = d.albumSeen == null ? state.discovered.size : Math.min(count(d.albumSeen), state.discovered.size);
  state.completed = d.completed === true && state.discovered.size === TOTAL;
  return true;
}

function save() {
  Store.write(MODE.storeKey, {
    v: 2,
    discovered: state.order,
    unseen: [...state.unseen],
    stats: state.stats,
    stars: state.stars,
    served: state.served,
    albumSeen: state.albumSeen,
    completed: state.completed,
    savedAt: Date.now(),
  });
}

// Global preferences (mode + audio), shared by both kitchens.
function loadPrefs() {
  const p = Store.read(PREFS_KEY);
  // First run after an upgrade: inherit audio settings from the old bakery save.
  const legacy = p ? null : Store.read(KITCHENS.bakery.storeKey);
  const s = p || (legacy && legacy.settings) || {};
  for (const k of ['sfx', 'music', 'voice']) if (typeof s[k] === 'boolean') state.settings[k] = s[k];
  state.mode = p && KITCHENS[p.mode] ? p.mode : DEFAULT_KITCHEN;
}

function savePrefs() {
  Store.write(PREFS_KEY, { v: 2, mode: state.mode, ...state.settings });
}

/* =====================================================================
   DOM refs
   ===================================================================== */
const station = $('#station');
const dropzone = $('#dropzone');
const bowlWrap = $('#bowlWrap');
const bowlSvg = $('#bowlSvg');
const slotsEl = $('#slots');
let slotEls = [];
const caption = $('#caption');
const btnEmpty = $('#btnEmpty');
const resultPop = $('#resultPop');
const resultEmo = $('#resultEmo');
const resultName = $('#resultName');
const pantryGrid = $('#pantryGrid');
const pantryChips = $('#pantryChips');
const btnBook = $('#btnBook');
const bookDot = $('#bookDot');
const btnParents = $('#btnParents');
const toastsEl = $('#toasts');
const book = $('#book');
const bookGrid = $('#bookGrid');
const bookTabs = $('#bookTabs');
const detail = $('#detail');
const gate = $('#gate');
const gateQ = $('#gateQ');
const gateOpts = $('#gateOpts');
const parents = $('#parents');
const modeList = $('#modeList');
const swVoice = $('#swVoice');
const swSfx = $('#swSfx');
const swMusic = $('#swMusic');
const voiceStatus = $('#voiceStatus');
const btnTestVoice = $('#btnTestVoice');
const btnReset = $('#btnReset');
const btnInstall = $('#btnInstall');
const orderEl = $('#order');
const orderCust = $('#orderCust');
const orderBubble = $('#orderBubble');
const orderWho = $('#orderWho');
const orderEmo = $('#orderEmo');
const orderName = $('#orderName');
const orderStars = $('#orderStars');
const starCount = $('#starCount');
const orderSkip = $('#orderSkip');
const startScreen = $('#startScreen');

const starsText = n => `${num(n)} ${n === 2 ? 'نجمتان' : n >= 3 && n <= 10 ? 'نجوم' : 'نجمة'}`;
const secretText = n => (n === 1 ? 'وصفة سرّية واحدة' : n === 2 ? 'وصفتان سرّيتان' : n <= 10 ? `${num(n)} وصفات سرّية` : `${num(n)} وصفة سرّية`);

// Speak with a talking animation on the mascot (or on the customer).
let talkId = 0;
function speakOut(parts, { interrupt = true, by = 'mascot', force = false } = {}) {
  const id = ++talkId;
  const who = by === 'customer' ? orderEl : bowlWrap;
  Narrator.speak(parts, {
    interrupt,
    force,
    onstart: () => {
      bowlWrap.classList.remove('talking');
      orderEl.classList.remove('talking');
      who.classList.add('talking');
      if (by !== 'customer') caption.classList.add('talking');
    },
    onend: () => {
      if (id !== talkId) return;
      bowlWrap.classList.remove('talking');
      orderEl.classList.remove('talking');
      caption.classList.remove('talking');
    },
  });
}

// The mascot's speech bubble (the caption) + voice.
function say(text, { warn = false, revertMs = 0, speech = null, interrupt = true } = {}) {
  setCaption(text, warn, revertMs);
  speakOut(speech || text, { interrupt });
}

/* =====================================================================
   Toasts & caption
   ===================================================================== */
function toast({ emoji = '🍳', art, title, text = '', kind = 'info', tag = '', duration = 3400 }) {
  const t = el('div', 'toast ' + kind);
  t.setAttribute('role', 'status');
  const body = el('div', 't-body');
  const h = el('b');
  if (tag) h.appendChild(el('span', 't-tag', tag));
  h.appendChild(document.createTextNode(title));
  body.appendChild(h);
  if (text) body.appendChild(el('p', null, text));
  t.append(fillEmo(el('span', 't-emo emo'), emoji, art), body);
  toastsEl.appendChild(t);
  while (toastsEl.children.length > 3) toastsEl.firstElementChild.remove();
  const kill = () => {
    if (t._dead) return;
    t._dead = true;
    t.classList.add('out');
    setTimeout(() => t.remove(), 320);
  };
  setTimeout(kill, duration);
  t.addEventListener('click', kill);
}

let captionTimer = 0;
function setCaption(text, warn = false, revertMs = 0) {
  clearTimeout(captionTimer);
  caption.textContent = text;
  caption.classList.toggle('warn', warn);
  caption.classList.remove('flash');
  void caption.offsetWidth;
  caption.classList.add('flash');
  if (revertMs) captionTimer = setTimeout(bowlCaption, revertMs);
}

function bowlCaption() {
  const held = state.bowl.filter(Boolean);
  if (state.stirring) {
    setCaption(STIR_TEXT);
  } else if (held.length && held.length < state.bowl.length) {
    const names = held.map(id => ITEMS[id].name).join(' و');
    setCaption(partnersOf(held).size
      ? `${held.map(id => `${ITEMS[id].emoji} ${ITEMS[id].name}`).join(' + ')} + … ؟ ✨ جرّب أحد المكوّنات المضيئة!`
      : `لا شيء جديد مع ${names}. جرّب أيّ مكوّن آخر!`);
  } else if (!held.length) {
    if (state.orderTarget && state.customer) {
      const it = ITEMS[state.orderTarget];
      setCaption(`هيّا نصنع ${it.emoji} ${it.name} ${forName(state.customer.name)}!`);
    } else {
      setCaption(state.stats.mixes === 0 ? 'اسحب مكوّنين إلى الوعاء، أو اضغط عليهما! 👆' : 'اسحب مكوّنين إلى الوعاء!');
    }
  }
}

/* =====================================================================
   Pantry rendering
   ===================================================================== */
const matchesFilter = (id, k) => {
  const it = ITEMS[id];
  if (k === 'all') return true;
  if (k === 'mishap') return it.kind === 'mishap';
  return it.kind !== 'mishap' && 't' + it.tier === k;
};

function renderChips() {
  pantryChips.replaceChildren(...FILTERS.map(f => {
    const b = el('button', 'chip', f.l);
    b.setAttribute('aria-pressed', String(state.filter === f.k));
    b.addEventListener('click', () => {
      if (state.filter === f.k) return;
      Sound.tap();
      state.filter = f.k;
      renderChips();
      renderPantry();
    });
    return b;
  }));
}

let pendingRender = null;
function renderPantry(opts = {}) {
  if (drag) { pendingRender = true; return; }
  const pos = Object.fromEntries(state.order.map((id, i) => [id, i]));
  const ids = state.order
    .filter(id => matchesFilter(id, state.filter))
    .sort((a, b) => ITEMS[a].tier - ITEMS[b].tier
      || (ITEMS[b].kind === 'base') - (ITEMS[a].kind === 'base') // starters first
      || pos[a] - pos[b]);
  const frag = document.createDocumentFragment();
  for (const id of ids) {
    const it = ITEMS[id];
    const t = el('button', 'tile ' + itemClasses(id).join(' '));
    t.dataset.id = id;
    t.setAttribute('aria-label', `${it.name}. اسحبه إلى الوعاء أو اضغط عليه.`);
    t.append(emoNode(id), el('span', 'lbl', it.name));
    if (state.unseen.has(id)) t.appendChild(el('span', 'new', 'جديد'));
    if (opts.incoming === id) t.classList.add('incoming');
    frag.appendChild(t);
  }
  if (!ids.length) frag.appendChild(el('p', 'empty', 'لا شيء هنا بعد. استمرّ في التجربة!'));
  pantryGrid.replaceChildren(frag);
  refreshGlow();
}

function flushRender() {
  if (pendingRender && !drag) {
    pendingRender = null;
    renderPantry();
  }
}

const findTile = id => pantryGrid.querySelector(`.tile[data-id="${id}"]`);

// Discovered items that would make something NEW together with the `held` ingredients.
const partnersOf = held => COOKBOOK.partners(held, has);

// The held ingredients: the one being dragged, or what is waiting in a part-full bowl.
function glowSource() {
  if (drag && drag.started) return [drag.id];
  const filled = state.bowl.filter(Boolean);
  if (filled.length && filled.length < state.bowl.length && !state.busy && !state.pending) return filled;
  return null;
}

function refreshGlow() {
  const src = glowSource();
  const partners = src ? partnersOf(src) : new Set();
  pantryGrid.querySelectorAll('.tile').forEach(t => t.classList.toggle('partner', partners.has(t.dataset.id)));
}

// Works for both scroll directions (the page is right-to-left).
function scrollTileIntoView(tile) {
  const behavior = reducedMotion.matches ? 'auto' : 'smooth';
  const g = pantryGrid.getBoundingClientRect();
  const t = tile.getBoundingClientRect();
  if (landscapeMQ.matches) pantryGrid.scrollBy({ top: (t.top + t.height / 2) - (g.top + g.height / 2), behavior });
  else pantryGrid.scrollBy({ left: (t.left + t.width / 2) - (g.left + g.width / 2), behavior });
}

function markSeen(id) {
  if (!state.unseen.delete(id)) return;
  const badge = findTile(id)?.querySelector('.new');
  if (badge) badge.remove();
  save();
}

function renderBookBtn(bump = false) {
  bookDot.hidden = state.discovered.size <= state.albumSeen;
  btnBook.setAttribute('aria-label', bookDot.hidden ? 'ألبوم الملصقات' : 'ألبوم الملصقات، فيه ملصقات جديدة');
  if (bump) {
    btnBook.classList.remove('bump');
    void btnBook.offsetWidth;
    btnBook.classList.add('bump');
  }
}

/* =====================================================================
   Ghosts (dragged / flying items)
   ===================================================================== */
const GHOST = 72;
const ghostT = (x, y, r, s) => `translate3d(${x}px,${y}px,0) rotate(${r}deg) scale(${s})`;

function makeGhost(id, rect, big = false) {
  const g = el('div', 'ghost' + (big ? ' big' : ''));
  g.appendChild(emoNode(id));
  document.body.appendChild(g);
  placeGhost(g, rect.left + rect.width / 2 - GHOST / 2, rect.top + rect.height / 2 - GHOST / 2, 0, 1);
  return g;
}

function placeGhost(g, x, y, r = 0, s = 1) {
  g._x = x; g._y = y; g._r = r; g._s = s;
  g.style.transform = ghostT(x, y, r, s);
}

async function flyGhost(g, rect, { duration = 260, endScale = .75, arc = false, easing = 'cubic-bezier(.45,0,.2,1)' } = {}) {
  const tx = rect.left + rect.width / 2 - GHOST / 2;
  const ty = rect.top + rect.height / 2 - GHOST / 2;
  const frames = [{ transform: ghostT(g._x, g._y, g._r, g._s) }];
  if (arc) {
    const mx = (g._x + tx) / 2, my = Math.min(g._y, ty) - 70;
    frames.push({ transform: ghostT(mx, my, 0, 1.2), offset: .5 });
  }
  frames.push({ transform: ghostT(tx, ty, 0, endScale) });
  await anim(g, frames, { duration: reducedMotion.matches ? Math.min(duration, 150) : duration, easing, fill: 'forwards' });
  g.remove();
}

async function snapBack(g, id, fallbackTile) {
  const tile = findTile(id) || fallbackTile;
  const rect = tile && tile.isConnected ? tile.getBoundingClientRect() : null;
  Sound.boing();
  if (rect) await flyGhost(g, rect, { duration: 420, endScale: 1, easing: 'cubic-bezier(.34,1.56,.64,1)' });
  else g.remove();
  if (tile) {
    tile.classList.remove('lifted');
    tile.classList.remove('arrive');
    void tile.offsetWidth;
    tile.classList.add('arrive');
  }
}

/* =====================================================================
   Drag & drop controller (pointer events: mouse, touch, pen)
   ===================================================================== */
let drag = null;

function isOverDrop(x, y) {
  const r = dropzone.getBoundingClientRect();
  const pad = 24;
  return x >= r.left - pad && x <= r.right + pad && y >= r.top - pad && y <= r.bottom + pad;
}

function onPantryDown(e) {
  if (e.button > 0 || drag) return;
  const tile = e.target.closest('.tile');
  if (!tile) return;
  Sound.ensure();
  dismissCoach();
  drag = {
    id: tile.dataset.id,
    tile,
    pid: e.pointerId,
    type: e.pointerType,
    sx: e.clientX, sy: e.clientY,
    lx: e.clientX, lt: performance.now(),
    started: false, ghost: null, over: false, rot: 0,
  };
  try { tile.setPointerCapture(e.pointerId); } catch (err) { /* not critical */ }
}

function startDrag() {
  drag.started = true;
  drag.ghost = makeGhost(drag.id, drag.tile.getBoundingClientRect());
  drag.tile.classList.add('lifted');
  markSeen(drag.id);
  Sound.pop();
  speakOut(ITEMS[drag.id].name);
  refreshGlow();
}

function onPointerMove(e) {
  if (!drag || e.pointerId !== drag.pid) return;
  const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
  if (!drag.started) {
    const dist = Math.hypot(dx, dy);
    if (dist < (drag.type === 'mouse' ? 5 : 10)) return;
    // On touch, movement along the pantry's scroll axis is a scroll, not a drag.
    if (drag.type !== 'mouse' && dist < 26) {
      const alongScroll = landscapeMQ.matches ? Math.abs(dy) > Math.abs(dx) * 1.2 : Math.abs(dx) > Math.abs(dy) * 1.2;
      if (alongScroll) return;
    }
    startDrag();
  }
  if (e.cancelable) e.preventDefault();
  const now = performance.now();
  const vx = (e.clientX - drag.lx) / Math.max(1, now - drag.lt) * 16;
  drag.lx = e.clientX;
  drag.lt = now;
  drag.rot += (clamp(vx * 1.6, -22, 22) - drag.rot) * .3;
  const lift = drag.type === 'touch' ? 30 : 0; // keep the item visible above the finger
  placeGhost(drag.ghost, e.clientX - GHOST / 2, e.clientY - GHOST / 2 - lift, drag.rot, 1.15);
  const over = isOverDrop(e.clientX, e.clientY - lift);
  if (over !== drag.over) {
    drag.over = over;
    dropzone.classList.toggle('hover', over);
    if (over) Sound.tap();
  }
}

function onPointerEnd(e) {
  if (!drag || e.pointerId !== drag.pid) return;
  const d = drag;
  drag = null;
  dropzone.classList.remove('hover');
  try { d.tile.releasePointerCapture(d.pid); } catch (err) { /* ignore */ }

  if (!d.started) {
    if (e.type === 'pointerup') tapAdd(d.id, d.tile);
    flushRender();
    return;
  }
  refreshGlow();
  const lift = d.type === 'touch' ? 30 : 0;
  const dropped = e.type === 'pointerup' && isOverDrop(e.clientX, e.clientY - lift) && addToBowl(d.id, d.ghost, d.tile, false);
  if (dropped) flushRender();
  else snapBack(d.ghost, d.id, d.tile).then(flushRender);
}

function cancelDrag() {
  if (!drag) return;
  const d = drag;
  drag = null;
  dropzone.classList.remove('hover');
  if (d.ghost) d.ghost.remove();
  d.tile.classList.remove('lifted');
  flushRender();
  refreshGlow();
}

/* =====================================================================
   Bowl logic
   ===================================================================== */
function canAdd() {
  return !state.busy && state.bowl.includes(null);
}

function rejectFeedback() {
  Sound.boing();
  dropzone.classList.remove('reject');
  void dropzone.offsetWidth;
  dropzone.classList.add('reject');
  setCaption('انتظر قليلًا... ما زلنا نطبخ! ⏳', true, 1400);
}

function tapAdd(id, tile) {
  markSeen(id);
  if (!canAdd()) { rejectFeedback(); return; }
  Sound.pop();
  speakOut(ITEMS[id].name);
  addToBowl(id, makeGhost(id, tile.getBoundingClientRect()), tile, true);
}

function addToBowl(id, ghost, tile, arc) {
  const i = state.bowl.indexOf(null);
  if (state.busy || i < 0) { rejectFeedback(); return false; }
  state.bowl[i] = id;
  state.pending++;
  if (!state.bowl.includes(null)) state.busy = true;
  if (tile) tile.classList.remove('lifted');
  const target = slotEls[i].getBoundingClientRect();
  flyGhost(ghost, target, arc ? { arc: true, duration: 440 } : { duration: 190 }).then(() => {
    state.pending--;
    renderSlot(i);
    squish();
    Sound.drop();
    updateLiquid();
    updateEmptyBtn();
    refreshGlow();
    if (state.pending === 0 && !state.bowl.includes(null)) setTimeout(startStir, 260);
    else bowlCaption();
  });
  return true;
}

const SLOT_NAMES = ['الأولى', 'الثانية', 'الثالثة', 'الرابعة', 'الخامسة'];

// One slot per space in the bowl; the kitchen's `bowl` size decides how many.
function buildSlots() {
  slotEls = [];
  const nodes = [];
  for (let i = 0; i < MODE.bowl; i++) {
    if (i) {
      const op = el('span', 'op', '+');
      op.setAttribute('aria-hidden', 'true');
      nodes.push(op);
    }
    const s = el('button', 'slot');
    s.dataset.i = String(i);
    slotEls.push(s);
    nodes.push(s);
  }
  slotsEl.replaceChildren(...nodes, btnEmpty);
}

function renderSlot(i) {
  const s = slotEls[i];
  const id = state.bowl[i];
  s.className = 'slot';
  s.replaceChildren();
  if (!id) {
    s.appendChild(el('span', 'plus', '+'));
    s.setAttribute('aria-label', `الخانة ${SLOT_NAMES[i] || num(i + 1)} فارغة`);
    return;
  }
  const it = ITEMS[id];
  s.classList.add('filled', ...itemClasses(id));
  s.append(emoNode(id), el('span', 'lbl', it.name));
  s.setAttribute('aria-label', `${it.name} في الوعاء. اضغط لإخراجه.`);
}

function removeFromSlot(i) {
  const id = state.bowl[i];
  if (!id || state.pending || (state.busy && !state.stirring)) return;
  cancelStir(); // changed their mind before stirring: that's fine
  const rect = slotEls[i].getBoundingClientRect();
  state.bowl[i] = null;
  renderSlot(i);
  updateLiquid();
  updateEmptyBtn();
  refreshGlow();
  bowlCaption();
  Sound.pop();
  const tile = findTile(id);
  const g = makeGhost(id, rect);
  if (tile) {
    flyGhost(g, tile.getBoundingClientRect(), { arc: true, duration: 380, endScale: 1 }).then(() => {
      tile.classList.remove('arrive');
      void tile.offsetWidth;
      tile.classList.add('arrive');
    });
  } else {
    anim(g, [{ opacity: 1, transform: g.style.transform }, { opacity: 0, transform: g.style.transform + ' scale(.3)' }], { duration: 250, fill: 'forwards' }).then(() => g.remove());
  }
}

function clearBowl() {
  if (slotEls.length !== MODE.bowl) buildSlots();
  state.bowl = new Array(MODE.bowl).fill(null);
  slotEls.forEach((s, i) => renderSlot(i));
  updateEmptyBtn();
  refreshGlow();
}

function updateEmptyBtn() {
  btnEmpty.hidden = (state.busy && !state.stirring) || !state.bowl.some(Boolean);
}

function updateLiquid(forceColor) {
  const color = forceColor || mixColors(state.bowl.filter(Boolean).map(id => ITEMS[id].color));
  bowlWrap.classList.toggle('has-liquid', !!color);
  if (color) bowlWrap.style.setProperty('--liquid', color);
}

function squish() {
  bowlSvg.classList.remove('squish', 'giggle', 'sneeze');
  void bowlSvg.getBoundingClientRect();
  bowlSvg.classList.add('squish');
}
bowlSvg.addEventListener('animationend', e => {
  if (['squish', 'giggle', 'sneeze'].includes(e.animationName)) bowlSvg.classList.remove(e.animationName);
});

let faceTimer = 0;
function setFace(face, revertMs = 0) {
  clearTimeout(faceTimer);
  bowlWrap.dataset.face = face;
  if (revertMs) faceTimer = setTimeout(() => { if (!state.mixing) bowlWrap.dataset.face = 'idle'; }, revertMs);
}

function bowlCenter() {
  const r = bowlWrap.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height * .38 };
}

/* =====================================================================
   Stirring: the bowl is full, and waits for the child to stir it
   ===================================================================== */
const MUDDY = '#c9b8a6'; // the bowl's colour when a mix makes nothing
const STIR_TEXT = 'حرّك الملعقة في دوائر! 🥄';
const stirrer = createStirrer({ bowlWrap, center: bowlCenter, onTick: p => Sound.stirTick(p), onGrab: dismissStirHint });
let stirNag = 0;

function startStir() {
  const mixed = state.bowl.slice();
  if (state.stirring || state.mixing || !mixed.every(Boolean)) return;
  const res = COOKBOOK.lookup(mixed);
  state.stirring = true;
  state.busy = true;
  station.classList.add('stir-ready');
  updateEmptyBtn();
  setFace('wow');
  stirrer.start({
    colors: mixed.map(id => ITEMS[id].color),
    target: res ? ITEMS[res].color : MUDDY,
    onDone: finishStir,
  });
  if (reducedMotion.matches) { stirrer.autoStir(); return; }
  // Explain it out loud for the first few mixes; after that the glowing spoon is enough.
  if (state.stats.mixes < 3) {
    say(STIR_TEXT, { speech: PHRASES.stir, interrupt: false });
    showStirHint();
  } else {
    setCaption(STIR_TEXT);
  }
  clearTimeout(stirNag);
  stirNag = setTimeout(function nag() {
    if (!state.stirring) return;
    if (stirrer.progress() < .15 && !topModal()) { showStirHint(); setCaption(STIR_TEXT); }
    stirNag = setTimeout(nag, 9000);
  }, 7000);
}

function endStir() {
  state.stirring = false;
  station.classList.remove('stir-ready');
  clearTimeout(stirNag);
  dismissStirHint();
}

// The swirl has turned into the dish's colour: keep it (no fade from the old colour) and reveal.
function finishStir(color) {
  endStir();
  noteActivity();
  bowlWrap.classList.add('snap-liquid');
  updateLiquid(color);
  void bowlWrap.getBoundingClientRect();
  requestAnimationFrame(() => bowlWrap.classList.remove('snap-liquid'));
  mix({ stirred: true });
}

function cancelStir() {
  if (!state.stirring) return;
  endStir();
  stirrer.cancel();
  state.busy = false;
  setFace('idle');
}

// A hand that circles the bowl to show how to stir.
let stirHand = null;
function showStirHint() {
  dismissStirHint();
  if (reducedMotion.matches) return;
  const r = bowlWrap.getBoundingClientRect();
  const c = bowlCenter();
  const rx = r.width * .26, ry = r.width * .09;
  const frames = [];
  for (let i = 0; i <= 16; i++) {
    const a = i / 16 * Math.PI * 2 - Math.PI / 2;
    frames.push({ transform: `translate(${c.x + rx * Math.cos(a) - 16}px, ${c.y + ry * Math.sin(a)}px)` });
  }
  const hand = el('div', 'coach-hand emo', '👆');
  document.body.appendChild(hand);
  stirHand = hand;
  anim(hand, frames, { duration: 1500, iterations: 2, easing: 'linear', fill: 'forwards' })
    .then(() => { if (stirHand === hand) dismissStirHint(); });
}

function dismissStirHint() {
  if (stirHand) { stirHand.remove(); stirHand = null; }
}

/* =====================================================================
   Frying: dishes in the kitchen's cook.fry list go into the pan after stirring
   ===================================================================== */
const FRY_TEXT = 'عندما يصير ذهبيًّا ⭐ اضغط على المقلاة!';
const fryPan = $('#fryPan');
const fryer = createFryer({ root: $('#fry'), paused: () => !!topModal() || document.hidden, on: onFryEvent });
let fryHelped = false;

function panCenter() {
  const r = fryPan.getBoundingClientRect();
  return { x: r.left + r.width * .617, y: r.top + r.height * .5 };
}

function onFryEvent(type, info) {
  if (type === 'sizzle') {
    Sound.sizzle(info);
  } else if (type === 'ready') {
    Sound.ready();
    // Say "now!" while they are learning, and whenever the last try burnt.
    if (state.stats.fried < 3 || info.attempt > 1) say('الآن! ارفع المقلاة! ⬆', { speech: PHRASES.fryNow });
  } else if (type === 'overdone') {
    setCaption(FRY_TEXT); // the "now!" moment has passed
  } else if (type === 'early') {
    Sound.boing();
    say('لم ينضج بعد! انتظر قليلًا. ⏳', { speech: PHRASES.fryEarly });
  } else if (type === 'burnt') {
    Sound.poof();
    const c = panCenter();
    FX.puff(c.x, c.y, '#6e625a');
    setFace('dizzy', 1600);
    say('أوه! احترق قليلًا. لنجرّب مرّة أخرى! 💨', { speech: PHRASES.fryBurnt });
  } else if (type === 'help') {
    fryHelped = true; // spoken with the result, so the reveal doesn't cut it off
  } else if (type === 'lift') {
    Sound.lift();
    station.classList.remove('frying'); // the mascot comes back as the pan lifts away
  }
}

// Resolves true once the dish is lifted out of the pan, false if cancelled.
async function fry(id) {
  fryHelped = false;
  station.classList.add('frying');
  setFace('wow');
  if (state.stats.fried < 3) say(FRY_TEXT, { speech: PHRASES.fry });
  else setCaption(FRY_TEXT);
  const ok = await fryer.run({ id, emoji: ITEMS[id].emoji });
  station.classList.remove('frying');
  if (ok) state.stats.fried++;
  return ok;
}

/* =====================================================================
   Mixing & discovery
   ===================================================================== */
let resultToken = 0;

async function mix({ stirred = false } = {}) {
  if (state.mixing) return;
  const mixed = state.bowl.slice();
  if (!mixed.every(Boolean)) { state.busy = false; return; }
  state.mixing = true;
  state.busy = true;
  updateEmptyBtn();
  try {
    station.classList.add('cooking');
    station.classList.toggle('after-stir', stirred);
    setFace('wow');
    setCaption(`نخلط ${mixed.map(id => ITEMS[id].name).join(' مع ')}... 🥄`);
    if (!stirred) Sound.stir();
    // After a stir, just long enough for the ingredients to sink into the bowl.
    await wait(stirred ? 380 : reducedMotion.matches ? 450 : 1050);

    const res = COOKBOOK.lookup(mixed);
    state.stats.mixes++;
    station.classList.remove('cooking');
    clearBowl();

    if (!res) {
      failReaction(bowlCenter());
      save();
      return;
    }

    const cooked = MODE.cookOf[res];
    if (cooked === 'fry' && !(await fry(res))) return;
    const lead = cooked ? [fryHelped ? PHRASES.fryHelp : PHRASES.fryDone] : [];
    const c = bowlCenter();
    const item = ITEMS[res];
    const isNew = !state.discovered.has(res);
    const orderHit = res === state.orderTarget;
    const token = ++resultToken;
    updateLiquid(item.color);
    Sound.ovenDing();
    showResult(res, isNew);
    setCaption(`${mixed.map(id => `${ITEMS[id].emoji} ${ITEMS[id].name}`).join(' + ')} = ${item.emoji} ${item.name}`);

    if (isNew) {
      if (item.kind === 'mishap') {
        state.stats.mishaps++;
        Sound.splat();
        FX.splat(c.x, c.y, item.color);
        setFace('dizzy', 2200);
        speakOut([PHRASES.mishap, item.name, item.desc]);
      } else {
        setTimeout(() => Sound.magic(), 140);
        FX.sparkle(c.x, c.y, item.emoji);
        setFace('happy', 2200);
        speakOut([...lead, PHRASES.newFind, item.name, item.desc]);
      }
      discover(res);
      toastDiscovery(res);
      finishNewResult(res, token);
    } else {
      FX.mini(c.x, c.y);
      setFace('happy', 1500);
      speakOut([...lead, item.name, PHRASES.again]);
      setTimeout(() => { if (token === resultToken) hideResult(); }, 1300);
    }
    if (orderHit) setTimeout(() => serveOrder(res), isNew ? 1500 : 700);
    save();
    await wait(650); // let the reveal land before accepting new ingredients
  } finally {
    station.classList.remove('cooking', 'after-stir');
    state.mixing = false;
    state.busy = false;
    state.pending = 0;
    updateEmptyBtn();
    refreshGlow();
    setTimeout(() => { if (!state.bowl.some(Boolean) && !state.mixing) updateLiquid(); }, 1400);
  }
}

// No such thing as a wrong mix — the bowl just does something silly.
function failReaction(c) {
  const r = pick(FAIL_REACTIONS);
  updateLiquid(MUDDY);
  bowlSvg.classList.remove('squish', 'giggle', 'sneeze');
  void bowlSvg.getBoundingClientRect();
  if (r.style === 'giggle') {
    Sound.giggle();
    setFace('happy', 1600);
    bowlSvg.classList.add('giggle');
    FX.mini(c.x, c.y);
  } else if (r.style === 'sneeze') {
    setFace('wow');
    Sound.sneeze();
    bowlSvg.classList.add('sneeze');
    setTimeout(() => { FX.puff(c.x, c.y); setFace('meh', 1400); }, 420);
  } else if (r.style === 'dizzy') {
    Sound.boing();
    setFace('dizzy', 1600);
    FX.mini(c.x, c.y);
  } else {
    Sound.nope();
    setFace('meh', 1600);
    FX.puff(c.x, c.y);
  }
  say(r.text);
  setTimeout(() => { if (!state.bowl.some(Boolean)) updateLiquid(); }, 900);
}

function showResult(id, isNew) {
  const it = ITEMS[id];
  fillEmo(resultEmo, it.emoji, id);
  resultName.textContent = it.name;
  resultPop.className = 'result-pop ' + itemClasses(id).join(' ') + (isNew ? ' new' : '');
  resultPop.hidden = false;
  void resultPop.offsetWidth;
  resultPop.classList.add('show');
}

function hideResult() {
  if (resultPop.hidden) return;
  resultPop.classList.remove('show');
  resultPop.classList.add('leave');
  setTimeout(() => { if (resultPop.classList.contains('leave')) resultPop.hidden = true; }, 300);
}

async function finishNewResult(id, token) {
  await wait(reducedMotion.matches ? 700 : 1400);
  if (token !== resultToken) return;
  const tile = findTile(id);
  try {
    if (!tile || resultPop.hidden) { hideResult(); return; }
    scrollTileIntoView(tile);
    await wait(380);
    if (token !== resultToken) return;
    const g = makeGhost(id, resultEmo.getBoundingClientRect(), true);
    resultPop.hidden = true;
    await flyGhost(g, tile.getBoundingClientRect(), { arc: true, duration: 650, endScale: .7 });
    tile.classList.remove('incoming');
    tile.classList.add('arrive');
    Sound.pop();
    const r = tile.getBoundingClientRect();
    FX.mini(r.left + r.width / 2, r.top + r.height / 2);
  } finally {
    if (tile) tile.classList.remove('incoming');
    if (!checkUnlocks()) refreshOrderIfIdle();
    checkComplete();
  }
}

function discover(id) {
  state.discovered.add(id);
  state.order.push(id);
  state.unseen.add(id);
  if (!matchesFilter(id, state.filter)) state.filter = 'all';
  renderChips();
  renderPantry({ incoming: id });
  renderBookBtn(true);
  if (!book.hidden) renderBook();
  save();
}

function toastDiscovery(id) {
  const item = ITEMS[id];
  const kind = item.kind === 'mishap' ? 'mishap' : item.kind === 'legendary' ? 'legend' : 'new';
  const tag = item.kind === 'mishap' ? 'أوه لا!' : item.kind === 'legendary' ? 'أسطوري' : item.kind === 'wacky' ? 'عجيب!' : 'جديد';
  toast({ emoji: item.emoji, art: id, title: `اكتشاف جديد: ${item.name}!`, text: item.desc, kind, tag, duration: 4200 });
}

function checkComplete() {
  if (state.completed || state.discovered.size < TOTAL) return;
  state.completed = true;
  save();
  setTimeout(() => {
    Sound.fanfare();
    FX.confetti();
    setFace('happy', 3000);
    toast({ emoji: '🎉', title: MODE.text.complete, kind: 'legend', tag: '١٠٠٪', duration: 6000 });
    speakOut(MODE.text.complete, { interrupt: false });
  }, 400);
}

/* =====================================================================
   Gentle start: new starting ingredients unlock as rewards
   ===================================================================== */
const hasNewCombos = () => COOKBOOK.recipes.some(r => COOKBOOK.ready(r, has) && !has(r.result));

// The next gift ingredient, once the player has found enough (or has nothing left to try).
function nextUnlock() {
  const next = MODE.unlocks.find(u => !has(u.id));
  if (!next) return null;
  const found = state.order.filter(id => ITEMS[id].kind !== 'base').length;
  return found >= next.after || !hasNewCombos() ? next.id : null;
}

function addStarter(id) {
  state.discovered.add(id);
  state.order.push(id);
  state.unseen.add(id);
}

// On load: quietly catch up on unlocks earned earlier (or needed to avoid a dead end).
function applyPendingUnlocks() {
  let id;
  while ((id = nextUnlock())) addStarter(id);
}

function checkUnlocks() {
  const id = nextUnlock();
  if (!id) return false;
  const it = ITEMS[id];
  addStarter(id);
  if (!matchesFilter(id, state.filter)) state.filter = 'all';
  renderChips();
  renderPantry();
  renderBookBtn(true);
  save();
  const tile = findTile(id);
  if (tile) {
    scrollTileIntoView(tile);
    tile.classList.add('arrive');
    setTimeout(() => {
      const r = tile.getBoundingClientRect();
      FX.sparkle(r.left + r.width / 2, r.top + r.height / 2, '🎁');
    }, 350);
  }
  Sound.gift();
  toast({ emoji: it.emoji, art: id, title: `مفاجأة! مكوّن جديد: ${it.name}`, text: it.desc, kind: 'new', tag: '🎁 هدية', duration: 4200 });
  speakOut([PHRASES.unlock, it.name], { interrupt: false });
  refreshOrderIfIdle();
  return true;
}

/* =====================================================================
   Customer picture orders
   ===================================================================== */
let orderToken = 0;
let orderTaps = { n: 0, at: 0 };

// Mixes needed to make `id` from what the child already has.
const orderCost = id => COOKBOOK.cost(id, has);

// Ages 6–8: a mix of practice orders (known dishes) and 1–3 step adventures.
function pickOrderTarget() {
  if (state.served === 0 && MODE.firstOrder && !state.discovered.has(MODE.firstOrder) && orderCost(MODE.firstOrder) === 1) return MODE.firstOrder;
  const eligible = IDS.filter(id => !['base', 'mishap'].includes(ITEMS[id].kind) && id !== state.lastOrder);
  const known = eligible.filter(id => state.discovered.has(id));
  const fresh = eligible.filter(id => !state.discovered.has(id)).map(id => [id, orderCost(id)]);
  const one = fresh.filter(([, c]) => c === 1).map(([id]) => id);
  const more = fresh.filter(([, c]) => c >= 2 && c <= 3).map(([id]) => id);
  const roll = Math.random();
  const pools = roll < .45 ? [known, one, more] : roll < .8 ? [one, known, more] : [more, one, known];
  for (const p of pools) if (p.length) return pick(p);
  return null;
}

const orderParts = () => [customerAsk(state.customer), ITEMS[state.orderTarget].name];
const orderRequest = () => {
  const c = state.customer;
  return `${customerAsk(c)} ${ITEMS[state.orderTarget].name}!`;
};

function newOrder({ announce = true } = {}) {
  orderToken++;
  const target = pickOrderTarget();
  if (!target) {
    state.orderTarget = null;
    orderEl.hidden = true;
    if (!state.bowl.some(Boolean) && !state.busy) bowlCaption();
    return;
  }
  let c;
  do { c = pick(CUSTOMERS); } while (state.customer && c.name === state.customer.name);
  state.customer = c;
  state.orderTarget = target;
  state.lastOrder = target;
  orderTaps = { n: 0, at: 0 };
  renderOrder(true);
  if (!state.bowl.some(Boolean) && !state.busy) bowlCaption();
  if (announce) speakOut(orderParts(), { interrupt: false, by: 'customer' });
}

function refreshOrderIfIdle() {
  if (!state.orderTarget && orderEl.hidden) newOrder();
}

function renderOrder(enter = false) {
  starCount.textContent = num(state.stars);
  if (!state.orderTarget || !state.customer) { orderEl.hidden = true; return; }
  const it = ITEMS[state.orderTarget];
  const c = state.customer;
  fillEmo(orderCust, c.emoji, c.art);
  orderWho.textContent = `${customerAsk(c)}:`;
  fillEmo(orderEmo, it.emoji, state.orderTarget);
  orderName.textContent = it.name;
  orderBubble.setAttribute('aria-label', `${orderRequest()} اضغط لتسمع الطلب.`);
  orderEl.hidden = false;
  orderEl.classList.remove('served', 'leave');
  if (enter) {
    orderEl.classList.remove('enter');
    void orderEl.offsetWidth;
    orderEl.classList.add('enter');
  }
}

async function serveOrder(id) {
  if (id !== state.orderTarget) return;
  const tok = ++orderToken;
  state.stars++;
  state.served++;
  state.orderTarget = null;
  save();
  orderEl.classList.add('served');
  starCount.textContent = num(state.stars);
  orderStars.classList.remove('bump');
  void orderStars.offsetWidth;
  orderStars.classList.add('bump');
  Sound.coin();
  const r = orderCust.getBoundingClientRect();
  FX.sparkle(r.left + r.width / 2, r.top + r.height / 2, '💖');
  if (state.stars % 5 === 0) setTimeout(starMilestone, 900);
  await wait(2400);
  if (tok !== orderToken) return;
  orderEl.classList.add('leave');
  await wait(350);
  if (tok !== orderToken) return;
  newOrder();
}

function starMilestone() {
  Sound.fanfare();
  FX.confetti();
  toast({ emoji: '⭐', title: `${starsText(state.stars)}! أنت طبّاخ رائع!`, kind: 'legend', tag: '🏅', duration: 3600 });
  speakOut(PHRASES.fiveStars, { interrupt: false });
}

function skipOrder() {
  Sound.tap();
  const tok = ++orderToken;
  orderEl.classList.add('leave');
  setTimeout(() => { if (tok === orderToken) newOrder(); }, 330);
}

function onOrderTap() {
  Sound.ensure();
  if (!state.orderTarget) return;
  const now = Date.now();
  orderTaps = now - orderTaps.at < 12000 ? { n: orderTaps.n + 1, at: now } : { n: 1, at: now };
  if (orderTaps.n >= 2) giveHint();
  else speakOut(orderParts(), { by: 'customer' });
}

/* =====================================================================
   Mascot hints (tap the bowl)
   ===================================================================== */
function giveHint() {
  Sound.ensure();
  if (state.busy) return;
  squish();
  Sound.boing();
  let rec = state.orderTarget ? COOKBOOK.stepToward(state.orderTarget, has) : null;
  if (!rec) {
    const cands = COOKBOOK.recipes.filter(r => COOKBOOK.ready(r, has) && !has(r.result));
    if (!cands.length) {
      setFace('happy', 1500);
      say('لقد وجدت كل شيء هنا! أنت رائع! 🏆', { speech: PHRASES.allFound });
      return;
    }
    const minTier = Math.min(...cands.map(r => ITEMS[r.result].tier));
    const pool = cands.filter(r => ITEMS[r.result].tier === minTier);
    rec = pool.find(r => r.key === state.hint.key) || pick(pool);
  }
  const key = rec.key;
  const now = Date.now();
  state.hint = state.hint.key === key && now - state.hint.at < 30000
    ? { key, level: state.hint.level + 1, at: now }
    : { key, level: 1, at: now };
  const [a] = rec.inputs;
  if (state.filter !== 'all') { state.filter = 'all'; renderChips(); renderPantry(); }
  const ids = state.hint.level === 1 ? [a] : rec.inputs;
  pantryGrid.querySelectorAll('.tile.hint').forEach(t => t.classList.remove('hint'));
  ids.forEach(id => {
    const t = findTile(id);
    if (t) { void t.offsetWidth; t.classList.add('hint'); }
  });
  const first = findTile(a);
  if (first) scrollTileIntoView(first);
  setFace('happy', 1500);
  if (state.hint.level === 1) {
    say(`عندي فكرة! جرّب ${ITEMS[a].emoji} ${ITEMS[a].name} مع شيء آخر. اضغط عليّ مرّة أخرى لمساعدة أكبر!`, { revertMs: 6000, speech: [PHRASES.hintA, ITEMS[a].name, PHRASES.hintB] });
  } else {
    const shown = rec.inputs.map(id => `${ITEMS[id].emoji} ${ITEMS[id].name}`).join(' مع ');
    const speech = rec.inputs.flatMap((id, i) => (i ? [PHRASES.with, ITEMS[id].name] : [ITEMS[id].name]));
    say(`جرّب ${shown}!`, { revertMs: 6000, speech: [PHRASES.try, ...speech] });
  }
}

/* =====================================================================
   Modals
   ===================================================================== */
const modalStack = [];
const topModal = () => (modalStack.length ? modalStack[modalStack.length - 1].m : null);

function openModal(m, focusEl) {
  modalStack.push({ m, focus: document.activeElement });
  m.classList.remove('closing');
  m.hidden = false;
  const f = focusEl || m.querySelector('[data-close].icon-btn') || m.querySelector('button');
  if (f) f.focus({ preventScroll: true });
}

function closeModal(m, { silent = false, then } = {}) {
  if (m.hidden || m.classList.contains('closing')) return;
  if (!silent) Sound.tap();
  const i = modalStack.findIndex(x => x.m === m);
  const entry = i >= 0 ? modalStack.splice(i, 1)[0] : null;
  m.classList.add('closing');
  setTimeout(() => {
    m.hidden = true;
    m.classList.remove('closing');
    if (then) then();
  }, reducedMotion.matches ? 20 : 250);
  if (entry && entry.focus && entry.focus.focus && !topModal()) entry.focus.focus({ preventScroll: true });
}

/* =====================================================================
   Sticker album
   ===================================================================== */
function renderBook() {
  $('#bookBar').style.width = (state.discovered.size / TOTAL * 100).toFixed(1) + '%';
  $('#bookCount').textContent = `⭐ ${starsText(state.stars)} · اضغط على أيّ ملصق لتسمعه`;

  bookTabs.replaceChildren(...FILTERS.map(f => {
    const b = el('button', 'chip', f.l);
    b.setAttribute('aria-pressed', String(state.bookTab === f.k));
    b.addEventListener('click', () => { Sound.tap(); state.bookTab = f.k; renderBook(); });
    return b;
  }));

  bookGrid.replaceChildren(...bookOrder.filter(id => matchesFilter(id, state.bookTab)).map(id => {
    const it = ITEMS[id];
    const known = has(id);
    const card = el('button', 'card ' + (known ? itemClasses(id).join(' ') : 'locked'));
    card.dataset.id = id;
    card.style.setProperty('--rot', ((((IDX[id] * 37) % 7) - 3) * 1.2).toFixed(1) + 'deg');
    card.append(emoNode(id), el('span', 'lbl', known ? it.name : '؟'));
    if (!known) {
      if (COOKBOOK.makersOf(id).some(r => COOKBOOK.ready(r, has))) card.classList.add('ready');
      card.setAttribute('aria-label', 'ملصق مخفي');
    } else {
      card.setAttribute('aria-label', it.name);
      if (state.unseen.has(id)) card.appendChild(el('span', 'new'));
    }
    return card;
  }));
}

function eqNode(inputs) {
  const part = id => {
    const s = el('span');
    if (state.discovered.has(id)) s.append(emoNode(id), document.createTextNode(ITEMS[id].name));
    else s.textContent = '؟';
    return s;
  };
  const row = el('div', 'eq');
  inputs.forEach((id, i) => {
    if (i) row.appendChild(el('span', 'plus', '+'));
    row.appendChild(part(id));
  });
  return row;
}

let detailId = null;
function detailSpeech(id) {
  const it = ITEMS[id];
  return state.discovered.has(id) ? [it.name, it.desc] : PHRASES.locked;
}

function showDetail(id) {
  detailId = id;
  const it = ITEMS[id];
  const known = state.discovered.has(id);
  const dEmo = $('#dEmo');
  fillEmo(dEmo, it.emoji, id);
  dEmo.classList.toggle('locked', !known);
  $('#dName').textContent = known ? it.name : '؟';
  const tag = $('#dTag');
  tag.className = 'tag ' + (known ? itemClasses(id).join(' ') : 'locked');
  tag.textContent = `المستوى ${num(it.tier)} · ${known ? KIND_LABEL[it.kind] : 'مخفي'}`;

  const made = $('#dMade');
  const uses = $('#dUses');
  made.replaceChildren();
  uses.replaceChildren();
  const sources = COOKBOOK.makersOf(id);

  if (!known) {
    const ready = sources.some(r => COOKBOOK.ready(r, has));
    $('#dDesc').textContent = ready
      ? '✨ عندك كل ما تحتاجه لهذا الملصق. جرّب في الوعاء!'
      : (it.kind === 'base' ? '🎁 هذا مكوّن مفاجأة! استمرّ في الطبخ لتحصل عليه.' : 'ملصق مخفي! اكتشف مكوّنات أكثر لتجده.');
  } else {
    $('#dDesc').textContent = it.desc;
    if (it.kind === 'base') {
      made.append(el('h4', null, 'من أين؟'), el('div', 'eq', 'مكوّن أساسي، موجود دائمًا في المطبخ!'));
    } else {
      made.appendChild(el('h4', null, 'يُصنع من:'));
      sources.forEach(r => made.appendChild(eqNode(r.inputs)));
    }
    const usedIn = COOKBOOK.usesOf(id);
    if (usedIn.length) {
      uses.appendChild(el('h4', null, 'يدخل في:'));
      const wrap = el('div', 'uses');
      const seen = new Set();
      let secret = 0;
      usedIn.forEach(({ result: r }) => {
        if (seen.has(r)) return;
        seen.add(r);
        if (has(r)) {
          const s = el('span');
          s.append(emoNode(r), document.createTextNode(ITEMS[r].name));
          wrap.appendChild(s);
        } else secret++;
      });
      if (secret) wrap.appendChild(el('span', null, `+ ${secretText(secret)}`));
      uses.appendChild(wrap);
    }
    markSeen(id);
  }
  detail.hidden = false;
  detail.scrollTop = 0;
  $('#detailBack').focus({ preventScroll: true });
  speakOut(detailSpeech(id));
}

function hideDetail() {
  if (detail.hidden) return;
  detail.hidden = true;
  detailId = null;
  renderBook();
}

function openBook() {
  Sound.ensure();
  Sound.tap();
  dismissCoach();
  cancelDrag();
  detail.hidden = true;
  state.albumSeen = state.discovered.size;
  save();
  renderBookBtn();
  renderBook();
  openModal(book, $('#bookClose'));
}

function closeBook() {
  closeModal(book, { then: () => { detail.hidden = true; } });
}

/* =====================================================================
   Parent gate & parents' corner
   ===================================================================== */
const UNITS = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستّة', 'سبعة', 'ثمانية', 'تسعة'];
const TENS = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستّون', 'سبعون', 'ثمانون', 'تسعون'];
const numberWords = n => `${UNITS[n % 10]} و${TENS[Math.floor(n / 10)]}`;
const gateNumber = () => { let n; do { n = 21 + Math.floor(Math.random() * 79); } while (n % 10 === 0); return n; };
let gateAnswer = 0;

function renderGate() {
  gateAnswer = gateNumber();
  const opts = new Set([gateAnswer]);
  const swapped = (gateAnswer % 10) * 10 + Math.floor(gateAnswer / 10); // reversed digits: a common trap
  if (swapped > 20 && swapped % 10 !== 0 && swapped !== gateAnswer) opts.add(swapped);
  while (opts.size < 4) opts.add(gateNumber());
  gateQ.textContent = numberWords(gateAnswer);
  gateOpts.replaceChildren(...[...opts].sort(() => Math.random() - .5).map(n => {
    const b = el('button', null, num(n));
    b.dataset.n = String(n);
    return b;
  }));
}

function openGate() {
  Sound.ensure();
  Sound.tap();
  cancelDrag();
  dismissCoach();
  Narrator.stop();
  renderGate();
  openModal(gate, gateOpts.querySelector('button'));
}

function onGatePick(e) {
  const b = e.target.closest('button');
  if (!b) return;
  if (Number(b.dataset.n) === gateAnswer) {
    Sound.pop();
    closeModal(gate, { silent: true, then: openParents });
  } else {
    Sound.boing();
    gateOpts.classList.remove('wrong');
    void gateOpts.offsetWidth;
    gateOpts.classList.add('wrong');
    renderGate();
  }
}

function openParents() {
  disarmReset();
  renderParents();
  openModal(parents);
}

function renderParents() {
  renderModeList();
  renderSwitches();
  renderVoiceStatus();
  $('#parentStats').textContent =
    `${MODE.name} — الملصقات: ${num(state.discovered.size)} / ${num(TOTAL)} · النجوم: ${num(state.stars)} · مرّات الخلط: ${num(state.stats.mixes)}`;
  renderInstall();
}

function modeProgress(key) {
  const m = KITCHENS[key];
  const total = Object.keys(m.items).length;
  if (key === state.mode) return [state.discovered.size, total];
  const found = new Set(m.start);
  const d = Store.read(m.storeKey);
  if (d && Array.isArray(d.discovered)) d.discovered.forEach(id => { if (m.items[id]) found.add(id); });
  return [found.size, total];
}

function renderModeList() {
  modeList.replaceChildren(...Object.values(KITCHENS).map(m => {
    const [n, total] = modeProgress(m.key);
    const active = m.key === state.mode;
    const card = el('button', 'mode-card' + (active ? ' active' : ''));
    card.dataset.mode = m.key;
    const title = el('b', null, m.name);
    if (active) title.appendChild(el('span', 'mc-now', 'نلعب الآن'));
    const text = el('span', 'mc-text');
    text.append(title, el('small', null, m.blurb));
    card.append(el('span', 'emo', m.logo), text, el('span', 'mc-prog', `${num(n)} / ${num(total)}`));
    card.setAttribute('aria-label', `${m.name}${active ? '، نلعب الآن' : ''}`);
    return card;
  }));
}

function renderSwitches() {
  swVoice.setAttribute('aria-checked', String(state.settings.voice));
  swSfx.setAttribute('aria-checked', String(state.settings.sfx));
  swMusic.setAttribute('aria-checked', String(state.settings.music));
}

const clipsText = n => (n === 1 ? 'مقطع واحد' : n === 2 ? 'مقطعان' : n >= 3 && n <= 10 ? `${num(n)} مقاطع` : `${num(n)} مقطعًا`);

function renderVoiceStatus() {
  const lines = [];
  let bad = false;
  if (Clips.ready) {
    const missing = voiceParts().filter(t => !Clips.has(t)).length;
    lines.push(`✓ صوت طبيعي جاهز: ${clipsText(Clips.count)}.`);
    if (missing) lines.push(`${clipsText(missing)} بلا تسجيل بعد، وستُقرأ بصوت الجهاز.`);
    if (Clips.info.provider === 'elevenlabs') lines.push('الأصوات الطبيعية من ElevenLabs.');
  } else {
    lines.push('لم تُجهَّز الأصوات الطبيعية بعد، لذلك نستخدم صوت الجهاز.');
    if (!Voice.supported) { lines.push('هذا المتصفّح لا يدعم القراءة الصوتية. ستظهر الكلمات مكتوبة فقط.'); bad = true; }
    else if (!Voice.available) { lines.push('لا يوجد صوت عربي على هذا الجهاز. لإضافته: إعدادات الجهاز ← تسهيلات الاستخدام (أو «تحويل النص إلى كلام») ← الأصوات ← العربية.'); bad = true; }
    else lines.push(`صوت الجهاز: ${Voice.name}`);
  }
  voiceStatus.textContent = lines.join(' ');
  voiceStatus.classList.toggle('bad', bad);
  btnTestVoice.hidden = !Clips.ready && !Voice.available;
}

function toggleSetting(key) {
  state.settings[key] = !state.settings[key];
  if (key === 'voice') Narrator.setEnabled(state.settings.voice);
  if (key === 'sfx') Sound.setSfx(state.settings.sfx);
  if (key === 'music') Sound.setMusic(state.settings.music);
  savePrefs();
  renderSwitches();
  Sound.tap();
}

let resetTimer = 0;
function disarmReset() {
  clearTimeout(resetTimer);
  btnReset.classList.remove('armed');
  btnReset.textContent = 'مسح تقدّم هذا المطبخ';
}

function onReset() {
  if (!btnReset.classList.contains('armed')) {
    Sound.boing();
    btnReset.classList.add('armed');
    btnReset.textContent = 'اضغط مرّة أخرى للتأكيد';
    resetTimer = setTimeout(disarmReset, 3500);
    return;
  }
  disarmReset();
  cancelStir();
  if (state.busy || state.mixing || state.pending) { rejectFeedback(); return; }
  Store.clear(MODE.storeKey);
  resetState();
  clearBowl();
  hideResult();
  orderToken++;
  state.filter = 'all';
  state.bookTab = 'all';
  state.orderTarget = null;
  state.customer = null;
  save();
  renderChips();
  renderPantry();
  renderBookBtn();
  closeModal(parents, { silent: true });
  newOrder({ announce: false });
  setFace('meh', 1500);
  FX.puff(window.innerWidth / 2, window.innerHeight / 2);
  Sound.nope();
  toast({ emoji: '🧽', title: 'بدأنا من جديد!', text: `مُسح تقدّم «${MODE.name}».`, kind: 'meh' });
}

let deferredInstall = null;
function renderInstall() {
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const ios = /iP(ad|hone|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  let t;
  if (standalone) t = '✓ اللعبة مثبّتة، وتعمل بدون إنترنت.';
  else if (!/^https?:$/.test(location.protocol)) t = 'لتثبيت اللعبة واللعب بها بدون إنترنت، افتحها من رابط على الإنترنت (وليس كملف).';
  else if (deferredInstall) t = 'ثبّت اللعبة على الشاشة الرئيسية لتعمل بدون إنترنت، ومن غير شريط المتصفّح.';
  else if (ios) t = 'على الآيباد أو الآيفون: اضغط زرّ المشاركة، ثم اختر «إضافة إلى الشاشة الرئيسية».';
  else t = 'من قائمة المتصفّح اختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية».';
  $('#installText').textContent = t;
  btnInstall.hidden = !deferredInstall || standalone;
}

async function onInstall() {
  if (!deferredInstall) return;
  const p = deferredInstall;
  deferredInstall = null;
  try { p.prompt(); await p.userChoice; } catch (e) { /* dismissed */ }
  renderInstall();
}

/* =====================================================================
   Kitchen modes
   ===================================================================== */
function applyBranding() {
  document.documentElement.dataset.mode = state.mode;
  $('#brandLogo').textContent = MODE.logo;
  $('#brandMode').textContent = MODE.name;
  $('#startLogo').textContent = MODE.logo;
  $('#startMode').textContent = MODE.name;
  document.title = `مختبر المطبخ: ${MODE.name}`;
}

function switchMode(key) {
  if (!KITCHENS[key] || key === state.mode) return false;
  cancelStir();
  if (state.busy || state.mixing || state.pending) { rejectFeedback(); return false; }
  cancelDrag();
  dismissCoach();
  Narrator.stop();
  resultToken++;
  orderToken++;
  resultPop.hidden = true;
  clearBowl();
  updateLiquid();
  state.mode = key;
  setModeData(key);
  const returning = loadState();
  applyPendingUnlocks();
  state.filter = 'all';
  state.bookTab = 'all';
  state.orderTarget = null;
  state.customer = null;
  state.lastOrder = null;
  applyBranding();
  renderChips();
  renderPantry();
  renderBookBtn(true);
  savePrefs();
  squish();
  setFace('happy', 1200);
  Sound.pop();
  const c = bowlCenter();
  FX.mini(c.x, c.y);
  speakOut(returning ? MODE.text.back : MODE.text.welcome);
  newOrder();
  return true;
}

/* =====================================================================
   First-run coach
   ===================================================================== */
let coachEl = null;
function showCoach() {
  if (state.stats.mixes > 0 || state.bowl.some(Boolean) || state.pending || reducedMotion.matches) return;
  const tile = findTile(MODE.start[0]);
  if (!tile) return;
  tile.classList.add('coach');
  const from = tile.getBoundingClientRect();
  const to = dropzone.getBoundingClientRect();
  const hand = el('div', 'coach-hand emo', '👆');
  document.body.appendChild(hand);
  coachEl = hand;
  const T = (x, y, s = 1) => `translate(${x - 16}px, ${y - 6}px) scale(${s})`;
  const fx = from.left + from.width / 2, fy = from.top + from.height / 2;
  const tx = to.left + to.width / 2, ty = to.top + to.height * .55;
  anim(hand, [
    { transform: T(fx, fy), opacity: 0 },
    { transform: T(fx, fy, .9), opacity: 1, offset: .15 },
    { transform: T(tx, ty, .9), opacity: 1, offset: .75 },
    { transform: T(tx, ty), opacity: 0 },
  ], { duration: 1800, iterations: 3, easing: 'ease-in-out', fill: 'forwards' }).then(dismissCoach);
}

function dismissCoach() {
  if (coachEl) { coachEl.remove(); coachEl = null; }
  pantryGrid.querySelectorAll('.tile.coach').forEach(t => t.classList.remove('coach'));
}

/* =====================================================================
   Idle nudge from the mascot
   ===================================================================== */
let lastActivity = Date.now();
let lastNudge = 0;
function noteActivity() { lastActivity = Date.now(); }
setInterval(() => {
  const now = Date.now();
  if (!startScreen.hidden || state.busy || topModal() || document.hidden) return;
  if (now - lastActivity > 25000 && now - lastNudge > 90000) {
    lastNudge = now;
    squish();
    setFace('happy', 1500);
    say('اضغط عليّ إذا احتجت مساعدة! 🤗', { revertMs: 5000, speech: PHRASES.nudge });
  }
}, 5000);

/* =====================================================================
   Start screen (also unlocks audio + speech, which need a tap)
   ===================================================================== */
function startGame() {
  if (startScreen.hidden || startScreen.classList.contains('leaving')) return;
  Sound.ensure();
  Voice.unlock();
  Sound.pop();
  if (state.settings.music) Sound.setMusic(true);
  startScreen.classList.add('leaving');
  setTimeout(() => { startScreen.hidden = true; startScreen.classList.remove('leaving'); }, 330);
  noteActivity();
  const returning = state.stats.mixes > 0;
  speakOut(returning ? MODE.text.back : MODE.text.welcome);
  if (state.orderTarget) speakOut(orderParts(), { interrupt: false, by: 'customer' });
  if (!returning) setTimeout(showCoach, 1400);
  setTimeout(() => Clips.preloadAll(), 2500);
}

/* =====================================================================
   Error handling
   ===================================================================== */
let lastErrorToast = 0;
function recover(err) {
  console.error('[KitchenLab]', err);
  try {
    cancelDrag();
    document.querySelectorAll('.ghost').forEach(g => g.remove());
    station.classList.remove('cooking', 'after-stir', 'frying');
    endStir();
    stirrer.cancel();
    fryer.cancel();
    state.busy = false;
    state.mixing = false;
    state.pending = 0;
    clearBowl();
    updateLiquid();
    setFace('meh', 1500);
    if (Date.now() - lastErrorToast > 5000) {
      lastErrorToast = Date.now();
      toast({ emoji: '🧯', title: 'أوه! حدث خطأ صغير', text: 'لا تقلق، ملصقاتك محفوظة. لنكمل الطبخ!', kind: 'meh' });
    }
  } catch (e) { console.error('[KitchenLab] recovery failed', e); }
}

/* =====================================================================
   Offline / install support
   ===================================================================== */
function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return;
  const go = () => navigator.serviceWorker.register('sw.js').catch(e => console.warn('[KitchenLab] offline mode unavailable', e));
  if (document.readyState === 'complete') go();
  else window.addEventListener('load', go);
}

/* =====================================================================
   Wiring
   ===================================================================== */
function init() {
  loadPrefs();
  setModeData(state.mode);
  loadState();
  applyPendingUnlocks();
  applyBranding();
  Sound.setSfx(state.settings.sfx);
  Narrator.setEnabled(state.settings.voice);
  Clips.load();
  FX.resize();
  renderChips();
  renderPantry();
  renderBookBtn();
  clearBowl();
  newOrder({ announce: false });
  bowlCaption();

  $('#btnPlay').addEventListener('click', startGame);

  pantryGrid.addEventListener('pointerdown', onPantryDown);
  pantryGrid.addEventListener('click', e => {
    // Keyboard activation (Enter/Space) arrives as a click with detail 0; pointer taps are handled on pointerup.
    const tile = e.target.closest('.tile');
    if (tile && e.detail === 0) tapAdd(tile.dataset.id, tile);
  });
  pantryGrid.addEventListener('contextmenu', e => e.preventDefault());
  pantryGrid.addEventListener('dragstart', e => e.preventDefault());
  window.addEventListener('pointermove', onPointerMove, { passive: false });
  window.addEventListener('pointerup', onPointerEnd);
  window.addEventListener('pointercancel', onPointerEnd);
  window.addEventListener('blur', cancelDrag);

  slotsEl.addEventListener('click', e => {
    const slot = e.target.closest('.slot');
    if (slot) removeFromSlot(Number(slot.dataset.i));
  });
  btnEmpty.addEventListener('click', () => { for (let i = state.bowl.length - 1; i >= 0; i--) removeFromSlot(i); });
  // While the bowl waits to be stirred, a tap (or Enter) stirs it for the child.
  const onBowlTap = () => (state.stirring ? stirrer.autoStir() : giveHint());
  bowlWrap.addEventListener('click', onBowlTap);
  bowlWrap.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onBowlTap(); }
  });

  orderBubble.addEventListener('click', onOrderTap);
  orderSkip.addEventListener('click', skipOrder);

  btnBook.addEventListener('click', openBook);
  btnParents.addEventListener('click', openGate);

  book.addEventListener('click', e => { if (e.target.closest('[data-close]')) closeBook(); });
  bookGrid.addEventListener('click', e => {
    const card = e.target.closest('.card');
    if (!card) return;
    Sound.tap();
    if (card.classList.contains('locked')) {
      card.classList.remove('shake');
      void card.offsetWidth;
      card.classList.add('shake');
    }
    showDetail(card.dataset.id);
  });
  $('#detailBack').addEventListener('click', () => { Sound.tap(); hideDetail(); });
  $('#detailListen').addEventListener('click', () => { if (detailId) speakOut(detailSpeech(detailId)); });

  gate.addEventListener('click', e => { if (e.target.closest('[data-close]')) closeModal(gate); });
  gateOpts.addEventListener('click', onGatePick);

  parents.addEventListener('click', e => { if (e.target.closest('[data-close]')) closeModal(parents); });
  modeList.addEventListener('click', e => {
    const card = e.target.closest('.mode-card');
    if (!card) return;
    if (card.dataset.mode === state.mode) { Sound.tap(); return; }
    if (switchMode(card.dataset.mode)) closeModal(parents, { silent: true });
  });
  swVoice.addEventListener('click', () => toggleSetting('voice'));
  swSfx.addEventListener('click', () => toggleSetting('sfx'));
  swMusic.addEventListener('click', () => toggleSetting('music'));
  btnTestVoice.addEventListener('click', () => speakOut(PHRASES.test, { force: true }));
  btnReset.addEventListener('click', onReset);
  btnInstall.addEventListener('click', onInstall);
  Voice.onchange = () => { if (!parents.hidden) renderVoiceStatus(); };

  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredInstall = e;
    if (!parents.hidden) renderInstall();
  });
  window.addEventListener('appinstalled', () => { deferredInstall = null; if (!parents.hidden) renderInstall(); });

  document.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !startScreen.hidden) { e.preventDefault(); startGame(); return; }
    const m = topModal();
    if (e.key === 'Escape') {
      if (m === book && !detail.hidden) hideDetail();
      else if (m === book) closeBook();
      else if (m) closeModal(m);
      else cancelDrag();
    }
    if (e.key === 'Tab' && m) {
      // keep focus inside the open dialog
      const scope = m === book && !detail.hidden ? detail : m;
      const f = [...scope.querySelectorAll('button')].filter(b => b.offsetParent !== null && !b.disabled);
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
  });

  // Any tap: count as activity and make sure audio is awake.
  document.addEventListener('pointerdown', () => { noteActivity(); Sound.ensure(); Voice.unlock(); }, true);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { cancelDrag(); Narrator.stop(); Sound.suspend(); } else Sound.resume();
  });

  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    dismissCoach();
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(FX.resize, 120);
  });

  window.addEventListener('error', e => recover(e.error || e.message));
  window.addEventListener('unhandledrejection', e => recover(e.reason));

  if (!Store.ok) savePrefs(); // surface the storage warning once, early
  registerServiceWorker();
}

window.kitchenLabStarted = true; // index.html shows an error if this never gets set
try {
  init();
} catch (err) {
  console.error('[KitchenLab] failed to start', err);
  document.body.insertAdjacentHTML('beforeend',
    '<div dir="rtl" style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;padding:24px;text-align:center;background:#fff4e6;font:20px system-ui;z-index:3000">🔥 تعذّر تشغيل اللعبة. أعد تحميل الصفحة من فضلك.</div>');
}
