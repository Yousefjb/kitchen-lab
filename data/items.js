// Every ingredient and dish in the game, listed once.
// Kitchens (data/kitchens/*.js) pick items from here and decide their tier and kind.
//
//   id     the key. It is also the picture name (img/<id>.webp) and is stored in
//          players' saves, so never rename an id once it has shipped.
//   name   short, simple Fusha a 6-year-old understands (spoken aloud)
//   emoji  shown when there is no picture yet
//   alt    optional backup emoji for devices that can't show the first one
//   color  the colour the bowl turns when this item is in it
//   desc   one or two short sentences (spoken aloud)
//
// A kitchen can change the wording of an item for itself; see `overrides` there.

export const ITEMS = {
  // Starters
  egg:         { name: 'بيضة', emoji: '🥚', color: '#fff1d0', desc: 'بيضة صغيرة، في داخلها فطور لذيذ.' },
  oil:         { name: 'زيت الزيتون', emoji: '🫒', alt: '🛢️', color: '#b5c24a', desc: 'زيت لامع وزلِق من حبّات الزيتون.' },
  heat:        { name: 'نار الموقد', emoji: '🔥', color: '#ff8a3d', desc: 'نار صغيرة تطبخ الطعام. لا تلمسها أبدًا!' },
  water:       { name: 'ماء', emoji: '💧', color: '#cfe9ff', desc: 'ماء صافٍ ومنعش. نبدأ به كل شيء!' },
  potato:      { name: 'بطاطس', emoji: '🥔', color: '#c9a063', desc: 'بطاطس مستديرة تحبّ أن تصير طعامًا شهيًّا.' },
  flour:       { name: 'طحين', emoji: '🌾', color: '#f6ecd6', desc: 'طحين ناعم جدًّا... احذر أن تعطس!' },
  tomato:      { name: 'طماطم', emoji: '🍅', color: '#ff5a4e', desc: 'طماطم حمراء مليئة بالعصير.' },
  sugar:       { name: 'سكّر', emoji: '🍬', color: '#fff4fa', desc: 'حبّات صغيرة من السعادة الحلوة.' },
  milk:        { name: 'حليب', emoji: '🥛', color: '#fbfbff', desc: 'حليب طازج من بقرة لطيفة.' },

  // Basics
  boiling:     { name: 'ماء يغلي', emoji: '♨️', color: '#dff1ff', desc: 'بقبقة وبخار! ساخن جدًّا، فابتعد عنه.' },
  friedegg:    { name: 'بيض مقلي', emoji: '🍳', color: '#ffe27a', desc: 'صباح الخير! بيضة ذهبية تبتسم لك.' },
  fries:       { name: 'بطاطس مقلية', emoji: '🍟', color: '#ffc94a', desc: 'أصابع ذهبية مقرمشة. لا أحد يأكل واحدة فقط!' },
  bakedpotato: { name: 'بطاطس مشوية', emoji: '🍠', color: '#c77d4a', desc: 'مقرمشة من الخارج، وطريّة من الداخل.' },
  dough:       { name: 'عجين', emoji: '🫓', alt: '🥯', color: '#f1d39a', desc: 'طريّ ومطاطيّ، ومن الممتع أن تضغط عليه.' },
  butter:      { name: 'زبدة', emoji: '🧈', color: '#ffe07a', desc: 'خضضنا الحليب كثيرًا... فصار زبدة!' },
  sauce:       { name: 'صلصة طماطم', emoji: '🥫', color: '#e8412f', desc: 'طماطم طُبخت حتى صارت صلصة حمراء.' },
  batter:      { name: 'خليط البان كيك', emoji: '🥣', color: '#f7e3b0', desc: 'خليط سائل سيصير بان كيك لذيذًا.' },
  cheese:      { name: 'جبن', emoji: '🧀', color: '#ffcf4a', desc: 'سخّنّا الحليب قليلًا... فصار جبنًا!' },
  salad:       { name: 'سلطة طماطم', emoji: '🥗', color: '#7fc96b', desc: 'طماطم طازجة مع قطرات من الزيت. منعشة!' },
  greasefire:  { name: 'حريق الزيت', emoji: '🚒', color: '#ff4d2e', desc: 'سخن الزيت أكثر من اللازم! نطبخ دائمًا مع شخص كبير.' },
  splatter:    { name: 'رذاذ الزيت', emoji: '🫧', alt: '💦', color: '#d8f0ff', desc: 'الزيت والماء لا يحبّان بعضهما! رذاذ في كل مكان.' },
  chick:       { name: 'كتكوت مفاجئ', emoji: '🐣', color: '#ffe34d', desc: 'دفّأنا البيضة... ففقست كتكوتًا! مرحبًا يا صغير.' },
  flourcloud:  { name: 'غيمة طحين', emoji: '🌪️', color: '#f1ede4', desc: 'صار كل شيء أبيض! حتى القطّة!' },

  // Dishes and meals
  bread:       { name: 'خبز', emoji: '🍞', color: '#d69a52', desc: 'خبز دافئ، ورائحته طيّبة جدًّا.' },
  noodles:     { name: 'شوربة نودلز', emoji: '🍜', color: '#f4d58d', desc: 'خيوط نودلز طويلة تسبح في الحساء الساخن.' },
  pizza:       { name: 'بيتزا', emoji: '🍕', color: '#ff8a4c', desc: 'عجين وصلصة... أشهر مثلّث في العالم!' },
  pancakes:    { name: 'بان كيك', emoji: '🥞', color: '#e8b562', desc: 'كومة هشّة تنتظر شلّالًا من العسل.' },
  waffle:      { name: 'وافل', emoji: '🧇', color: '#dca24c', desc: 'مربّعات صغيرة، كل مربّع مسبح للعسل!' },
  croissant:   { name: 'كرواسون', emoji: '🥐', color: '#e9a94f', desc: 'طبقات وطبقات من الزبدة. فُتات في كل مكان!' },
  quiche:      { name: 'فطيرة البيض', emoji: '🥧', color: '#e6b45a', desc: 'عجين محشوّ بالبيض. فطور فاخر!' },
  dumplings:   { name: 'فطائر محشوّة', emoji: '🥟', color: '#f3dcb0', desc: 'جيوب صغيرة من العجين تحضن البطاطس.' },
  soup:        { name: 'شوربة طماطم', emoji: '🍲', color: '#e04a36', desc: 'شوربة حمراء دافئة لليوم الماطر.' },
  fondue:      { name: 'قِدر الجبن الذائب', emoji: '🫕', color: '#ffd45e', desc: 'جبن ذائب ساخن. اغمس فيه الخبز!' },
  gratin:      { name: 'بطاطس بالجبن', emoji: '🥘', color: '#e8b04f', desc: 'بطاطس مشوية تحت بطّانية من الجبن الذهبي.' },
  soggyfries:  { name: 'بطاطس مبلّلة', emoji: '🫠', alt: '🤢', color: '#d9c27a', desc: 'غسلت البطاطس المقلية؟! صارت طريّة ومبلّلة. يَع!' },
  kaboom:      { name: 'انفجار المطبخ', emoji: '💥', color: '#ff7a2e', desc: 'لا نسكب الماء على زيت مشتعل أبدًا! الكبار يغطّونه بغطاء.' },
  mouse:       { name: 'حفلة الفأر', emoji: '🐭', color: '#cfc7c0', desc: 'رائحة الجبن جاءت بضيف صغير سعيد!' },
  sandwich:    { name: 'شطيرة جبن', emoji: '🥪', color: '#f1c16a', desc: 'خبز وجبن وخبز. بسيطة ولذيذة!' },
  spaghetti:   { name: 'سباغيتي', emoji: '🍝', color: '#e8573c', desc: 'معكرونة ملفوفة بالصلصة الحمراء. لا تنسَ المنديل!' },
  lunchbox:    { name: 'علبة الغداء', emoji: '🍱', color: '#8fcf8a', desc: 'شطيرة وبطاطس... غداء المدرسة جاهز!' },
  pizzatower:  { name: 'برج البيتزا المائل', emoji: '🗼', color: '#ff9b5a', desc: 'كدّسنا البيتزا حتى مال البرج!' },
  burnttoast:  { name: 'خبز محروق', emoji: '🌑', color: '#3d3d3d', desc: 'صار الخبز أسود كالفحم! جرس الإنذار يصفّق.' },
  frisbee:     { name: 'بان كيك طائر', emoji: '🥏', alt: '🛸', color: '#d9c27a', desc: 'طبخناه أكثر من اللازم فصار قرصًا طائرًا!' },
  trophy:      { name: 'كأس الطاهي الذهبي', emoji: '🏆', color: '#ffcf3f', desc: 'سباغيتي وبيتزا معًا؟ أنت الآن كبير الطهاة!' },

  // Sweets and baking
  cream:       { name: 'كريمة', emoji: '🍦', color: '#fff4dc', desc: 'حليب صار كثيفًا وناعمًا مثل الغيمة.' },
  caramel:     { name: 'كراميل', emoji: '🍯', color: '#d98b2b', desc: 'سكّر جلس قرب النار فصار ذهبيًّا.' },
  hotmilk:     { name: 'حليب ساخن', emoji: '☕', color: '#fff0dd', desc: 'حليب دافئ لما قبل النوم.' },
  sweetmilk:   { name: 'حليب محلّى', emoji: '🍼', color: '#fff1f6', desc: 'حليب مع سكّر. يحبّه الصغار!' },
  ash:         { name: 'رماد محروق', emoji: '🌑', color: '#6b6b6b', desc: 'احترق الطحين! رائحته... ليست جميلة.' },
  sugarrush:   { name: 'نشاط السكّر', emoji: '⚡', color: '#ffe34d', desc: 'أكلت سكّرًا كثيرًا! صرت تقفز في كل مكان!' },
  fire:        { name: 'حريق المطبخ', emoji: '🚒', color: '#ff4d2e', desc: 'نار ونار؟ نادوا رجال الإطفاء!' },
  sweetsand:   { name: 'رمل حلو', emoji: '🏖️', color: '#f0d9a0', desc: 'يشبه رمل الشاطئ... لكنّه حلو جدًّا!' },
  cookiedough: { name: 'عجينة الكوكيز', emoji: '🥮', color: '#d9a66b', desc: 'من المفروض أن نخبزها أولًا!' },
  cakebatter:  { name: 'خليط الكعكة', emoji: '🥣', color: '#ffe0b8', desc: 'خليط حلو جاهز للحفلة!' },
  frosting:    { name: 'كريمة التزيين', emoji: '🍥', color: '#ffc4dc', desc: 'غيمة حلوة ملفوفة لتزيين الكعك.' },
  custard:     { name: 'كاسترد', emoji: '🍮', color: '#ffd45e', desc: 'يهتزّ ويتمايل... وطعمه لذيذ!' },
  toffee:      { name: 'توفي', emoji: '🍫', color: '#a5652a', desc: 'حلوى مقرمشة بالزبدة. تلتصق بالأسنان!' },
  goop:        { name: 'عجينة لزجة', emoji: '🫠', alt: '🤢', color: '#b8d98a', desc: 'حليب كثير جدًّا! صارت لزجة وعلقت بكُمّك.' },
  paste:       { name: 'غراء الورق', emoji: '🧴', color: '#e9e6d8', desc: 'ممتاز للأشغال اليدوية، لكنّه سيّئ للفطور!' },
  puddle:      { name: 'بركة زبدة', emoji: '💧', color: '#ffd84a', desc: 'بحيرة من الزبدة الذائبة. انتبه لا تنزلق!' },
  pancake:     { name: 'بان كيك', emoji: '🥞', color: '#e8b562', desc: 'دائريّ وهشّ، ينتظر شلّالًا من العسل.' },
  cookie:      { name: 'كوكيز', emoji: '🍪', color: '#c68a4a', desc: 'أطراف ذهبية وقلب طريّ. يَمّ!' },
  cake:        { name: 'كعكة', emoji: '🍰', color: '#ffd2a8', desc: 'طريّة وإسفنجية. من الصعب أن تأكل قطعة واحدة!' },
  pie:         { name: 'فطيرة الكاسترد', emoji: '🥧', color: '#d88c43', desc: 'قشرة مقرمشة وقلب يتمايل.' },
  donut:       { name: 'دونات', emoji: '🍩', color: '#ff9ec4', desc: 'عجين سبح في الزبدة. والثقب مجّانيّ!' },
  pretzel:     { name: 'بريتزل', emoji: '🥨', color: '#8b5a2b', desc: 'ملتوٍ وداكن. السرّ هو الرماد؟ لا تسأل!' },
  lollipop:    { name: 'مصّاصة', emoji: '🍭', color: '#ff6fa8', desc: 'كراميل على عصا. لفّة، لفّة، لفّة!' },
  icecream:    { name: 'آيس كريم', emoji: '🍨', color: '#ffe1ec', desc: 'بارد وحلو، ويذوب بسرعة!' },
  milkshake:   { name: 'ميلك شيك', emoji: '🥤', color: '#ffc0d6', desc: 'آيس كريم خُفق حتى صار مشروبًا.' },
  cupcake:     { name: 'كب كيك', emoji: '🧁', color: '#ff9ecb', desc: 'كعكة صغيرة تلبس قبّعة من الكريمة.' },
  bdaycake:    { name: 'كعكة عيد الميلاد', emoji: '🎂', color: '#ffb3d1', desc: 'أُضيئت الشموع وحدها! عيد ميلاد سعيد!' },
  soggy:       { name: 'كوكيز مبلّلة', emoji: '🥴', color: '#b89a74', desc: 'غمسناها في الحليب طويلًا... فذابت!' },
  charcoal:    { name: 'كوكيز الفحم', emoji: '🪨', alt: '⚫', color: '#3d3d3d', desc: 'خبزناها مرّتين! صارت مثل الحجر.' },
  volcano:     { name: 'بركان الكعك', emoji: '🌋', color: '#ff5a2e', desc: 'الكعكة تقذف الكريمة! اهربوا!' },
  monster:     { name: 'وحش الكعك اللزج', emoji: '👾', color: '#8fd46b', desc: 'لقد تحرّك! إنّه يريد اسمًا.' },
  hypercookie: { name: 'كوكيز صاروخ', emoji: '🚀', color: '#7cc4ff', desc: 'كوكيز فيها سكّر كثير... طارت إلى الفضاء!' },
  cookiecrown: { name: 'تاج الكوكيز', emoji: '👑', color: '#ffcf3f', desc: 'أعظم إنجاز! أنت الآن ملك الخبّازين!' },
};
