import type { QuestionDifficulty, QuestionDomain } from '@prisma/client';

/**
 * Deterministic generator for fictional practice questions.
 *
 * Every item is authored for this platform. Nothing here is taken from, derived
 * from, or recalled from any real examination: the regulation covering the
 * official test treats its questions as confidential intellectual property, and
 * "questions that appeared previously" is exactly the category the product must
 * never carry. These exist so the engine has a pool to select from in
 * development, and they are all labelled as sample content.
 *
 * Generation takes no randomness, so re-running the seed produces identical
 * rows and the seed stays idempotent.
 *
 * The bank is built two ways, and both are deterministic:
 *
 *  - **Authored tables.** Verbal items — analogies, sentence completion,
 *    contextual error, reading passages — are written out one by one, because
 *    language items cannot be computed.
 *  - **Parameterised generators.** Quantitative items are functions over fixed
 *    input tables. The correct answer *and* the three distractors are computed
 *    from the same inputs, each distractor being the result of a specific common
 *    mistake (taking the discount for the price, adding the legs instead of
 *    applying Pythagoras, forgetting to divide by the count) rather than a
 *    filler number. A student who picks one has made an identifiable error.
 *
 * `externalKey` is the stable identity of an item. Existing keys are never
 * renumbered: tables are appended to, so an already-seeded database keeps every
 * row it has. New families take their own key prefix for the same reason.
 *
 * Subskill labels come from the taxonomy this file already uses:
 *
 *  - VERBAL_ANALOGY — 'الترادف والاختلاف'، 'علاقة الجزء بالكل'،
 *    'علاقة السبب والنتيجة'، 'التصنيف'، 'الترابط والتلازم'
 *  - SENTENCE_COMPLETION — 'المعنى الصريح والضمني'، 'علاقة السبب والنتيجة'،
 *    'العلاقات الزمانية والمكانية'، 'المفردة المناسبة'
 *  - CONTEXTUAL_ERROR — 'التناقض'، 'الحاجة السياقية'، 'الحكم الناقد'
 *  - READING_COMPREHENSION — 'الفكرة الرئيسة'، 'الأفكار الداعمة'،
 *    'معنى المفردة في السياق'، 'العلاقات بين أجزاء النص'، 'مرجع الضمير'،
 *    'الاستنتاج'
 *  - quantitative — 'النسب والتناسب'، 'النسبة المئوية'، 'السرعة والزمن'،
 *    'المتوسطات'، 'المساحة'، 'المحيط'، 'نظرية فيثاغورس'، 'الزوايا'،
 *    'المعادلات'، 'تبسيط المقادير'، 'الجداول'، 'الأعمدة البيانية'،
 *    'القطاعات الدائرية'، 'الاحتمالات'
 */
export const SAMPLE_CONTENT_LABEL = 'محتوى تدريبي تجريبي من إعداد المنصة';

/** Structured content. Never HTML: there is no markup to sanitise. */
export type Inline =
  { type: 'text'; text: string } | { type: 'math'; tex: string } | { type: 'ltr'; text: string };

export type RichText = { blocks: Array<{ type: 'paragraph'; children: Inline[] }> };

export function text(value: string): RichText {
  return { blocks: [{ type: 'paragraph', children: [{ type: 'text', text: value }] }] };
}

export function math(prefix: string, tex: string, suffix = ''): RichText {
  const children: Inline[] = [
    { type: 'text', text: prefix },
    { type: 'math', tex },
  ];
  if (suffix) children.push({ type: 'text', text: suffix });
  return { blocks: [{ type: 'paragraph', children }] };
}

/** A whole option that is nothing but an expression, e.g. `2x + 12`. */
export function formula(tex: string): RichText {
  return { blocks: [{ type: 'paragraph', children: [{ type: 'math', tex }] }] };
}

/** Free mix of prose and expressions, for stems that need more than one span. */
export function rich(...children: Inline[]): RichText {
  return { blocks: [{ type: 'paragraph', children }] };
}

export function inlineText(value: string): Inline {
  return { type: 'text', text: value };
}

export function inlineMath(tex: string): Inline {
  return { type: 'math', tex };
}

export type SeedQuestion = {
  externalKey: string;
  domain: QuestionDomain;
  subskill: string;
  difficulty: QuestionDifficulty;
  stem: RichText;
  options: RichText[];
  correctIndex: number;
  explanation: RichText;
  hint?: RichText;
  shuffleOptions?: boolean;
};

const DIFFICULTIES: QuestionDifficulty[] = ['EASY', 'MEDIUM', 'HARD'];

function cycleDifficulty(index: number): QuestionDifficulty {
  return DIFFICULTIES[index % DIFFICULTIES.length]!;
}

/** Renders a number the way an option should read: `15`, `12.5`, never `12.50`. */
function num(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
}

/**
 * Arabic counted nouns: 3–10 take the plural, 11 and above take the singular
 * accusative. Generated stems would otherwise read like "12 دفاتر".
 */
function counted(value: number, plural: string, singular: string): string {
  return value >= 3 && value <= 10 ? `${value} ${plural}` : `${value} ${singular}`;
}

/** "ساعتين" is a dual, not "2 ساعات". */
function hoursPhrase(value: number): string {
  if (value === 1) return 'ساعة واحدة';
  if (value === 2) return 'ساعتين';
  return counted(value, 'ساعات', 'ساعة');
}

// ── Verbal analogy ──────────────────────────────────────────────────────

const ANALOGY_ITEMS: Array<{
  pair: [string, string];
  correct: [string, string];
  distractors: Array<[string, string]>;
  relation: string;
  subskill: string;
}> = [
  {
    pair: ['قلم', 'كتابة'],
    correct: ['مقص', 'قص'],
    distractors: [
      ['ورق', 'شجرة'],
      ['كتاب', 'مكتبة'],
      ['حبر', 'أزرق'],
    ],
    relation: 'أداة ووظيفتها',
    subskill: 'علاقة السبب والنتيجة',
  },
  {
    pair: ['صفحة', 'كتاب'],
    correct: ['غصن', 'شجرة'],
    distractors: [
      ['قلم', 'حبر'],
      ['معلم', 'مدرسة'],
      ['ماء', 'بحر'],
    ],
    relation: 'الجزء إلى الكل',
    subskill: 'علاقة الجزء بالكل',
  },
  {
    pair: ['جوع', 'طعام'],
    correct: ['عطش', 'ماء'],
    distractors: [
      ['نوم', 'ليل'],
      ['برد', 'شتاء'],
      ['تعب', 'عمل'],
    ],
    relation: 'حاجة وما يسدّها',
    subskill: 'علاقة السبب والنتيجة',
  },
  {
    pair: ['طبيب', 'مستشفى'],
    correct: ['مهندس', 'مصنع'],
    distractors: [
      ['دواء', 'مرض'],
      ['طالب', 'كتاب'],
      ['قاضٍ', 'عدل'],
    ],
    relation: 'مهنة ومكان عملها',
    subskill: 'الترابط والتلازم',
  },
  {
    pair: ['كرم', 'بخل'],
    correct: ['شجاعة', 'جبن'],
    distractors: [
      ['صدق', 'أمانة'],
      ['علم', 'معرفة'],
      ['فرح', 'سرور'],
    ],
    relation: 'التضاد',
    subskill: 'الترادف والاختلاف',
  },
  {
    pair: ['ذهب', 'معدن'],
    correct: ['ياسمين', 'زهرة'],
    distractors: [
      ['خاتم', 'إصبع'],
      ['فضة', 'لامع'],
      ['حديد', 'صلب'],
    ],
    relation: 'فرد وصنفه',
    subskill: 'التصنيف',
  },
  // ── appended items ──
  {
    pair: ['جذر', 'شجرة'],
    correct: ['عجلة', 'سيارة'],
    distractors: [
      ['نجار', 'خشب'],
      ['ثمرة', 'حلوة'],
      ['ماء', 'نبات'],
    ],
    relation: 'الجزء إلى الكل',
    subskill: 'علاقة الجزء بالكل',
  },
  {
    pair: ['سطر', 'صفحة'],
    correct: ['درجة', 'سُلّم'],
    distractors: [
      ['مكتبة', 'كتاب'],
      ['رواية', 'أديب'],
      ['مطر', 'سحاب'],
    ],
    relation: 'الجزء إلى الكل',
    subskill: 'علاقة الجزء بالكل',
  },
  {
    pair: ['مقبض', 'باب'],
    correct: ['عقرب', 'ساعة'],
    distractors: [
      ['مفتاح', 'قفل'],
      ['حديد', 'مصنع'],
      ['باب', 'خشب'],
    ],
    relation: 'الجزء إلى الكل',
    subskill: 'علاقة الجزء بالكل',
  },
  {
    pair: ['جناح', 'طائر'],
    correct: ['زعنفة', 'سمكة'],
    distractors: [
      ['عش', 'طائر'],
      ['طيران', 'جو'],
      ['ريشة', 'ناعمة'],
    ],
    relation: 'عضو والكائن الذي هو منه',
    subskill: 'علاقة الجزء بالكل',
  },
  {
    pair: ['فصل', 'كتاب'],
    correct: ['مشهد', 'مسرحية'],
    distractors: [
      ['قارئ', 'كتاب'],
      ['كتاب', 'رفّ'],
      ['مسرحية', 'تمثيل'],
    ],
    relation: 'الجزء إلى الكل',
    subskill: 'علاقة الجزء بالكل',
  },
  {
    pair: ['حبة', 'عنقود'],
    correct: ['نجمة', 'مجرّة'],
    distractors: [
      ['كرم', 'عنب'],
      ['عصير', 'برتقال'],
      ['حبة', 'حلوة'],
    ],
    relation: 'وحدة صغيرة داخل تجمّع أكبر',
    subskill: 'علاقة الجزء بالكل',
  },
  {
    pair: ['مطر', 'خصب'],
    correct: ['شمس', 'دفء'],
    distractors: [
      ['سحاب', 'سماء'],
      ['ماء', 'شرب'],
      ['ريح', 'قوية'],
    ],
    relation: 'سبب ونتيجته',
    subskill: 'علاقة السبب والنتيجة',
  },
  {
    pair: ['إهمال', 'فشل'],
    correct: ['مثابرة', 'إتقان'],
    distractors: [
      ['كسل', 'خمول'],
      ['طالب', 'مدرسة'],
      ['جهد', 'كبير'],
    ],
    relation: 'سلوك وما يفضي إليه',
    subskill: 'علاقة السبب والنتيجة',
  },
  {
    pair: ['حريق', 'رماد'],
    correct: ['صقيع', 'ذبول'],
    distractors: [
      ['نار', 'حطب'],
      ['دخان', 'أسود'],
      ['مطفأة', 'إطفاء'],
    ],
    relation: 'حدث وأثره الباقي بعده',
    subskill: 'علاقة السبب والنتيجة',
  },
  {
    pair: ['تمرين', 'لياقة'],
    correct: ['مراجعة', 'إتقان'],
    distractors: [
      ['رياضة', 'ملعب'],
      ['جري', 'سريع'],
      ['صحة', 'عافية'],
    ],
    relation: 'ممارسة والنتيجة المكتسبة منها',
    subskill: 'علاقة السبب والنتيجة',
  },
  {
    pair: ['جفاف', 'قحط'],
    correct: ['فيضان', 'غرق'],
    distractors: [
      ['نهر', 'ماء'],
      ['قحط', 'جفاف'],
      ['مزارع', 'أرض'],
    ],
    relation: 'ظاهرة ونتيجتها',
    subskill: 'علاقة السبب والنتيجة',
  },
  {
    pair: ['سهر', 'إرهاق'],
    correct: ['ضجيج', 'تشتّت'],
    distractors: [
      ['ليل', 'نهار'],
      ['إرهاق', 'تعب'],
      ['سرير', 'نوم'],
    ],
    relation: 'مؤثر وما يخلّفه',
    subskill: 'علاقة السبب والنتيجة',
  },
  {
    pair: ['سخاء', 'جود'],
    correct: ['وهن', 'ضعف'],
    distractors: [
      ['كرم', 'بخل'],
      ['مال', 'غنى'],
      ['عطاء', 'يد'],
    ],
    relation: 'الترادف',
    subskill: 'الترادف والاختلاف',
  },
  {
    pair: ['عسر', 'يسر'],
    correct: ['ضيق', 'سعة'],
    distractors: [
      ['فرح', 'سرور'],
      ['ليل', 'ظلام'],
      ['صعب', 'عمل'],
    ],
    relation: 'التضاد',
    subskill: 'الترادف والاختلاف',
  },
  {
    pair: ['حزن', 'أسى'],
    correct: ['بهجة', 'سرور'],
    distractors: [
      ['ضحك', 'بكاء'],
      ['دمعة', 'عين'],
      ['حزين', 'قلب'],
    ],
    relation: 'الترادف',
    subskill: 'الترادف والاختلاف',
  },
  {
    pair: ['جهل', 'علم'],
    correct: ['ظلمة', 'نور'],
    distractors: [
      ['قراءة', 'معرفة'],
      ['معلم', 'علم'],
      ['كتاب', 'ورق'],
    ],
    relation: 'التضاد',
    subskill: 'الترادف والاختلاف',
  },
  {
    pair: ['صمت', 'سكوت'],
    correct: ['خوف', 'فزع'],
    distractors: [
      ['كلام', 'صمت'],
      ['لسان', 'كلام'],
      ['ضجيج', 'مكتبة'],
    ],
    relation: 'الترادف',
    subskill: 'الترادف والاختلاف',
  },
  {
    pair: ['بخل', 'شحّ'],
    correct: ['طمع', 'جشع'],
    distractors: [
      ['جود', 'بخل'],
      ['مال', 'خزانة'],
      ['بخيل', 'كريم'],
    ],
    relation: 'الترادف',
    subskill: 'الترادف والاختلاف',
  },
  {
    pair: ['قمح', 'حبوب'],
    correct: ['تفاح', 'فاكهة'],
    distractors: [
      ['خبز', 'فرن'],
      ['حصاد', 'زرع'],
      ['حبة', 'سنبلة'],
    ],
    relation: 'فرد وصنفه',
    subskill: 'التصنيف',
  },
  {
    pair: ['نسر', 'طائر'],
    correct: ['نحلة', 'حشرة'],
    distractors: [
      ['طائر', 'سرب'],
      ['جناح', 'نسر'],
      ['عش', 'طائر'],
    ],
    relation: 'نوع وجنسه',
    subskill: 'التصنيف',
  },
  {
    pair: ['العربية', 'لغة'],
    correct: ['الهندسة', 'علم'],
    distractors: [
      ['كلمة', 'جملة'],
      ['قاموس', 'كلمات'],
      ['متحدث', 'لغة'],
    ],
    relation: 'فرد وصنفه',
    subskill: 'التصنيف',
  },
  {
    pair: ['كرسي', 'أثاث'],
    correct: ['معطف', 'ملابس'],
    distractors: [
      ['خشب', 'كرسي'],
      ['جلوس', 'كرسي'],
      ['غرفة', 'أثاث'],
    ],
    relation: 'فرد وصنفه',
    subskill: 'التصنيف',
  },
  {
    pair: ['قصيدة', 'شعر'],
    correct: ['مقالة', 'نثر'],
    distractors: [
      ['شاعر', 'قصيدة'],
      ['بيت', 'قصيدة'],
      ['قافية', 'وزن'],
    ],
    relation: 'نموذج وفنّه',
    subskill: 'التصنيف',
  },
  {
    pair: ['أكسجين', 'غاز'],
    correct: ['حديد', 'معدن'],
    distractors: [
      ['هواء', 'تنفس'],
      ['غاز', 'أنبوب'],
      ['صدأ', 'حديد'],
    ],
    relation: 'فرد وصنفه',
    subskill: 'التصنيف',
  },
  {
    pair: ['فلّاح', 'حقل'],
    correct: ['صيّاد', 'بحر'],
    distractors: [
      ['محراث', 'حرث'],
      ['قمح', 'خبز'],
      ['حصاد', 'موسم'],
    ],
    relation: 'صاحب حرفة وموضع عمله',
    subskill: 'الترابط والتلازم',
  },
  {
    pair: ['طيّار', 'طائرة'],
    correct: ['ربّان', 'سفينة'],
    distractors: [
      ['مطار', 'سفر'],
      ['جناح', 'طائرة'],
      ['رحلة', 'وجهة'],
    ],
    relation: 'قائد وما يقوده',
    subskill: 'الترابط والتلازم',
  },
  {
    pair: ['قاضٍ', 'محكمة'],
    correct: ['معلم', 'مدرسة'],
    distractors: [
      ['عدل', 'قاضٍ'],
      ['مدرسة', 'طلاب'],
      ['حكم', 'قضية'],
    ],
    relation: 'مهنة ومكان عملها',
    subskill: 'الترابط والتلازم',
  },
  {
    pair: ['نجار', 'منشار'],
    correct: ['خيّاط', 'إبرة'],
    distractors: [
      ['خشب', 'نجار'],
      ['نشر', 'قطع'],
      ['ورشة', 'عمل'],
    ],
    relation: 'صانع وأداته',
    subskill: 'الترابط والتلازم',
  },
  {
    pair: ['ميناء', 'سفينة'],
    correct: ['محطة', 'قطار'],
    distractors: [
      ['بحر', 'ميناء'],
      ['سفينة', 'ركاب'],
      ['إبحار', 'ميناء'],
    ],
    relation: 'مكان ووسيلة النقل التي ترسو فيه',
    subskill: 'الترابط والتلازم',
  },
  {
    pair: ['بوصلة', 'ملّاح'],
    correct: ['ميزان', 'بائع'],
    distractors: [
      ['اتجاه', 'شمال'],
      ['سفينة', 'بحر'],
      ['ملّاح', 'سفينة'],
    ],
    relation: 'أداة ومن يستعملها',
    subskill: 'الترابط والتلازم',
  },
];

