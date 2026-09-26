// Friendly customers who bring picture orders.
//   emoji  shown when there is no picture yet (img/<art>.webp)
//   f      feminine, for Arabic verb agreement (تريد / يريد)
//   eat    what they do after eating an order (js/gags.js): burp | hiccup | toot | purr |
//          roar | snore | slurp | flip | love | rocket. A toot turns into a burp when
//          the grown-ups switch the toot jokes off.
//   voice  how their own voice sounds (tools/make-voice.mjs cast designs it from this)
//   lines  said in their own voice. [brackets] are acting notes for the voice
//          (ElevenLabs v3 audio tags); they are never shown or read out.
//     yum   after eating          yuck  when the bowl makes a mishap in front of them
//     poke  tapped once, twice, three times (the fourth tap does their `eat` trick)
export const CUSTOMERS = [
  {
    emoji: '🐻', art: 'cust-bear', name: 'دبدوب', f: false, eat: 'burp',
    voice: 'A big, slow, deep and rumbly but very friendly cartoon bear, a gentle giant with a warm belly laugh',
    lines: {
      yum: '[happy] ممممم! عفوًا! كان لذيذًا جدًّا!',
      yuck: '[disgusted] إييييع! هذا ليس طعامًا يا صديقي!',
      poke: ['[curious] هاه؟ من هناك؟', '[giggles] هههه! بطني يدغدغني!', '[laughing] توقّف! هههههه! سأنفجر من الضحك!'],
    },
  },
  {
    emoji: '🐰', art: 'cust-bunny', name: 'أرنوبة', f: true, eat: 'hiccup',
    voice: 'A tiny, quick, very high-pitched and bubbly little girl bunny who talks fast and giggles a lot',
    lines: {
      yum: '[excited] يمّ يمّ يمّ! لذيذ! هِك!',
      yuck: '[disgusted] إييييع! أذناي وقفتا من الخوف!',
      poke: ['[giggles] هيهي!', '[laughing] هههه! لا تدغدغ أذنيّ!', '[laughing] هههههه! توقّف! سأقفز إلى القمر!'],
    },
  },
  {
    emoji: '👵', art: 'cust-grandma', name: 'الجدّة', f: true, eat: 'toot',
    voice: 'A sweet, warm, slightly wobbly elderly grandmother with a soft cheeky giggle, loving and kind',
    lines: {
      yum: '[embarrassed] أوه! عفوًا يا حبيبي! [giggles] الطعام لذيذ جدًّا!',
      yuck: '[disgusted] يا إلهي! هذا الطعام أعجب من طبخ جدّك!',
      poke: ['[warmly] أهلًا يا حبيبي!', '[giggles] هيهيهي! أنت شقيّ!', '[laughing] هههه! سيسقط طقم أسناني من الضحك!'],
    },
  },
  {
    emoji: '🐱', art: 'cust-cat', name: 'مشمشة', f: true, eat: 'purr',
    voice: 'A playful, cheeky cartoon cat character with a bright, friendly voice, a little dramatic and theatrical, who says meow a lot',
    lines: {
      yum: '[happy] مياااو! لذيذ! أريد صحنًا آخر!',
      yuck: '[disgusted] ميااو! إيييع! هذا لا تأكله حتى الفئران!',
      poke: ['[curious] مياو؟', '[giggles] هيهي! شواربي تدغدغني!', '[laughing] ميااو! هههه! توقّف يا شقيّ!'],
    },
  },
  {
    emoji: '🦁', art: 'cust-lion', name: 'شِبل', f: false, eat: 'roar',
    voice: 'A proud little lion cub boy who tries to sound big and brave but has a cute squeaky voice underneath',
    lines: {
      yum: '[shouting] رااااه! أنا ملك الطعام اللذيذ!',
      yuck: '[disgusted] إيييع! حتى الأسد يخاف من هذا!',
      poke: ['[proudly] أنا أسد شجاع!', '[giggles] هههه! الأسود لا تضحك! هههه!', '[laughing] ههههه! توقّف! صار زئيري ضحكًا!'],
    },
  },
  {
    emoji: '🐼', art: 'cust-panda', name: 'باندو', f: false, eat: 'snore',
    voice: 'A sleepy, slow, soft and cuddly panda boy who yawns a lot and speaks dreamily',
    lines: {
      yum: '[yawns] ممممم… لذيذ… أشعر بالنعاس… [sleepy] تصبحون على خير…',
      yuck: '[disgusted] إيييع! هذا أيقظني من النوم!',
      poke: ['[sleepy] هاه؟ هل حان وقت الأكل؟', '[giggles] هيهي… أنا نعسان…', '[laughing] هههه! لن أنام وأنت تدغدغني!'],
    },
  },
  {
    emoji: '🐸', art: 'cust-frog', name: 'ضفدوع', f: false, eat: 'slurp',
    voice: 'A croaky, goofy and cheerful frog boy with a funny throaty voice',
    lines: {
      yum: '[excited] نقّ نقّ! أكلته في لقمة واحدة!',
      yuck: '[disgusted] نقّ! إيييع! سأقفز إلى البركة!',
      poke: ['[curious] نقّ؟', '[giggles] نقّ نقّ! هههه!', '[laughing] ههههه! نقّ! سأقفز من الضحك!'],
    },
  },
  {
    emoji: '🐵', art: 'cust-monkey', name: 'قرقور', f: false, eat: 'flip',
    voice: 'A hyper, cheeky and mischievous little monkey boy, fast and excited, always laughing',
    lines: {
      yum: '[excited] أووو أووو! آآآ آآآ! لذيذ جدًّا!',
      yuck: '[disgusted] إيييع! أعطني موزة بدلًا منه!',
      poke: ['[excited] أووو؟', '[laughing] هههه! أووو أووو!', '[laughing] هههههه! سأتشقلب من الضحك!'],
    },
  },
  {
    emoji: '👧', art: 'cust-layla', name: 'ليلى', f: true, eat: 'love',
    voice: 'A cheerful, dreamy cartoon character with a bright, sparkly, high voice, always delighted and full of wonder',
    lines: {
      yum: '[delighted] مممممم! هذا أطيب طبق في العالم كلّه!',
      yuck: '[disgusted] إيييع! هذا مقرف! هههه!',
      poke: ['[giggles] هيهي!', '[laughing] هههه! أنا أخاف من الدغدغة!', '[laughing] ههههههه! توقّف! أرجوك!'],
    },
  },
  {
    emoji: '👦', art: 'cust-sami', name: 'سامي', f: false, eat: 'rocket',
    voice: 'An energetic, loud and silly cartoon character with a bright, bouncy voice who loves jokes and laughs out loud',
    lines: {
      yum: '[laughing] أووبس! هههه! طرتُ من الشبع!',
      yuck: '[disgusted] إيييع! لن آكل هذا ولو أعطيتني مليون حلوى!',
      poke: ['[curious] ماذا؟', '[giggles] هههه! هذا يدغدغ!', '[laughing] هههههه! سأطير من الضحك!'],
    },
  },
];
