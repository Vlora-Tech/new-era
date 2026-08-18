/**
 * Exam attempts: the list, one attempt's record, and its per-section and
 * per-question detail.
 *
 * Composed into `COPY.adminAttempts` by `src/lib/copy.ts`.
 *
 * This screen is read-only and the copy commits to that. There is no control
 * that extends a clock, corrects an answer, re-marks a question or reopens a
 * locked section, and the notices say so instead of leaving an administrator
 * looking for one. The reason is not caution: an attempt is evidence of what a
 * student was shown and what they did, and an editable attempt is not evidence.
 *
 * The second rule is the one that governs every number rendered here. The
 * platform reports what an attempt contained — how many were right, how long each
 * section took — and never a score, a band, a percentile or a prediction. That is
 * the same legal position `COPY.exam.notAnOfficialScore` states to the student,
 * restated here so an administrator does not repeat something stronger to a
 * parent on the phone.
 */
export const ADMIN_ATTEMPTS_COPY = {
  listTitle: 'المحاولات والنتائج',
  listDescription: 'محاولات الاختبار ونتائجها التدريبية، للمتابعة والتشخيص.',

  detailTitle: 'تفاصيل المحاولة',
  detailDescription: 'ما وُلِّد لهذه المحاولة، وما فعله الطالب فيها، وكيف انتهت.',
  backToList: 'العودة إلى المحاولات',

  columns: {
    student: 'الطالب',
    email: 'البريد الإلكتروني',
    simulator: 'المحاكي',
    examVersion: 'الإصدار',
    mode: 'النمط',
    status: 'الحالة',
    isDryRun: 'تجربة إدارية',
    startedAt: 'تاريخ البدء',
    submittedAt: 'تاريخ التسليم',
    duration: 'الزمن المستغرق',
    totalQuestions: 'عدد الأسئلة',
    correctCount: 'إجابات صحيحة',
    incorrectCount: 'إجابات خاطئة',
    unansweredCount: 'بلا إجابة',
    accuracy: 'نسبة الإجابات الصحيحة',
    actions: 'إجراءات المحاولة',
  },

  filters: {
    mode: 'نمط المحاولة',
    status: 'الحالة',
    simulator: 'المحاكي',
    examVersion: 'الإصدار',
    isDryRun: 'التجارب الإدارية',
    includeDryRuns: 'تضمين التجارب الإدارية',
    /*
     * The three answers the `isDryRun` control offers, as one select rather than
     * a checkbox beside a filter that could contradict it.
     *
     * `exclude` is the default because a rehearsal is a manager checking a
     * version, not a student sitting an exam: counting it among the attempts
     * makes every number on the screen answer a slightly different question from
     * the one it appears to answer. `include` restates `includeDryRuns` above so
     * the group reads as one control.
     */
    dryRunOptions: {
      exclude: 'استبعاد التجارب الإدارية',
      include: 'تضمين التجارب الإدارية',
      only: 'التجارب الإدارية فقط',
    },
    from: 'من تاريخ',
    to: 'حتى تاريخ',
    searchPlaceholder: 'ابحث ببريد الطالب أو اسمه أو اسم المحاكي…',
  },

  /** Headings for the record view. */
  sections: {
    summary: 'ملخّص المحاولة',
    generation: 'كيف وُلِّدت هذه المحاولة',
    results: 'النتيجة التدريبية',
    domains: 'الأداء حسب المهارة',
    attemptSections: 'أقسام المحاولة',
    questions: 'أسئلة المحاولة وإجاباتها',
  },

  fields: {
    id: { label: 'معرّف المحاولة', hint: '' },
    student: { label: 'الطالب', hint: 'صاحب المحاولة.' },
    simulator: { label: 'المحاكي', hint: '' },
    examVersion: {
      label: 'إصدار الاختبار',
      hint: 'الإصدار الذي وُلِّدت منه هذه المحاولة. اعتماد إصدار آخر لاحقًا لا ينقل محاولة قائمة إليه.',
    },
    mode: { label: 'نمط المحاولة', hint: '' },
    status: { label: 'الحالة', hint: 'تُشتق من التسليم ومن انتهاء الوقت، لا تُضبط يدويًا.' },
    seed: {
      label: 'بذرة الاختيار',
      hint: 'رقم يُحفظ لإعادة إنتاج الاختيار والخلط نفسيهما عند التشخيص.',
    },
    isDryRun: {
      label: 'تجربة إدارية',
      hint: 'محاولة تجريبية نفّذها مدير لفحص إصدار. مستبعدة من تحليلات الطلاب.',
    },
    settingsSnapshot: {
      label: 'نسخة الإعدادات',
      hint: 'القواعد والتوقيت كما جُمِّدت لحظة إنشاء المحاولة. تعديل الإصدار بعدها لا يغيّرها.',
    },
    trainingConfig: {
      label: 'إعداد وضع التدريب',
      hint: 'ما اختاره الطالب من مهارة وصعوبة. فارغ في المحاكاة الكاملة.',
    },
    startedAt: { label: 'تاريخ البدء', hint: 'لحظة بدء العدّ الفعلي.' },
    maxEndAt: {
      label: 'أقصى وقت لانتهائها',
      hint: 'آخر لحظة يمكن أن تبقى فيها المحاولة مفتوحة. بعدها تُعدّ منتهية الوقت.',
    },
    submittedAt: { label: 'تاريخ التسليم', hint: '' },
    totalQuestions: { label: 'عدد الأسئلة', hint: '' },
    correctCount: { label: 'إجابات صحيحة', hint: 'تُحسب عند التسليم، لا قبله.' },
    incorrectCount: { label: 'إجابات خاطئة', hint: '' },
    unansweredCount: { label: 'أسئلة بلا إجابة', hint: '' },
  },

  /** `AttemptMode`. Restated from `COPY.statusLabels.attemptMode`; see below. */
  modeLabels: {
    FULL_SIMULATION: 'محاكاة كاملة',
    TRAINING: 'وضع التدريب',
  },

  /**
   * `AttemptStatus`.
   *
   * Identical to `COPY.statusLabels.attemptStatus`, which the student dashboard
   * uses, and restated rather than imported because `copy.ts` composes this
   * module and importing `COPY` back would close a cycle. If one side is
   * reworded, reword both — a support call goes wrong when the student and the
   * administrator are reading two different words for one row.
   */
  statusLabels: {
    CREATED: 'لم تبدأ',
    IN_PROGRESS: 'قيد التنفيذ',
    SUBMITTED: 'مُسلَّمة',
    EXPIRED: 'انتهى وقتها',
    ABANDONED: 'متروكة',
  },

  /** `AttemptSectionStatus`. */
  sectionStatusLabels: {
    PENDING: 'لم يبدأ بعد',
    IN_PROGRESS: 'جارٍ',
    LOCKED: 'مغلق',
  },

  /**
   * `AttemptSectionLockReason`.
   *
   * The three are kept apart because they answer a support question the status
   * alone cannot: a student who says "أُغلق القسم فجأة" is describing `EXPIRED`,
   * while `ADVANCED` means they pressed the button themselves.
   */
  lockReasonLabels: {
    ADVANCED: 'أنهاه الطالب وانتقل',
    EXPIRED: 'انتهى وقته',
    FINALIZED: 'أُغلق بتسليم المحاولة',
  },

  /** Per-section table inside the record view. */
  attemptSections: {
    title: 'أقسام المحاولة',
    description: 'كل قسم كما جرى فعلًا: وقته المتاح، ومتى بدأ، ومتى أُغلق ولماذا.',
    columns: {
      position: 'الترتيب',
      title: 'القسم',
      status: 'الحالة',
      allowed: 'الوقت المتاح',
      elapsed: 'الوقت المستغرق',
      startedAt: 'وقت البدء',
      deadlineAt: 'الموعد النهائي',
      lockedAt: 'وقت الإغلاق',
      lockedReason: 'سبب الإغلاق',
      questionCount: 'عدد الأسئلة',
      answeredCount: 'المُجاب عنها',
    },
    deadlineNote: 'المواعيد محسوبة على الخادم. ساعة المتصفح للعرض فقط ولا يُعتد بها.',
    empty: {
      nothingYetTitle: 'لا توجد أقسام مسجّلة',
      nothingYetBody: 'لم تُولَّد أقسام لهذه المحاولة، وهو ما يحدث حين تفشل عملية التوليد.',
    },
  },

  /** Per-question table inside the record view. */
  questions: {
    title: 'أسئلة المحاولة وإجاباتها',
    description: 'النص المعروض هنا هو النسخة التي رآها الطالب فعلًا، لا نص السؤال في البنك اليوم.',
    columns: {
      position: 'الترتيب',
      stem: 'نص السؤال',
      domain: 'المهارة',
      subskill: 'المهارة الفرعية',
      difficulty: 'الصعوبة',
      questionVersion: 'نسخة السؤال',
      studentAnswer: 'إجابة الطالب',
      correctAnswer: 'الإجابة الصحيحة',
      isCorrect: 'النتيجة',
      flagged: 'معلّم للمراجعة',
      timeSpent: 'الزمن المستغرق',
      revealedAt: 'وقت كشف الإجابة',
    },
    noAnswer: 'لم يُجب',
    correct: 'صحيحة',
    incorrect: 'خاطئة',
    notGraded: 'لم تُصحَّح بعد',
    flaggedYes: 'معلّم',
    flaggedNo: '—',
    openInBank: 'فتح السؤال في البنك',
    empty: {
      nothingYetTitle: 'لا توجد أسئلة مسجّلة',
      nothingYetBody: 'لم تُولَّد أسئلة لهذه المحاولة.',
    },
  },

  /** Aggregates, all described as counts of this attempt and nothing more. */
  results: {
    title: 'النتيجة التدريبية',
    pendingTitle: 'لم تُسلَّم هذه المحاولة بعد',
    pendingBody: 'تُحسب الأرقام عند التسليم أو عند انتهاء الوقت، ولا توجد نتيجة جزئية قبل ذلك.',
    accuracyLabel: 'نسبة الإجابات الصحيحة',
    domainsTitle: 'الأداء حسب المهارة',
    subskillsTitle: 'الأداء حسب المهارة الفرعية',
    timePerQuestionLabel: 'متوسط الزمن لكل سؤال',
    /* Shown instead of a number when nothing was graded: a zero here would read
       as a result rather than as an absence. */
    noScore: 'لا نتيجة',
  },

  notices: {
    readOnly:
      'هذه الشاشة للاطلاع فقط. لا يمكن تعديل إجابة ولا تمديد وقت ولا إعادة فتح قسم مغلق: المحاولة سجل لما جرى، وتعديله يُفقده معناه.',
    notAnOfficialScore:
      'هذه الأرقام وصف لما حدث في هذه المحاولة وحدها. المنصة لا تحسب درجة رسمية ولا نسبة معيارية ولا توقّعًا لنتيجة الاختبار.',
    snapshotIsWhatStudentSaw:
      'نصوص الأسئلة والخيارات هنا نسخ ثابتة كما عُرضت على الطالب. تعديل السؤال في البنك بعد ذلك لا يغيّرها.',
    dryRunExcluded: 'هذه محاولة تجريبية نفّذها مدير لفحص إصدار، وهي مستبعدة من تحليلات الطلاب.',
    inProgressNote: 'هذه المحاولة ما زالت جارية والوقت مستمر، والأرقام أدناه ستتغيّر عند انتهائها.',
    expiredNote: 'انتهى وقت هذه المحاولة قبل التسليم، وصُحِّحت بما أُجيب عنه حتى تلك اللحظة.',
    supportNote:
      'إن اشتكى طالب من عطل أثناء محاولته، فالتصحيح لا يكون بتعديل المحاولة بل بمنحه محاولة جديدة ومعالجة سبب العطل.',
  },

  errors: {
    notFound: 'هذه المحاولة غير موجودة.',
    resultsNotReady: 'لا توجد نتيجة لهذه المحاولة قبل تسليمها أو انتهاء وقتها.',
    sectionNotFound: 'هذا القسم غير موجود في هذه المحاولة.',
    editUnavailable: 'لا تُعدَّل المحاولات ولا إجاباتها من لوحة التحكم.',
    deleteUnavailable:
      'لا تُحذف المحاولات. سجل ما خاضه الطالب يجب أن يبقى مقروءًا حتى لو كان المنتج قد أُرشف.',
    extendTimeUnavailable: 'لا يمكن تمديد وقت محاولة. الوقت محسوب على الخادم وثابت منذ بدايتها.',
  },

  empty: {
    nothingYetTitle: 'لا توجد محاولات بعد',
    nothingYetBody: 'لم يبدأ أي طالب محاولة على أي محاكٍ حتى الآن.',
  },
} as const;
