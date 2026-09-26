#!/usr/bin/env node
// Checks the game data after you add or change items, recipes or kitchens.
//
//   node tools/check-data.mjs      (or: npm run check)
//
// Errors (✖) break the game and must be fixed: unknown ids, clashing recipes,
// dishes that can never be made, files missing from the offline cache.
// Warnings (!) still play fine: a missing picture shows the emoji, a missing
// voice clip uses the device's voice.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { KITCHENS, checkKitchen } from '../js/kitchens.js';
import { voiceParts, castParts } from '../js/voice-lines.js';
import { ITEMS } from '../data/items.js';
import { CUSTOMERS } from '../data/customers.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const exists = rel => fs.existsSync(path.join(ROOT, rel));
const errors = [];
const warnings = [];

// Kitchens: tiers, recipes, starters, reachability.
for (const k of Object.values(KITCHENS)) {
  checkKitchen(k).forEach(p => errors.push(`${k.key}: ${p}`));
  console.log(`${k.logo} ${k.name} (${k.key}): ${k.ids.length} items, ${k.cookbook.recipes.length} recipes, bowl of ${k.bowl}`);
}

// Catalog entries no kitchen uses (their words are not voiced and they never appear).
const used = new Set(Object.values(KITCHENS).flatMap(k => k.ids));
for (const id of Object.keys(ITEMS)) if (!used.has(id)) warnings.push(`"${id}" is in data/items.js but no kitchen uses it`);

// Pictures and their prompts.
const prompts = JSON.parse(read('tools/image-prompts.json'));
const arts = [...used, ...CUSTOMERS.map(c => c.art)];
const noPicture = arts.filter(id => !exists(`img/${id}.webp`));
const noPrompt = arts.filter(id => !prompts.images?.[id] && !prompts.aliases?.[id]);
if (noPicture.length) warnings.push(`no picture yet (shows the emoji): ${noPicture.join(', ')}`);
if (noPrompt.length) warnings.push(`no prompt in tools/image-prompts.json: ${noPrompt.join(', ')}`);

// Voice clips.
let clips = {};
try { clips = JSON.parse(read('voice/manifest.json')).clips || {}; } catch { /* none yet */ }
const unvoiced = [...voiceParts(), ...castParts()].filter(t => !clips[t] || !exists(`voice/${clips[t]}`));
if (unvoiced.length) warnings.push(`${unvoiced.length} line(s) have no voice clip. Run: node tools/make-voice.mjs plan`);

// Silly sounds: every stand-in in js/sound.js should have a prompt, and the other way round.
const sfx = JSON.parse(read('tools/sfx-prompts.json')).sounds;
const silly = read('js/sound.js').slice(read('js/sound.js').indexOf('const SYNTH'), read('js/sound.js').indexOf('// --- recorded clips'));
const standIns = [...silly.matchAll(/^    (\w+): \(\) =>/gm)].map(m => m[1]);
standIns.filter(n => !sfx[n]).forEach(n => warnings.push(`silly sound "${n}" has no prompt in tools/sfx-prompts.json`));
Object.keys(sfx).filter(n => !standIns.includes(n)).forEach(n => errors.push(`tools/sfx-prompts.json: "${n}" has no stand-in in js/sound.js (SYNTH)`));
let sounds = {};
try { sounds = JSON.parse(read('sfx/manifest.json')).sounds || {}; } catch { /* none yet */ }
const noSfx = Object.keys(sfx).filter(n => !sounds[n] || !exists(`sfx/${sounds[n]}`));
if (noSfx.length) warnings.push(`${noSfx.length} silly sound(s) not recorded yet (a stand-in plays). Run: node tools/make-sfx.mjs plan`);

// Offline cache: every code, style and data file must be listed in sw.js.
const sw = read('sw.js');
const walk = dir => fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })
  .flatMap(e => (e.isDirectory() ? walk(`${dir}/${e.name}`) : [`${dir}/${e.name}`]));
for (const f of ['css', 'js', 'data'].flatMap(walk).filter(f => /\.(js|css)$/.test(f))) {
  if (!sw.includes(`'./${f}'`)) errors.push(`sw.js: add './${f}' to ASSETS, or the game won't work offline`);
}

console.log('');
warnings.forEach(w => console.log(`! ${w}`));
errors.forEach(e => console.log(`✖ ${e}`));
if (errors.length) {
  console.log(`\n${errors.length} error(s) to fix.\n`);
  process.exit(1);
}
console.log(`\n✓ Data looks good${warnings.length ? ` (${warnings.length} warning(s))` : ''}.\n`);
