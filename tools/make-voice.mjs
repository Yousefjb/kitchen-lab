#!/usr/bin/env node
// Makes natural Arabic voice clips for The Kitchen Lab with ElevenLabs.
//
// The game lists every line it can say (voiceParts() in js/voice-lines.js).
// This script turns each line into a small MP3 in voice/ar/ and records them in
// voice/manifest.json. The game plays those files and only falls back to the
// device's robotic voice for a line that has no clip yet.
//
// Setup (once): create an ElevenLabs account, copy your API key, then in a terminal:
//   export ELEVENLABS_API_KEY="your-key"      # keep this private; never commit it
//
// Commands (run from the project folder):
//   node tools/make-voice.mjs plan                      what is missing and how many characters it costs
//   node tools/make-voice.mjs design [--desc "..."]     FREE PLAN: create 3 sample Arabic voices to listen to
//   node tools/make-voice.mjs keep <generated_voice_id> save the sample you liked as your own voice
//   node tools/make-voice.mjs find [words]              browse Voice Library voices (API use needs a paid plan)
//   node tools/make-voice.mjs add <owner_id> <voice_id> add a Voice Library voice to your account (paid plan)
//   node tools/make-voice.mjs voices                    list the voices in your account
//   node tools/make-voice.mjs make --voice <voice_id> [--model eleven_multilingual_v2] [--yes]
//   node tools/make-voice.mjs cast [cust-bear …] [--yes] design a voice of their own for each customer
//   node tools/make-voice.mjs prune                     delete clip files that are no longer used
//
// Free plan: Voice Library voices can't be used through the API, but voices you
// design yourself can. So on the free plan: design → keep → make.
//
// "make" only spends credits when you add --yes, skips clips that already exist,
// and can be re-run safely if it stops halfway.
//
// Lines with [acting notes] (e.g. "[giggles] هيهي!") are made with eleven_v3, which acts
// them out. Customers' own lines ("cust-bear: …") use that customer's voice (see "cast")
// and eleven_v3 too.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { voiceParts, castParts, splitCast, TAGGED } from '../js/voice-lines.js';
import { CUSTOMERS } from '../data/customers.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VOICE_DIR = path.join(ROOT, 'voice');
const CLIP_DIR = path.join(VOICE_DIR, 'ar');
const MANIFEST = path.join(VOICE_DIR, 'manifest.json');
const API = 'https://api.elevenlabs.io';
const DEFAULT_MODEL = 'eleven_multilingual_v2';
const FORMAT = 'mp3_22050_32'; // small files, clear speech; available on the free tier
const LANGUAGE_CODE_MODELS = new Set(['eleven_flash_v2_5', 'eleven_turbo_v2_5']);
const ACTING_MODEL = 'eleven_v3'; // for lines with [acting notes], and the customers

const [, , command = 'plan', ...rest] = process.argv;
const flags = {};
const positional = [];
for (let i = 0; i < rest.length; i++) {
  const a = rest[i];
  if (a.startsWith('--')) {
    const key = a.slice(2);
    const next = rest[i + 1];
    if (next && !next.startsWith('--')) { flags[key] = next; i++; } else flags[key] = true;
  } else positional.push(a);
}

function fail(msg) {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
}

function apiKey() {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) fail('Set your key first:  export ELEVENLABS_API_KEY="your-key"');
  return key;
}

