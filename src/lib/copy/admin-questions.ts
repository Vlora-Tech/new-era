/**
 * The question bank: list, filters, the editor, and the review workflow.
 *
 * Composed into `COPY.adminQuestions` by `src/lib/copy.ts`.
 *
 * Two constraints shape the wording, both from
 * `docs/content-and-legal-checklist.md`:
 *
 *  1. The rights fields are mandatory and the interface says so in the form
 *     itself, not in a help page. Publication is blocked without them.
 *  2. Nothing anywhere may describe the bank as containing questions that
 *     appeared in a real examination, or invite an editor to enter such
 *     material. Every prompt here asks for original or documented-licensed
 *     content, and the rights section says outright what is not accepted.
 */
export const ADMIN_QUESTIONS_COPY = {
  listTitle: 'بنك الأسئلة',
  listDescription:
    'الأسئلة من إعداد المنصة أو المرخَّصة بمستند موثّق، مع تصنيفها ومسار مراجعتها ونشرها.',
  createAction: 'سؤال جديد',
  createTitle: 'إضافة سؤال',
  createDescription: 'يُنشأ السؤال كمسودة، ولا يصل إلى أي طالب قبل مراجعته واعتماده ونشره.',
  editTitle: 'تعديل السؤال',
  editDescription: 'التعديل هنا يغيّر المسودة الحالية للسؤال.',

  columns: {
    stem: 'نص السؤال',
    domain: 'المهارة',
    difficulty: 'الصعوبة',
    track: 'المسار',
    workflow: 'حالة المراجعة',
    version: 'النسخة المنشورة',
    author: 'المُعِد أو الجهة المرخِّصة',
    updatedAt: 'آخر تحديث',
    actions: 'إجراءات السؤال',
  },

  filters: {
    domain: 'المهارة',
    difficulty: 'الصعوبة',
    track: 'المسار',
    workflow: 'حالة المراجعة',
    searchPlaceholder: 'ابحث في نص السؤال أو وسومه…',
  },

  /** Headings that break the editor into readable sections. */
  sections: {
    content: 'نص السؤال وخياراته',
    classification: 'التصنيف',
    guidance: 'الشرح والتلميح',
    rights: 'المصدر وحقوق الاستخدام',
    review: 'المراجعة والنشر',
  },

  fields: {
    stem: {
      label: 'نص السؤال',
      hint: 'اكتب السؤال كما يقرؤه الطالب. يُخزَّن النص كبيانات لا كوسوم، فلا تستخدم HTML؛ اترك سطرًا فارغًا للفصل بين فقرتين.',
    },
    options: {
      label: 'الخيارات',
      hint: 'اكتب كل خيار في سطره. الترتيب هنا هو الترتيب المخزَّن، وقد يُخلط عند العرض إن كان الخلط مفعّلًا.',
    },
    correctAnswer: {
      label: 'الإجابة الصحيحة',
      hint: 'حدّد خيارًا واحدًا فقط. لا تُرسل الإجابة الصحيحة إلى متصفح الطالب قبل تسليم المحاولة.',
    },
    explanation: {
      label: 'الشرح',
      hint: 'يظهر بعد تسليم المحاولة، وفي وضع التدريب فور الإجابة. اشرح طريقة الوصول إلى الإجابة لا الإجابة وحدها.',
    },
    hint: {
      label: 'تلميح',
      hint: 'اختياري. يظهر أثناء المحاولة عندما يطلبه الطالب.',
    },
    tags: {
      label: 'وسوم',
      hint: 'كلمات للتصنيف الداخلي والبحث، تفصل بينها بفاصلة. لا تظهر للطالب.',
    },
    subskill: {
      label: 'المهارة الفرعية',
      hint: 'تصنيف أدق داخل المهارة. يظهر في تقرير الأداء بعد المحاولة، فاستخدم تسمية ثابتة عبر الأسئلة المتشابهة.',
    },
    domain: {
      label: 'المهارة',
      hint: 'المهارة المعلنة رسميًا التي يتدرّب عليها السؤال. تُستخدم في قواعد اختيار أسئلة المحاكي وفي تقرير الأداء.',
    },
    difficulty: {
      label: 'مستوى الصعوبة',
      hint: 'تقدير المُعِد. يُستخدم في توزيع أسئلة المحاكي، ولا يُعرض للطالب.',
    },
    track: {
      label: 'المسار',
      hint: 'المسار الذي يصلح له السؤال. اختر «المساران» إن كان مناسبًا للعلمي والنظري معًا.',
    },
    estimatedSeconds: {
      label: 'الزمن التقديري بالثواني',
      hint: 'تقدير إرشادي للتخطيط فقط. لا يحدّ وقت الطالب ولا يدخل في التصحيح.',
    },
    shuffleOptions: {
      label: 'خلط ترتيب الخيارات',
      hint: 'أوقفه إذا كان ترتيب الخيارات يحمل معنى — كترتيب تصاعدي، أو خيار «كل ما سبق».',
    },
    stimulus: {
      label: 'المادة المرافقة',
      hint: 'النص أو الجدول أو الصورة التي يشترك فيها أكثر من سؤال، إن وُجدت.',
    },
    reviewNote: {
      label: 'ملاحظة المراجعة',
      hint: 'تُحفظ مع السؤال وتظهر للمُعِد. اكتب سبب الاعتماد أو ما يجب تعديله.',
    },
  },

  optionsEditor: {
    addOption: 'إضافة خيار',
    removeOption: 'حذف الخيار',
    optionLabel: 'الخيار {number}',
    markCorrect: 'هذه هي الإجابة الصحيحة',
    correctLegend: 'اختر الإجابة الصحيحة',
    minimumNote: 'يجب ألا يقل عدد الخيارات عن خيارين.',
    // The rule is enforced by a partial unique index in the database. Saying so
    // here keeps the form's message and the constraint describing one rule, and
    // it is why the schema refuses before the write rather than after it.
    exactlyOneNote: 'يجب تحديد إجابة صحيحة واحدة بالضبط؛ قاعدة البيانات نفسها ترفض ما عدا ذلك.',
  },

  /**
   * Rights and provenance.
   *
   * Mandatory, and stated as a rule about what may enter the bank rather than as
   * a form field with an asterisk. The prohibition is spelled out because the
   * cost of getting it wrong is not a bad row — it is publishing protected
   * examination material.
   */
  rights: {
    sectionTitle: 'المصدر وحقوق الاستخدام',
    sectionBody:
      'لا يدخل بنك الأسئلة إلا محتوى من إعداد المنصة، أو محتوى مغطّى بترخيص مكتوب وموثّق. لا يُقبل نقل أي سؤال أو نص أو صورة من مادة رسمية أو من تجميعات أو لقطات شاشة أو تسجيلات، ولو بإعادة صياغة.',
    mandatoryNote: 'هذه الحقول إلزامية، ولا يمكن نشر السؤال قبل تعبئتها.',
    authorOrLicensor: {
      label: 'المُعِد أو الجهة المرخِّصة',
      hint: 'اسم من أعدّ السؤال داخل المنصة، أو الجهة التي منحت الترخيص المكتوب.',
    },
    provenanceNote: {
      label: 'بيان المصدر',
      hint: 'من أين جاء المحتوى وكيف. عند الترخيص، أشر إلى المستند ونطاقه وتاريخه.',
    },
    rightsDeclaration: {
      label: 'إقرار الحقوق',
      hint: 'إقرار صريح بأن هذا السؤال أصلي من إعداد المنصة، أو مرخَّص بمستند موثّق يغطي هذا الاستخدام.',
    },
  },

  /**
   * Enum labels.
   *
   * `domainLabels` uses the exact Arabic names carried in the trailing comments
   * of `QuestionDomain` in `prisma/schema.prisma`, so the schema and the screen
   * cannot describe the same skill differently. `trackLabels` restates
   * `COPY.statusLabels.questionTrack` verbatim; the duplication is deliberate,
   * because `copy.ts` composes this module and importing `COPY` back would close
   * a cycle. If either side is reworded, reword both.
   */
  domainLabels: {
    VERBAL_ANALOGY: 'التناظر اللفظي',
    SENTENCE_COMPLETION: 'إكمال الجمل',
    CONTEXTUAL_ERROR: 'الخطأ السياقي',
    READING_COMPREHENSION: 'استيعاب المقروء',
    ARITHMETIC: 'الحساب',
    GEOMETRY: 'الهندسة',
    ALGEBRA: 'الجبر',
    DATA_ANALYSIS: 'تفسير البيانات',
  },
  difficultyLabels: {
    EASY: 'سهل',
    MEDIUM: 'متوسط',
    HARD: 'صعب',
  },
  trackLabels: {
    SCIENTIFIC: 'المسار العلمي',
    THEORETICAL: 'المسار النظري',
    BOTH: 'المساران',
    CUSTOM: 'مسار مخصص',
  },
  workflowLabels: {
    DRAFT: 'مسودة',
    IN_REVIEW: 'قيد المراجعة',
    APPROVED: 'معتمد',
    PUBLISHED: 'منشور',
    RETIRED: 'مسحوب من الخدمة',
  },
  rightsLabels: {
    ORIGINAL: 'أصلي من إعداد المنصة',
    LICENSED: 'مرخَّص بمستند موثّق',
  },
  stimulusTypeLabels: {
    PASSAGE: 'نص مقروء',
    IMAGE: 'صورة',
    TABLE: 'جدول',
    CHART: 'رسم بياني',
    MATH: 'تعبير رياضي',
  },

  /**
   * Workflow transitions: DRAFT → IN_REVIEW → APPROVED → PUBLISHED → RETIRED.
   *
   * Publishing is the only irreversible-feeling step, because it freezes an
   * immutable version snapshot that live attempts then serve; retiring removes
   * the question from the eligible pool without touching attempts already built
   * from it. Both confirmations say exactly that, since neither is guessable
   * from the button's verb.
   */
  transitions: {
    submitForReview: 'إرسال للمراجعة',
    submitForReviewConfirmTitle: 'إرسال السؤال للمراجعة؟',
    submitForReviewConfirmBody:
      'ينتقل السؤال إلى قائمة المراجعة. يمكن إعادته إلى المسودة إن طُلبت تعديلات.',
    submitForReviewConfirmAction: 'نعم، أرسله',

    approve: 'اعتماد السؤال',
    approveConfirmTitle: 'اعتماد هذا السؤال؟',
    approveConfirmBody:
      'الاعتماد يعني أن المحتوى والتصنيف وبيانات الحقوق صحيحة. لا يصل السؤال إلى الطلاب قبل نشره.',
    approveConfirmAction: 'نعم، اعتمده',

    requestChanges: 'إعادة إلى المسودة',
    requestChangesConfirmTitle: 'إعادة السؤال إلى المسودة؟',
    requestChangesConfirmBody: 'يعود السؤال قابلًا للتحرير، وتُحفظ ملاحظتك مع السؤال.',
    requestChangesConfirmAction: 'نعم، أعده',

    publish: 'نشر السؤال',
    publishConfirmTitle: 'نشر هذا السؤال؟',
    publishConfirmBody:
      'يُنشأ عند النشر نسخة ثابتة من السؤال بخياراته وإجابته وشرحه، وهي ما يُقدَّم للطلاب. أي تعديل بعد ذلك لا يظهر لهم إلا بنشر نسخة جديدة.',
    publishConfirmAction: 'نعم، انشر',

    retire: 'سحب من الخدمة',
    retireConfirmTitle: 'سحب هذا السؤال من الخدمة؟',
    retireConfirmBody:
      'يخرج السؤال من مجموعة الأسئلة المتاحة للمحاولات الجديدة. المحاولات السابقة تحتفظ بالنسخة التي عُرضت فيها، ونتائجها لا تتغيّر.',
    retireConfirmAction: 'نعم، اسحبه',

    restore: 'إعادة إلى المسودة',
    restoreConfirmTitle: 'إعادة السؤال إلى المسودة؟',
    restoreConfirmBody: 'يعود السؤال قابلًا للتحرير، ويحتاج إلى مراجعة واعتماد جديدين قبل نشره.',
    restoreConfirmAction: 'نعم، أعده إلى المسودة',
  },

  errors: {
    notFound: 'هذا السؤال غير موجود.',
    needsTwoOptions: 'يجب إدخال خيارين على الأقل.',
    needsExactlyOneCorrect: 'يجب تحديد إجابة صحيحة واحدة بالضبط.',
    rightsRequired: 'لا يمكن النشر قبل تحديد المُعِد أو الجهة المرخِّصة وإقرار الحقوق.',
    reviewRequired: 'لا يمكن نشر سؤال لم يُعتمد بعد. أرسله للمراجعة ثم اعتمده.',
    invalidTransition: 'لا يمكن الانتقال من حالة السؤال الحالية إلى الحالة المطلوبة.',
    deleteBlockedInUse:
      'لا يمكن حذف سؤال مستخدم في اختبار أو في محاولة سابقة. اسحبه من الخدمة بدلًا من ذلك، حتى تبقى المحاولات السابقة مقروءة.',
    stimulusNotFound: 'المادة المرافقة المحددة غير موجودة.',
  },

  notices: {
    publishedEditsNeedRepublish:
      'هذا السؤال منشور. التعديل هنا يغيّر المسودة فقط؛ ما يراه الطلاب هو النسخة المنشورة حتى تنشر نسخة جديدة.',
    correctAnswerHidden: 'الإجابة الصحيحة والشرح لا يُرسلان إلى متصفح الطالب قبل تسليم المحاولة.',
  },

  toast: {
    created: 'أُضيف السؤال كمسودة.',
    updated: 'حُفظت تعديلات السؤال.',
    submittedForReview: 'أُرسل السؤال للمراجعة.',
    approved: 'اعتُمد السؤال.',
    published: 'نُشر السؤال.',
    retired: 'سُحب السؤال من الخدمة.',
    returnedToDraft: 'أُعيد السؤال إلى المسودة.',
    deleted: 'حُذف السؤال.',
  },

  empty: {
    nothingYetTitle: 'لا توجد أسئلة بعد',
    nothingYetBody: 'بنك الأسئلة فارغ. ابدأ بإضافة أول سؤال من إعداد المنصة.',
    nothingYetAction: 'إضافة أول سؤال',
  },
} as const;
