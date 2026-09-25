// The recipe engine: which ingredients make what, and how to get there.
// Pure logic with no page code, so the game and the tools in tools/ share it.
//
// A recipe is written as a list: every ingredient, then the result last.
//   ['water', 'heat', 'boiling']            two ingredients
//   ['flour', 'egg', 'milk', 'batter']      three ingredients
// Order doesn't matter and an ingredient can repeat (['milk', 'milk', 'butter']).

const keyOf = ingredients => ingredients.slice().sort().join('+');

export function readRecipe(r) {
  return { inputs: r.slice(0, -1), result: r[r.length - 1] };
}

export function createCookbook(list) {
  const recipes = list.map(readRecipe);
  const byKey = new Map();
  const makers = new Map();   // result -> recipes that make it
  const uses = new Map();     // ingredient -> recipes it goes into
  const add = (map, k, r) => { if (!map.has(k)) map.set(k, []); if (!map.get(k).includes(r)) map.get(k).push(r); };
  for (const r of recipes) {
    r.key = keyOf(r.inputs);
    if (!byKey.has(r.key)) byKey.set(r.key, r);
    add(makers, r.result, r);
    r.inputs.forEach(id => add(uses, id, r));
  }
  const makersOf = id => makers.get(id) || [];

  // Would `ingredients` still fit inside `recipe`? Returns what is missing, or null.
  function missing(recipe, ingredients) {
    const left = recipe.inputs.slice();
    for (const id of ingredients) {
      const i = left.indexOf(id);
      if (i < 0) return null;
      left.splice(i, 1);
    }
    return left;
  }

  // Fewest mixes to make `id` from what the player has (depth-limited).
  function cost(id, has, depth = 3) {
    if (has(id)) return 0;
    if (depth === 0) return Infinity;
    let best = Infinity;
    for (const r of makersOf(id)) {
      const c = r.inputs.reduce((n, x) => n + cost(x, has, depth - 1), 1);
      if (c < best) best = c;
    }
    return best;
  }

  return {
    recipes,
    makersOf,
    usesOf: id => uses.get(id) || [],

    // The result of mixing exactly these ingredients, or null.
    lookup: ingredients => byKey.get(keyOf(ingredients))?.result ?? null,

    // Can the player mix this recipe right now?
    ready: (recipe, has) => recipe.inputs.every(has),

    // Items the player has that would complete something NEW with `held`
    // (the ingredients already picked up or waiting in the bowl).
    partners(held, has) {
      const out = new Set();
      for (const r of recipes) {
        if (has(r.result)) continue;
        const left = missing(r, held);
        if (left && left.length && left.every(has)) left.forEach(id => out.add(id));
      }
      return out;
    },

    cost,

    // A recipe the player can mix right now that moves toward `target`.
    stepToward(target, has, depth = 3) {
      if (depth === 0) return null;
      const direct = makersOf(target).find(r => r.inputs.every(has));
      if (direct) return direct;
      for (const r of makersOf(target)) {
        for (const x of r.inputs) {
          if (has(x)) continue;
          const s = this.stepToward(x, has, depth - 1);
          if (s) return s;
        }
      }
      return null;
    },
  };
}
