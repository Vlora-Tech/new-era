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
    /*
     * The heading is split so the second half can carry the gradient clip. It
     * must stay two adjacent inline runs with a real space between them, or a
     * screen reader announces the two halves as one joined word.
     */
    headingLead: 'استعدادك للقدرات',
    headingAccent: 'يبدأ من عندنا',
    lead: 'تأسيس منظّم، وتدريبات عملية، ومحاكيات تتيح لك التدرّب في ظروف قريبة من تجربة الاختبار، مع متابعة تقدّمك خطوة بخطوة.',
    /*
     * One action, and that is the design. The canvas removed the badge pill,
     * the secondary button and the fine print that used to sit under them: the
     * hero now asks for exactly one thing, and everything else on the page is
     * reachable from the bar above it.
     */
    ctaPrimary: 'ابدأ الآن',
  },

  /* ── §2 Features ──────────────────────────────────────────────────────── */
  features: {
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
      /*
       * The canvas replaced «وصول دائم» here with the attempt report. The
       * permanent-access promise did not disappear from the site — it is still
       * the answer to the third FAQ, and still on every catalogue page, where a
       * buyer is actually deciding.
       */
      report: {
        title: 'تقرير أداء بعد كل محاولة',
        body: 'تفصيل لنتيجتك مهارة بمهارة، مع الوقت الذي استغرقته في كل قسم.',
      },
    },
  },

  /* ── §3 Benefits band ─────────────────────────────────────────────────── */
  benefits: {
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
    title: 'تدرّب في ظروف الاختبار الحقيقية',
    lead: 'اختبارات مقسّمة ومؤقّتة بواجهة هادئة، مع حفظ تلقائي للإجابات، ومؤشرات تدريبية بعد كل محاولة.',
    meta: [
      { label: 'مدة القسم', value: '25 دقيقة' },
      { label: 'عدد الأسئلة', value: '24 سؤالًا' },
    ],
    cta: 'استعرض المحاكيات',
  },

  /* ── §6 Demo ──────────────────────────────────────────────────────────── */
  demo: {
    title: 'محاكي الاختبارات',
    lead: 'واجهة هادئة وواضحة تُبقي تركيزك على السؤال والوقت دون تشتيت.',
    playLabel: 'اعرض واجهة المحاكي',
  },

  /* ── §7 Products ──────────────────────────────────────────────────────────
   *
   * The course band, and it is the ONE band on this page that reads from the
   * database. The canvas draws six invented cards with their own titles, bodies
   * and unit counts; they were built that way first and then removed, so the
   * homepage and `/courses` cannot disagree about what exists.
   *
   * What is left here is the frame only — the eyebrow, the head, the lead and
   * the link label. Every title, description, level chip, count and cover comes
   * from Prisma in `landing/sections/products.tsx`, which is also where the
   * empty and failed cases are handled.
   */
  products: {
    eyebrow: 'الدورات',
    title: 'دوراتنا التدريبية',
    lead: 'مسارات منفصلة يمكنك البدء بأيٍّ منها حسب مرحلة استعدادك.',
    cta: 'تفاصيل الدورة',
  },

  /* ── §8 Journey ───────────────────────────────────────────────────────── */
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

  /* ── §9 FAQ ───────────────────────────────────────────────────────────── */
  faq: {
    title: 'الأسئلة الشائعة',
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

  /* ── §10 Closing band ─────────────────────────────────────────────────── */
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
    verbalLevel: 'مستواك في القسم اللفظي',
    verbalLevelValue: '72% إجابات صحيحة',
    quantLevel: 'مستواك في القسم الكمي',
    quantLevelValue: '64% إجابات صحيحة',
    simulatorFinished: 'أنهيت محاكي القدرات كامل',
    progressSaved: 'تقدمك محفوظ تلقائيًا',

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
    lessonsThisWeekValue: '6',
    drillUnit: 'وحدة النسب',
    drillClock: '00:42',
    drillPosition: '4 / 12',
    quickDrillStem: 'إذا كانت نسبة الأولاد إلى البنات 3 : 5، وعدد البنات 20، فكم عدد الأولاد؟',
    drillOptions: ['10', '12', '15', '18'],
    answerSaved: 'تم حفظ الإجابة',
    answerSavedAuto: 'تم حفظ الإجابة تلقائيًا',
    nextQuestion: 'السؤال التالي',
    next: 'التالي',
    previous: 'السابق',

    // The attempt report drawn in the fifth feature card
    attemptReport: 'تقرير المحاولة',
    attemptReportMeta: '30 سؤالًا · 22 صحيحة',
    attemptReportValue: '73%',
    attemptReportTitle: 'نتيجة المحاولة الأخيرة',
    attemptReportDelta: 'أعلى من محاولتك السابقة بـ 6%',
    attemptReportSkills: [
      { label: 'النسب والتناسب', meta: '12 سؤالًا · 9 صحيحة', value: '75%', percent: 75 },
      { label: 'التناظر اللفظي', meta: '10 أسئلة · 6 صحيحة', value: '60%', percent: 60 },
      { label: 'استيعاب المقروء', meta: '8 أسئلة · 5 صحيحة', value: '63%', percent: 63 },
    ],
    attemptReportPace: 'متوسط وقت السؤال 48 ثانية',
    attemptReportAction: 'مراجعة الأخطاء',

    // The weekly panel in §benefits
    weekTitle: 'تقدّمك هذا الأسبوع',
    weekMeta: '6 جلسات تدريب · درسان مكتملان',
    weekRange: 'آخر 7 أيام',
    dailyMinutes: 'دقائق التدريب اليومية',
    dailyMinutesValue: '4 س 48 د',
    days: [
      { label: 'السبت', percent: 42 },
      { label: 'الأحد', percent: 68 },
      { label: 'الاثنين', percent: 55 },
      { label: 'الثلاثاء', percent: 88 },
      { label: 'الأربعاء', percent: 34 },
      { label: 'الخميس', percent: 72 },
      { label: 'الجمعة', percent: 20 },
    ],
    masteryTitle: 'نسبة الإتقان حسب المهارة',
    mastery: [
      { label: 'النسب والتناسب', value: '78%', percent: 78 },
      { label: 'التناظر اللفظي', value: '62%', percent: 62 },
      { label: 'استيعاب المقروء', value: '54%', percent: 54 },
    ],
    recentTitle: 'آخر المحاولات',
    recent: [
      { title: 'محاكي القدرات — نموذج 3', meta: 'أمس · 120 دقيقة', value: '74%' },
      { title: 'تمرين وحدة النسب', meta: 'قبل 3 أيام · 12 سؤالًا', value: '9 / 12' },
    ],

    // Course-player mockup
    coursePlayerTitle: 'دورة تأسيس القدرات — القسم الكمي',
    modulesLabel: 'الوحدات',
    modules: ['1. أساسيات النسب', '2. الكسور', '3. المتوسطات', '4. المسائل اللفظية'],
    lessonClock: '04:12',
    lessonTitle: 'حساب المتوسط الحسابي في المسائل المركبة',
    lessonExercise: 'تمرين الدرس',
    lessonProgressValue: '34%',

    // The specimen questions — one for §sims, one for §demo
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
    answeredCount: '17',
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