async function api(pathname, { method = 'GET', body, accept = 'application/json' } = {}) {
  const res = await fetch(API + pathname, {
    method,
    headers: { 'xi-api-key': apiKey(), 'Content-Type': 'application/json', Accept: accept },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res;
}

const PAID_VOICE_HELP = `This voice comes from the Voice Library, which the free plan can't use through the API.
  Free option:  node tools/make-voice.mjs design      (make your own Arabic voice, then "keep" it)
  Paid option:  upgrade to the Starter plan, then run the same "make" command again.`;

function explain(status, text) {
  if (status === 402 || /paid_plan_required|payment_required/.test(text)) return PAID_VOICE_HELP;
  if (/quota_exceeded/.test(text)) return `You've used this month's credits. ${text.slice(0, 300)}`;
  if (status === 401) return `Your API key was rejected (401). ${text.slice(0, 300)}`;
  return `ElevenLabs said ${status}: ${text.slice(0, 400)}`;
}

async function apiJson(pathname, opts) {
  const res = await api(pathname, opts);
  const text = await res.text();
  if (!res.ok) fail(explain(res.status, text));
  return JSON.parse(text);
}

// Every line the game can speak, from the game's own data: the mascot's, then the customers'.
const loadLines = () => [...voiceParts(), ...castParts()];

// Which voice and model make a line. Null voice: that customer has no voice yet ("cast").
function voiceFor(key, m, voiceId, model) {
  const { who, text } = splitCast(key);
  if (who) return { voice: m.cast?.[who]?.voiceId || null, model: ACTING_MODEL, text };
  return { voice: voiceId, model: TAGGED.test(text) ? ACTING_MODEL : model, text };
}

function readManifest() {
  try {
    const m = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
    if (m && typeof m.clips === 'object') return m;
  } catch { /* first run */ }
  return { version: 1, clips: {} };
}

function writeManifest(m) {
  fs.mkdirSync(VOICE_DIR, { recursive: true });
  const sorted = Object.fromEntries(Object.entries(m.clips).sort(([x], [y]) => x.localeCompare(y, 'ar')));
  fs.writeFileSync(MANIFEST, JSON.stringify({ ...m, clips: sorted }, null, 2) + '\n');
}

const clipFile = (text, voiceId, model) =>
  'ar/' + crypto.createHash('sha1').update(`${model}|${voiceId}|${FORMAT}|${text}`).digest('hex').slice(0, 12) + '.mp3';

const exists = rel => fs.existsSync(path.join(VOICE_DIR, rel));

function plan(voiceId, model) {
  const lines = loadLines();
  const m = readManifest();
  const uncast = new Set();
  let waiting = 0; // customers' lines that wait for their voice
  const todo = lines.filter(t => {
    const v = voiceFor(t, m, voiceId, model);
    if (!v.voice) {
      if (splitCast(t).who) { uncast.add(splitCast(t).who); waiting++; return false; }
      return !m.clips[t] || !exists(m.clips[t]);
    }
    return m.clips[t] !== clipFile(v.text, v.voice, v.model) || !exists(m.clips[t]);
  });
  const chars = todo.reduce((n, t) => n + voiceFor(t, m, voiceId, model).text.length, 0);
  return { lines, todo, chars, manifest: m, uncast: [...uncast], waiting };
}

function voiceSettings(model) {
  if (model.startsWith('eleven_v3')) return { stability: 0.5 }; // "natural": acts, but stays on script
  // Warm and steady for young listeners, slightly slower than normal.
  return { stability: 0.5, similarity_boost: 0.8, style: 0.25, use_speaker_boost: true, speed: 0.92 };
}

async function synthesize(text, voiceId, model) {
  for (let attempt = 1; ; attempt++) {
    const body = { text, model_id: model, voice_settings: voiceSettings(model) };
    if (LANGUAGE_CODE_MODELS.has(model)) body.language_code = 'ar';
    const res = await api(`/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=${FORMAT}`, {
      method: 'POST', body, accept: 'audio/mpeg',
    });
    if (res.ok) return Buffer.from(await res.arrayBuffer());
    const detail = (await res.text()).slice(0, 400);
    if (res.status === 401 || res.status === 402 || /paid_plan_required|quota_exceeded/.test(detail)) fail(explain(res.status, detail));
    if ((res.status === 429 || res.status >= 500) && attempt < 5) {
      const pause = 2000 * attempt;
      console.log(`   … busy (${res.status}), retrying in ${pause / 1000}s`);
      await new Promise(r => setTimeout(r, pause));
      continue;
    }
    fail(`Could not make «${text}» (${res.status}): ${detail}`);
  }
}

async function cmdPlan() {
  const m = readManifest();
  const voiceId = flags.voice || m.voiceId;
  const model = flags.model || m.model || DEFAULT_MODEL;
  const { lines, todo, chars, uncast, waiting } = plan(voiceId, model);
  console.log(`\nThe game can say ${lines.length} different lines (${lines.reduce((n, t) => n + t.length, 0)} characters).`);
  console.log(`Clips ready: ${lines.length - todo.length - waiting}. Missing: ${todo.length} (${chars} characters ≈ ${chars} credits; acting lines on eleven_v3 may cost more).`);
  if (m.voiceId) console.log(`Current voice: ${m.voiceName || m.voiceId} · model ${m.model}`);
  if (uncast.length) console.log(`${waiting} customer lines wait for a voice: ${uncast.join(', ')}\n  Give them one:  node tools/make-voice.mjs cast --yes`);
  if (todo.length) {
    console.log('\nNext step:');
    console.log(voiceId
      ? `  node tools/make-voice.mjs make --voice ${voiceId} --yes`
      : '  node tools/make-voice.mjs find        (pick a voice, then run "make --voice <id>")');
  }
  console.log('');
}

// Voice Design: describe a voice and get 3 samples reading real lines from the game.
const DEFAULT_DESCRIPTION =
  'A warm, gentle and cheerful young adult female voice speaking clear Modern Standard Arabic (Fusha) ' +
  'with a natural native Arabic accent, like a kind kindergarten teacher reading a story to young children. ' +
  'Smiling, friendly tone, calm and clear pace, perfect audio quality.';
const SAMPLE_TEXT =
  'أهلًا بك في مختبر المطبخ! أنا طبّوخ. هيّا نطبخ معًا! ليلى تريد بيض مقلي. ' +
  'واو! اكتشاف جديد: بيض مقلي! صباح الخير! بيضة ذهبية تبتسم لك.';

async function cmdDesign() {
  const description = typeof flags.desc === 'string' ? flags.desc : DEFAULT_DESCRIPTION;
  const model = typeof flags.model === 'string' ? flags.model : 'eleven_multilingual_ttv_v2';
  console.log('\nDesigning 3 sample voices (uses a few hundred credits)…');
  const data = await apiJson('/v1/text-to-voice/design', {
    method: 'POST',
    body: { voice_description: description, model_id: model, text: SAMPLE_TEXT, output_format: 'mp3_44100_128' },
  });
  const dir = path.join(VOICE_DIR, 'previews');
  fs.mkdirSync(dir, { recursive: true });
  const saved = [];
  (data.previews || []).forEach((p, i) => {
    const file = path.join(dir, `sample-${i + 1}.mp3`);
    fs.writeFileSync(file, Buffer.from(p.audio_base_64, 'base64'));
    saved.push({ file, id: p.generated_voice_id });
  });
  fs.writeFileSync(path.join(dir, 'samples.json'), JSON.stringify({ description, model, samples: saved }, null, 2));
  if (!saved.length) fail('No samples came back. Try again, or change the description with --desc "...".');
  console.log('\nListen to the samples (double-click to play):\n');
  saved.forEach((s, i) => {
    console.log(`  ${i + 1}. ${path.relative(ROOT, s.file)}`);
    console.log(`     keep it:  node tools/make-voice.mjs keep ${s.id}`);
  });
  console.log('\nNone quite right? Run "design" again (each run gives new voices), or describe it yourself:');
  console.log('  node tools/make-voice.mjs design --desc "warm female Arabic storyteller, soft and slow"\n');
}

async function cmdKeep() {
  const [generatedId] = positional;
  if (!generatedId) fail('Usage: node tools/make-voice.mjs keep <generated_voice_id>   (copy it from "design")');
  let description = DEFAULT_DESCRIPTION;
  try { description = JSON.parse(fs.readFileSync(path.join(VOICE_DIR, 'previews', 'samples.json'), 'utf8')).description; } catch { /* default */ }
  const data = await apiJson('/v1/text-to-voice', {
    method: 'POST',
    body: { voice_name: typeof flags.name === 'string' ? flags.name : 'Tabbookh (Arabic)', voice_description: description, generated_voice_id: generatedId },
  });
  console.log(`\n✓ Saved to your voices. Voice id: ${data.voice_id}`);
  console.log(`Next: node tools/make-voice.mjs make --voice ${data.voice_id} --yes\n`);
}

async function cmdFind() {
  console.log('\nNote: the free plan can\'t use these voices through the API. On the free plan use "design" instead.');
  const q = new URLSearchParams({ language: 'ar', gender: 'female', page_size: '30', sort: 'usage_character_count_1y' });
  if (positional.length) q.set('search', positional.join(' '));
  const data = await apiJson(`/v1/shared-voices?${q}`);
  const voices = data.voices || [];
  if (!voices.length) return console.log('\nNo voices found. Try: node tools/make-voice.mjs find storyteller\n');
  console.log('\nArabic female voices from the ElevenLabs Voice Library (open the preview links to listen):\n');
  voices.forEach((v, i) => {
    const tags = [v.accent, v.age, v.descriptive, v.use_case].filter(Boolean).join(', ');
    console.log(`${String(i + 1).padStart(2)}. ${v.name}${tags ? ' — ' + tags : ''}${v.free_users_allowed === false ? '  (paid plans only)' : ''}`);
    if (v.preview_url) console.log(`    listen: ${v.preview_url}`);
    console.log(`    add:    node tools/make-voice.mjs add ${v.public_owner_id} ${v.voice_id}`);
  });
  console.log('\nAfter adding one, run:  node tools/make-voice.mjs make --voice <voice_id> --yes\n');
}

async function cmdAdd() {
  const [owner, voiceId] = positional;
  if (!owner || !voiceId) fail('Usage: node tools/make-voice.mjs add <owner_id> <voice_id>   (copy it from "find")');
  const data = await apiJson(`/v1/voices/add/${encodeURIComponent(owner)}/${encodeURIComponent(voiceId)}`, {
    method: 'POST', body: { new_name: flags.name || 'Tabbookh Arabic' },
  });
  console.log(`\n✓ Added to your voices. Voice id: ${data.voice_id}`);
  console.log(`Next: node tools/make-voice.mjs make --voice ${data.voice_id} --yes\n`);
}

async function cmdVoices() {
  const data = await apiJson('/v1/voices');
  console.log('\nVoices in your account:\n');
  for (const v of data.voices || []) {
    const labels = Object.values(v.labels || {}).join(', ');
    console.log(`  ${v.voice_id}  ${v.name}${labels ? ' — ' + labels : ''}`);
  }
  console.log('');
}

async function cmdMake() {
  const m = readManifest();
  const voiceId = flags.voice || m.voiceId;
  const model = flags.model || m.model || DEFAULT_MODEL;
  if (!voiceId) fail('Choose a voice:  node tools/make-voice.mjs make --voice <voice_id>   (see "find" or "voices")');
  const { lines, todo, chars, uncast } = plan(voiceId, model);
  console.log(`\nVoice ${voiceId} · model ${model}`);
  if (uncast.length) console.log(`Skipping customers without a voice yet: ${uncast.join(', ')} (run "cast" first).`);
  console.log(`${todo.length} of ${lines.length} clips to make · ${chars} characters (≈ ${chars} credits).`);
  if (!todo.length) return console.log('Everything is already made. 🎉\n');
  if (!flags.yes) return console.log('\nNothing was sent yet. Add --yes to make them.\n');

  let voiceName = m.voiceId === voiceId ? m.voiceName : undefined;
  if (!voiceName) {
    const res = await api(`/v1/voices/${encodeURIComponent(voiceId)}`);
    if (res.ok) voiceName = (await res.json()).name;
  }
  // A changed voice or model shows up as a changed file name, so only those clips are remade.
  const manifest = { ...m, version: 1, provider: 'elevenlabs', voiceId, voiceName, model, format: FORMAT };

  fs.mkdirSync(CLIP_DIR, { recursive: true });
  let made = 0;
  for (const key of todo) {
    const v = voiceFor(key, manifest, voiceId, model);
    const rel = clipFile(v.text, v.voice, v.model);
    const audio = await synthesize(v.text, v.voice, v.model);
    fs.writeFileSync(path.join(VOICE_DIR, rel), audio);
    manifest.clips[key] = rel;
    made++;
    console.log(`  ${String(made).padStart(3)}/${todo.length}  ${key}`);
    if (made % 5 === 0) writeManifest({ ...manifest, updatedAt: new Date().toISOString() });
  }
  // Forget lines the game no longer says (files stay until "prune").
  const keep = new Set(lines);
  for (const t of Object.keys(manifest.clips)) if (!keep.has(t)) delete manifest.clips[t];
  writeManifest({ ...manifest, updatedAt: new Date().toISOString() });
  console.log(`\n✓ Made ${made} clips. Reload the game to hear the new voice.\n`);
}

// A voice of their own for each customer, designed from their `voice` in data/customers.js.
// Keeps the first of the 3 designs and saves it to your ElevenLabs voices; the sample is in
// voice/previews/<art>.mp3. Don't like one? Run "cast <art> --redo --yes" for a new design.
const CAST_MODEL = 'eleven_ttv_v3';
const CAST_STYLE = 'Speaks Modern Standard Arabic (Fusha) with a natural native Arabic accent. ' +
  'A cartoon character in a children\'s cooking game: expressive, funny and warm, perfect audio quality.';

async function cmdCast() {
  const m = readManifest();
  const pickArts = positional.length ? positional : CUSTOMERS.map(c => c.art);
  const unknown = pickArts.filter(a => !CUSTOMERS.some(c => c.art === a));
  if (unknown.length) fail(`Unknown customer(s): ${unknown.join(', ')}. Use: ${CUSTOMERS.map(c => c.art).join(', ')}`);
  const todo = CUSTOMERS.filter(c => pickArts.includes(c.art) && (flags.redo || !m.cast?.[c.art]?.voiceId));
  console.log(`\n${todo.length} customer voice(s) to design${todo.length ? ': ' + todo.map(c => c.art).join(', ') : ''}.`);
  if (!todo.length) return console.log('Every customer already has a voice. (Add --redo to design one again.)\n');
  console.log('Each design costs a few hundred credits.');
  if (!flags.yes) return console.log('\nNothing was sent yet. Add --yes to design them.\n');
  const dir = path.join(VOICE_DIR, 'previews');
  fs.mkdirSync(dir, { recursive: true });
  const blocked = [];
  for (const c of todo) {
    let text = [c.lines.yum, ...c.lines.poke, c.lines.yuck].join(' ');
    while (text.length < 120) text += ' ' + c.lines.yum;
    const res = await api('/v1/text-to-voice/design', {
      method: 'POST',
      body: { voice_description: `${c.voice}. ${CAST_STYLE}`, model_id: CAST_MODEL, text: text.slice(0, 1000), output_format: 'mp3_44100_128' },
    });
    const raw = await res.text();
    // ElevenLabs' safety filter can refuse a description: skip that customer and carry on.
    if (res.status === 403 && /blocked_generation/.test(raw)) {
      blocked.push(c.art);
      console.log(`  ✖ ${c.art} (${c.name}): ElevenLabs blocked this voice description. Reword its "voice" in data/customers.js.`);
      continue;
    }
    if (!res.ok) fail(explain(res.status, raw));
    const data = JSON.parse(raw);
    const first = (data.previews || [])[0];
    if (!first) fail(`No voice came back for ${c.art}. Try again, or change its "voice" in data/customers.js.`);
    fs.writeFileSync(path.join(dir, `${c.art}.mp3`), Buffer.from(first.audio_base_64, 'base64'));
    const saved = await apiJson('/v1/text-to-voice', {
      method: 'POST',
      body: { voice_name: `Kitchen Lab · ${c.name}`, voice_description: `${c.voice}. ${CAST_STYLE}`.slice(0, 1000), generated_voice_id: first.generated_voice_id },
    });
    m.cast = { ...m.cast, [c.art]: { voiceId: saved.voice_id, name: c.name } };
    writeManifest({ ...m, updatedAt: new Date().toISOString() });
    console.log(`  ✓ ${c.art} (${c.name}) → ${saved.voice_id}   sample: voice/previews/${c.art}.mp3`);
  }
  if (blocked.length) console.log(`\nBlocked: ${blocked.join(', ')}. After rewording, run "cast" again (it skips the ones already done).`);
  console.log('\nNext, make their lines:  node tools/make-voice.mjs make --yes\n');
}

async function cmdPrune() {
  const m = readManifest();
  const used = new Set(Object.values(m.clips).map(f => path.basename(f)));
  let removed = 0;
  if (fs.existsSync(CLIP_DIR)) {
    for (const f of fs.readdirSync(CLIP_DIR)) {
      if (!used.has(f)) { fs.unlinkSync(path.join(CLIP_DIR, f)); removed++; }
    }
  }
  console.log(`\nRemoved ${removed} unused clip file(s).\n`);
}

const commands = { plan: cmdPlan, design: cmdDesign, keep: cmdKeep, find: cmdFind, add: cmdAdd, voices: cmdVoices, make: cmdMake, cast: cmdCast, prune: cmdPrune };
if (!commands[command]) fail(`Unknown command "${command}". Use: ${Object.keys(commands).join(', ')}`);
commands[command]().catch(e => fail(e.message || String(e)));