function buildAnalogyQuestions(): SeedQuestion[] {
  return ANALOGY_ITEMS.map((item, index) => {
    const options = [item.correct, ...item.distractors].map(
      ([left, right]) => text(`${left} : ${right}`) as RichText,
    );
    return {
      externalKey: `analogy-${index + 1}`,
      domain: 'VERBAL_ANALOGY' as const,
      subskill: item.subskill,
      difficulty: cycleDifficulty(index),
      stem: text(`${item.pair[0]} : ${item.pair[1]} ← الأقرب في العلاقة:`),
      options,
      correctIndex: 0,
      explanation: text(
        `العلاقة بين "${item.pair[0]}" و"${item.pair[1]}" هي ${item.relation}، وهي نفسها العلاقة بين "${item.correct[0]}" و"${item.correct[1]}".`,
      ),
      hint: text('حدّد نوع العلاقة أولًا، ثم اختبر الخيارات عليها بالترتيب نفسه.'),
    };
  });
}

// ── Sentence completion ─────────────────────────────────────────────────

const COMPLETION_ITEMS: Array<{
  sentence: string;
  correct: string;
  distractors: string[];
  reason: string;
  subskill: string;
}> = [
  {
    sentence: 'لم يكن نجاحه وليد الصدفة، بل ثمرة ــــــــ طويل واجتهاد متصل.',
    correct: 'صبرٍ',
    distractors: ['حظٍّ', 'ترددٍ', 'انتظارٍ'],
    reason: 'السياق ينفي الصدفة ويؤكد الجهد، فالكلمة المناسبة تدل على مثابرة لا على مصادفة.',
    subskill: 'المعنى الصريح والضمني',
  },
  {
    sentence: 'كان الطريق ــــــــ حتى إن السائق اضطر إلى إبطاء سرعته كثيرًا.',
    correct: 'وعرًا',
    distractors: ['مُعبّدًا', 'واسعًا', 'مستقيمًا'],
    reason: 'النتيجة المذكورة هي الإبطاء، وهي تستلزم سببًا يعيق السير لا يسهّله.',
    subskill: 'علاقة السبب والنتيجة',
  },
  {
    sentence: 'لا يُعرف قدر العافية ــــــــ يفقدها الإنسان.',
    correct: 'حتى',
    distractors: ['لأن', 'مع أن', 'بينما'],
    reason: 'المعنى يقتضي غاية زمنية: لا تُعرف قيمتها إلا عند فقدها.',
    subskill: 'العلاقات الزمانية والمكانية',
  },
  {
    sentence: 'رغم ــــــــ الأدلة، أصرّ على رأيه ولم يراجعه.',
    correct: 'وضوح',
    distractors: ['غياب', 'ضعف', 'ندرة'],
    reason: '"رغم" تفيد المخالفة، فالمتوقع أن تكون الأدلة قوية ومع ذلك لم يغيّر رأيه.',
    subskill: 'المعنى الصريح والضمني',
  },
  {
    sentence: 'المكتبة مكان ــــــــ يجد فيه القارئ ما يبحث عنه دون عناء.',
    correct: 'منظَّم',
    distractors: ['مزدحم', 'بعيد', 'قديم'],
    reason: 'الوصف يجب أن يفسّر سهولة الوصول إلى الكتاب، والتنظيم هو ما يحققها.',
    subskill: 'المفردة المناسبة',
  },
  // ── appended items ──
  {
    sentence: 'ظلّ الباب ــــــــ منذ الصباح، فتسلل الهواء البارد إلى الغرفة كلها.',
    correct: 'مفتوحًا',
    distractors: ['موصدًا', 'مغلقًا', 'مقفلًا'],
    reason: 'دخول الهواء إلى الغرفة لا يكون إلا مع منفذ مفتوح، والخيارات الثلاثة الأخرى تمنعه.',
    subskill: 'المفردة المناسبة',
  },
  {
    sentence: 'كلما زاد اطّلاع المرء ــــــــ إدراكه لسعة ما يجهله.',
    correct: 'اتّسع',
    distractors: ['ضاق', 'توقف', 'تراجع'],
    reason: 'أسلوب "كلما" يقتضي تلازمًا طرديًا، فزيادة الاطلاع تقابلها زيادة في الإدراك لا نقص.',
    subskill: 'علاقة السبب والنتيجة',
  },
  {
    sentence: 'لم يعتذر عن تأخره، ــــــــ لم يبيّن سببه.',
    correct: 'كما',
    distractors: ['لأن', 'إذ', 'كي'],
    reason:
      'الجملة الثانية تضيف نفيًا ثانيًا إلى الأول، والإضافة في هذا الموضع تؤدّيها "كما" لا أدوات التعليل.',
    subskill: 'المعنى الصريح والضمني',
  },
  {
    sentence: 'وصل المسافرون إلى المحطة ــــــــ انطلاق القطار بدقائق، فلحقوا به.',
    correct: 'قبل',
    distractors: ['بعد', 'أثناء', 'مع'],
    reason:
      'اللحاق بالقطار لا يتحقق إلا إذا كان الوصول سابقًا للانطلاق، فالترتيب الزمني هو ما يحدد الأداة.',
    subskill: 'العلاقات الزمانية والمكانية',
  },
  {
    sentence: 'يقع المتحف ــــــــ النهر، فتطلّ نوافذه كلها على الماء.',
    correct: 'بمحاذاة',
    distractors: ['بعيدًا عن', 'خلف', 'أسفل'],
    reason: 'الإطلال المباشر على الماء يقتضي مجاورة النهر، وهو ما تدل عليه "بمحاذاة".',
    subskill: 'العلاقات الزمانية والمكانية',
  },
  {
    sentence: 'كان حديثه ــــــــ فلم يحتج السامعون إلى إعادة ولا استفسار.',
    correct: 'واضحًا',
    distractors: ['مبهمًا', 'مقتضبًا', 'سريعًا'],
    reason: 'انتفاء الحاجة إلى الإعادة نتيجة، وسببها وضوح الحديث لا غموضه ولا سرعته.',
    subskill: 'علاقة السبب والنتيجة',
  },
  {
    sentence: 'النجاح في المشروعات الكبيرة رهنٌ ــــــــ الفريق لا بجهد فرد واحد.',
    correct: 'بتعاون',
    distractors: ['بانفراد', 'بتنافس', 'بصمت'],
    reason: 'المقابلة مع "لا بجهد فرد واحد" تقتضي معنى العمل الجماعي.',
    subskill: 'المعنى الصريح والضمني',
  },
  {
    sentence: 'رغم قلة موارده، استطاع أن ــــــــ مشروعه حتى اكتمل.',
    correct: 'يواصل',
    distractors: ['يوقف', 'يؤجل', 'يهمل'],
    reason: 'قوله "حتى اكتمل" يدل على استمرار العمل إلى نهايته، وهو ما ينفي التوقف والتأجيل.',
    subskill: 'المعنى الصريح والضمني',
  },
  {
    sentence: 'كان النص ــــــــ حتى إن القارئ يحتاج إلى قراءته مرتين ليفهمه.',
    correct: 'معقّدًا',
    distractors: ['سهلًا', 'قصيرًا', 'ممتعًا'],
    reason: 'الحاجة إلى قراءتين لأجل الفهم نتيجة للصعوبة، لا للسهولة ولا للقصر.',
    subskill: 'علاقة السبب والنتيجة',
  },
  {
    sentence: 'لم يكن الطريق إلى القمة ــــــــ فقد تخللته عقبات كثيرة.',
    correct: 'ممهَّدًا',
    distractors: ['طويلًا', 'واضحًا', 'ضيقًا'],
    reason: 'العقبات نقيض التمهيد على وجه الخصوص، أما الطول والضيق فلا تدل عليهما العقبات.',
    subskill: 'المفردة المناسبة',
  },
  {
    sentence: 'يزداد الإنسان تواضعًا ــــــــ ازداد علمًا.',
    correct: 'كلما',
    distractors: ['حتى', 'لأن', 'بينما'],
    reason: 'التلازم الطردي بين أمرين يتزايدان معًا يُعبَّر عنه بـ"كلما".',
    subskill: 'علاقة السبب والنتيجة',
  },
  {
    sentence: 'المدينة القديمة ــــــــ بأسواقها الشعبية التي يقصدها الزوار من كل مكان.',
    correct: 'تشتهر',
    distractors: ['تضيق', 'تبتعد', 'تستغني'],
    reason: 'قصد الزوار من كل مكان دليل الشهرة، ولا يستقيم معه معنى الضيق أو الاستغناء.',
    subskill: 'المفردة المناسبة',
  },
  {
    sentence: 'لم يكتفِ بقراءة الملخص، ــــــــ عاد إلى المصادر الأصلية كلها.',
    correct: 'بل',
    distractors: ['أو', 'إذ', 'كي'],
    reason: '"بل" هنا للإضراب الانتقالي بعد النفي: ترك الأدنى وأثبت ما هو أعلى منه.',
    subskill: 'المعنى الصريح والضمني',
  },
  {
    sentence: 'أنجز الفريق الخطة قبل موعدها بأسبوع، وهذا دليل على ــــــــ في العمل.',
    correct: 'كفاءته',
    distractors: ['تردده', 'بطئه', 'تراخيه'],
    reason: 'الإنجاز قبل الموعد شاهد على الكفاءة، وهو ينفي البطء والتراخي.',
    subskill: 'المعنى الصريح والضمني',
  },
  {
    sentence: 'لا تُقاس قيمة الكتاب ــــــــ صفحاته، بل بما يتركه في عقل قارئه.',
    correct: 'بعدد',
    distractors: ['بجودة', 'بلون', 'بسعر'],
    reason: 'المقابلة قائمة بين الكمّ والأثر، فالمنفيّ هو المقياس العددي.',
    subskill: 'المعنى الصريح والضمني',
  },
  {
    sentence: 'ظلّ يبحث عن حلّ ــــــــ اهتدى إليه بعد جهد طويل.',
    correct: 'حتى',
    distractors: ['منذ', 'كي', 'لأن'],
    reason: '"حتى" تفيد الغاية: استمر البحث إلى أن تحقق الاهتداء.',
    subskill: 'العلاقات الزمانية والمكانية',
  },
  {
    sentence: 'الصديق الصادق من ــــــــ عند الشدة، لا من يكثر المديح في الرخاء.',
    correct: 'يثبت',
    distractors: ['ينصرف', 'يتردد', 'يغيب'],
    reason: 'المقابلة بين موقف الشدة وموقف الرخاء تقتضي معنى الثبات لا الانصراف.',
    subskill: 'المعنى الصريح والضمني',
  },
  {
    sentence: 'أسهم انتشار المكتبات العامة في ــــــــ فرص القراءة أمام الناس جميعًا.',
    correct: 'توسيع',
    distractors: ['تضييق', 'تأجيل', 'إلغاء'],
    reason: 'الانتشار سبب، ونتيجته زيادة الفرص لا نقصها.',
    subskill: 'علاقة السبب والنتيجة',
  },
  {
    sentence: 'كان جدوله ــــــــ بحيث لم يجد فراغًا لمراجعة ما فاته.',
    correct: 'مزدحمًا',
    distractors: ['مرنًا', 'قصيرًا', 'واضحًا'],
    reason: 'انعدام الفراغ نتيجة للازدحام، والمرونة والقصر يقتضيان عكسه.',
    subskill: 'علاقة السبب والنتيجة',
  },
];

