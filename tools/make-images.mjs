#!/usr/bin/env node
// Turns the sticker pictures in img/src/ into small game-ready images in img/.
//
// The pictures come from ElevenLabs (Nano Banana 2) using the prompts in
// tools/image-prompts.json, saved as img/src/<item id>.webp at 1024×1024.
// For each one this script:
//   1. removes the white background (only the white touching the edges, so egg
//      whites, milk and chef hats stay white) and softens the outline's edge,
//   2. trims the empty space around the picture so every sticker looks the same size,
//   3. saves a 256×256 WebP with a transparent background to img/<item id>.webp.
// It also writes img/manifest.json, which the offline cache reads.
// The game shows the picture when there is one and falls back to the emoji otherwise.
//
// Needs ffmpeg (brew install ffmpeg). Run from the project folder:
//   node tools/make-images.mjs            process every picture in img/src/
//   node tools/make-images.mjs egg milk   process only these

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'img', 'src');
const OUT = path.join(ROOT, 'img');
const PROMPTS = path.join(ROOT, 'tools', 'image-prompts.json');
const FFMPEG = process.env.FFMPEG || 'ffmpeg';
const SIZE = 256;       // output size; the largest sticker on screen is ~112 CSS px
const LIGHT = 200;      // pixels lighter than this (every channel) can be background
const PAD = 0.04;       // space kept around the trimmed sticker

function fail(msg) {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
}

function ffmpeg(args, input) {
  const r = spawnSync(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', ...args], { input, maxBuffer: 64 << 20 });
  if (r.error) fail(`Could not run ffmpeg (${r.error.code}). Install it with: brew install ffmpeg`);
  if (r.status !== 0) fail(`ffmpeg failed: ${r.stderr.toString().slice(0, 400)}`);
  return r.stdout;
}

function probeSize(file) {
  // ffmpeg prints the size on stderr; decoding one frame to raw tells us for sure.
  const raw = ffmpeg(['-i', file, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-']);
  const side = Math.round(Math.sqrt(raw.length / 4));
  if (side * side * 4 !== raw.length) fail(`${path.basename(file)} is not square.`);
  return { raw, side };
}

// Flood-fill the light background in from the edges. Filled pixels become
// transparent in proportion to how close they are to the background, and their
// colour is "un-mixed" from it so the anti-aliased outline edge stays clean.
// The background is measured from the edge pixels, because a few pictures came
// back on light grey instead of pure white.
function cutBackground(px, side) {
  const n = side * side;
  const seen = new Uint8Array(n);
  const queue = new Int32Array(n);
  let head = 0, tail = 0;
  const lum = i => Math.min(px[i * 4], px[i * 4 + 1], px[i * 4 + 2]);
  const light = i => lum(i) >= LIGHT;
  const edge = [];
  for (let k = 0; k < side; k += 8) edge.push(lum(k), lum(n - side + k), lum(k * side), lum(k * side + side - 1));
  edge.sort((a, b) => a - b);
  const bg = Math.max(LIGHT + 20, edge[edge.length >> 1]);
  const push = i => { if (!seen[i] && light(i)) { seen[i] = 1; queue[tail++] = i; } };
  for (let k = 0; k < side; k++) {
    push(k); push(n - side + k); push(k * side); push(k * side + side - 1);
  }
  while (head < tail) {
    const i = queue[head++];
    const x = i % side;
    if (x > 0) push(i - 1);
    if (x < side - 1) push(i + 1);
    if (i >= side) push(i - side);
    if (i < n - side) push(i + side);
  }
  for (let i = 0; i < n; i++) {
    if (!seen[i]) continue;
    const o = i * 4;
    const a = Math.max(0, Math.min(1, (bg - lum(i)) / (bg - LIGHT)));
    if (a < 0.02) { px[o + 3] = 0; continue; }
    for (let c = 0; c < 3; c++) px[o + c] = Math.max(0, Math.min(255, Math.round((px[o + c] - bg * (1 - a)) / a)));
    px[o + 3] = Math.round(255 * a);
  }
}

// Square box around everything that is not transparent, plus a little padding.
function trimBox(px, side) {
  let x0 = side, y0 = side, x1 = -1, y1 = -1;
  for (let y = 0; y < side; y++) {
    for (let x = 0; x < side; x++) {
      if (px[(y * side + x) * 4 + 3] < 24) continue;
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) return { x: 0, y: 0, w: side };
  let w = Math.max(x1 - x0, y1 - y0) + 1;
  w = Math.min(side, Math.round(w * (1 + PAD * 2)));
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const x = Math.max(0, Math.min(side - w, Math.round(cx - w / 2)));
  const y = Math.max(0, Math.min(side - w, Math.round(cy - w / 2)));
  return { x, y, w };
}

function processOne(id) {
  const file = path.join(SRC, id + '.webp');
  const { raw, side } = probeSize(file);
  cutBackground(raw, side);
  const { x, y, w } = trimBox(raw, side);
  ffmpeg([
    '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${side}x${side}`, '-i', '-',
    '-vf', `crop=${w}:${w}:${x}:${y},scale=${SIZE}:${SIZE}:flags=lanczos,format=yuva420p`,
    '-c:v', 'libwebp', '-quality', '85', '-compression_level', '6',
    path.join(OUT, id + '.webp'),
  ], raw);
  return fs.statSync(path.join(OUT, id + '.webp')).size;
}

if (!fs.existsSync(SRC)) fail('No pictures yet. Save them as img/src/<item id>.webp first.');
const all = fs.readdirSync(SRC).filter(f => f.endsWith('.webp')).map(f => f.slice(0, -5)).sort();
const wanted = process.argv.slice(2);
const ids = wanted.length ? wanted : all;
for (const id of ids) if (!all.includes(id)) fail(`img/src/${id}.webp does not exist.`);

let bytes = 0;
for (const [i, id] of ids.entries()) {
  const size = processOne(id);
  bytes += size;
  console.log(`  ${String(i + 1).padStart(3)}/${ids.length}  ${id}  ${(size / 1024).toFixed(1)} KB`);
}

// Items that reuse another item's picture (e.g. the sweet kitchen's "pancake").
const { aliases = {} } = JSON.parse(fs.readFileSync(PROMPTS, 'utf8'));
for (const [alias, id] of Object.entries(aliases)) {
  if (fs.existsSync(path.join(OUT, id + '.webp'))) fs.copyFileSync(path.join(OUT, id + '.webp'), path.join(OUT, alias + '.webp'));
}

const images = fs.readdirSync(OUT).filter(f => f.endsWith('.webp')).sort();
fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify({ version: 1, size: SIZE, images }, null, 2) + '\n');
console.log(`\n✓ ${ids.length} picture(s) ready (${(bytes / 1024).toFixed(0)} KB). ${images.length} in img/manifest.json.\n`);
