/**
 * Landing page copy.
 *
 * One screen, one module — the same rule the `admin*` blocks follow, and for the
 * same reason: this is the largest single body of Arabic on the public site and
 * it should not be a 400-line region inside `copy.ts` that two edits collide in.
 * Composed into `COPY.landing` by `src/lib/copy.ts`.
 *
 * ── Why this is `landing` and not a rewrite of `home` ──────────────────────
 *
 * `COPY.home` outlived the page it was written for. Four other surfaces read it
 * — the catalogue pages take `coursesBody`/`simulatorsBody` as their own
 * descriptions, the root layout takes `supporting` as the site's meta
 * description, and the dashboard's next-steps rail takes `pathSteps` so the
 * signed-in advice cannot drift from the marketing promise. Replacing it in
 * place would have silently changed all four. A new namespace changes none.
 *
 * ── The mock namespace ─────────────────────────────────────────────────────
 *
 * `mock` holds the strings that live inside the page's drawings of the product
 * — a dashboard greeting, a lesson title, a section clock. They are still
 * user-facing Arabic and the copy doctrine still covers them, but they are
 * SPECIMEN text, not statements: every figure among them describes an imagined
 * student, and each drawing is `aria-hidden` and carries a visible specimen
 * label. Keeping them under one key is what makes that reviewable — a claim
 * that wandered into `mock` is obvious, and a specimen that wandered out of it
 * is too.
 *
 * Latin digits are used deliberately inside `mock`, against the site's `ar-SA`
 * Arabic-Indic convention: these are drawn interface chrome carried over from
 * the approved design, not values formatted by `src/lib/format.ts`. Anything the
 * platform actually computes still goes through the formatters.
 *
 * ── What is still never claimed ────────────────────────────────────────────
 *
 * No student count, pass rate, rating, testimonial, countdown or discount
 * appears anywhere in this file. The only percentages are specimen values inside
 * `mock`, and the training-indicator disclaimer travels with them.
 */