function buildCompletionQuestions(): SeedQuestion[] {
  return COMPLETION_ITEMS.map((item, index) => ({
    externalKey: `completion-${index + 1}`,
    domain: 'SENTENCE_COMPLETION' as const,
    subskill: item.subskill,
    difficulty: cycleDifficulty(index),
    stem: text(item.sentence),
    options: [item.correct, ...item.distractors].map((option) => text(option)),
    correctIndex: 0,
    explanation: text(item.reason),
    hint: text('توقّع المعنى الناقص قبل النظر إلى الخيارات.'),
  }));
}

// ── Contextual error ────────────────────────────────────────────────────

const CONTEXTUAL_ITEMS: Array<{
  sentence: string;
  wrong: string;
  others: string[];
  reason: string;
  subskill: string;
}> = [
  {
    sentence: 'اجتهد الطالب في مراجعته، فكان الإهمال سببًا في تفوقه على أقرانه.',
    wrong: 'الإهمال',
    others: ['اجتهد', 'مراجعته', 'تفوقه'],
    reason: 'الجملة تتحدث عن اجتهاد أدى إلى تفوق، فذكر "الإهمال" سببًا للتفوق يناقض السياق.',
    subskill: 'التناقض',
  },
  {
    sentence: 'كان الجو باردًا جدًا، فارتدى الجميع ملابس خفيفة قبل الخروج.',
    wrong: 'خفيفة',
    others: ['باردًا', 'ارتدى', 'الخروج'],
    reason: 'البرد الشديد يستدعي ملابس ثقيلة، فالكلمة المناسبة نقيض المذكورة.',
    subskill: 'الحاجة السياقية',
  },
  {
    sentence: 'اشتهرت المدينة بمياهها العذبة، حتى قصدها الناس لملوحتها الشديدة.',
    wrong: 'لملوحتها',
    others: ['اشتهرت', 'العذبة', 'قصدها'],
    reason: 'العذوبة ضد الملوحة، فلا يستقيم أن تكون الملوحة سبب القصد.',
    subskill: 'التناقض',
  },
  {
    sentence: 'قرأ الباحث المراجع كلها بعناية، ثم كتب خلاصته دون أن يطّلع على شيء.',
    wrong: 'دون أن يطّلع على شيء',
    others: ['قرأ', 'بعناية', 'خلاصته'],
    reason: 'الشطر الأول يثبت الاطلاع، والشطر الثاني ينفيه، وهو تناقض صريح.',
    subskill: 'الحكم الناقد',
  },
  // ── appended items ──
  {
    sentence: 'وصل المسافر متأخرًا عن موعد الرحلة، فأدرك الطائرة قبل إقلاعها بوقت طويل.',
    wrong: 'متأخرًا',
    others: ['المسافر', 'الرحلة', 'إقلاعها'],
    reason: 'التأخر عن الموعد لا يجتمع مع إدراك الطائرة قبل إقلاعها بوقت طويل، والصواب "مبكرًا".',
    subskill: 'التناقض',
  },
  {
    sentence: 'كان النهر غزير المياه، فاشتد جفاف الأرض المحيطة به.',
    wrong: 'جفاف',
    others: ['النهر', 'غزير', 'المحيطة'],
    reason: 'غزارة الماء سبب لخصب ما حوله لا لجفافه، فالكلمة تناقض ما قبلها.',
    subskill: 'التناقض',
  },
  {
    sentence: 'أهمل الطالب واجباته طوال الفصل، فنال الجائزة الأولى في الانضباط.',
    wrong: 'أهمل',
    others: ['واجباته', 'الفصل', 'الانضباط'],
    reason: 'جائزة الانضباط نتيجة للالتزام، ولا يمكن أن يكون الإهمال سببًا لها.',
    subskill: 'التناقض',
  },
  {
    sentence: 'كان الكتاب مختصرًا جدًا، ومع ذلك استغرق في قراءته ثلاثة أشهر متصلة.',
    wrong: 'مختصرًا',
    others: ['الكتاب', 'قراءته', 'متصلة'],
    reason: 'المدة الطويلة المذكورة تناسب كتابًا مطوّلًا، والاختصار ينافيها.',
    subskill: 'الحاجة السياقية',
  },
  {
    sentence: 'ازدحمت القاعة بالحضور حتى ضاقت بهم، فبدت خالية على اتساعها.',
    wrong: 'خالية',
    others: ['ازدحمت', 'الحضور', 'اتساعها'],
    reason: 'الازدحام والضيق بالحضور لا يجتمعان مع وصف القاعة بأنها خالية.',
    subskill: 'التناقض',
  },
  {
    sentence: 'يمتاز هذا الطريق بكثرة الحوادث، ولهذا يوصف بأنه الأكثر أمانًا.',
    wrong: 'أمانًا',
    others: ['الطريق', 'الحوادث', 'يوصف'],
    reason: 'كثرة الحوادث دليل على الخطر، فلا يترتب عليها وصف الطريق بأنه الأكثر أمانًا.',
    subskill: 'التناقض',
  },
  {
    sentence: 'اشترى ثوبًا رخيص الثمن، فأنفق عليه معظم راتبه.',
    wrong: 'رخيص',
    others: ['اشترى', 'الثمن', 'راتبه'],
    reason: 'إنفاق معظم الراتب يدل على ارتفاع الثمن لا على رخصه.',
    subskill: 'التناقض',
  },
  {
    sentence: 'تحدث المحاضر بصوت خافت، فسمعه الجالسون في آخر القاعة بوضوح تام.',
    wrong: 'خافت',
    others: ['المحاضر', 'الجالسون', 'بوضوح'],
    reason: 'السماع الواضح في آخر القاعة يقتضي صوتًا مرتفعًا، فالوصف بالخفوت ينقض النتيجة.',
    subskill: 'الحاجة السياقية',
  },
  {
    sentence: 'كان الامتحان سهلًا في نظر الجميع، فرسب فيه معظم الطلاب.',
    wrong: 'سهلًا',
    others: ['الامتحان', 'نظر', 'معظم'],
    reason: 'رسوب الأكثرية نتيجة تناسب الصعوبة، وهي تناقض وصف الامتحان بالسهولة عند الجميع.',
    subskill: 'التناقض',
  },
  {
    sentence: 'قدّم المتحدث أدلة قاطعة على رأيه، غير أن حديثه خلا من أي دليل.',
    wrong: 'خلا من أي دليل',
    others: ['قدّم', 'قاطعة', 'حديثه'],
    reason: 'إثبات الأدلة القاطعة أولًا ثم نفي وجود أي دليل حكم متناقض لا يصح اجتماعه.',
    subskill: 'الحكم الناقد',
  },
  {
    sentence: 'نبتت الزهور في الحديقة بعد أن انقطع عنها الماء شهورًا طويلة.',
    wrong: 'انقطع',
    others: ['نبتت', 'الحديقة', 'شهورًا'],
    reason: 'إنبات الزهور يستلزم الريّ، فانقطاع الماء شهورًا لا يكون سببًا له.',
    subskill: 'الحاجة السياقية',
  },
  {
    sentence: 'اشتد البرد في ليالي الصيف حتى تجمدت المياه في الأنابيب.',
    wrong: 'الصيف',
    others: ['اشتد', 'ليالي', 'الأنابيب'],
    reason: 'تجمد المياه من شدة البرد يناسب الشتاء، وذكر الصيف يخالف السياق.',
    subskill: 'الحاجة السياقية',
  },
  {
    sentence: 'يعتمد الباحث على المصادر الموثوقة، ويستقي معلوماته من الشائعات المنتشرة.',
    wrong: 'الشائعات',
    others: ['الباحث', 'الموثوقة', 'معلوماته'],
    reason: 'الاعتماد على المصادر الموثوقة ينفي الأخذ من الشائعات، فلا يجتمع الوصفان.',
    subskill: 'الحكم الناقد',
  },
  {
    sentence: 'كان الحل الذي اقترحه بسيطًا وواضحًا، فاحتاج شرحه إلى مجلدات كثيرة.',
    wrong: 'بسيطًا',
    others: ['اقترحه', 'شرحه', 'مجلدات'],
    reason: 'ما يحتاج شرحه إلى مجلدات ليس بسيطًا، فالوصف يناقض النتيجة المذكورة.',
    subskill: 'التناقض',
  },
  {
    sentence: 'وفّر النظام الجديد وقت الموظفين، فتضاعفت ساعات عملهم دون فائدة.',
    wrong: 'وفّر',
    others: ['النظام', 'الموظفين', 'ساعات'],
    reason: 'مضاعفة ساعات العمل نتيجة لا تترتب على توفير الوقت، بل على إهداره.',
    subskill: 'التناقض',
  },
  {
    sentence: 'كان الجو صحوًا والسماء صافية، فاضطر الناس إلى حمل المظلات اتقاءً للمطر.',
    wrong: 'صحوًا',
    others: ['السماء', 'الناس', 'المظلات'],
    reason: 'حمل المظلات اتقاءً للمطر يستلزم جوًا ممطرًا، وهو ضد الصحو.',
    subskill: 'الحاجة السياقية',
  },
  {
    sentence: 'حرص المدير على إشراك موظفيه في القرار، فانفرد باتخاذه دون مشورة.',
    wrong: 'فانفرد',
    others: ['حرص', 'موظفيه', 'القرار'],
    reason: 'الحرص على الإشراك ينافي الانفراد بالقرار دون مشورة.',
    subskill: 'التناقض',
  },
  {
    sentence: 'تمتاز هذه المدينة باعتدال مناخها، فهي شديدة الحرارة صيفًا قارسة البرودة شتاءً.',
    wrong: 'باعتدال',
    others: ['المدينة', 'مناخها', 'شتاءً'],
    reason: 'شدة الحرارة والبرودة وصف للتطرف المناخي، وهو ضد الاعتدال المذكور.',
    subskill: 'التناقض',
  },
  {
    sentence: 'قرأ الخبر في صحيفة موثوقة، ثم نقله إلى أصدقائه على أنه إشاعة لا أصل لها.',
    wrong: 'إشاعة',
    others: ['الخبر', 'صحيفة', 'أصدقائه'],
    reason: 'ما ورد في مصدر موثوق لا يوصف بأنه إشاعة لا أصل لها، فالوصفان لا يجتمعان.',
    subskill: 'الحكم الناقد',
  },
  {
    sentence: 'ادّخر مبلغًا كبيرًا من راتبه كل شهر، حتى أثقلته الديون بعد سنة واحدة.',
    wrong: 'أثقلته الديون',
    others: ['ادّخر', 'راتبه', 'سنة'],
    reason: 'الادخار المنتظم يفضي إلى فائض لا إلى تراكم الديون، فالنتيجة تخالف مقدمتها.',
    subskill: 'التناقض',
  },
  {
    sentence: 'كان المتحف مغلقًا طوال الأسبوع، فزاره آلاف السياح كل يوم.',
    wrong: 'مغلقًا',
    others: ['المتحف', 'الأسبوع', 'السياح'],
    reason: 'الزيارة اليومية لا تقع في مكان مغلق طوال الأسبوع.',
    subskill: 'التناقض',
  },
  {
    sentence: 'انتهى الاجتماع بالاتفاق التام بين الأعضاء، وخرج كل واحد منهم متمسكًا برأيه المخالف.',
    wrong: 'بالاتفاق التام',
    others: ['الاجتماع', 'الأعضاء', 'برأيه'],
    reason: 'تمسك كل عضو برأيه المخالف يدل على خلاف لا على اتفاق تام.',
    subskill: 'الحكم الناقد',
  },
  {
    sentence: 'اعتمد التقرير على إحصاءات حديثة دقيقة، وهي أرقام مضى على جمعها عقود.',
    wrong: 'حديثة',
    others: ['التقرير', 'إحصاءات', 'أرقام'],
    reason: 'ما مضى على جمعه عقود لا يوصف بالحداثة، فالوصف يناقض ما بعده.',
    subskill: 'الحكم الناقد',
  },
  {
    sentence: 'كان الطعام لذيذ المذاق، فامتنع الضيوف عن تناوله جميعًا.',
    wrong: 'لذيذ',
    others: ['الطعام', 'الضيوف', 'تناوله'],
    reason: 'امتناع الضيوف جميعًا نتيجة تناسب رداءة الطعام لا لذّته.',
    subskill: 'الحاجة السياقية',
  },
  {
    sentence: 'زرع المزارع الحقل قمحًا، فحصد منه في الموسم حديدًا وفيرًا.',
    wrong: 'حديدًا',
    others: ['زرع', 'الحقل', 'الموسم'],
    reason: 'المحصود من زرع القمح قمح، والحديد ليس مما يُزرع فيُحصد.',
    subskill: 'الحاجة السياقية',
  },
  {
    sentence: 'تمرّن اللاعب ساعات طويلة كل يوم، فتراجع مستواه بسبب كثرة راحته.',
    wrong: 'راحته',
    others: ['تمرّن', 'ساعات', 'مستواه'],
    reason: 'من يتمرن ساعات طويلة كل يوم لا يوصف بكثرة الراحة، فالتعليل يناقض المقدمة.',
    subskill: 'التناقض',
  },
];

function buildContextualQuestions(): SeedQuestion[] {
  return CONTEXTUAL_ITEMS.map((item, index) => ({
    externalKey: `contextual-${index + 1}`,
    domain: 'CONTEXTUAL_ERROR' as const,
    subskill: item.subskill,
    difficulty: cycleDifficulty(index),
    stem: text(`حدّد الكلمة التي لا يستقيم بها المعنى: «${item.sentence}»`),
    options: [item.wrong, ...item.others].map((option) => text(option)),
    correctIndex: 0,
    explanation: text(item.reason),
    hint: text('الجملة سليمة نحويًا؛ ابحث عن التناقض في المعنى لا عن خطأ إملائي.'),
  }));
}

// ── Quantitative: authored items ────────────────────────────────────────

type QuantItem = {
  key: string;
  domain: QuestionDomain;
  subskill: string;
  prefix: string;
  tex: string;
  suffix?: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  ordered?: boolean;
};

