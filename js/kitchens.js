// Turns the kitchen files in data/kitchens/ into what the game plays with:
// each item gets its catalog entry + the kitchen's tier, kind and wording.
import { ITEMS as CATALOG } from '../data/items.js';
import { KITCHEN_DEFS } from '../data/kitchens/index.js';
import { createCookbook } from './recipes.js';
import { COOK_LINES } from '../data/phrases.js';

export const KINDS = ['base', 'basic', 'dough', 'treat', 'dish', 'meal', 'mishap', 'wacky', 'legendary'];
// Ways a dish can be cooked after stirring (the kitchen's `cook` lists).
export const COOK_METHODS = Object.keys(COOK_LINES);

export function buildKitchen(def) {
  const items = {};
  def.tiers.forEach((page, i) => {
    for (const [kind, ids] of Object.entries(page.items)) {
      for (const id of ids) {
        items[id] = { ...CATALOG[id], ...def.overrides?.[id], tier: i + 1, kind };
      }
    }
  });
  const ids = Object.keys(items);
  return {
    ...def,
    bowl: def.bowl || 2,
    unlocks: def.unlocks || [],
    items,
    ids,
    starters: ids.filter(id => items[id].kind === 'base'),
    cookOf: Object.fromEntries(Object.entries(def.cook || {}).flatMap(([how, list]) => list.map(id => [id, how]))),
    cookbook: createCookbook(def.recipes),
  };
}

// Everything that is wrong with a kitchen's data, as readable sentences.
export function checkKitchen(k) {
  const problems = [];
  const seen = new Set();
  k.tiers.forEach((page, i) => {
    for (const [kind, ids] of Object.entries(page.items)) {
      if (!KINDS.includes(kind)) problems.push(`tier ${i + 1}: unknown kind "${kind}"`);
      for (const id of ids) {
        if (seen.has(id)) problems.push(`"${id}" is listed twice in the tiers`);
        seen.add(id);
        if (!CATALOG[id]) problems.push(`"${id}" is not in data/items.js`);
      }
    }
  });
  for (const id of Object.keys(k.overrides || {})) {
    if (!k.items[id]) problems.push(`override for "${id}", which this kitchen doesn't use`);
  }
  for (const id of k.ids) {
    for (const f of ['name', 'emoji', 'color', 'desc']) if (!k.items[id][f]) problems.push(`"${id}" has no ${f}`);
  }

  const cooked = new Set();
  for (const [how, list] of Object.entries(k.cook || {})) {
    if (!COOK_METHODS.includes(how)) problems.push(`cook: unknown way to cook "${how}" (known: ${COOK_METHODS.join(', ')})`);
    for (const id of list) {
      if (!k.items[id]) problems.push(`cook.${how}: "${id}" is not in this kitchen's tiers`);
      else if (k.items[id].kind === 'mishap') problems.push(`cook.${how}: "${id}" is a mishap; mishaps happen straight away`);
      else if (!k.cookbook.makersOf(id).length) problems.push(`cook.${how}: "${id}" is never made in the bowl, so it's never cooked`);
      if (cooked.has(id)) problems.push(`cook: "${id}" is listed more than once`);
      cooked.add(id);
    }
  }

  const results = new Map();
  for (const r of k.cookbook.recipes) {
    const shown = [...r.inputs, r.result].join(', ');
    for (const id of [...r.inputs, r.result]) if (!k.items[id]) problems.push(`recipe [${shown}]: "${id}" is not in this kitchen's tiers`);
    if (r.inputs.length !== k.bowl) problems.push(`recipe [${shown}] has ${r.inputs.length} ingredients, but the bowl holds ${k.bowl}`);
    if (results.has(r.key) && results.get(r.key) !== r.result) problems.push(`recipe [${shown}] clashes: the same ingredients already make "${results.get(r.key)}"`);
    results.set(r.key, r.result);
  }

  const openers = [...k.start, ...k.unlocks.map(u => u.id)];
  for (const id of openers) if (k.items[id]?.kind !== 'base') problems.push(`starter "${id}" must be listed under base`);
  for (const id of k.starters) if (!openers.includes(id)) problems.push(`base item "${id}" is not in start or unlocks, so the player never gets it`);
  if (k.firstOrder && !k.items[k.firstOrder]) problems.push(`firstOrder "${k.firstOrder}" is not in this kitchen`);

  // Everything must be reachable from the starting ingredients.
  const have = new Set(openers);
  for (let grew = true; grew;) {
    grew = false;
    for (const r of k.cookbook.recipes) {
      if (!have.has(r.result) && r.inputs.every(id => have.has(id))) { have.add(r.result); grew = true; }
    }
  }
  for (const id of k.ids) {
    if (have.has(id)) continue;
    problems.push(k.cookbook.makersOf(id).length ? `"${id}" can never be made (its ingredients can't be reached)` : `"${id}" has no recipe`);
  }
  return problems;
}

export const KITCHENS = Object.fromEntries(KITCHEN_DEFS.map(def => [def.key, buildKitchen(def)]));
export const DEFAULT_KITCHEN = KITCHEN_DEFS[0].key;
