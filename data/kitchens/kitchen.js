// Everyday Kitchen — مطبخ كل يوم
// How a kitchen file works: see "Kitchens and recipes" in README.md.

export default {
  key: 'kitchen',
  name: 'مطبخ كل يوم',
  logo: '🍳',
  blurb: 'بيض، بطاطس، بيتزا، وأطباق كل يوم.',
  storeKey: 'kitchenLab.kitchen.v1',
  bowl: 2,

  start: ['egg', 'oil', 'heat', 'water'],
  unlocks: [
    { id: 'potato', after: 2 },
    { id: 'flour', after: 4 },
    { id: 'tomato', after: 6 },
    { id: 'milk', after: 8 },
  ],
  firstOrder: 'friedegg',

  // Dishes that are cooked after stirring, and how (see "cook" in README.md).
  cook: {
    fry:  ['friedegg', 'fries', 'pancakes'],
    boil: ['boiling', 'noodles', 'soup', 'cheese'],
    bake: ['bread', 'bakedpotato'],
    melt: ['sauce', 'fondue'],
  },

  text: {
    welcome: 'أهلًا بك في مختبر المطبخ! أنا طبّوخ. هيّا نطبخ معًا!',
    back: 'أهلًا بعودتك يا طبّاخنا الصغير! هيّا نطبخ!',
    complete: 'رائع! وجدت كل الملصقات! أنت الآن كبير الطهاة!',
  },

  tiers: [
    { label: 'أساسيات', items: {
      base:   ['egg', 'oil', 'heat', 'water', 'potato', 'flour', 'tomato', 'milk'],
      basic:  ['boiling', 'friedegg', 'fries', 'bakedpotato', 'dough', 'butter', 'sauce', 'batter', 'cheese', 'salad'],
      mishap: ['greasefire', 'splatter', 'chick', 'flourcloud'],
    } },
    { label: 'أطباق', items: {
      dish:   ['bread', 'noodles', 'pizza', 'pancakes', 'waffle', 'croissant', 'quiche', 'dumplings', 'soup', 'fondue', 'gratin'],
      mishap: ['soggyfries', 'kaboom'],
      wacky:  ['mouse'],
    } },
    { label: 'وجبات', items: {
      meal:      ['sandwich', 'spaghetti', 'lunchbox'],
      wacky:     ['pizzatower'],
      mishap:    ['burnttoast', 'frisbee'],
      legendary: ['trophy'],
    } },
  ],

  recipes: [
    ['water', 'heat', 'boiling'],
    ['egg', 'oil', 'friedegg'],
    ['potato', 'oil', 'fries'],
    ['potato', 'heat', 'bakedpotato'],
    ['flour', 'water', 'dough'],
    ['milk', 'milk', 'butter'],
    ['tomato', 'heat', 'sauce'],
    ['flour', 'milk', 'batter'],
    ['milk', 'heat', 'cheese'],
    ['tomato', 'oil', 'salad'],
    ['oil', 'heat', 'greasefire'],
    ['oil', 'water', 'splatter'],
    ['egg', 'heat', 'chick'],
    ['flour', 'flour', 'flourcloud'],
    ['dough', 'heat', 'bread'],
    ['dough', 'boiling', 'noodles'],
    ['dough', 'sauce', 'pizza'],
    ['batter', 'heat', 'pancakes'],
    ['batter', 'butter', 'waffle'],
    ['dough', 'butter', 'croissant'],
    ['dough', 'egg', 'quiche'],
    ['dough', 'potato', 'dumplings'],
    ['sauce', 'boiling', 'soup'],
    ['cheese', 'heat', 'fondue'],
    ['bakedpotato', 'cheese', 'gratin'],
    ['fries', 'water', 'soggyfries'],
    ['greasefire', 'water', 'kaboom'],
    ['cheese', 'cheese', 'mouse'],
    ['bread', 'cheese', 'sandwich'],
    ['noodles', 'sauce', 'spaghetti'],
    ['sandwich', 'fries', 'lunchbox'],
    ['pizza', 'pizza', 'pizzatower'],
    ['bread', 'heat', 'burnttoast'],
    ['pancakes', 'heat', 'frisbee'],
    ['spaghetti', 'pizza', 'trophy'],
  ],
};