const QUANT_ITEMS: QuantItem[] = [
  {
    key: 'arith-1',
    domain: 'ARITHMETIC',
    subskill: 'النسب والتناسب',
    prefix: 'إذا كان ',
    tex: '\\frac{a}{b} = \\frac{3}{4}',
    suffix: ' وكان b = 20، فما قيمة a؟',
    options: ['15', '16', '18', '12'],
    correctIndex: 0,
    explanation: 'من التناسب: a = (3 ÷ 4) × 20 = 15.',
  },
  {
    key: 'arith-2',
    domain: 'ARITHMETIC',
    subskill: 'النسبة المئوية',
    prefix: 'سلعة ثمنها 240 ريالًا، خُصم منها 25%. كم يصبح ثمنها؟',
    tex: '',
    options: ['180', '200', '190', '160'],
    correctIndex: 0,
    explanation: 'قيمة الخصم = 240 × 0.25 = 60، والثمن بعد الخصم = 240 − 60 = 180 ريالًا.',
  },
  {
    key: 'arith-3',
    domain: 'ARITHMETIC',
    subskill: 'السرعة والزمن',
    prefix: 'قطع متسابق 120 كم في ساعتين. ما متوسط سرعته بالكيلومتر في الساعة؟',
    tex: '',
    options: ['60', '50', '70', '80'],
    correctIndex: 0,
    explanation: 'السرعة = المسافة ÷ الزمن = 120 ÷ 2 = 60 كم/ساعة.',
  },
  {
    key: 'arith-4',
    domain: 'ARITHMETIC',
    subskill: 'المتوسطات',
    prefix: 'ما المتوسط الحسابي للأعداد: 4، 8، 10، 14؟',
    tex: '',
    options: ['9', '8', '10', '12'],
    correctIndex: 0,
    explanation: 'المجموع = 36، وعدد القيم = 4، فالمتوسط = 36 ÷ 4 = 9.',
  },
  {
    key: 'geom-1',
    domain: 'GEOMETRY',
    subskill: 'المساحة',
    prefix: 'مستطيل طوله 12 سم وعرضه 5 سم. ما مساحته بالسنتيمتر المربع؟',
    tex: '',
    options: ['60', '34', '17', '30'],
    correctIndex: 0,
    explanation: 'مساحة المستطيل = الطول × العرض = 12 × 5 = 60 سم².',
  },
  {
    key: 'geom-2',
    domain: 'GEOMETRY',
    subskill: 'نظرية فيثاغورس',
    prefix: 'مثلث قائم الزاوية ضلعاه القائمان 6 و8. ما طول الوتر؟',
    tex: '',
    options: ['10', '12', '14', '9'],
    correctIndex: 0,
    explanation: 'بنظرية فيثاغورس: الوتر² = 36 + 64 = 100، فالوتر = 10.',
  },
  {
    key: 'geom-3',
    domain: 'GEOMETRY',
    subskill: 'الزوايا',
    prefix: 'مجموع زاويتين متكاملتين 180°. إذا كانت إحداهما 65°، فكم الأخرى؟',
    tex: '',
    options: ['115°', '125°', '105°', '95°'],
    correctIndex: 0,
    explanation: 'الزاوية الأخرى = 180° − 65° = 115°.',
  },
  {
    key: 'alg-1',
    domain: 'ALGEBRA',
    subskill: 'المعادلات',
    prefix: 'حل المعادلة ',
    tex: '2x + 7 = 19',
    options: ['6', '5', '7', '4'],
    correctIndex: 0,
    explanation: '2x = 19 − 7 = 12، إذن x = 6.',
  },
  {
    key: 'alg-2',
    domain: 'ALGEBRA',
    subskill: 'تبسيط المقادير',
    prefix: 'بسّط المقدار ',
    tex: '3(x + 2) - 2x',
    options: ['x + 6', 'x + 2', '5x + 6', 'x - 6'],
    correctIndex: 0,
    explanation: '3x + 6 − 2x = x + 6.',
  },
  {
    key: 'data-1',
    domain: 'DATA_ANALYSIS',
    subskill: 'الجداول',
    prefix:
      'سجّل متجر مبيعات أسبوعية: السبت 12، الأحد 18، الاثنين 9، الثلاثاء 21. في أي يوم بلغت المبيعات ذروتها؟',
    tex: '',
    options: ['الثلاثاء', 'الأحد', 'السبت', 'الاثنين'],
    correctIndex: 0,
    explanation: 'أعلى قيمة في القائمة هي 21 وتقابل يوم الثلاثاء.',
    ordered: true,
  },
  {
    key: 'data-2',
    domain: 'DATA_ANALYSIS',
    subskill: 'القطاعات الدائرية',
    prefix: 'يمثل قطاع دائري 25% من إجمالي 400 مشارك. كم عدد المشاركين الذين يمثلهم القطاع؟',
    tex: '',
    options: ['100', '80', '125', '75'],
    correctIndex: 0,
    explanation: '400 × 0.25 = 100 مشارك.',
  },
];

function buildAuthoredQuantQuestions(): SeedQuestion[] {
  return QUANT_ITEMS.map((item, index) => ({
    externalKey: item.key,
    domain: item.domain,
    subskill: item.subskill,
    difficulty: cycleDifficulty(index),
    stem: item.tex ? math(item.prefix, item.tex, item.suffix) : text(item.prefix),
    options: item.options.map((option) => text(option)),
    correctIndex: item.correctIndex,
    explanation: text(item.explanation),
    // Numeric option sets are left in their authored order where shuffling
    // would scramble a deliberate sequence.
    shuffleOptions: !item.ordered,
  }));
}

// ── Quantitative: parameterised generators ──────────────────────────────

/**
 * One generated item before difficulty is assigned.
 *
 * The correct option is always written first and the three distractors after
 * it, each computed from the same inputs as a named wrong method. Delivery
 * order is the shuffler's business, not the table's.
 */
type GeneratedQuant = {
  key: string;
  domain: QuestionDomain;
  subskill: string;
  stem: RichText;
  options: RichText[];
  explanation: string;
  /** Options whose written order carries meaning are not shuffled. */
  ordered?: boolean;
};

/** Renders numeric options: correct first, then the three mistake results. */
function numericOptions(values: number[]): RichText[] {
  return values.map((value) => text(num(value)));
}

// Arithmetic — percentage discount.
const DISCOUNT_CASES: Array<[price: number, rate: number]> = [
  [180, 20],
  [320, 15],
  [450, 40],
  [600, 35],
  [250, 12],
  [840, 25],
  [90, 30],
];

function buildDiscountQuestions(): GeneratedQuant[] {
  return DISCOUNT_CASES.map(([price, rate], index) => {
    const cut = (price * rate) / 100;
    const final = price - cut;
    return {
      key: `arith-discount-${index + 1}`,
      domain: 'ARITHMETIC' as const,
      subskill: 'النسبة المئوية',
      stem: text(`ثوب ثمنه ${price} ريالًا، ثم خُصم منه ${rate}%. كم يصير ثمنه بالريال؟`),
      // Distractors: قيمة الخصم وحدها، طرح النسبة كأنها ريالات، الزيادة بدل الخصم.
      options: numericOptions([final, cut, price - rate, price + cut]),
      explanation: `قيمة الخصم = ${price} × ${rate} ÷ 100 = ${num(cut)} ريالًا، والثمن بعد الخصم = ${price} − ${num(cut)} = ${num(final)} ريالًا.`,
    };
  });
}

// Arithmetic — sharing a total by a ratio.
const RATIO_CASES: Array<[first: number, second: number, total: number]> = [
  [3, 5, 80],
  [2, 7, 63],
  [4, 5, 90],
  [5, 7, 84],
  [3, 4, 140],
  [2, 3, 75],
  [7, 5, 60],
];

function buildRatioQuestions(): GeneratedQuant[] {
  return RATIO_CASES.map(([first, second, total], index) => {
    const parts = first + second;
    const unit = total / parts;
    const share = unit * first;
    return {
      key: `arith-ratio-${index + 1}`,
      domain: 'ARITHMETIC' as const,
      subskill: 'النسب والتناسب',
      stem: math(
        `وُزّع مبلغ ${total} ريالًا بين سعد وفهد بنسبة `,
        `${first} : ${second}`,
        '. كم نصيب سعد بالريال؟',
      ),
      // Distractors: نصيب فهد، قيمة الجزء الواحد، ضرب المبلغ في النسبة دون قسمته على مجموع الأجزاء.
      options: numericOptions([share, unit * second, unit, (total * first) / second]),
      explanation: `مجموع أجزاء النسبة = ${first} + ${second} = ${parts}، وقيمة الجزء الواحد = ${total} ÷ ${parts} = ${num(unit)}، فنصيب سعد = ${num(unit)} × ${first} = ${num(share)} ريالًا.`,
    };
  });
}

// Arithmetic — average speed.
const SPEED_CASES: Array<[distance: number, hours: number]> = [
  [360, 4],
  [180, 3],
  [240, 5],
  [420, 6],
  [150, 2],
  [504, 8],
];

function buildSpeedQuestions(): GeneratedQuant[] {
  return SPEED_CASES.map(([distance, hours], index) => {
    const speed = distance / hours;
    return {
      key: `arith-speed-${index + 1}`,
      domain: 'ARITHMETIC' as const,
      subskill: 'السرعة والزمن',
      stem: text(
        `قطعت حافلة ${distance} كيلومترًا في ${hoursPhrase(hours)}. ما متوسط سرعتها بالكيلومتر في الساعة؟`,
      ),
      // Distractors: الضرب بدل القسمة، ثم خطأ في عدّ الساعات نقصًا وزيادة.
      options: numericOptions([
        speed,
        distance * hours,
        distance / (hours - 1),
        distance / (hours + 1),
      ]),
      explanation: `السرعة = المسافة ÷ الزمن = ${distance} ÷ ${hours} = ${num(speed)} كم/ساعة.`,
    };
  });
}

// Arithmetic — arithmetic mean.
const AVERAGE_CASES: number[][] = [
  [8, 12, 16, 24],
  [7, 11, 18, 24],
  [15, 25, 33, 47],
  [30, 36, 50, 64],
  [9, 13, 16, 22],
  [21, 27, 30, 42],
];

function buildAverageQuestions(): GeneratedQuant[] {
  return AVERAGE_CASES.map((values, index) => {
    const sum = values.reduce((total, value) => total + value, 0);
    const mean = sum / values.length;
    const range = Math.max(...values) - Math.min(...values);
    return {
      key: `arith-mean-${index + 1}`,
      domain: 'ARITHMETIC' as const,
      subskill: 'المتوسطات',
      stem: text(`ما المتوسط الحسابي للأعداد: ${values.join('، ')}؟`),
      // Distractors: القسمة على عدد خاطئ مرتين، ثم المدى بدل المتوسط.
      options: numericOptions([mean, sum / 3, sum / 5, range]),
      explanation: `المجموع = ${sum}، وعدد القيم = ${values.length}، فالمتوسط = ${sum} ÷ ${values.length} = ${num(mean)}.`,
    };
  });
}

// Arithmetic — percentage increase.
const INCREASE_CASES: Array<[base: number, rate: number]> = [
  [400, 15],
  [250, 20],
  [1200, 5],
  [80, 25],
  [640, 10],
  [500, 12],
];

function buildIncreaseQuestions(): GeneratedQuant[] {
  return INCREASE_CASES.map(([base, rate], index) => {
    const added = (base * rate) / 100;
    const total = base + added;
    return {
      key: `arith-increase-${index + 1}`,
      domain: 'ARITHMETIC' as const,
      subskill: 'النسبة المئوية',
      stem: text(`ارتفع عدد مشتركي ناد من ${base} مشتركًا بنسبة ${rate}%. كم صار عددهم؟`),
      // Distractors: مقدار الزيادة وحده، النقص بدل الزيادة، إضافة النسبة كأنها عدد.
      options: numericOptions([total, added, base - added, base + rate]),
      explanation: `مقدار الزيادة = ${base} × ${rate} ÷ 100 = ${num(added)}، والعدد الجديد = ${base} + ${num(added)} = ${num(total)} مشتركًا.`,
    };
  });
}

// Arithmetic — unit price then scaling up.
const UNIT_RATE_CASES: Array<[count: number, price: number, wanted: number]> = [
  [4, 48, 6],
  [5, 60, 6],
  [6, 72, 9],
  [8, 96, 12],
  [5, 80, 8],
  [7, 84, 12],
  [9, 108, 12],
];

function buildUnitRateQuestions(): GeneratedQuant[] {
  return UNIT_RATE_CASES.map(([count, price, wanted], index) => {
    const unit = price / count;
    const total = unit * wanted;
    return {
      key: `arith-rate-${index + 1}`,
      domain: 'ARITHMETIC' as const,
      subskill: 'النسب والتناسب',
      stem: text(
        `ثمن ${counted(count, 'دفاتر', 'دفترًا')} متماثلة ${price} ريالًا. كم ثمن ${counted(wanted, 'دفاتر', 'دفترًا')} منها بالسعر نفسه؟`,
      ),
      // Distractors: سعر الدفتر الواحد، قلب النسبة، جمع الفرق بدل ضربه.
      options: numericOptions([total, unit, (price * count) / wanted, price + (wanted - count)]),
      explanation: `ثمن الدفتر الواحد = ${price} ÷ ${count} = ${num(unit)} ريالًا، وثمن ${wanted} = ${num(unit)} × ${wanted} = ${num(total)} ريالًا.`,
    };
  });
}

// Geometry — rectangle area.
const RECTANGLE_AREA_CASES: Array<[length: number, width: number]> = [
  [14, 6],
  [15, 8],
  [9, 7],
  [20, 11],
  [18, 5],
];

function buildRectangleAreaQuestions(): GeneratedQuant[] {
  return RECTANGLE_AREA_CASES.map(([length, width], index) => {
    const area = length * width;
    return {
      key: `geom-area-${index + 1}`,
      domain: 'GEOMETRY' as const,
      subskill: 'المساحة',
      stem: text(`مستطيل طوله ${length} سم وعرضه ${width} سم. ما مساحته بالسنتيمتر المربع؟`),
      // Distractors: المحيط، نصف المحيط، ضعف المساحة.
      options: numericOptions([area, 2 * (length + width), length + width, 2 * area]),
      explanation: `مساحة المستطيل = الطول × العرض = ${length} × ${width} = ${area} سم².`,
    };
  });
}

// Geometry — rectangle perimeter.
const RECTANGLE_PERIMETER_CASES: Array<[length: number, width: number]> = [
  [13, 7],
  [16, 9],
  [21, 4],
  [11, 6],
  [25, 10],
];

function buildRectanglePerimeterQuestions(): GeneratedQuant[] {
  return RECTANGLE_PERIMETER_CASES.map(([length, width], index) => {
    const perimeter = 2 * (length + width);
    return {
      key: `geom-perimeter-${index + 1}`,
      domain: 'GEOMETRY' as const,
      subskill: 'المحيط',
      stem: text(`مستطيل طوله ${length} سم وعرضه ${width} سم. ما محيطه بالسنتيمتر؟`),
      // Distractors: نسيان الضرب في 2، المساحة، مضاعفة الطول وحده.
      options: numericOptions([perimeter, length + width, length * width, 2 * length + width]),
      explanation: `محيط المستطيل = 2 × (الطول + العرض) = 2 × (${length} + ${width}) = ${perimeter} سم.`,
    };
  });
}

// Geometry — Pythagoras. Each triple is written out so the answer stays exact.
const PYTHAGORAS_CASES: Array<[a: number, b: number, c: number]> = [
  [3, 4, 5],
  [5, 12, 13],
  [9, 12, 15],
  [8, 15, 17],
  [7, 24, 25],
  [12, 16, 20],
];