export const LANDING_COPY = {
  /* ── §1 Hero ──────────────────────────────────────────────────────────── */
  hero: {
    badge: 'منصة تدريب متخصصة في اختبار القدرات',
    /*
     * The heading is split so the second half can carry the gradient clip. It
     * must stay two adjacent inline runs with a real space between them, or a
     * screen reader announces the two halves as one joined word.
     */
    headingLead: 'استعدادك للقدرات',
    headingAccent: 'يبدأ من هنا',
    lead: 'تأسيس منظّم، وتدريبات عملية، ومحاكيات تتيح لك التدرّب في ظروف قريبة من تجربة الاختبار، مع متابعة تقدّمك خطوة بخطوة.',
    ctaPrimary: 'ابدأ استعدادك',
    ctaSecondary: 'استكشف المحاكيات',
    finePrint: 'شراء مرة واحدة • وصول دائم',
  },

  /* ── §2 Features ──────────────────────────────────────────────────────── */
  features: {
    eyebrow: 'المميزات',
    title: 'كل ما تحتاجه للاستعداد في مكان واحد',
    lead: 'من التأسيس إلى التدريب والمحاكاة: أدوات تساعدك على بناء مستواك، ومعرفة الجوانب التي تحتاج مزيدًا من التركيز.',
    cards: {
      courses: {
        title: 'دورات منظمة',
        body: 'دروس مرتّبة تبدأ من الأساس وتتقدّم بك خطوة بخطوة.',
      },
      simulation: {
        title: 'محاكاة واقعية',
        body: 'اختبارات مقسّمة ومؤقّتة للتدرّب في ظروف قريبة من تجربة الاختبار.',
      },
      progress: {
        title: 'تابع تقدمك',
        body: 'تابع دروسك المكتملة ونتائج محاولاتك السابقة في مكان واحد.',
      },
      quizzes: {
        title: 'اختبارات بعد الدروس',
        body: 'طبّق مباشرة على المهارات التي تعلمتها.',
      },
      access: {
        title: 'وصول دائم',
        body: 'اشترِ المنتج مرة واحدة، وعُد إليه في أي وقت.',
      },
    },
  },

  /* ── §3 Method band ───────────────────────────────────────────────────── */
  method: {
    eyebrow: 'طريقة أذكى للاستعداد',
    title: 'تعلّم، طبّق، ثم اختبر مستواك',
    lead: 'رحلة تدريب واضحة تنقلك من فهم المهارة إلى تطبيقها تحت ضغط الوقت.',
    steps: [
      { title: 'ابدأ بالتأسيس', body: 'رتّب تعلّمك عبر وحدات ودروس واضحة.' },
      { title: 'طبّق مباشرة', body: 'اختبارات قصيرة بعد كل درس للتأكد من إتقان المهارة.' },
      { title: 'اختبر نفسك تحت ضغط الوقت', body: 'انتقل إلى المحاكيات عندما تكون جاهزًا.' },
    ],
  },

  /* ── §4 Courses ───────────────────────────────────────────────────────── */
  courses: {
    eyebrow: 'الدورات التدريبية',
    title: 'ابنِ أساسًا قويًا قبل الانتقال إلى المحاكاة',
    lead: 'دروس فيديو منظّمة داخل وحدات، مع تدريبات قصيرة بعد كل درس لبناء المهارة بالتدريج.',
    bullets: [
      'وحدات مرتّبة من الأساس إلى المسائل المركّبة',
      'تمرين بعد كل درس للتأكد من الفهم',
      'تقدّمك محفوظ لتكمل من حيث توقفت',
    ],
    cta: 'استعرض الدورات',
  },

  /* ── §5 Simulators ────────────────────────────────────────────────────── */
  simulators: {
    eyebrow: 'محاكيات القدرات',
    title: 'تدرّب على اتخاذ القرار تحت ضغط الوقت',
    lead: 'اختبارات مقسّمة ومؤقّتة بواجهة هادئة، مع حفظ تلقائي للإجابات، ومؤشرات تدريبية بعد كل محاولة.',
    meta: [
      { label: 'مدة القسم', value: '25 دقيقة' },
      { label: 'عدد الأسئلة', value: '24 سؤالًا' },
    ],
    cta: 'استعرض المحاكيات',
  },

  /* ── §6 Why ───────────────────────────────────────────────────────────── */
  why: {
    eyebrow: 'لماذا المنصة؟',
    title: 'مصمّمة ليكون تدريبك أوضح',
    lead: 'كل جزء في تجربة التعلّم مصمّم ليجعل تدريبك منظّمًا وتقدّمك واضحًا دون تعقيد.',
    feature: {
      title: 'تقدّمك واضح خطوة بخطوة',
      body: 'لوحة واحدة تجمع دروسك ومحاولاتك ومؤشرات أدائك، لتعرف من نظرة واحدة أين وصلت وأين تحتاج تدريبًا أكثر.',
      cta: 'ابدأ استعدادك',
    },
    cards: [
      {
        title: 'محتوى أصلي وموثق الحقوق',
        body: 'لا نعتمد على تسريبات أو تجميعات من الاختبارات الرسمية.',
      },
      { title: 'تجربة عربية بالكامل', body: 'واجهة عربية مصمّمة من البداية للطالب السعودي.' },
      { title: 'تقدم محفوظ', body: 'عُد وأكمل تدريبك من حيث توقفت.' },
      {
        title: 'نتائج تدريبية واضحة',
        body: 'شاهد مؤشرات أدائك واعرف الجوانب التي تحتاج تدريبًا إضافيًا.',
      },
    ],
  },

  /* ── §7 Demo ──────────────────────────────────────────────────────────── */
  demo: {
    eyebrow: 'تجربة المحاكي',
    title: 'استعرض تجربة المحاكي قبل أن تبدأ',
    lead: 'واجهة هادئة وواضحة تُبقي تركيزك على السؤال والوقت دون تشتيت.',
    playLabel: 'اعرض واجهة المحاكي',
  },

  /* ── §8 Products ──────────────────────────────────────────────────────── */
  products: {
    eyebrow: 'ابدأ بطريقتك',
    title: 'اختر ما يناسب مرحلة استعدادك',
    lead: 'كل منتج يُشترى مرة واحدة ويمنحك وصولًا دائمًا إليه.',
    includesTitle: 'ما يتضمنه المنتج',
    purchaseBadge: 'شراء مرة واحدة',
    courses: {
      title: 'الدورات التدريبية',
      body: 'تأسيس منظّم للقسمين الكمي واللفظي عبر وحدات متدرّجة.',
      note: 'وصول دائم للمنتج بعد الشراء',
      cta: 'استعرض الدورات',
      includes: [
        'دروس فيديو منظّمة',
        'وحدات تدريبية',
        'اختبارات قصيرة',
        'متابعة التقدم',
        'وصول دائم',
      ],
    },
    simulators: {
      title: 'محاكيات القدرات',
      badge: 'للتدريب العملي',
      body: 'تجربة اختبار مؤقّتة ومقسّمة، مع مؤشرات أداء بعد كل محاولة.',
      note: 'بدون اشتراك شهري',
      cta: 'استعرض المحاكيات',
      includes: [
        'تجربة اختبار مؤقتة',
        'أقسام منظّمة',
        'حفظ تلقائي للإجابات',
        'نتائج ومؤشرات تدريبية',
        'سجل المحاولات',
        'وصول دائم',
      ],
    },
    once: {
      title: 'شراء مرة واحدة',
      body: 'لا اشتراكات شهرية. المنتج الذي تشتريه يبقى متاحًا لك، وتعود إلى تدريبك في أي وقت.',
      rows: ['وصول دائم لمنتجاتك', 'سجل تدريبك محفوظ', 'يعمل على الجوال والحاسب'],
    },
  },

  /* ── §9 Journey ───────────────────────────────────────────────────────── */
  journey: {
    eyebrow: 'كيف تعمل المنصة؟',
    title: 'رحلة استعدادك في أربع خطوات',
    lead: 'من أول درس إلى مراجعة مؤشراتك بعد أول محاكاة.',
    steps: [
      { title: 'ابدأ بالتأسيس', body: 'تعلم المهارات الأساسية من خلال الدورات.' },
      { title: 'طبّق على كل مهارة', body: 'اختبر فهمك بعد الدروس.' },
      { title: 'انتقل إلى المحاكاة', body: 'اختبر نفسك في تجربة مؤقّتة ومقسّمة.' },
      { title: 'راجع مؤشراتك', body: 'اعرف أين تحتاج إلى مزيد من التدريب.' },
    ],
  },

  /* ── §10 Rights ───────────────────────────────────────────────────────── */
  rights: {
    title: 'تدريب يعتمد على محتوى أصلي',
    body: 'المحتوى التدريبي داخل المنصة أصلي أو مستخدم بحقوق موثّقة، ولا تعتمد المنصة على الأسئلة المسرّبة أو تجميعات الاختبارات الرسمية.',
    statusLabel: 'حالة الحقوق',
    statusValue: 'موثقة',
    sourceLabel: 'مصدر السؤال',
    sourceValue: 'تأليف خاص بالمنصة',
  },

  /* ── §11 FAQ ──────────────────────────────────────────────────────────── */
  faq: {
    eyebrow: 'الأسئلة الشائعة',
    title: 'أسئلة يتكرر طرحها',
    items: [
      {
        question: 'هل المنصة تابعة لجهة الاختبار الرسمية؟',
        answer: 'لا. المنصة تدريبية مستقلة، وهدفها مساعدة الطلاب على الاستعداد والتدرّب.',
      },
      {
        question: 'هل النتيجة في المحاكي تعتبر درجتي في اختبار القدرات؟',
        answer: 'لا. جميع النتائج ومؤشرات الأداء داخل المنصة تدريبية فقط.',
      },
      {
        question: 'هل أحتاج اشتراكًا شهريًا؟',
        answer: 'لا. كل منتج يُشترى بشكل منفصل، ويمنحك شراؤه وصولًا دائمًا إليه.',
      },
      {
        question: 'ما الفرق بين الدورة والمحاكي؟',
        answer:
          'الدورة تبني المهارة وتدرّبك عليها، والمحاكي يقيس مستواك في تجربة مؤقّتة ومقسّمة تشبه ظروف الاختبار.',
      },
      {
        question: 'هل يمكنني الرجوع إلى الدروس بعد إنهائها؟',
        answer: 'نعم. المنتج الذي اشتريته يبقى متاحًا لك بشكل دائم.',
      },
    ],
  },

  /* ── §12 Closing band ─────────────────────────────────────────────────── */
  closing: {
    title: 'جاهز لبدء استعدادك؟',
    lead: 'ابدأ اليوم بخطوة واحدة، وتابع تقدّمك من أول درس إلى آخر محاكاة.',
    ctaPrimary: 'ابدأ الآن',
    ctaSecondary: 'استكشف الدورات والمحاكيات',
  },

  /* ── Footer ───────────────────────────────────────────────────────────── */
  footer: {
    description:
      'منصة تدريب عربية تساعد طلاب وطالبات المرحلة الثانوية في المملكة على الاستعداد لاختبار القدرات العامة.',
    platformGroup: 'المنصة',
    helpGroup: 'المساعدة',
    policiesGroup: 'السياسات',
    /*
     * The short form of the independence statement, for the footer's info strip.
     * It does NOT replace INDEPENDENCE_DISCLAIMER, which still renders in full
     * directly below it — that wording is fixed and is not a layout variable.
     */
    disclaimerStrip:
      'المنصة تدريبية مستقلة، وجميع نتائج المحاكاة مؤشرات تدريبية وليست درجات رسمية.',
    madeIn: 'صُنعت في المملكة العربية السعودية',
    contactAction: 'راسلنا',
  },

  /* ── Specimen text inside the drawings ────────────────────────────────── */
  mock: {
    specimenNote: 'رسم توضيحي للواجهة',

    // In-product chrome
    searchPlaceholder: 'ابحث في الدروس والمحاكيات',
    greeting: 'مرحبًا عبدالله',
    greetingBody: 'جاهز لجلسة تدريب اليوم؟ بقي لك درسان في وحدة النسب.',
    startTraining: 'ابدأ التدريب',
    avatarInitials: 'ع.م',

    // Dashboard stat tiles
    courseProgress: 'تقدمك في الدورة',
    courseProgressValue: '68%',
    lastAttempt: 'آخر محاكاة',
    lastAttemptValue: '74%',
    answered: 'الأسئلة التي أجبت عنها',
    answeredValue: '1,240',
    lessonsDone: 'الدروس المكتملة',
    lessonsDoneValue: '38',

    // Charts
    progressTitle: 'تقدمك',
    verbal: 'لفظي',
    quantitative: 'كمي',
    weeks: ['الأسبوع 1', 'الأسبوع 2', 'الأسبوع 3', 'الأسبوع 4', 'الأسبوع 5'],
    simulatorPerformance: 'الأداء في المحاكيات',
    lastFourAttempts: 'آخر 4 محاولات',
    attemptIndicator: 'مؤشر تدريبي',
    attemptIndicatorLabel: 'مؤشر المحاولة',
    indicatorNote: 'المؤشرات تدريبية وليست درجة رسمية.',
    verbalValue: '72%',
    quantitativeValue: '64%',
    ringValue: '74%',

    // Continue-lesson row
    resumeLabel: 'أكمل من حيث توقفت',
    resumeTitle: 'دورة تأسيس القدرات — القسم الكمي · وحدة النسب',
    resumePosition: 'الدرس 4 من 12',
    resumeAction: 'أكمل الدرس',

    // Hero float chips
    lastAttemptDone: 'آخر محاولة مكتملة',
    progressSaved: 'تم حفظ تقدمك',

    // Feature-card mockups
    unitLabel: 'وحدة 2 · النسب والتناسب',
    unitPosition: '4 / 12',
    lessonRatioConcept: 'مفهوم النسبة',
    lessonRatioProblems: 'حل مسائل النسب',
    lessonRatioClock: '08:24',
    lessonUnitExercise: 'تمرين الوحدة',
    quantSection: 'القسم الكمي',
    verbalSection: 'القسم اللفظي',
    sectionClock: '12:42',
    questionFifteen: 'السؤال 15 من 24',
    questionEighteen: 'السؤال 18 من 24',
    performanceIndicator: 'مؤشر الأداء',
    weekly: 'أسبوعي',
    lessonsThisWeek: 'دروس مكتملة هذا الأسبوع',
    quickDrill: 'تمرين سريع · وحدة النسب',
    quickDrillStem: 'إذا كانت نسبة الأولاد إلى البنات 3 : 5، وعدد البنات 20، فكم عدد الأولاد؟',
    answerSaved: 'تم حفظ الإجابة',
    answerSavedAuto: 'تم حفظ الإجابة تلقائيًا',
    next: 'التالي',
    previous: 'السابق',
    entitlementCourse: 'دورة تأسيس القدرات',
    entitlementCourseNote: 'مُفعّلة · وصول دائم',
    entitlementSimulator: 'محاكي القدرات — 4 نماذج',
    entitlementSimulatorNote: 'شراء مرة واحدة · بدون اشتراك',
    entitlementActive: 'مُفعّل',
    historyNote: 'سجل محاولاتك محفوظ ويبقى متاحًا لك',

    // Method-band float chips
    quantImprovement: 'تحسّن الكمي',
    quantImprovementValue: '+12%',
    attemptsDone: 'محاولات مكتملة',
    attemptsDoneValue: '3',

    // Course-player mockup
    coursePlayerTitle: 'دورة تأسيس القدرات — القسم الكمي',
    modulesLabel: 'الوحدات',
    modules: ['1. أساسيات النسب', '2. الكسور', '3. المتوسطات', '4. المسائل اللفظية'],
    lessonClock: '04:12',
    lessonTitle: 'حساب المتوسط الحسابي في المسائل المركبة',
    lessonExercise: 'تمرين الدرس',

    // The specimen questions — one for #sims, one for #demo
    verbalPrompt: 'اختر الكلمة التي تكمل المعنى',
    verbalStem: 'القراءة المستمرة ...... حصيلة الطالب اللغوية.',
    verbalOptions: ['تُقلّل', 'تُنمّي', 'تُؤخّر', 'تُوقف'],
    demoPrompt: 'اقرأ السؤال ثم اختر الإجابة الأنسب',
    demoStem: 'أكمل الجملة: التخطيط الجيد للوقت ...... من فرص إتمام جميع أسئلة القسم.',
    demoOptions: ['يُقلّل', 'يزيد', 'لا يؤثر في', 'يُلغي'],
    optionLetters: ['أ', 'ب', 'ج', 'د'],
    demoWindowTitle: 'محاكي القدرات — القسم اللفظي',
    questionMap: 'خريطة الأسئلة',
    answeredLegend: 'تمت الإجابة',
    noReturnNote: 'لا يمكن الرجوع بعد إنهاء القسم',
    timeRemaining: 'الوقت المتبقي 12:42',

    // Journey step mockups
    journeyUnit: 'الوحدة 1 · التأسيس',
    journeyStartLesson: 'ابدأ الدرس الأول',
    journeyDrill: 'تمرين بعد الدرس',
    journeyOptions: ['الخيار الأول', 'الخيار الثاني', 'الخيار الثالث'],
    journeyClock: '18:05',
    journeyRingValue: '72%',
  },
} as const;
