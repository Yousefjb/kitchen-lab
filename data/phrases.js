// Words the mascot says. Everything here is spoken aloud, so every line gets a
// voice clip (node tools/make-voice.mjs make --yes).

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
  fry: 'هيّا نقلي! عندما يصير ذهبيًّا، ارفع المقلاة.',
  fryNow: 'الآن! ارفع المقلاة!',
  fryEarly: 'لم ينضج بعد! انتظر قليلًا.',
  fryBurnt: 'أوه! احترق قليلًا. لنجرّب مرّة أخرى!',
  fryHelp: 'سأساعدك هذه المرّة!',
  fryDone: 'ممتاز! ذهبيّ تمامًا!',
  locked: 'ملصق مخفي! اكتشفه في الوعاء.',
  test: 'مرحبًا! أنا طبّوخ. هيّا نطبخ معًا!',
};

// "No such thing as a wrong mix": silly bowl reactions.
// style picks the animation and sound: giggle | sneeze | meh | dizzy
export const FAIL_REACTIONS = [
  { style: 'giggle', text: 'هههه! هذا يدغدغني! 🤭 جرّب شيئًا آخر.' },
  { style: 'sneeze', text: 'أتشووو! 🤧 لا شيء هنا، جرّب مرّة أخرى!' },
  { style: 'meh', text: 'مممم... لم يحدث شيء! 🤔 جرّب خليطًا آخر.' },
  { style: 'dizzy', text: 'دوّخني هذا الخليط! 😵 لنجرّب غيره.' },
];

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