function buildPythagorasQuestions(): GeneratedQuant[] {
  return PYTHAGORAS_CASES.map(([a, b, c], index) => ({
    key: `geom-pythagoras-${index + 1}`,
    domain: 'GEOMETRY' as const,
    subskill: 'نظرية فيثاغورس',
    stem: text(`مثلث قائم الزاوية ضلعاه القائمان ${a} سم و${b} سم. ما طول الوتر بالسنتيمتر؟`),
    // Distractors: جمع الضلعين، طرحهما، محيط المثلث.
    options: numericOptions([c, a + b, b - a, a + b + c]),
    explanation: `بنظرية فيثاغورس: الوتر² = ${a}² + ${b}² = ${a * a} + ${b * b} = ${c * c}، فالوتر = ${c} سم.`,
  }));
}

// Geometry — triangle area.
const TRIANGLE_AREA_CASES: Array<[base: number, height: number]> = [
  [10, 6],
  [14, 9],
  [12, 7],
  [16, 5],
  [18, 11],
];

function buildTriangleAreaQuestions(): GeneratedQuant[] {
  return TRIANGLE_AREA_CASES.map(([base, height], index) => {
    const area = (base * height) / 2;
    return {
      key: `geom-triangle-${index + 1}`,
      domain: 'GEOMETRY' as const,
      subskill: 'المساحة',
      stem: text(`مثلث طول قاعدته ${base} سم وارتفاعه ${height} سم. ما مساحته بالسنتيمتر المربع؟`),
      // Distractors: نسيان القسمة على 2، جمع البعدين، مضاعفة مجموعهما.
      options: numericOptions([area, base * height, base + height, 2 * (base + height)]),
      explanation: `مساحة المثلث = (القاعدة × الارتفاع) ÷ 2 = (${base} × ${height}) ÷ 2 = ${num(area)} سم².`,
    };
  });
}

// Geometry — circle area and circumference, kept in terms of π so the values
// stay exact and no rounding convention has to be assumed.
const CIRCLE_AREA_RADII = [3, 6, 7, 8];
const CIRCLE_CIRCUMFERENCE_RADII = [4, 5, 9, 10];

function buildCircleAreaQuestions(): GeneratedQuant[] {
  return CIRCLE_AREA_RADII.map((radius, index) => ({
    key: `geom-circle-area-${index + 1}`,
    domain: 'GEOMETRY' as const,
    subskill: 'المساحة',
    stem: math(`دائرة نصف قطرها ${radius} سم. ما مساحتها بالسنتيمتر المربع بدلالة `, '\\pi', '؟'),
    // Distractors: المحيط، ضرب نصف القطر في π دون تربيعه، استعمال القطر مكان نصف القطر.
    options: [
      formula(`${radius * radius}\\pi`),
      formula(`${2 * radius}\\pi`),
      formula(`${radius}\\pi`),
      formula(`${4 * radius * radius}\\pi`),
    ],
    explanation: `مساحة الدائرة = π × نق² = π × ${radius}² = ${radius * radius}π سم².`,
  }));
}

function buildCircleCircumferenceQuestions(): GeneratedQuant[] {
  return CIRCLE_CIRCUMFERENCE_RADII.map((radius, index) => ({
    key: `geom-circle-perimeter-${index + 1}`,
    domain: 'GEOMETRY' as const,
    subskill: 'المحيط',
    stem: math(`دائرة نصف قطرها ${radius} سم. ما محيطها بالسنتيمتر بدلالة `, '\\pi', '؟'),
    // Distractors: المساحة، نسيان الضرب في 2، استعمال القطر مربعًا.
    options: [
      formula(`${2 * radius}\\pi`),
      formula(`${radius * radius}\\pi`),
      formula(`${radius}\\pi`),
      formula(`${4 * radius * radius}\\pi`),
    ],
    explanation: `محيط الدائرة = 2 × π × نق = 2 × π × ${radius} = ${2 * radius}π سم.`,
  }));
}

// Geometry — angles.
const ANGLE_CASES: Array<{ stem: string; options: string[]; explanation: string }> = [
  {
    stem: 'زاويتان متكاملتان مجموعهما 180°. إذا كان قياس إحداهما 42°، فما قياس الأخرى؟',
    options: ['138°', '48°', '318°', '222°'],
    explanation: 'الزاوية الأخرى = 180° − 42° = 138°.',
  },
  {
    stem: 'زاويتان متتامتان مجموعهما 90°. إذا كان قياس إحداهما 37°، فما قياس الأخرى؟',
    options: ['53°', '143°', '323°', '63°'],
    explanation: 'الزاوية الأخرى = 90° − 37° = 53°.',
  },
  {
    stem: 'في مثلث قياس زاويتين منه 55° و65°. ما قياس الزاوية الثالثة؟',
    options: ['60°', '120°', '125°', '240°'],
    explanation: 'مجموع زوايا المثلث 180°، فالزاوية الثالثة = 180° − (55° + 65°) = 60°.',
  },
  {
    stem: 'في مثلث قياس زاويتين منه 40° و75°. ما قياس الزاوية الثالثة؟',
    options: ['65°', '115°', '105°', '140°'],
    explanation: 'الزاوية الثالثة = 180° − (40° + 75°) = 65°.',
  },
];

function buildAngleQuestions(): GeneratedQuant[] {
  return ANGLE_CASES.map((item, index) => ({
    key: `geom-angle-${index + 1}`,
    domain: 'GEOMETRY' as const,
    subskill: 'الزوايا',
    stem: text(item.stem),
    options: item.options.map((option) => text(option)),
    explanation: item.explanation,
  }));
}

// Algebra — one-step-then-divide equations.
const LINEAR_EQUATION_CASES: Array<[a: number, b: number, c: number]> = [
  [3, 6, 27],
  [2, 6, 20],
  [4, 4, 40],
  [6, 12, 60],
  [3, 12, 45],
  [5, 15, 80],
];

function buildLinearEquationQuestions(): GeneratedQuant[] {
  return LINEAR_EQUATION_CASES.map(([a, b, c], index) => {
    const root = (c - b) / a;
    return {
      key: `alg-linear-${index + 1}`,
      domain: 'ALGEBRA' as const,
      subskill: 'المعادلات',
      stem: math('حل المعادلة ', `${a}x + ${b} = ${c}`),
      // Distractors: الجمع بدل الطرح، نسيان القسمة، إهمال الحد الثابت.
      options: numericOptions([root, (c + b) / a, c - b, c / a]),
      explanation: `${a}x = ${c} − ${b} = ${c - b}، إذن x = ${c - b} ÷ ${a} = ${num(root)}.`,
    };
  });
}

/** `x`, `2x + 12`, `x - 14` — never `1x` and never `+ -12`. */
function linearTex(coefficient: number, constant: number): string {
  const term = coefficient === 1 ? 'x' : `${coefficient}x`;
  if (constant === 0) return term;
  return constant > 0 ? `${term} + ${constant}` : `${term} - ${Math.abs(constant)}`;
}

// Algebra — expanding then collecting like terms.
const SIMPLIFY_CASES: Array<[factor: number, inner: number, subtracted: number]> = [
  [4, 3, 2],
  [5, 2, 3],
  [2, 7, 1],
  [6, 1, 4],
  [3, 5, 1],
];

function buildSimplifyQuestions(): GeneratedQuant[] {
  return SIMPLIFY_CASES.map(([factor, inner, subtracted], index) => {
    const coefficient = factor - subtracted;
    const constant = factor * inner;
    return {
      key: `alg-simplify-${index + 1}`,
      domain: 'ALGEBRA' as const,
      subskill: 'تبسيط المقادير',
      stem: math('بسّط المقدار ', `${factor}(x + ${inner}) - ${subtracted}x`),
      // Distractors: نسيان توزيع المعامل على الحد الثابت، جمع المعاملين بدل طرحهما، خطأ في إشارة الثابت.
      options: [
        formula(linearTex(coefficient, constant)),
        formula(linearTex(coefficient, inner)),
        formula(linearTex(factor + subtracted, constant)),
        formula(linearTex(coefficient, -constant)),
      ],
      explanation: `بالتوزيع: ${factor}x + ${constant} − ${subtracted}x، وبجمع الحدود المتشابهة يكون الناتج ${linearTex(coefficient, constant)}.`,
    };
  });
}

// Algebra — substituting into an expression.
const EVALUATE_CASES = [4, 3, 5, 6];

function buildEvaluateQuestions(): GeneratedQuant[] {
  return EVALUATE_CASES.map((value, index) => {
    const result = 3 * value * value - 5;
    return {
      key: `alg-evaluate-${index + 1}`,
      domain: 'ALGEBRA' as const,
      subskill: 'تبسيط المقادير',
      stem: rich(
        inlineText('إذا كان '),
        inlineMath(`x = ${value}`),
        inlineText('، فما قيمة المقدار '),
        inlineMath('3x^2 - 5'),
        inlineText('؟'),
      ),
      // Distractors: تربيع 3x كلها، جمع 5 بدل طرحها، ضرب x في 2 بدل تربيعها.
      options: numericOptions([
        result,
        (3 * value) ** 2 - 5,
        3 * value * value + 5,
        3 * (2 * value) - 5,
      ]),
      explanation: `نعوّض: 3 × ${value}² − 5 = 3 × ${value * value} − 5 = ${3 * value * value} − 5 = ${result}.`,
    };
  });
}

// Algebra — the unknown on both sides.
const BALANCED_EQUATION_CASES: Array<{
  tex: string;
  options: string[];
  explanation: string;
}> = [
  {
    tex: '5x - 3 = 2x + 12',
    options: ['5', '3', '15', '-5'],
    explanation: 'بنقل الحدود: 5x − 2x = 12 + 3، أي 3x = 15، إذن x = 5.',
  },
  {
    tex: '7x + 4 = 3x + 20',
    options: ['4', '6', '16', '-4'],
    explanation: 'بنقل الحدود: 7x − 3x = 20 − 4، أي 4x = 16، إذن x = 4.',
  },
  {
    tex: '4x + 9 = x + 27',
    options: ['6', '12', '18', '-6'],
    explanation: 'بنقل الحدود: 4x − x = 27 − 9، أي 3x = 18، إذن x = 6.',
  },
  {
    tex: '9x - 5 = 4x + 20',
    options: ['5', '3', '25', '-5'],
    explanation: 'بنقل الحدود: 9x − 4x = 20 + 5، أي 5x = 25، إذن x = 5.',
  },
  {
    tex: '6x + 7 = 2x + 31',
    options: ['6', '24', '-6', '4'],
    explanation: 'بنقل الحدود: 6x − 2x = 31 − 7، أي 4x = 24، إذن x = 6.',
  },
];

function buildBalancedEquationQuestions(): GeneratedQuant[] {
  return BALANCED_EQUATION_CASES.map((item, index) => ({
    key: `alg-balance-${index + 1}`,
    domain: 'ALGEBRA' as const,
    subskill: 'المعادلات',
    stem: math('حل المعادلة ', item.tex),
    options: item.options.map((option) => formula(option)),
    explanation: item.explanation,
  }));
}

// Data analysis — reading a small table.
const TABLE_CASES: Array<{ stem: string; options: string[]; explanation: string }> = [
  {
    stem: 'سجّلت مكتبة عدد زوارها: السبت 34، الأحد 52، الاثنين 41، الثلاثاء 28. في أي يوم كان عدد الزوار أقل ما يكون؟',
    options: ['الثلاثاء', 'السبت', 'الاثنين', 'الأحد'],
    explanation: 'أقل قيمة في الجدول هي 28 وتقابل يوم الثلاثاء.',
  },
  {
    stem: 'أنتج مصنع في أربعة أسابيع: الأول 120 قطعة، الثاني 95، الثالث 140، الرابع 110. في أي أسبوع بلغ الإنتاج ذروته؟',
    options: ['الأسبوع الثالث', 'الأسبوع الأول', 'الأسبوع الرابع', 'الأسبوع الثاني'],
    explanation: 'أعلى قيمة هي 140 قطعة وتقابل الأسبوع الثالث.',
  },
  {
    stem: 'درجات طالب في أربع مواد: اللغة 88، الرياضيات 74، العلوم 91، التاريخ 80. في أي مادة كانت درجته أعلى؟',
    options: ['العلوم', 'اللغة', 'التاريخ', 'الرياضيات'],
    explanation: 'أعلى درجة هي 91 وتقابل مادة العلوم.',
  },
  {
    stem: 'عدد المتدربين في أربع دورات: أ 45، ب 30، ج 52، د 38. أي الدورات كان عدد متدربيها أقل؟',
    options: ['الدورة ب', 'الدورة د', 'الدورة أ', 'الدورة ج'],
    explanation: 'أقل عدد هو 30 متدربًا ويقابل الدورة ب.',
  },
];

function buildTableQuestions(): GeneratedQuant[] {
  return TABLE_CASES.map((item, index) => ({
    key: `data-table-${index + 1}`,
    domain: 'DATA_ANALYSIS' as const,
    subskill: 'الجداول',
    stem: text(item.stem),
    options: item.options.map((option) => text(option)),
    explanation: item.explanation,
    // Named categories, not values: their written order is deliberate.
    ordered: true,
  }));
}

// Data analysis — a pie sector as a share of a total.
const SECTOR_CASES: Array<[total: number, rate: number]> = [
  [600, 15],
  [800, 35],
  [1200, 40],
  [250, 20],
  [900, 30],
];

function buildSectorQuestions(): GeneratedQuant[] {
  return SECTOR_CASES.map(([total, rate], index) => {
    const share = (total * rate) / 100;
    return {
      key: `data-sector-${index + 1}`,
      domain: 'DATA_ANALYSIS' as const,
      subskill: 'القطاعات الدائرية',
      stem: text(
        `يمثل قطاع دائري ${rate}% من إجمالي ${total} مشارك. كم عدد المشاركين الذين يمثلهم القطاع؟`,
      ),
      // Distractors: القطاع المتمم، طرح النسبة كأنها عدد، مضاعفة الناتج.
      options: numericOptions([share, total - share, total - rate, 2 * share]),
      explanation: `عدد المشاركين = ${total} × ${rate} ÷ 100 = ${num(share)} مشاركًا.`,
    };
  });
}

