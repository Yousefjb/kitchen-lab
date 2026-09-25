// Wacky Bakery — المخبز العجيب
// How a kitchen file works: see "Kitchens and recipes" in README.md.

export default {
  key: 'bakery',
  name: 'المخبز العجيب',
  logo: '🍪',
  blurb: 'كوكيز وكعك وحلويات، ومفاجآت مضحكة.',
  storeKey: 'cookieLab.save.v1',
  bowl: 2,

  start: ['flour', 'sugar', 'milk', 'heat'],
  unlocks: [],
  firstOrder: 'cream',

  // Dishes that are cooked after stirring, and how (see "cook" in README.md).
  cook: {
    fry:  ['pancake'],
    boil: ['hotmilk'],
    bake: ['cookie', 'bread', 'cake', 'bdaycake'],
    melt: ['caramel', 'custard'],
  },

  text: {
    welcome: 'أهلًا بك في المخبز العجيب! أنا طبّوخ. هيّا نخبز معًا!',
    back: 'أهلًا بعودتك إلى المخبز! هيّا نخبز!',
    complete: 'رائع! وجدت كل الملصقات! أنت الآن ملك الخبّازين!',
  },

  tiers: [
    { label: 'أساسيات', items: {
      base:   ['flour', 'sugar', 'milk', 'heat'],
      basic:  ['cream', 'butter', 'caramel', 'hotmilk', 'sweetmilk'],
      mishap: ['ash', 'sugarrush', 'fire', 'flourcloud', 'sweetsand'],
    } },
    { label: 'عجائن', items: {
      dough:  ['batter', 'dough', 'cookiedough', 'cakebatter', 'frosting', 'custard', 'toffee'],
      mishap: ['goop', 'paste', 'puddle'],
    } },
    { label: 'حلويات', items: {
      treat:     ['pancake', 'waffle', 'cookie', 'bread', 'cake', 'croissant', 'pie', 'donut', 'pretzel', 'lollipop', 'icecream', 'milkshake', 'cupcake', 'bdaycake'],
      mishap:    ['frisbee', 'soggy', 'charcoal', 'volcano'],
      wacky:     ['monster', 'hypercookie'],
      legendary: ['cookiecrown'],
    } },
  ],

  // This kitchen's own wording for shared items.
  overrides: {
    heat:       { name: 'شعلة سحرية', desc: 'شعلة سحرية صغيرة. لا تلمسها!' },
    butter:     { desc: 'خضضنا الكريمة كثيرًا... فصارت زبدة!' },
    flourcloud: { name: 'إعصار الطحين' },
    batter:     { name: 'خليط سائل', emoji: '🫗', alt: '🍶', desc: 'سائل ومتكتّل، ومليء بالمفاجآت.' },
  },

  recipes: [
    ['milk', 'milk', 'cream'],
    ['cream', 'cream', 'butter'],
    ['sugar', 'heat', 'caramel'],
    ['milk', 'heat', 'hotmilk'],
    ['milk', 'sugar', 'sweetmilk'],
    ['flour', 'heat', 'ash'],
    ['sugar', 'sugar', 'sugarrush'],
    ['heat', 'heat', 'fire'],
    ['flour', 'flour', 'flourcloud'],
    ['flour', 'sugar', 'sweetsand'],
    ['flour', 'milk', 'batter'],
    ['flour', 'butter', 'dough'],
    ['dough', 'sugar', 'cookiedough'],
    ['batter', 'sugar', 'cakebatter'],
    ['cream', 'sugar', 'frosting'],
    ['sweetmilk', 'heat', 'custard'],
    ['hotmilk', 'sugar', 'custard'],
    ['caramel', 'butter', 'toffee'],
    ['batter', 'milk', 'goop'],
    ['flour', 'hotmilk', 'paste'],
    ['butter', 'heat', 'puddle'],
    ['batter', 'heat', 'pancake'],
    ['batter', 'butter', 'waffle'],
    ['cookiedough', 'heat', 'cookie'],
    ['dough', 'heat', 'bread'],
    ['cakebatter', 'heat', 'cake'],
    ['dough', 'butter', 'croissant'],
    ['dough', 'custard', 'pie'],
    ['dough', 'puddle', 'donut'],
    ['dough', 'ash', 'pretzel'],
    ['caramel', 'sugar', 'lollipop'],
    ['sweetmilk', 'cream', 'icecream'],
    ['icecream', 'milk', 'milkshake'],
    ['cake', 'frosting', 'cupcake'],
    ['cupcake', 'heat', 'bdaycake'],
    ['goop', 'heat', 'frisbee'],
    ['cookie', 'milk', 'soggy'],
    ['cookie', 'heat', 'charcoal'],
    ['cake', 'fire', 'volcano'],
    ['cake', 'goop', 'monster'],
    ['cookie', 'sugarrush', 'hypercookie'],
    ['bdaycake', 'cookie', 'cookiecrown'],
  ],
};
