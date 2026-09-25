# The Kitchen Lab · مختبر المطبخ

A cooking game for children aged 6–8. Kids drag two ingredients into the bowl and
stir it (the colours swirl into the new dish's colour) to discover new dishes, fill customers' orders, and collect stickers in an album.
All text and narration are in simple Modern Standard Arabic (Fusha), right to left.

There is no build step: the browser loads the files as they are. The game works
offline once installed.

## Project layout

Content (what the game says and cooks) lives in `data/`. Code lives in `js/`.
Adding dishes, recipes or whole kitchens only touches `data/`.

| Path | What it is |
| --- | --- |
| `index.html` | The page: screens and buttons, no code |
| `css/game.css` | All the styles |
| `data/items.js` | Every ingredient and dish, listed once: name, emoji, colour, description |
| `data/kitchens/*.js` | One file per kitchen: its items, tiers, starters and recipes |
| `data/kitchens/index.js` | Which kitchens exist, in menu order |
| `data/customers.js` | The customers who bring orders |
| `data/phrases.js` | The mascot's reusable lines, silly bowl reactions, album labels |
| `js/recipes.js` | The recipe engine: lookups, hints, order difficulty. Shared with the tools. |
| `js/kitchens.js` | Builds each kitchen from the data, and checks it for mistakes |
| `js/voice-lines.js` | The list of every spoken line (used by the game and the voice tool) |
| `js/main.js` | The game itself: bowl, pantry, orders, album, parents' corner |
| `js/stir.js` | Stirring the full bowl: the spoon gesture and the colour swirl |
| `js/cook.js` | Cooking after the stir (fry, boil, bake, melt): the meter and the timing |
| `js/sound.js`, `js/fx.js`, `js/voice.js`, `js/util.js` | Sound effects, particles, narration, small helpers |
| `sw.js` | Offline cache (service worker) |
| `manifest.webmanifest`, `icons/` | App install info and icons |
| `voice/ar/*.mp3`, `voice/manifest.json` | Narration clips (ElevenLabs), one per spoken line |
| `img/*.webp`, `img/manifest.json` | Sticker pictures used in the game (256×256, transparent) |
| `img/src/*.webp` | Original 1024×1024 pictures from ElevenLabs |
| `tools/check-data.mjs` | Checks the data for mistakes (`npm run check`) |
| `tools/make-voice.mjs` | Makes the narration clips |
| `tools/make-images.mjs` | Turns `img/src/` originals into game pictures |
| `tools/image-prompts.json` | The prompt for every picture, plus the shared style |

## You need

- **Node.js** 18 or newer, to run the tools
- **ffmpeg**, for the pictures: `brew install ffmpeg`
- **Python 3**, only for the local web server
- An **ElevenLabs** account. Voice uses the API key; pictures are made on the website.

## Run the game locally

```bash
python3 -m http.server 8765
```

Then open http://localhost:8765. The game needs a web server: opening `index.html`
as a file won't load the code. Run every command in this guide from the project folder.

After changing files, reload the page. If you still see the old version, the offline
cache is serving it. Open DevTools → Application → Service workers → Unregister, then reload.

## Voice (narration)

The game knows every line it can say: item names and descriptions, kitchen greetings,
customer requests and phrases (`voiceParts()` in `js/voice-lines.js`).
The tool turns each line into an MP3. If a line has no clip, the game falls back to the
device's robotic voice.

Set your API key once per terminal session. Keep it private and never commit it.

```bash
export ELEVENLABS_API_KEY="your-key"
```

See what is missing and what it will cost (sends nothing):

```bash
node tools/make-voice.mjs plan
```

Make the missing clips. It reuses the saved voice (Tabbookh Arabic,
`eleven_multilingual_v2`) and skips clips that already exist:

```bash
node tools/make-voice.mjs make --yes
```

Delete clip files that are no longer used, e.g. after you change or remove a line:

```bash
node tools/make-voice.mjs prune
```

Other commands:

| Command | Does |
| --- | --- |
| `node tools/make-voice.mjs voices` | List the voices in your account |
| `node tools/make-voice.mjs find [words]` | Browse Arabic voices in the Voice Library |
| `node tools/make-voice.mjs add <owner_id> <voice_id>` | Add a Voice Library voice to your account |
| `node tools/make-voice.mjs design [--desc "..."]` | Design 3 new sample voices to listen to |
| `node tools/make-voice.mjs keep <generated_voice_id>` | Save a designed sample as your voice |
| `node tools/make-voice.mjs make --voice <voice_id> --yes` | Switch voice. This remakes **every** clip (about 4,300 credits). |

## Pictures (stickers)

Each ingredient, dish and customer has a picture named after its id, e.g. `img/egg.webp`
or `img/cust-bear.webp`. If a picture is missing, the game shows the emoji instead.

### Make or replace a picture

1. Open ElevenLabs → **Image & Video** → **Image**.
   Settings: **Nano Banana 2**, **1:1**, **1K**, **1** generation, prompt improvement **Off**.
2. Build the prompt from `tools/image-prompts.json`:
   - Ingredients and dishes: `<description>, <foodFace>. <style>`
   - Customers: `<description>, <customerExtra>. <style>`

   Example:
   > a single white-cream chicken egg, with a cute happy kawaii face (small dot eyes, rosy cheeks, little smile). Cute sticker-style illustration for a children's cooking game, soft rounded shapes, thick dark-brown outline, warm bright colors, simple flat shading, one subject centered with empty space around it, plain pure white background, no text, no letters.

3. Download the result and save it as `img/src/<id>.webp`.
4. Process just that picture:

   ```bash
   node tools/make-images.mjs egg
   ```

   Or process all of them:

   ```bash
   node tools/make-images.mjs
   ```

   The tool removes the white background around the sticker; white inside it (egg
   white, milk, chef hats) stays. It trims the empty space, saves a 256px WebP in
   `img/` and updates `img/manifest.json`.

If ffmpeg is not on your PATH, tell the tool where it is:

```bash
FFMPEG=/path/to/ffmpeg node tools/make-images.mjs
```

**Shared pictures:** `aliases` in `tools/image-prompts.json` lets one item reuse
another's picture. For example, the bakery's `pancake` uses `pancakes`. The tool
copies these for you.

## Kitchens and recipes

### Add a dish

1. **Item.** If it's new to the game, add it to `data/items.js`:

   ```js
   honey: { name: 'عسل', emoji: '🍯', color: '#f2b233', desc: 'عسل ذهبي حلو من النحل.' },
   ```

   - `alt`: optional backup emoji, for devices that can't show the first one
   - Keep `name` and `desc` short, simple Fusha that a 6-year-old understands.
   - Items already in the catalog (from another kitchen) can be reused as they are.

2. **Place it.** In the kitchen file, add the id to a tier under its kind:

   ```js
   { label: 'أطباق', items: {
     dish: ['bread', 'noodles', 'honeycake'],
   ```

   - Tier 1, 2, 3… is the order of the album pages and pantry filters. Add a tier for more pages.
   - Kinds: `base` (starting ingredient), `basic`, `dough`, `treat`, `dish`, `meal`,
     `mishap` (funny accident), `wacky` or `legendary`.

3. **Recipe.** Add it to the kitchen's `recipes`. The ingredients come first, the result last:

   ```js
   ['bread', 'honey', 'honeycake'],
   ```

4. **Check.** Run `npm run check` (or `node tools/check-data.mjs`). It tells you about typos,
   recipes that clash, dishes that can't be reached, and what is missing (pictures, prompts, voice).
5. **Voice.** Run `node tools/make-voice.mjs make --yes` to make the new name and description clips.
6. **Picture.** Add a description to `images` in `tools/image-prompts.json`, then follow
   [Make or replace a picture](#make-or-replace-a-picture).
7. **Test.** Run it locally and make the new dish in the bowl.

A new starting ingredient goes under `base` and in the kitchen's `start` list, or in
`unlocks` to arrive as a gift: `{ id: 'honey', after: 10 }` means after 10 discoveries.

### Kitchen file settings

| Setting | Meaning |
| --- | --- |
| `key` | Id used in saves. Never change it after release. |
| `name`, `logo`, `blurb` | Shown in the parents' corner menu and on the start screen |
| `storeKey` | Where this kitchen's progress is saved. Never change it after release. |
| `bowl` | How many ingredients go in the bowl. Every recipe in the kitchen needs this many. |
| `start` | Starting ingredients |
| `unlocks` | Gift ingredients and how many discoveries each one needs |
| `firstOrder` | The very first customer order (an easy one) |
| `cook` | Dishes that are cooked after stirring, and how: `{ fry: [...], boil: [...], bake: [...], melt: [...] }`. The child taps the pan, pot or oven when the meter reaches the star. Dishes not listed appear straight away. Each way has its own lines in `COOK_LINES` in `data/phrases.js`. |
| `text` | Welcome, welcome back, and "you found everything" lines (spoken) |
| `tiers` | Album pages: a label and the items on it, grouped by kind |
| `overrides` | This kitchen's own wording for a shared item, e.g. the bakery calls `heat` «شعلة سحرية» |
| `recipes` | `[ingredient, ingredient, …, result]`. Order doesn't matter; repeats are fine. |

### Add a kitchen

Copy `data/kitchens/bakery.js`, give it a new `key`, `name` and `storeKey`, and list it in
`data/kitchens/index.js`. It can use any item in `data/items.js`, including items from other
kitchens, so a kitchen can mix savoury and sweet. Add the new file to `ASSETS` in `sw.js`
(the check tells you if you forget).

### Recipes with more ingredients

Set `bowl: 3` in a kitchen and write three-ingredient recipes:

```js
['flour', 'egg', 'milk', 'batter'],
```

The bowl shows three spaces and mixes once all three are filled. The glow hints, the mascot's
hints, orders and the album all work with any number of ingredients. For now all recipes in one
kitchen must use the same number (the check enforces it); mixing sizes in one kitchen needs a
"mix now" button in the bowl first.

## Release a new version

The offline cache keeps players on the old version until the cache name changes.
When you change the game, bump the version in `sw.js`:

```js
const CACHE = 'kitchen-lab-v4';   // → 'kitchen-lab-v5'
```

The cache already picks up new voice clips and pictures automatically. It reads both
manifests. New code, style or data files must be added to `ASSETS` in `sw.js`.

## Checks before committing

```bash
npm run check
```

```bash
node tools/make-voice.mjs plan
```

The check should end with `✓ Data looks good`, and the voice plan should say `Missing: 0`. Then open the game, mix a few recipes, and open
the sticker album to check that the pictures show.

## Writing guidelines

- Audience: children aged 6–8. Everything on screen and in the voice is simple Arabic Fusha, right to left.
- Short sentences, friendly tone, no hard words.
- Mishaps teach kitchen safety. Keep them funny, never scary.