// Data analysis — comparing two bars.
const BAR_CASES: Array<{ stem: string; values: number[]; explanation: string }> = [
  {
    stem: 'يبيّن رسم بالأعمدة عدد الكتب المستعارة: أ 45، ب 30، ج 52، د 38. كم يزيد العمود ج على العمود ب؟',
    values: [22, 82, 14, 15],
    explanation: 'الفرق = 52 − 30 = 22 كتابًا.',
  },
  {
    stem: 'يبيّن رسم بالأعمدة أعداد الطلاب: الأول 28، الثاني 35، الثالث 22، الرابع 40. كم يزيد الرابع على الثالث؟',
    values: [18, 62, 5, 12],
    explanation: 'الفرق = 40 − 22 = 18 طالبًا.',
  },
  {
    stem: 'درجات الحرارة المسجلة: الاثنين 31، الثلاثاء 27، الأربعاء 35، الخميس 29. ما الفرق بين أعلى درجة وأدنى درجة؟',
    values: [8, 62, 6, 4],
    explanation: 'أعلى درجة 35 وأدناها 27، والفرق = 35 − 27 = 8 درجات.',
  },
  {
    stem: 'عدد الرحلات اليومية: صباحًا 24، ظهرًا 31، مساءً 19. كم تزيد رحلات الظهر على رحلات المساء؟',
    values: [12, 50, 7, 5],
    explanation: 'الفرق = 31 − 19 = 12 رحلة.',
  },
];

function buildBarQuestions(): GeneratedQuant[] {
  return BAR_CASES.map((item, index) => ({
    key: `data-bar-${index + 1}`,
    domain: 'DATA_ANALYSIS' as const,
    subskill: 'الأعمدة البيانية',
    stem: text(item.stem),
    // Distractors: الجمع بدل الطرح، ثم الفرق بين عمودين غير المطلوبين.
    options: numericOptions(item.values),
    explanation: item.explanation,
  }));
}

// Data analysis — the mean of a recorded set.
const DATA_MEAN_CASES: Array<{ label: string; values: number[] }> = [
  { label: 'درجات طالب في أربع مواد', values: [12, 18, 14, 16] },
  { label: 'أعداد الزوار في أربعة أيام', values: [22, 26, 30, 42] },
  { label: 'عدد الكتب المقروءة في أربعة أشهر', values: [9, 16, 14, 21] },
  { label: 'مبيعات أربعة فروع بالآلاف', values: [45, 55, 35, 45] },
];

function buildDataMeanQuestions(): GeneratedQuant[] {
  return DATA_MEAN_CASES.map((item, index) => {
    const sum = item.values.reduce((total, value) => total + value, 0);
    const mean = sum / item.values.length;
    const range = Math.max(...item.values) - Math.min(...item.values);
    return {
      key: `data-mean-${index + 1}`,
      domain: 'DATA_ANALYSIS' as const,
      subskill: 'المتوسطات',
      stem: text(`${item.label}: ${item.values.join('، ')}. ما متوسط هذه القيم؟`),
      // Distractors: المجموع دون قسمة، القسمة على عدد خاطئ، المدى.
      options: numericOptions([mean, sum, sum / 3, range]),
      explanation: `المجموع = ${sum}، وعدد القيم = ${item.values.length}، فالمتوسط = ${sum} ÷ ${item.values.length} = ${num(mean)}.`,
    };
  });
}

// Data analysis — simple probability.
const PROBABILITY_CASES: Array<[red: number, blue: number]> = [
  [5, 7],
  [9, 11],
  [7, 13],
  [3, 17],
];

function buildProbabilityQuestions(): GeneratedQuant[] {
  return PROBABILITY_CASES.map(([red, blue], index) => {
    const total = red + blue;
    return {
      key: `data-probability-${index + 1}`,
      domain: 'DATA_ANALYSIS' as const,
      subskill: 'الاحتمالات',
      stem: text(
        `في صندوق ${counted(red, 'كرات', 'كرة')} حمراء و${counted(blue, 'كرات', 'كرة')} زرقاء، سُحبت كرة واحدة دون النظر. ما احتمال أن تكون حمراء؟`,
      ),
      // Distractors: احتمال الزرقاء، نسبة الحمراء إلى الزرقاء بدل الكل، مقلوب عدد الحمراء.
      options: [
        formula(`\\frac{${red}}{${total}}`),
        formula(`\\frac{${blue}}{${total}}`),
        formula(`\\frac{${red}}{${blue}}`),
        formula(`\\frac{1}{${red}}`),
      ],
      explanation: `عدد الكرات كلها = ${red} + ${blue} = ${total}، والحالات المواتية ${red}، فالاحتمال = ${red}/${total}.`,
    };
  });
}

// Data analysis — a count expressed as a percentage.
const SHARE_CASES: Array<[total: number, part: number]> = [
  [240, 60],
  [500, 150],
  [900, 180],
  [700, 280],
];

function buildShareQuestions(): GeneratedQuant[] {
  return SHARE_CASES.map(([total, part], index) => {
    const rate = (part * 100) / total;
    return {
      key: `data-share-${index + 1}`,
      domain: 'DATA_ANALYSIS' as const,
      subskill: 'النسبة المئوية',
      stem: text(`من بين ${total} طالبًا شارك ${part} طالبًا في النادي العلمي. ما نسبة المشاركين؟`),
      // Distractors: نسبة غير المشاركين، نصف النسبة، ضعفها.
      options: [rate, 100 - rate, rate / 2, rate * 2].map((value) => text(`${num(value)}%`)),
      explanation: `النسبة = (${part} ÷ ${total}) × 100 = ${num(rate)}%.`,
    };
  });
}

function buildGeneratedQuantQuestions(): SeedQuestion[] {
  const generated: GeneratedQuant[] = [
    ...buildDiscountQuestions(),
    ...buildRatioQuestions(),
    ...buildSpeedQuestions(),
    ...buildAverageQuestions(),
    ...buildIncreaseQuestions(),
    ...buildUnitRateQuestions(),
    ...buildRectangleAreaQuestions(),
    ...buildRectanglePerimeterQuestions(),
    ...buildPythagorasQuestions(),
    ...buildTriangleAreaQuestions(),
    ...buildCircleAreaQuestions(),
    ...buildCircleCircumferenceQuestions(),
    ...buildAngleQuestions(),
    ...buildLinearEquationQuestions(),
    ...buildSimplifyQuestions(),
    ...buildEvaluateQuestions(),
    ...buildBalancedEquationQuestions(),
    ...buildTableQuestions(),
    ...buildSectorQuestions(),
    ...buildBarQuestions(),
    ...buildDataMeanQuestions(),
    ...buildProbabilityQuestions(),
    ...buildShareQuestions(),
  ];

  return generated.map((item, index) => ({
    externalKey: item.key,
    domain: item.domain,
    subskill: item.subskill,
    difficulty: cycleDifficulty(index),
    stem: item.stem,
    options: item.options,
    correctIndex: 0,
    explanation: text(item.explanation),
    shuffleOptions: !item.ordered,
  }));
}

// ── Reading comprehension ───────────────────────────────────────────────

type ReadingItem = {
  question: string;
  correct: string;
  distractors: string[];
  reason: string;
  subskill: string;
};

export type ReadingPassage = {
  externalKey: string;
  title: string;
  body: string;
  /**
   * Key prefix for this passage's questions. The first passage keeps the bare
   * `reading-N` keys it was seeded with, so databases that already hold those
   * four rows keep them instead of gaining duplicates under a new name.
   */
  keyPrefix: string;
  items: ReadingItem[];
};

