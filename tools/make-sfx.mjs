#!/usr/bin/env node
// Makes the silly sounds for The Kitchen Lab (burps, toots, bonks…) with ElevenLabs
// Sound Effects.
//
// tools/sfx-prompts.json describes each sound. This script turns each one into a small
// MP3 in sfx/ and records them in sfx/manifest.json. The game plays those files; a sound
// without a file uses its synthesized stand-in (js/sound.js).
//
// Setup (once per terminal):   export ELEVENLABS_API_KEY="your-key"
//
// Commands (run from the project folder):
//   node tools/make-sfx.mjs plan                 what is missing and roughly what it costs
//   node tools/make-sfx.mjs make [--yes]         make the missing sounds (only spends credits with --yes)
//   node tools/make-sfx.mjs redo <name> [--yes]  make one sound again (each try comes out different)
//   node tools/make-sfx.mjs prune                delete sound files that are no longer used
//
// A sound is remade by "make" when its prompt or length changes.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'sfx');
const MANIFEST = path.join(DIR, 'manifest.json');
const PROMPTS = path.join(ROOT, 'tools', 'sfx-prompts.json');
const API = 'https://api.elevenlabs.io';
const MODEL = 'eleven_text_to_sound_v2';
const FORMAT = 'mp3_44100_64';
const CREDITS_PER_SECOND = 40; // ElevenLabs' price when the length is set

const [, , command = 'plan', ...rest] = process.argv;
const flags = {};
const positional = [];
for (const a of rest) {
  if (a.startsWith('--')) flags[a.slice(2)] = true;
  else positional.push(a);
}

function fail(msg) {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
}

const readJson = (file, fallback) => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; } };
const prompts = () => {
  const p = readJson(PROMPTS, null);
  if (!p || !p.sounds) fail('tools/sfx-prompts.json is missing or broken.');
  return p;
};
const readManifest = () => {
  const m = readJson(MANIFEST, null);
  return m && typeof m.sounds === 'object' ? m : { version: 1, sounds: {}, made: {} };
};
function writeManifest(m) {
  fs.mkdirSync(DIR, { recursive: true });
  const sort = o => Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));
  fs.writeFileSync(MANIFEST, JSON.stringify({ ...m, sounds: sort(m.sounds), made: sort(m.made || {}) }, null, 2) + '\n');
}

// What a sound is made from; it changes when its prompt or length changes.
const recipe = (p, name) => `${MODEL}|${p.sounds[name].seconds}|${p.sounds[name].prompt}|${p.style}`;
const hash = s => crypto.createHash('sha1').update(s).digest('hex').slice(0, 10);
const exists = rel => fs.existsSync(path.join(DIR, rel));

function todo(p, m) {
  return Object.keys(p.sounds).filter(n => !m.sounds[n] || !exists(m.sounds[n]) || m.made?.[n] !== hash(recipe(p, n)));
}
const cost = (p, names) => Math.round(names.reduce((n, k) => n + p.sounds[k].seconds * CREDITS_PER_SECOND, 0));

async function generate(p, name) {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) fail('Set your key first:  export ELEVENLABS_API_KEY="your-key"');
  const s = p.sounds[name];
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`${API}/v1/sound-generation?output_format=${FORMAT}`, {
      method: 'POST',
      headers: { 'xi-api-key': key, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
      body: JSON.stringify({ text: `${s.prompt}. ${p.style}`, duration_seconds: s.seconds, prompt_influence: 0.6, model_id: MODEL }),
    });
    if (res.ok) return Buffer.from(await res.arrayBuffer());
    const detail = (await res.text()).slice(0, 400);
    if (/quota_exceeded/.test(detail)) fail(`You've used this month's credits. ${detail}`);
    if (res.status === 401) fail(`Your API key was rejected (401). ${detail}`);
    if ((res.status === 429 || res.status >= 500) && attempt < 5) {
      console.log(`   … busy (${res.status}), retrying in ${2 * attempt}s`);
      await new Promise(r => setTimeout(r, 2000 * attempt));
      continue;
    }
    fail(`Could not make "${name}" (${res.status}): ${detail}`);
  }
}

async function makeAll(names, { fresh = false } = {}) {
  const p = prompts();
  const m = readManifest();
  m.made = m.made || {};
  console.log(`\n${names.length} sound(s) to make · about ${cost(p, names)} credits.`);
  if (!names.length) return console.log('Everything is already made. 🎉\n');
  if (!flags.yes) return console.log('\nNothing was sent yet. Add --yes to make them.\n');
  fs.mkdirSync(DIR, { recursive: true });
  let i = 0;
  for (const name of names) {
    const audio = await generate(p, name);
    // A new file name each time, so the offline cache never keeps an old copy.
    const file = `${name}-${hash(recipe(p, name) + (fresh ? Date.now() : ''))}.mp3`;
    if (m.sounds[name] && m.sounds[name] !== file && exists(m.sounds[name])) fs.unlinkSync(path.join(DIR, m.sounds[name]));
    fs.writeFileSync(path.join(DIR, file), audio);
    m.sounds[name] = file;
    m.made[name] = hash(recipe(p, name));
    console.log(`  ${String(++i).padStart(2)}/${names.length}  ${name}  (${(audio.length / 1024).toFixed(0)} KB)`);
    writeManifest({ ...m, provider: 'elevenlabs', model: MODEL, updatedAt: new Date().toISOString() });
  }
  for (const n of Object.keys(m.sounds)) if (!p.sounds[n]) { delete m.sounds[n]; delete m.made[n]; }
  writeManifest({ ...m, provider: 'elevenlabs', model: MODEL, updatedAt: new Date().toISOString() });
  console.log('\n✓ Done. Reload the game to hear them.\n');
}

const commands = {
  plan() {
    const p = prompts();
    const m = readManifest();
    const t = todo(p, m);
    const all = Object.keys(p.sounds);
    console.log(`\n${all.length} silly sounds. Ready: ${all.length - t.length}. Missing or changed: ${t.length} (about ${cost(p, t)} credits).`);
    if (t.length) console.log(`  ${t.join(', ')}\n\nNext:  node tools/make-sfx.mjs make --yes`);
    console.log('');
  },
  make: () => makeAll(todo(prompts(), readManifest())),
  redo() {
    const p = prompts();
    const bad = positional.filter(n => !p.sounds[n]);
    if (!positional.length || bad.length) fail(`Usage: node tools/make-sfx.mjs redo <name> [--yes]. Names: ${Object.keys(p.sounds).join(', ')}`);
    return makeAll(positional, { fresh: true });
  },
  prune() {
    const m = readManifest();
    const used = new Set(Object.values(m.sounds));
    let removed = 0;
    if (fs.existsSync(DIR)) for (const f of fs.readdirSync(DIR)) {
      if (f.endsWith('.mp3') && !used.has(f)) { fs.unlinkSync(path.join(DIR, f)); removed++; }
    }
    console.log(`\nRemoved ${removed} unused sound file(s).\n`);
  },
};
if (!commands[command]) fail(`Unknown command "${command}". Use: ${Object.keys(commands).join(', ')}`);
Promise.resolve(commands[command]()).catch(e => fail(e.message || String(e)));
