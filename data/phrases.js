// Words the mascot says. Everything here is spoken aloud, so every line gets a
// voice clip (node tools/make-voice.mjs make --yes).

// Lines can carry [acting notes] for the voice; see GAG_LINES below.

// Short reusable lines. Spoken sentences are built from these + item names,
// so every clip can be recorded once and reused.
export const PHRASES = {
  newFind: 'واو! اكتشاف جديد:',
  mishap: 'أوه لا!',
  again: 'من جديد! يَمّ!',
  unlock: 'مفاجأة! مكوّن جديد:',
  hintA: 'عندي فكرة! جرّب',
  hintB: 'مع شيء آخر. اضغط عليّ مرّة أخرى لمساعدة أكبر!',
  try: 'جرّب',
  with: 'مع',
  allFound: 'لقد وجدت كل شيء هنا! أنت رائع!',
  fiveStars: 'رائع! جمعت خمس نجوم جديدة!',
  nudge: 'اضغط عليّ إذا احتجت مساعدة!',
  stir: 'هيّا نخلط! حرّك الملعقة في دوائر.',
  cookEarly: 'ليس بعد! انتظر قليلًا.',
  cookHelp: 'سأساعدك هذه المرّة!',
  locked: 'ملصق مخفي! اكتشفه في الوعاء.',
  test: 'مرحبًا! أنا طبّوخ. هيّا نطبخ معًا!',
};

// Cooking after the stir (js/cook.js), one set of lines per way of cooking.
// A kitchen's `cook` lists say which dishes are cooked which way.
//   go       said the first few times: what to do       caption  the same, shown in the bubble
//   label    written on the pan, pot or oven (tap it)   now      said when it's ready
//   spoilt   too late: burnt, or boiled over            done     taken out on time
export const COOK_LINES = {
  fry: {
    go: 'هيّا نقلي! عندما يصير ذهبيًّا، ارفع المقلاة.',
    caption: 'عندما يصير ذهبيًّا ⭐ اضغط على المقلاة!',
    label: 'ارفع المقلاة',
    now: 'الآن! ارفع المقلاة!',
    spoilt: 'أوه! احترق قليلًا. لنجرّب مرّة أخرى!',
    done: 'ممتاز! ذهبيّ تمامًا!',
  },
  boil: {
    go: 'هيّا نغلي! عندما تكبر الفقاعات، ارفع القِدر.',
    caption: 'عندما تكبر الفقاعات ⭐ اضغط على القِدر!',
    label: 'ارفع القِدر',
    now: 'الآن! ارفع القِدر!',
    spoilt: 'أوه! فار القِدر! لنجرّب مرّة أخرى!',
    done: 'ممتاز! في الوقت المناسب تمامًا!',
  },
  bake: {
    go: 'هيّا نخبز! عندما يصير ذهبيًّا، أخرجه من الفرن.',
    caption: 'عندما يصير ذهبيًّا ⭐ اضغط على الفرن!',
    label: 'أخرجه من الفرن',
    now: 'الآن! أخرجه من الفرن!',
    spoilt: 'أوه! احترق قليلًا. لنجرّب مرّة أخرى!',
    done: 'ممتاز! ذهبيّ تمامًا!',
  },
  melt: {
    go: 'هيّا نسخّنه على نار هادئة! عندما يصير ناعمًا، ارفع القِدر.',
    caption: 'عندما يصير ناعمًا ⭐ اضغط على القِدر!',
    label: 'ارفع القِدر',
    now: 'الآن! ارفع القِدر!',
    spoilt: 'أوه! احترق قليلًا. لنجرّب مرّة أخرى!',
    done: 'ممتاز! ناعم تمامًا!',
  },
};

// "No such thing as a wrong mix": silly bowl reactions.
// style picks the animation and sound (js/gags.js):
//   giggle | sneeze (flour covers the screen: wipe it) | meh | dizzy |
//   hiccup | spit (the bowl spits the ingredients back) | burp | toot
// A toot is skipped when the grown-ups switch the toot jokes off.
export const FAIL_REACTIONS = [
  { style: 'giggle', text: 'هههه! هذا يدغدغني! 🤭 جرّب شيئًا آخر.' },
  { style: 'sneeze', text: 'أتشووو! 🤧 لا شيء هنا، جرّب مرّة أخرى!' },
  { style: 'meh', text: 'مممم... لم يحدث شيء! 🤔 جرّب خليطًا آخر.' },
  { style: 'dizzy', text: 'دوّخني هذا الخليط! 😵 لنجرّب غيره.' },
  { style: 'hiccup', text: 'هِك! هِك! 😳 أصابتني الحازوقة! جرّب خليطًا آخر.' },
  { style: 'spit', text: 'بففففف! 😝 لا أحبّ هذا الخليط! خذه!' },
  { style: 'burp', text: 'بُرررب! 😅 عفوًا! هذا الخليط لا يصنع شيئًا.' },
  { style: 'toot', text: 'أووبس! 💨 عفوًا! هذا الخليط أزعج بطني!' },
];

// The mascot being silly (js/gags.js). Everything here is spoken, so every line gets a
// voice clip. [brackets] are acting notes for the voice (ElevenLabs v3 audio tags):
// they are never shown or read out, and lines with them are made with eleven_v3.
export const GAG_LINES = {
  // Tapping the mascot quickly again and again: each tap is a bigger laugh.
  tickle: [
    '[giggles] هيهي!',
    '[laughs] هههه! هذا يدغدغني!',
    '[laughing hard] ههههههه! توقّف! لا أستطيع التوقّف عن الضحك!',
    '[embarrassed] أووبس! ضحكت كثيرًا! عفوًا!',
    '[dizzy] دوّختني! أرى نجومًا تدور!',
  ],
  // Flour all over the screen after a sneeze.
  flour: 'أوه! غطّى الطحين كلّ شيء! امسحه بإصبعك!',
  flourDone: '[relieved] نظيف! شكرًا يا صديقي!',
  // Cooking went too far: burnt (soot on the face) or boiled over (the lid comes down on the head).
  soot: '[coughs] كح! كح! صار وجهي أسود مثل الفحم!',
  bonk: '[dizzy] آه! رأسي! طار الغطاء ووقع عليّ!',
  // Funny voices after a wacky dish.
  squeaky: '[squeaky] صوتي صار رفيعًا مثل الفأر!',
  deep: '[deep voice] صوتي صار غليظًا مثل الوحش!',
  wobbly: '[dizzy] صوتي يتمايل مثل البرج!',
  // Rare surprises.
  runaway: '[shouting] انتبه! الطبق يهرب! أمسكه!',
  caught: '[laughs] أمسكته! أحسنت!',
  escaped: '[laughs] هرب الطبق! لا بأس، نصنع غيره!',
  thief: '[shouting] انتبه! القطّة تسرق الطبق! اضغط عليها!',
  thiefCaught: '[laughs] هههه! أعادت القطّة الطبق!',
  thiefGone: '[laughs] هربت القطّة بالطبق! يا لها من شقيّة!',
  chicks: '[surprised] كتاكيت! من أين جاءت كل هذه الكتاكيت؟',
};

// Album labels for each kind of item (shown, not spoken).
export const KIND_LABEL = {
  base: 'مكوّن أساسي',
  basic: 'أساسيات',
  dough: 'عجينة وخليط',
  treat: 'حلوى',
  dish: 'طبق',
  meal: 'وجبة',
  mishap: 'أوه لا!',
  wacky: 'عجيب',
  legendary: 'أسطوري',
};