export const READING_PASSAGES: ReadingPassage[] = [
  {
    externalKey: 'passage-reading-habits',
    title: 'القراءة والعادة اليومية',
    keyPrefix: 'reading',
    body: 'تتكوّن عادة القراءة كما تتكوّن أي عادة أخرى: بالتكرار القصير المنتظم، لا بالجهد الكبير المتقطّع. من يقرأ عشر صفحات كل يوم يقطع في السنة مسافة لا يبلغها من يقرأ مئة صفحة في يوم واحد ثم ينقطع شهرًا. والسبب أن الانتظام يبني ألفة بين القارئ والنص، فتقلّ المقاومة التي يشعر بها عند البدء. أما الاندفاع المتقطّع فيُنهك صاحبه، ويجعل القراءة عبئًا يُؤجَّل لا متعة تُنتظر. ولهذا ينصح المختصون بالبدء بمقدار صغير يسهل الالتزام به، ثم زيادته تدريجيًا حين يصبح تركه أصعب من فعله.',
    items: [
      {
        question: 'ما الفكرة الرئيسة للنص؟',
        correct: 'الانتظام في القراءة أجدى من الجهد الكبير المتقطّع.',
        distractors: [
          'القراءة السريعة أفضل وسيلة لزيادة التحصيل.',
          'قراءة مئة صفحة يوميًا هدف يجب أن يسعى إليه الجميع.',
          'المختصون يختلفون في تحديد المقدار المناسب للقراءة.',
        ],
        reason: 'يقارن النص بين الانتظام والاندفاع المتقطّع، ويرجّح الانتظام في أكثر من موضع.',
        subskill: 'الفكرة الرئيسة',
      },
      {
        question: 'ما المقصود بكلمة «المقاومة» في النص؟',
        correct: 'النفور الذي يشعر به القارئ عند بدء القراءة.',
        distractors: [
          'صعوبة ألفاظ النص المقروء.',
          'اعتراض المحيطين على عادة القراءة.',
          'ضيق الوقت المتاح للقراءة.',
        ],
        reason: 'وردت الكلمة في سياق الألفة بين القارئ والنص، أي تراجع النفور عند البدء.',
        subskill: 'معنى المفردة في السياق',
      },
      {
        question: 'لماذا ينصح المختصون بالبدء بمقدار صغير؟',
        correct: 'لأنه يسهل الالتزام به حتى يصير تركه أصعب من فعله.',
        distractors: [
          'لأن المقدار الكبير لا يفيد القارئ.',
          'لأن الكتب القصيرة أنفع من الطويلة.',
          'لأن القراءة اليومية غير ممكنة لأكثر الناس.',
        ],
        reason: 'ذكر النص السبب صراحة في جملته الأخيرة.',
        subskill: 'الأفكار الداعمة',
      },
      {
        question: 'ما العلاقة بين الجملتين الأخيرتين في النص؟',
        correct: 'الثانية تقدّم توصية مبنية على ما قررته الأولى.',
        distractors: [
          'الثانية تناقض ما ورد في الأولى.',
          'الثانية تكرار حرفي للأولى.',
          'لا توجد علاقة بينهما.',
        ],
        reason: 'الجملة الأولى تصف أثر الاندفاع، والثانية تبني عليها نصيحة عملية.',
        subskill: 'العلاقات بين أجزاء النص',
      },
    ],
  },
  {
    externalKey: 'passage-sleep-learning',
    title: 'النوم وتثبيت ما نتعلّمه',
    keyPrefix: 'reading-sleep',
    body: 'ينظر كثيرون إلى النوم على أنه توقف كامل عن العمل، والحقيقة أن الدماغ في أثنائه يعيد ترتيب ما جمعه في يقظته. فالمعلومة التي تُقرأ قبل النوم تمرّ بعملية تثبيت هادئة، تنتقل بها من حيّز مؤقت إلى مخزن أطول بقاءً. ولهذا يجد الطالب الذي نام بعد مراجعته أن ما درسه أقرب إلى الاستحضار من زميله الذي سهر ليلته كلها يكرر الصفحات. وليس معنى ذلك أن النوم يغني عن الدرس، فهو لا يخلق معلومة لم تدخل الذهن أصلًا، وإنما يرتّب ما دخله. ومن هنا كان اقتطاع ساعات النوم لأجل مراجعة إضافية صفقة خاسرة في أكثر الأحوال: يربح الطالب وقتًا ظاهرًا، ويخسر التثبيت الذي كان ذلك الوقت نفسه سيمنحه إياه.',
    items: [
      {
        question: 'ما الفكرة الرئيسة للنص؟',
        correct: 'النوم جزء من عملية التعلّم لأنه يثبّت ما دُرس، لا وقت ضائع.',
        distractors: [
          'النوم بديل عن المراجعة يغني الطالب عن الدرس.',
          'السهر ليلة كاملة أنجع وسيلة لحفظ الدروس.',
          'الدماغ يتوقف عن العمل توقفًا تامًا أثناء النوم.',
        ],
        reason: 'يدور النص كله حول دور النوم في ترتيب ما جُمع في اليقظة وتثبيته.',
        subskill: 'الفكرة الرئيسة',
      },
      {
        question: 'لماذا عدّ النص اقتطاع ساعات النوم صفقة خاسرة؟',
        correct: 'لأن الطالب يكسب وقتًا ظاهرًا ويخسر تثبيت ما درسه.',
        distractors: [
          'لأن المراجعة الإضافية لا فائدة فيها إطلاقًا.',
          'لأن النوم يزيد عدد المعلومات المخزّنة تلقائيًا.',
          'لأن السهر يضعف البصر مع طول الوقت.',
        ],
        reason: 'الجملة الأخيرة توازن بين ربح ظاهر وخسارة حقيقية، وهي علة الحكم.',
        subskill: 'الأفكار الداعمة',
      },
      {
        question: 'ما المقصود بكلمة «التثبيت» في النص؟',
        correct: 'نقل المعلومة إلى مخزن أطول بقاءً في الذاكرة.',
        distractors: [
          'تكرار قراءة الصفحة أكثر من مرة.',
          'كتابة المعلومة في دفتر خاص.',
          'الامتناع عن الدراسة مدة طويلة.',
        ],
        reason: 'فسّر النص الكلمة بنفسه: انتقال من حيّز مؤقت إلى مخزن أطول بقاءً.',
        subskill: 'معنى المفردة في السياق',
      },
      {
        question: 'على من يعود الضمير المستتر في قوله «وإنما يرتّب ما دخله»؟',
        correct: 'على النوم.',
        distractors: ['على الطالب.', 'على الدرس.', 'على المخزن.'],
        reason: 'الجملة معطوفة على قوله «فهو لا يخلق معلومة»، والضمير فيهما للنوم.',
        subskill: 'مرجع الضمير',
      },
      {
        question: 'ماذا يُفهم من النص عن طالب لم يراجع أصلًا ثم نام؟',
        correct: 'لن يفيده نومه شيئًا، لأن النوم لا يخلق معلومة لم تدخل الذهن.',
        distractors: [
          'سيتذكر الدرس إذا نام مبكرًا بما يكفي.',
          'سيكون حاله أفضل من حال من راجع وسهر.',
          'سيخزّن المعلومات تلقائيًا في أثناء نومه.',
        ],
        reason: 'نصّ الكاتب على أن النوم يرتّب ما دخل الذهن ولا ينشئ ما لم يدخله.',
        subskill: 'الاستنتاج',
      },
      {
        question: 'ما وظيفة قوله «وليس معنى ذلك أن النوم يغني عن الدرس»؟',
        correct: 'دفع فهم خاطئ قد يُستنتج مما سبقه.',
        distractors: [
          'تقديم دليل جديد يؤيد ما قبله.',
          'تلخيص الفقرة كلها في جملة واحدة.',
          'الانتقال إلى موضوع لا صلة له بما قبله.',
        ],
        reason: 'العبارة تحدّ من الفكرة السابقة حتى لا تُفهم على إطلاقها.',
        subskill: 'العلاقات بين أجزاء النص',
      },
      {
        question: 'بمن قارن النص الطالب الذي نام بعد مراجعته؟',
        correct: 'بزميله الذي سهر ليلته كلها يكرر الصفحات.',
        distractors: [
          'بزميله الذي لم يفتح كتابه أصلًا.',
          'بمن يراجع في الصباح الباكر.',
          'بمن يقرأ أكثر من كتاب في وقت واحد.',
        ],
        reason: 'المقارنة وردت صريحة في النص بين النائم بعد المراجعة والساهر المكرر.',
        subskill: 'الأفكار الداعمة',
      },
    ],
  },
  {
    externalKey: 'passage-urban-green',
    title: 'المساحات الخضراء في المدن',
    keyPrefix: 'reading-green',
    body: 'حين تُخطَّط المدن، تُقاس جودتها بما تتركه من فراغ لا بما تملؤه من بناء. فالحديقة الصغيرة في وسط الحي ليست زينة تُضاف بعد اكتمال المباني، بل مرفق يؤدي عملًا: يخفّف حرارة المكان في الصيف، ويمنح السكان مساحة يلتقون فيها من غير كلفة، ويجعل المشي خيارًا معقولًا بدل السيارة في المشاوير القصيرة. وقد لوحظ أن الأحياء التي تكثر فيها هذه المساحات أقل شكوى من الضوضاء، لا لأن الشجر يحجب الصوت وحده، بل لأن الناس يجدون متنفّسًا يخرجون إليه فتقلّ احتكاكاتهم في الأزقة الضيقة. غير أن هذه المنافع لا تتحقق بمجرد تخصيص قطعة أرض وتسميتها حديقة؛ فالمكان الذي لا يُصان ولا يُظلَّل يبقى فراغًا مهجورًا، ويصير عبئًا على الحي بدل أن يكون متنفسًا له.',
    items: [
      {
        question: 'ما الفكرة الرئيسة للنص؟',
        correct: 'المساحات الخضراء مرفق عامل في المدينة بشرط أن تُصان وتُهيَّأ.',
        distractors: [
          'المدن الحديثة تحتاج إلى مزيد من المباني لا إلى الحدائق.',
          'الأشجار وحدها كافية لمنع الضوضاء في الأحياء.',
          'تخصيص قطعة أرض للحديقة يكفي لتحقيق منافعها.',
        ],
        reason: 'عرض النص منافع الحديقة ثم قيّدها بشرط الصيانة والتظليل في خاتمته.',
        subskill: 'الفكرة الرئيسة',
      },
      {
        question: 'لماذا تقلّ الشكوى من الضوضاء في الأحياء ذات المساحات الخضراء بحسب النص؟',
        correct: 'لأن السكان يجدون متنفسًا يخرجون إليه فتقلّ احتكاكاتهم.',
        distractors: [
          'لأن الشجر يحجب الصوت حجبًا تامًا.',
          'لأن عدد سكان تلك الأحياء أقل من غيرها.',
          'لأن السيارات ممنوعة من دخول تلك الأحياء.',
        ],
        reason: 'نفى النص أن يكون السبب حجب الشجر وحده، وأثبت سببًا اجتماعيًا بعده.',
        subskill: 'الأفكار الداعمة',
      },
      {
        question: 'ما معنى «متنفّسًا» في النص؟',
        correct: 'مكانًا يجد فيه الناس سعة وراحة.',
        distractors: [
          'هواءً نقيًا خاليًا من الغبار.',
          'طريقًا واسعًا مخصصًا للسيارات.',
          'وقتًا محددًا لممارسة الرياضة.',
        ],
        reason: 'الكلمة وردت في مقابل ضيق الأزقة، فدلّت على المكان الذي يتّسع للناس.',
        subskill: 'معنى المفردة في السياق',
      },
      {
        question: 'إلامَ تعود الإشارة في قوله «غير أن هذه المنافع»؟',
        correct: 'إلى فوائد الحديقة التي عدّدها النص قبلها.',
        distractors: [
          'إلى منافع المباني المرتفعة في المدينة.',
          'إلى فوائد المشي في المشاوير القصيرة وحدها.',
          'إلى مزايا الأزقة الضيقة في الأحياء القديمة.',
        ],
        reason:
          'اسم الإشارة يجمع ما سبق ذكره من تخفيف الحرارة والالتقاء وتيسير المشي وقلّة الضوضاء.',
        subskill: 'مرجع الضمير',
      },
      {
        question: 'ما العلاقة التي تربطها «غير أنّ» بما قبلها؟',
        correct: 'استدراك يقيّد المنافع السابقة بشرط.',
        distractors: [
          'تعليل يفسّر سبب تلك المنافع.',
          'تمثيل يوضّح المنافع بمثال.',
          'تكرار للمعنى السابق بلفظ آخر.',
        ],
        reason: '«غير أنّ» أداة استدراك، وقد جاءت لتشترط الصيانة قبل تحقق المنافع.',
        subskill: 'العلاقات بين أجزاء النص',
      },
      {
        question: 'ماذا يُفهم من النص عن الحديقة التي لا تُصان؟',
        correct: 'تتحول إلى عبء على الحي بدل أن تكون متنفسًا له.',
        distractors: [
          'تظل نافعة وإن قلّ روادها.',
          'تخفض حرارة المكان كغيرها من الحدائق.',
          'تمنع الضوضاء أكثر من الحديقة المصانة.',
        ],
        reason: 'ختم النص بأن المكان غير المصان يبقى فراغًا مهجورًا ويصير عبئًا.',
        subskill: 'الاستنتاج',
      },
      {
        question: 'أيّ المنافع الآتية ذكرها النص للحديقة؟',
        correct: 'جعل المشي خيارًا معقولًا في المشاوير القصيرة.',
        distractors: [
          'رفع أسعار العقارات في الحي.',
          'توفير أماكن لوقوف السيارات.',
          'تقليل استهلاك الماء في المنازل.',
        ],
        reason: 'ورد ذلك في تعداد أعمال الحديقة داخل النص.',
        subskill: 'الأفكار الداعمة',
      },
    ],
  },
  {
    externalKey: 'passage-learning-errors',
    title: 'الخطأ في طريق التعلّم',
    keyPrefix: 'reading-error',
    body: 'يُعامَل الخطأ في كثير من قاعات الدرس بوصفه علامة نقص يُستحيا منها، والأولى أن يُعامَل بوصفه معلومة. فالطالب الذي يحلّ مسألة حلًّا خاطئًا قد كشف لمعلّمه موضع الالتباس في ذهنه بدقة لا يبلغها اختبار يجيب فيه إجابة صحيحة عن ظهر قلب. ولذلك فإن الفصل الذي يخلو من الأخطاء ليس بالضرورة أنجح الفصول؛ فقد يكون الطلاب فيه قد تعلّموا الصمت لا المسألة. على أن للخطأ شرطًا حتى يفيد: أن يُتبَع بمراجعة تكشف سببه. أما الخطأ الذي يمرّ دون تفسير فإنه يترسّخ بالتكرار، ويصير عادة يصعب نقضها بعد حين. والفرق بين الحالتين ليس في الخطأ نفسه، بل فيما يُصنع به بعد وقوعه.',
    items: [
      {
        question: 'ما الفكرة الرئيسة للنص؟',
        correct: 'الخطأ يفيد المتعلّم إذا أُتبع بمراجعة تكشف سببه.',
        distractors: [
          'ينبغي منع الطلاب من الوقوع في الخطأ بكل وسيلة.',
          'الفصل الخالي من الأخطاء هو أنجح الفصول دائمًا.',
          'حفظ الإجابات عن ظهر قلب أفضل طرائق التعلّم.',
        ],
        reason: 'يقرر النص قيمة الخطأ ثم يشترط لها المراجعة الكاشفة لسببه.',
        subskill: 'الفكرة الرئيسة',
      },
      {
        question: 'لماذا قد لا يكون الفصل الخالي من الأخطاء أنجح الفصول؟',
        correct: 'لاحتمال أن يكون طلابه قد تعلّموا الصمت لا المسألة.',
        distractors: [
          'لأن معلّمه لا يصحح الواجبات.',
          'لأن مقرراته أصعب من مقررات غيره.',
          'لأن عدد طلابه قليل جدًا.',
        ],
        reason: 'ذكر النص هذا الاحتمال صراحة بعد حكمه على الفصل الخالي من الأخطاء.',
        subskill: 'الأفكار الداعمة',
      },
      {
        question: 'ما المقصود بكلمة «يترسّخ» في النص؟',
        correct: 'يثبت في الذهن حتى يصعب نقضه.',
        distractors: [
          'يظهر فجأة دون مقدمات.',
          'يزول من تلقاء نفسه بمرور الوقت.',
          'ينتقل من طالب إلى آخر.',
        ],
        reason: 'جاءت الكلمة موصولة بقوله «ويصير عادة يصعب نقضها»، وهو تفسيرها.',
        subskill: 'معنى المفردة في السياق',
      },
      {
        question: 'إلامَ يعود الضمير في قوله «أن يُتبَع بمراجعة تكشف سببه»؟',
        correct: 'إلى الخطأ.',
        distractors: ['إلى المعلّم.', 'إلى الفصل.', 'إلى الاختبار.'],
        reason: 'الشرط مذكور للخطأ نفسه، فالضمير عائد عليه لا على غيره.',
        subskill: 'مرجع الضمير',
      },
      {
        question: 'ما وظيفة قوله «على أن للخطأ شرطًا حتى يفيد»؟',
        correct: 'تقييد الحكم السابق بشرط لازم.',
        distractors: [
          'نقض ما سبق نقضًا تامًا.',
          'ضرب مثال يوضّح ما سبق.',
          'تكرار الفكرة الأولى بلفظ مختلف.',
        ],
        reason: '«على أن» أداة استدراك، جاءت لتضع للخطأ شرطًا لا لتلغي ما قبله.',
        subskill: 'العلاقات بين أجزاء النص',
      },
      {
        question: 'يُفهم من النص أن الحل الخاطئ ينفع المعلّم لأنه:',
        correct: 'يدلّه على موضع الالتباس في ذهن الطالب.',
        distractors: [
          'يوفّر عليه وقت التصحيح.',
          'يثبت له أن الطالب لم يذاكر.',
          'يدفعه إلى إعادة شرح المقرر كله.',
        ],
        reason: 'قرّر النص أن الحل الخاطئ يكشف موضع الالتباس بدقة لا يبلغها الجواب المحفوظ.',
        subskill: 'الاستنتاج',
      },
      {
        question: 'ما الفرق بين الخطأ النافع والخطأ الضار في النص؟',
        correct: 'النافع يُتبع بمراجعة تكشف سببه، والضار يمرّ دون تفسير.',
        distractors: [
          'النافع يقع في الرياضيات والضار يقع في اللغة.',
          'النافع يقع من المتفوقين والضار من غيرهم.',
          'النافع يقع مرة واحدة والضار يقع مرتين.',
        ],
        reason: 'ختم النص بأن الفرق ليس في الخطأ نفسه بل فيما يُصنع به بعد وقوعه.',
        subskill: 'الأفكار الداعمة',
      },
    ],
  },
  {
    externalKey: 'passage-water-saving',
    title: 'ترشيد استهلاك الماء',
    keyPrefix: 'reading-water',
    body: 'حين يجري الماء في الأنبوب دون انقطاع، يغيب عن الذهن أنه مورد محدود يُنقل ويُعالَج ويُخزَّن بكلفة عالية قبل أن يبلغ الصنبور. ولهذا يبدأ الترشيد من تصوّر صحيح للمسافة التي قطعها الماء، لا من شعور بالذنب. والملاحَظ أن أكبر الفواقد في البيوت لا يأتي من الاستعمال الظاهر كالشرب والطبخ، بل من تسريبات صغيرة لا يُسمع لها صوت: صنبور يقطر قطرة في الثانية يهدر في الشهر ما يكفي أسرة أيامًا. ولذلك فإن فحص الوصلات مرة كل موسم أجدى من حملات توعية تُنسى بعد أسبوع. أما تقنين الاستهلاك الظاهر وحده مع ترك التسريب الخفي، فهو أشبه بمن يعدّ قطرات كوبه بينما ينساب الماء من تحت قدميه.',
    items: [
      {
        question: 'ما الفكرة الرئيسة للنص؟',
        correct:
          'أكبر ما يُهدر من الماء تسريبات خفية، ومعالجتها أجدى من تقنين الاستعمال الظاهر وحده.',
        distractors: [
          'ينبغي الامتناع عن استعمال الماء في الطبخ والشرب.',
          'حملات التوعية هي الوسيلة الوحيدة لترشيد الماء.',
          'الماء مورد لا ينفد ما دام يجري في الأنابيب.',
        ],
        reason: 'يوازن النص بين الفاقد الظاهر والفاقد الخفي، ويرجّح العناية بالثاني.',
        subskill: 'الفكرة الرئيسة',
      },
      {
        question: 'ما المثال الذي ضربه النص للتسريب الخفي؟',
        correct: 'صنبور يقطر قطرة في الثانية.',
        distractors: [
          'خزان مكشوف يتبخر ماؤه في الصيف.',
          'أنبوب مكسور في الشارع العام.',
          'حوض يُملأ بالماء كل أسبوع.',
        ],
        reason: 'المثال مذكور بنصه بعد قوله «تسريبات صغيرة لا يُسمع لها صوت».',
        subskill: 'الأفكار الداعمة',
      },
      {
        question: 'ما معنى «الفواقد» في النص؟',
        correct: 'ما يضيع من الماء دون فائدة.',
        distractors: [
          'ما يُخزَّن من الماء للطوارئ.',
          'كلفة نقل الماء ومعالجته.',
          'الأدوات المستعملة في فحص الوصلات.',
        ],
        reason: 'الكلمة جاءت في سياق الهدر، ومقابلها ما يُنتفع به من الماء.',
        subskill: 'معنى المفردة في السياق',
      },
      {
        question: 'على من يعود الضمير المستتر في قوله «قبل أن يبلغ الصنبور»؟',
        correct: 'على الماء.',
        distractors: ['على الأنبوب.', 'على الصنبور.', 'على الذهن.'],
        reason: 'الجملة تصف رحلة الماء من النقل والمعالجة والتخزين إلى وصوله إلى الصنبور.',
        subskill: 'مرجع الضمير',
      },
      {
        question: 'ما وظيفة التشبيه الذي ختم به النص؟',
        correct: 'توضيح خطأ من يقنّن الاستهلاك الظاهر ويترك التسريب الخفي.',
        distractors: [
          'بيان أهمية الماء في الشرب والطبخ.',
          'التنبيه على غلاء كلفة معالجة الماء.',
          'الدعوة إلى الاستغناء عن الصنابير.',
        ],
        reason: 'التشبيه يصوّر انشغال المرء بالقليل الظاهر وغفلته عن الكثير الخفي.',
        subskill: 'العلاقات بين أجزاء النص',
      },
      {
        question: 'ماذا يُفهم من النص عن حملات التوعية؟',
        correct: 'أثرها أقل من فحص الوصلات لأنها تُنسى سريعًا.',
        distractors: [
          'لا فائدة فيها بحال من الأحوال.',
          'كافية وحدها لحل مشكلة الهدر.',
          'سبب رئيس في زيادة التسريبات.',
        ],
        reason: 'فضّل النص فحص الوصلات كل موسم على حملات تُنسى بعد أسبوع، ولم ينف فائدتها مطلقًا.',
        subskill: 'الاستنتاج',
      },
      {
        question: 'من أين يبدأ الترشيد بحسب النص؟',
        correct: 'من تصوّر صحيح لكلفة الماء والمسافة التي قطعها.',
        distractors: [
          'من شعور بالذنب تجاه كل استعمال للماء.',
          'من منع الأسر من استعمال الماء ليلًا.',
          'من تركيب صنابير جديدة كل شهر.',
        ],
        reason: 'نصّ الكاتب على أن الترشيد يبدأ من التصور الصحيح لا من الشعور بالذنب.',
        subskill: 'الأفكار الداعمة',
      },
    ],
  },
  {
    externalKey: 'passage-note-taking',
    title: 'تدوين الملاحظات وفهم الدرس',
    keyPrefix: 'reading-notes',
    body: 'يظن كثير من الطلاب أن أفضل ملاحظة أكثرها اكتمالًا، فينشغلون بنقل كلام المعلّم حرفًا حرفًا حتى تفوتهم فكرته. والحق أن التدوين عمل انتقائي: أنت تختار وتختصر وتعيد الصياغة، وفي هذا الاختيار نفسه يجري الفهم. ومن كتب بيده وجد أن بطء اليد يفرض عليه هذا الانتقاء فرضًا، بينما تتيح لوحة المفاتيح نسخًا سريعًا قد يمرّ بالعقل مرور الكلام العابر. وليس المقصود تفضيل أداة على أداة في كل حال، فمن كتب على الحاسوب ملخصًا بعبارته هو أفضل ممن ملأ دفتره نقلًا لا يفهمه. المعيار إذن ليس الأداة، بل مقدار ما بذله الكاتب من إعادة تشكيل للمعنى قبل أن يستقر على الورق.',
    items: [
      {
        question: 'ما الفكرة الرئيسة للنص؟',
        correct: 'قيمة التدوين في إعادة صياغة المعنى، لا في اكتمال النقل ولا في نوع الأداة.',
        distractors: [
          'الكتابة باليد أفضل من الحاسوب في كل الأحوال.',
          'أفضل الملاحظات أكثرها اكتمالًا ودقة في النقل.',
          'الأولى ترك التدوين والاكتفاء بالإنصات.',
        ],
        reason: 'ختم النص بأن المعيار ليس الأداة بل مقدار إعادة تشكيل المعنى.',
        subskill: 'الفكرة الرئيسة',
      },
      {
        question: 'لماذا يفرض بطء اليد الانتقاء بحسب النص؟',
        correct: 'لأن الكاتب لا يستطيع نقل كل شيء فيضطر إلى الاختيار والاختصار.',
        distractors: [
          'لأن اليد تتعب بعد وقت قصير من الكتابة.',
          'لأن الورق لا يتسع للكلام كله.',
          'لأن الخط يصعب قراءته إذا أسرع صاحبه.',
        ],
        reason: 'ربط النص بين بطء اليد وبين الانتقاء الذي هو جوهر التدوين عنده.',
        subskill: 'الأفكار الداعمة',
      },
      {
        question: 'ما المقصود بكلمة «انتقائي» في النص؟',
        correct: 'قائم على اختيار الأهم وترك ما دونه.',
        distractors: [
          'شامل لكل ما يُقال دون نقص.',
          'سريع في التنفيذ قليل الكلفة.',
          'خاص بمادة دراسية دون أخرى.',
        ],
        reason: 'فسّر النص الكلمة بما بعدها: «أنت تختار وتختصر وتعيد الصياغة».',
        subskill: 'معنى المفردة في السياق',
      },
      {
        question: 'إلامَ يشير قوله «وفي هذا الاختيار نفسه يجري الفهم»؟',
        correct: 'إلى انتقاء الأفكار واختصارها وإعادة صياغتها.',
        distractors: [
          'إلى الاختيار بين الكتابة باليد والكتابة على الحاسوب.',
          'إلى اختيار المعلّم لموضوع الدرس.',
          'إلى اختيار الطالب لمكان جلوسه في القاعة.',
        ],
        reason: 'اسم الإشارة يعود على العمل الانتقائي الموصوف في الجملة السابقة له.',
        subskill: 'مرجع الضمير',
      },
      {
        question: 'ما وظيفة قوله «وليس المقصود تفضيل أداة على أداة في كل حال»؟',
        correct: 'منع فهم متعجّل قد يُؤخذ مما سبق.',
        distractors: [
          'تقديم دليل إضافي يؤيد ما سبق.',
          'إعلان الانتقال إلى موضوع جديد.',
          'تكرار الفكرة السابقة بلفظها.',
        ],
        reason: 'جاءت العبارة لتصحّح استنتاجًا محتملًا من تفضيل الكتابة باليد.',
        subskill: 'العلاقات بين أجزاء النص',
      },
      {
        question: 'من كتب على الحاسوب ملخصًا بعبارته هو، يكون بحسب النص:',
        correct: 'أفضل ممن ملأ دفتره نقلًا لا يفهمه.',
        distractors: [
          'أسوأ حالًا من كل من كتب بيده.',
          'مساويًا لمن نقل الكلام حرفيًا.',
          'خارجًا عن موضوع التدوين كله.',
        ],
        reason: 'صرّح النص بهذه المفاضلة عند نفيه تفضيل أداة على أداة.',
        subskill: 'الاستنتاج',
      },
      {
        question: 'ما الخطأ الذي نسبه النص إلى كثير من الطلاب في مطلعه؟',
        correct: 'الانشغال بنقل الكلام حرفًا حرفًا حتى تفوتهم الفكرة.',
        distractors: [
          'الاكتفاء بالاستماع دون تدوين شيء.',
          'تدوين الملاحظات بعد انتهاء الدرس بأيام.',
          'الاعتماد على ملاحظات زملائهم.',
        ],
        reason: 'الجملة الأولى من النص تصف هذا الخطأ وتعلّله بظنّهم أن الاكتمال هو المعيار.',
        subskill: 'الأفكار الداعمة',
      },
    ],
  },
  {
    externalKey: 'passage-volunteering',
    title: 'أثر العمل التطوعي',
    keyPrefix: 'reading-volunteer',
    body: 'يُقاس أثر العمل التطوعي بما يتركه من قدرة مستمرة، لا بعدد الساعات التي تُسجَّل فيه. فالمتطوع الذي يوزّع طعامًا في يوم واحد يسدّ حاجة عابرة، أما الذي يعلّم أسرة كيف تدير ميزانيتها فقد ترك أثرًا يعمل بعد انصرافه. ولا يعني هذا أن الإغاثة العاجلة أقل شأنًا؛ فهي في موضعها لا بديل عنها، وإنما يعني أن الخلط بين النوعين يجعل الجهد كله يتّجه إلى ما يظهر أثره سريعًا، فتُترك الحاجات البطيئة بلا عناية. ومن علامات البرامج الناضجة أنها تسأل عن حال المستفيد بعد سنة، لا عن رضاه في اليوم نفسه؛ فالسؤال الأول يقيس التغيّر، والثاني يقيس الانطباع.',
    items: [
      {
        question: 'ما الفكرة الرئيسة للنص؟',
        correct: 'أثر التطوع يُقاس بما يتركه من قدرة مستمرة لا بعدد ساعاته.',
        distractors: [
          'الإغاثة العاجلة لا فائدة منها للمستفيدين.',
          'الأولى قياس التطوع برضا المستفيد في يومه.',
          'العمل التطوعي واجب على كل فرد كل أسبوع.',
        ],
        reason: 'افتتح النص بهذا المعيار وختم به في تفريقه بين سؤال التغيّر وسؤال الانطباع.',
        subskill: 'الفكرة الرئيسة',
      },
      {
        question: 'بمن مثّل النص للأثر المستمر؟',
        correct: 'بمن يعلّم أسرة كيف تدير ميزانيتها.',
        distractors: [
          'بمن يوزّع طعامًا في يوم واحد.',
          'بمن يسجّل أكبر عدد من ساعات التطوع.',
          'بمن يستطلع رضا المستفيدين كل يوم.',
        ],
        reason: 'قابل النص بين توزيع الطعام في يوم وبين تعليم الأسرة إدارة ميزانيتها.',
        subskill: 'الأفكار الداعمة',
      },
      {
        question: 'ما معنى «عابرة» في قوله «حاجة عابرة»؟',
        correct: 'مؤقتة تنقضي بسرعة.',
        distractors: ['شديدة يصعب سدّها.', 'مجهولة لا يعرفها أحد.', 'متكررة كل يوم دون انقطاع.'],
        reason:
          'وصف النص أثر التوزيع اليومي بأنه ينتهي سريعًا، في مقابل الأثر الذي يعمل بعد الانصراف.',
        subskill: 'معنى المفردة في السياق',
      },
      {
        question: 'إلامَ يعود الضمير في قوله «فقد ترك أثرًا يعمل بعد انصرافه»؟',
        correct: 'إلى المتطوع.',
        distractors: ['إلى المستفيد.', 'إلى البرنامج.', 'إلى الطعام.'],
        reason: 'الكلام عن المتطوع الذي يعلّم الأسرة، فالانصراف انصرافه هو.',
        subskill: 'مرجع الضمير',
      },
      {
        question: 'ما وظيفة قوله «ولا يعني هذا أن الإغاثة العاجلة أقل شأنًا»؟',
        correct: 'دفع لازم خاطئ قد يُفهم من التفريق السابق.',
        distractors: [
          'تقديم مثال جديد على الأثر المستمر.',
          'تلخيص النص كله في جملة واحدة.',
          'اعتراض ينقض الفكرة الأولى من أساسها.',
        ],
        reason: 'العبارة تمنع أن يُفهم من تفضيل الأثر المستمر تهوينُ شأن الإغاثة العاجلة.',
        subskill: 'العلاقات بين أجزاء النص',
      },
      {
        question: 'ما الفرق بين السؤالين اللذين ختم بهما النص؟',
        correct: 'الأول يقيس التغيّر بعد مدة، والثاني يقيس الانطباع في حينه.',
        distractors: [
          'الأول يقيس عدد الساعات والثاني يقيس الكلفة.',
          'كلاهما يقيس رضا المستفيد بطريقتين.',
          'الأول موجّه للمتطوعين والثاني للمشرفين.',
        ],
        reason: 'فرّق النص بينهما تفريقًا صريحًا في جملته الأخيرة.',
        subskill: 'الاستنتاج',
      },
      {
        question: 'ما الخطر الذي يترتب على الخلط بين نوعي العمل التطوعي؟',
        correct: 'اتجاه الجهد كله إلى ما يظهر أثره سريعًا وترك الحاجات البطيئة.',
        distractors: [
          'إنفاق المال على غير المستحقين.',
          'قلة عدد المتطوعين في البرامج.',
          'تكرار البرامج في المكان نفسه.',
        ],
        reason: 'ذكر النص هذه النتيجة صراحة عند حديثه عن الخلط بين النوعين.',
        subskill: 'الأفكار الداعمة',
      },
    ],
  },
];

