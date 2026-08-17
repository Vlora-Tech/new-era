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

// ── Quantitative ────────────────────────────────────────────────────────

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

function buildQuantQuestions(): SeedQuestion[] {
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

// ── Reading comprehension ───────────────────────────────────────────────

export const READING_PASSAGE = {
  externalKey: 'passage-reading-habits',
  title: 'القراءة والعادة اليومية',
  body: 'تتكوّن عادة القراءة كما تتكوّن أي عادة أخرى: بالتكرار القصير المنتظم، لا بالجهد الكبير المتقطّع. من يقرأ عشر صفحات كل يوم يقطع في السنة مسافة لا يبلغها من يقرأ مئة صفحة في يوم واحد ثم ينقطع شهرًا. والسبب أن الانتظام يبني ألفة بين القارئ والنص، فتقلّ المقاومة التي يشعر بها عند البدء. أما الاندفاع المتقطّع فيُنهك صاحبه، ويجعل القراءة عبئًا يُؤجَّل لا متعة تُنتظر. ولهذا ينصح المختصون بالبدء بمقدار صغير يسهل الالتزام به، ثم زيادته تدريجيًا حين يصبح تركه أصعب من فعله.',
};

const READING_ITEMS: Array<{
  question: string;
  correct: string;
  distractors: string[];
  reason: string;
  subskill: string;
}> = [
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
];

export function buildReadingQuestions(): SeedQuestion[] {
  return READING_ITEMS.map((item, index) => ({
    externalKey: `reading-${index + 1}`,
    domain: 'READING_COMPREHENSION' as const,
    subskill: item.subskill,
    difficulty: cycleDifficulty(index),
    stem: text(item.question),
    options: [item.correct, ...item.distractors].map((option) => text(option)),
    correctIndex: 0,
    explanation: text(item.reason),
  }));
}

/** Every question except the reading set, which needs its shared passage. */
export function buildStandaloneQuestions(): SeedQuestion[] {
  return [
    ...buildAnalogyQuestions(),
    ...buildCompletionQuestions(),
    ...buildContextualQuestions(),
    ...buildQuantQuestions(),
  ];
}