function buildReadingQuestions(passage: ReadingPassage): SeedQuestion[] {
  return passage.items.map((item, index) => ({
    externalKey: `${passage.keyPrefix}-${index + 1}`,
    domain: 'READING_COMPREHENSION' as const,
    subskill: item.subskill,
    difficulty: cycleDifficulty(index),
    stem: text(item.question),
    options: [item.correct, ...item.distractors].map((option) => text(option)),
    correctIndex: 0,
    explanation: text(item.reason),
  }));
}

// ── Assembly ────────────────────────────────────────────────────────────

/** Plain projection of an option, used only to compare two options. */
function plainText(document: RichText): string {
  return document.blocks
    .map((block) =>
      block.children.map((child) => (child.type === 'math' ? child.tex : child.text)).join(''),
    )
    .join(' ')
    .trim();
}

/**
 * Authoring invariants, checked before anything reaches the database.
 *
 * A generator can silently produce two identical options if a case's numbers
 * happen to collide, and a duplicated `externalKey` would make the seed's
 * idempotency check adopt the wrong row. Both are cheap to detect here and
 * expensive to discover in a student's attempt, so the build fails loudly.
 */
function assertBankIntegrity(questions: SeedQuestion[]): void {
  const keys = new Set<string>();

  for (const question of questions) {
    if (keys.has(question.externalKey)) {
      throw new Error(`مفتاح خارجي مكرر في بنك الأسئلة: ${question.externalKey}`);
    }
    keys.add(question.externalKey);

    if (question.options.length < 2) {
      throw new Error(`السؤال ${question.externalKey} لا يحمل خيارات كافية.`);
    }
    if (question.correctIndex < 0 || question.correctIndex >= question.options.length) {
      throw new Error(`السؤال ${question.externalKey} يشير إلى خيار صحيح غير موجود.`);
    }

    const rendered = question.options.map(plainText);
    if (new Set(rendered).size !== rendered.length) {
      throw new Error(`السؤال ${question.externalKey} يحمل خيارين متطابقين.`);
    }
  }
}

export type SeededPassage = {
  externalKey: string;
  title: string;
  body: string;
  questions: SeedQuestion[];
};

export type QuestionBank = {
  /** Questions that stand alone, with no shared stimulus. */
  standalone: SeedQuestion[];
  /** Reading sets, each with the passage its questions hang off. */
  passages: SeededPassage[];
};

/** The whole seeded bank. Deterministic: same input tables, same output rows. */
export function buildQuestionBank(): QuestionBank {
  const standalone = [
    ...buildAnalogyQuestions(),
    ...buildCompletionQuestions(),
    ...buildContextualQuestions(),
    ...buildAuthoredQuantQuestions(),
    ...buildGeneratedQuantQuestions(),
  ];

  const passages: SeededPassage[] = READING_PASSAGES.map((passage) => ({
    externalKey: passage.externalKey,
    title: passage.title,
    body: passage.body,
    questions: buildReadingQuestions(passage),
  }));

  assertBankIntegrity([...standalone, ...passages.flatMap((passage) => passage.questions)]);

  return { standalone, passages };
}
