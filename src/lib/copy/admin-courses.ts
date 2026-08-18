/**
 * Course content: the course's own settings, its modules, its lessons, and the
 * short quiz that can hang off a lesson.
 *
 * Composed into `COPY.adminCourses` by `src/lib/copy.ts`.
 *
 * Two facts about the schema decide most of the wording here, and neither is
 * visible from the form:
 *
 *  1. A `Course` row is not created on this screen. It belongs one-to-one to a
 *     `Product` of type `COURSE`, so the list here is a list of course *products*
 *     and the only way to add one is to add the product. Saying that plainly is
 *     what stops an administrator hunting for a "دورة جديدة" button that cannot
 *     exist.
 *  2. A module or a lesson has its own `ContentStatus`, separate from the
 *     product's `ProductStatus`. A published lesson inside a draft product is
 *     still invisible to every student, and an administrator who publishes a
 *     lesson and then cannot find it needs to be told which of the two gates is
 *     shut.
 */
export const ADMIN_COURSES_COPY = {
  listTitle: 'الدورات',
  listDescription:
    'محتوى الدورات المعروضة للبيع: الوحدات والدروس ومقاطعها والأسئلة القصيرة المرتبطة بها.',
  listNote: 'لإضافة دورة جديدة أنشئ منتجًا من نوع «دورة» أولًا.',
  goToProducts: 'الانتقال إلى المنتجات',

  detailTitle: 'محتوى الدورة',
  detailDescription: 'رتّب الوحدات والدروس، واضبط ما يُعتبر إكمالًا لكل درس.',
  backToCourses: 'العودة إلى الدورات',
  openProduct: 'فتح صفحة المنتج',

  columns: {
    title: 'الدورة',
    product: 'المنتج',
    productStatus: 'حالة المنتج',
    category: 'التصنيف',
    level: 'المستوى',
    moduleCount: 'الوحدات',
    lessonCount: 'الدروس',
    publishedLessonCount: 'دروس منشورة',
    duration: 'إجمالي المدة',
    updatedAt: 'آخر تحديث',
    actions: 'إجراءات الدورة',
  },

  filters: {
    productStatus: 'حالة المنتج',
    category: 'التصنيف',
    hasLessons: 'الدورات التي بها دروس فقط',
    searchPlaceholder: 'ابحث باسم الدورة أو تصنيفها…',
  },

  /** Headings that split the builder into readable regions. */
  sections: {
    settings: 'إعدادات الدورة',
    modules: 'الوحدات',
    lessons: 'الدروس',
    quiz: 'السؤال القصير بعد الدرس',
    summary: 'ملخّص المحتوى',
  },

  /** The `Course` row itself: three fields, none of them content. */
  settings: {
    title: 'إعدادات الدورة',
    description: 'قيم تسري على الدورة كلها، ويمكن لكل درس أن يتجاوز بعضها.',
    fields: {
      category: {
        label: 'التصنيف',
        hint: 'تصنيف داخلي للتنظيم، مثل: كمي، لفظي. لا يظهر للطالب ولا يؤثر على السعر أو الوصول.',
      },
      level: {
        label: 'المستوى',
        hint: 'وصف مختصر لمستوى الدورة، مثل: تأسيسي، متقدم. للتنظيم الداخلي فقط.',
      },
      completionThresholdPercent: {
        label: 'نسبة المشاهدة اللازمة لاعتبار الدرس مكتملًا',
        hint: 'نسبة مئوية بين ١ و١٠٠ تسري على كل درس لم تُحدَّد له نسبة خاصة. تغييرها لا يعيد حساب تقدّم سابق: الدروس المكتملة تبقى مكتملة.',
      },
    },
    toast: { updated: 'حُفظت إعدادات الدورة.' },
  },

  /** `CourseModule`: a titled, ordered container of lessons. */
  modules: {
    title: 'الوحدات',
    description: 'ترتيب الوحدات هو ترتيب ظهورها للطالب.',
    createAction: 'وحدة جديدة',
    createTitle: 'إضافة وحدة',
    createDescription: 'تُنشأ الوحدة كمسودة وتُضاف في نهاية الترتيب.',
    editTitle: 'تعديل الوحدة',

    columns: {
      position: 'الترتيب',
      title: 'اسم الوحدة',
      status: 'حالة النشر',
      lessonCount: 'الدروس',
      duration: 'المدة',
      updatedAt: 'آخر تحديث',
      actions: 'إجراءات الوحدة',
    },

    fields: {
      title: {
        label: 'اسم الوحدة',
        hint: 'الاسم كما يراه الطالب في قائمة محتوى الدورة.',
      },
      status: {
        label: 'حالة النشر',
        hint: 'الوحدة المسودة وكل دروسها لا تظهر للطالب، ولو كانت الدروس نفسها منشورة.',
      },
    },

    empty: {
      nothingYetTitle: 'لا توجد وحدات بعد',
      nothingYetBody: 'هذه الدورة بلا وحدات. ابدأ بإضافة أول وحدة ثم أضف دروسها.',
      nothingYetAction: 'إضافة أول وحدة',
    },

    confirmDelete: {
      title: 'حذف هذه الوحدة؟',
      body: 'يُحذف معها كل درس بداخلها. لا يمكن التراجع بعد التأكيد.',
      confirm: 'نعم، احذف الوحدة',
    },

    toast: {
      created: 'أُضيفت الوحدة كمسودة.',
      updated: 'حُفظت تعديلات الوحدة.',
      deleted: 'حُذفت الوحدة.',
      reordered: 'حُفظ ترتيب الوحدات.',
      published: 'نُشرت الوحدة.',
      unpublished: 'أُرجعت الوحدة إلى المسودة.',
      archived: 'أُرشفت الوحدة.',
    },
  },

  /** `Lesson`: the unit a student actually opens. */
  lessons: {
    title: 'الدروس',
    description: 'كل درس ينتمي إلى وحدة واحدة، وله ترتيبه داخلها.',
    createAction: 'درس جديد',
    createTitle: 'إضافة درس',
    createDescription: 'يُنشأ الدرس كمسودة داخل الوحدة المختارة، وفي نهاية ترتيبها.',
    editTitle: 'تعديل الدرس',

    columns: {
      position: 'الترتيب',
      title: 'اسم الدرس',
      module: 'الوحدة',
      status: 'حالة النشر',
      duration: 'المدة',
      video: 'المقطع',
      isPreview: 'معاينة مجانية',
      quiz: 'سؤال قصير',
      updatedAt: 'آخر تحديث',
      actions: 'إجراءات الدرس',
    },

    fields: {
      title: {
        label: 'اسم الدرس',
        hint: 'الاسم كما يراه الطالب في قائمة الدروس.',
      },
      module: {
        label: 'الوحدة',
        hint: 'الوحدة التي ينتمي إليها الدرس. نقله إلى وحدة أخرى يضعه في نهاية ترتيبها.',
      },
      content: {
        label: 'نص مرافق',
        hint: 'شرح مكتوب يظهر أسفل المقطع. يُخزَّن كنص لا كوسوم، فلا تستخدم HTML.',
      },
      videoAsset: {
        label: 'مقطع الدرس',
        hint: 'المقطع محمي ومرتبط بحساب الطالب، ولا يُعرض لمن لا يملك الوصول. الدرس بلا مقطع يظل قابلًا للنشر إن كان نصيًا.',
      },
      durationSec: {
        label: 'المدة بالثواني',
        hint: 'تُقرأ من المقطع عند توفّرها. تُستخدم في عرض مدة الوحدة والدورة فقط.',
      },
      isPreview: {
        label: 'إتاحته كمعاينة مجانية',
        hint: 'يفتح هذا الدرس لأي زائر دون شراء. لا تفعّله لدرس يحتوي على محتوى مدفوع.',
      },
      status: {
        label: 'حالة النشر',
        hint: 'الدرس المسودة لا يظهر للطالب. النشر لا يكفي وحده: يجب أن تكون الوحدة والمنتج منشورين أيضًا.',
      },
      completionThresholdPercent: {
        label: 'نسبة المشاهدة اللازمة لهذا الدرس',
        hint: 'اتركه فارغًا ليأخذ الدرس نسبة الدورة. القيمة هنا تتجاوز إعداد الدورة لهذا الدرس وحده.',
      },
    },

    /**
     * The video picker's honest states.
     *
     * `notConfigured` and `noAssets` are two different absences and are worded
     * apart deliberately. The first is an environment without Bunny credentials,
     * where no amount of administrator effort produces a video; the second is a
     * configured platform whose library is simply empty, where uploading one is
     * exactly the next step. Collapsing them into "no videos available" would
     * send somebody to a provider dashboard that does not exist, or leave them
     * waiting for an upload that was never possible.
     */
    video: {
      none: 'بلا مقطع',
      notConfigured:
        'خدمة الفيديو غير مهيّأة في هذه البيئة، فلا يمكن ربط مقطع بالدرس الآن. الدروس النصية تعمل كالمعتاد.',
      /*
       * Names both halves of the job and where each happens. The earlier wording
       * stopped at "upload it at the provider", which left the reader looking for
       * a step this screen does not perform — the bytes go to Bunny, but the
       * platform still needs the identifier.
       *
       * It no longer points down the page either. Registration happens in a
       * dialog opened from this field, so the sentence names the remaining
       * external step and the button beside it does the rest.
       */
      noAssets:
        'لا توجد مقاطع مسجّلة بعد. ارفع المقطع في لوحة Bunny Stream، ثم سجّل معرّفه هنا ليصبح متاحًا للاختيار.',
      registerHere: 'تسجيل مقطع الآن',
      registerNew: 'تسجيل مقطع جديد',
      registerDialogTitle: 'تسجيل مقطع جديد',
      registerDialogBody: 'يُسجَّل المقطع ويُربط بهذا الدرس مباشرة، دون مغادرة هذه الصفحة.',
      ready: 'جاهز',
      notReady: 'قيد المعالجة',
      inUse: 'مرتبط بدرس آخر',
      attached: 'مرتبط بهذا الدرس',
    },

    empty: {
      nothingYetTitle: 'لا توجد دروس بعد',
      nothingYetBody: 'هذه الوحدة بلا دروس. أضف أول درس إليها.',
      nothingYetAction: 'إضافة أول درس',
    },

    confirmDelete: {
      title: 'حذف هذا الدرس؟',
      body: 'يُحذف معه سؤاله القصير إن وُجد. لا يمكن التراجع بعد التأكيد.',
      confirm: 'نعم، احذف الدرس',
    },

    toast: {
      created: 'أُضيف الدرس كمسودة.',
      updated: 'حُفظت تعديلات الدرس.',
      deleted: 'حُذف الدرس.',
      reordered: 'حُفظ ترتيب الدروس.',
      published: 'نُشر الدرس.',
      unpublished: 'أُرجع الدرس إلى المسودة.',
      archived: 'أُرشف الدرس.',
    },
  },

  /**
   * `LessonQuiz`: an optional short check after a lesson.
   *
   * Its questions come from the question bank rather than being authored here,
   * so the copy points at the bank instead of offering a second editor. A
   * question used in a quiz cannot then be deleted from the bank — that refusal
   * is stated on the question screen, and repeated here so the link is visible
   * from both ends.
   */
  quiz: {
    title: 'السؤال القصير بعد الدرس',
    description: 'اختر أسئلة هذا الدرس من القائمة، ثم احفظ.',
    createAction: 'إضافة سؤال قصير',
    createTitle: 'اختيار أسئلة الدرس',
    editTitle: 'تعديل أسئلة الدرس',
    saveAction: 'حفظ الاختبار القصير',
    removeAction: 'إزالة السؤال القصير من الدرس',

    advanced: {
      title: 'إعدادات إضافية',
      summary: 'وقت ظهور النتيجة والمحاولات ودرجات الأسئلة',
    },

    fields: {
      feedbackMode: {
        label: 'وقت إظهار النتيجة',
        hint: 'الإظهار الفوري يعرض الصواب والشرح بعد كل إجابة. الإظهار بعد التسليم يؤجّلهما حتى ينتهي الطالب من كل الأسئلة.',
      },
      maxAttempts: {
        label: 'الحد الأقصى للمحاولات',
        hint: 'اتركه فارغًا لمحاولات غير محدودة. تقليل الحد لاحقًا لا يحذف محاولات سابقة ولا يعيد حسابها.',
      },
    },

    questions: {
      title: 'أسئلة السؤال القصير',
      description: 'الترتيب هنا هو ترتيب عرضها على الطالب.',
      addAction: 'إضافة',
      addTitle: 'اختيار سؤال من بنك الأسئلة',
      addHint: 'الأسئلة المنشورة فقط هي المتاحة للاختيار؛ المسودة أو قيد المراجعة لا تصل إلى طالب.',
      removeAction: 'إزالة السؤال',
      selected: {
        title: 'الأسئلة المختارة',
        description: 'تظهر للطالب بهذا الترتيب.',
        count: 'الأسئلة المختارة: {count}',
        emptyTitle: 'لم تختر أي سؤال بعد',
        emptyBody: 'اضغط «إضافة» بجوار أي سؤال مناسب من القائمة.',
      },
      bank: {
        title: 'اختر من بنك الأسئلة',
        description: 'تظهر أحدث الأسئلة المنشورة مباشرة.',
        searchPlaceholder: 'ابحث بكلمة من السؤال أو المهارة أو الوسم…',
        searchHint: 'لا تحتاج إلى تذكّر نص السؤال كاملًا؛ تكفي كلمة واحدة.',
        loading: 'جارٍ تحديث الأسئلة…',
        resultsCount: '{count} سؤال منشور',
        latestNote: 'مرتبة من الأحدث',
        loadFailed: 'تعذر تحميل بنك الأسئلة.',
        refreshAction: 'تحديث القائمة',
        addedAction: 'تمت الإضافة',
        manageHint:
          'لم تجد السؤال المناسب؟ افتح البنك في علامة تبويب جديدة حتى تبقى اختياراتك هنا.',
        openAction: 'فتح بنك الأسئلة',
        createAction: 'إنشاء سؤال جديد',
      },
      columns: {
        position: 'الترتيب',
        stem: 'نص السؤال',
        domain: 'المهارة',
        difficulty: 'الصعوبة',
        points: 'الدرجة',
        actions: 'إجراءات السؤال',
      },
      pointsField: {
        label: 'درجة السؤال',
        groupTitle: 'درجات الأسئلة',
        hint: 'وزن السؤال داخل هذا الاختبار القصير فقط. لا علاقة له بنتائج المحاكي.',
      },
      /**
       * A question that was published when it was added and has since been
       * retired or sent back for review. The link is not removed automatically —
       * silently dropping a question would change a quiz nobody asked to change
       * — so the row says what happened and leaves the decision to a person.
       */
      notPublishedBadge: 'لم يعُد منشورًا',
      notPublishedNote:
        'أحد الأسئلة لم يعُد منشورًا في البنك، ولن يصل إلى الطالب. أزله أو أعد نشره من بنك الأسئلة.',

      empty: {
        nothingYetTitle: 'لا توجد أسئلة في هذا الاختبار القصير',
        nothingYetBody: 'أضف سؤالًا واحدًا على الأقل من بنك الأسئلة المنشورة.',
        nothingYetAction: 'إضافة سؤال من البنك',
        noResultsTitle: 'لا أسئلة مطابقة',
        noResultsBody: 'جرّب إزالة المرشحات، أو أنشئ سؤالًا جديدًا في البنك وانشره أولًا.',
      },
    },

    empty: {
      nothingYetTitle: 'لا يوجد سؤال قصير لهذا الدرس',
      nothingYetBody: 'الدرس بلا اختبار قصير. أضف واحدًا إن أردت تثبيت فكرته قبل الانتقال.',
      nothingYetAction: 'إضافة سؤال قصير',
    },

    confirmDelete: {
      title: 'إزالة السؤال القصير من هذا الدرس؟',
      body: 'تُحذف إعداداته وقائمة أسئلته. محاولات الطلاب السابقة عليه تبقى محفوظة في سجلاتهم.',
      confirm: 'نعم، أزله',
    },

    toast: {
      created: 'أُضيف السؤال القصير إلى الدرس.',
      updated: 'حُفظت إعدادات السؤال القصير.',
      deleted: 'أُزيل السؤال القصير من الدرس.',
      questionAdded: 'أُضيف السؤال إلى الاختبار القصير.',
      questionRemoved: 'أُزيل السؤال من الاختبار القصير.',
      reordered: 'حُفظ ترتيب الأسئلة.',
    },
  },

  /**
   * Reordering.
   *
   * `position` is a plain integer and deliberately not unique, because a swap
   * inside a transaction would deadlock against a unique constraint. The hint
   * says the order is saved immediately, since a list that reorders on screen
   * without a save button otherwise leaves the administrator unsure.
   */
  reorder: {
    label: 'الترتيب',
    moveUp: 'تحريك للأعلى',
    moveDown: 'تحريك للأسفل',
    hint: 'يُحفظ الترتيب فور تغييره.',
    saving: 'جارٍ حفظ الترتيب…',
    failed: 'تعذّر حفظ الترتيب، ولم يتغيّر شيء.',
  },

  /**
   * The course default and the per-lesson override, named as one relationship.
   *
   * `Lesson.completionThresholdPercent` is nullable and null means "take the
   * course's". Showing two unlabelled percentages — one on the course, one on
   * the lesson — leaves an administrator with no way to tell which one is
   * actually applied, so every place a lesson's threshold appears states the
   * effective number *and* where it came from.
   */
  threshold: {
    effectiveLabel: 'نسبة الإكمال المطبَّقة',
    inherited: 'موروثة من إعداد الدورة',
    overridden: 'خاصة بهذا الدرس',
  },

  /**
   * `ContentStatus`.
   *
   * The same three words as `ProductStatus` in `COPY.adminProducts.statusLabels`,
   * because they are the same three states to an administrator. They are restated
   * rather than imported: `copy.ts` composes this module, so reaching back into
   * `COPY` would close a cycle. If one side is reworded, reword both.
   */
  statusLabels: {
    DRAFT: 'مسودة',
    PUBLISHED: 'منشور',
    ARCHIVED: 'مؤرشف',
  },

  /** `FeedbackMode` on a lesson quiz. */
  feedbackModeLabels: {
    IMMEDIATE: 'فوري بعد كل إجابة',
    AFTER_SUBMISSION: 'بعد تسليم الاختبار القصير',
  },

  /**
   * Publication transitions, shared by modules and lessons.
   *
   * Each confirmation names the other gate. Publishing a lesson inside a draft
   * module changes nothing a student can see, and a message that says only "تم
   * النشر" would be true and useless.
   */
  transitions: {
    publish: 'نشر',
    publishConfirmTitle: 'نشر هذا العنصر؟',
    publishConfirmBody:
      'يصبح العنصر ظاهرًا للطلاب الذين يملكون الدورة، بشرط أن تكون وحدته والمنتج المرتبط بها منشورين أيضًا.',
    publishConfirmAction: 'نعم، انشر',

    unpublish: 'إرجاع إلى المسودة',
    unpublishConfirmTitle: 'إرجاع هذا العنصر إلى المسودة؟',
    unpublishConfirmBody:
      'يختفي العنصر من محتوى الدورة عند الطلاب. تقدّمهم المسجَّل عليه لا يُحذف، ويعود كما هو إن نُشر من جديد.',
    unpublishConfirmAction: 'نعم، أرجعه إلى المسودة',

    archive: 'أرشفة',
    archiveConfirmTitle: 'أرشفة هذا العنصر؟',
    archiveConfirmBody:
      'العنصر المؤرشف لا يظهر للطلاب ولا يُحتسب في تقدّم الدورة، ويبقى محفوظًا مع سجلات المشاهدة السابقة.',
    archiveConfirmAction: 'نعم، أرشف',

    restore: 'إعادة إلى المسودة',
    restoreConfirmTitle: 'إعادة هذا العنصر إلى المسودة؟',
    restoreConfirmBody: 'يعود العنصر قابلًا للتحرير، ويبقى مخفيًا عن الطلاب حتى تنشره من جديد.',
    restoreConfirmAction: 'نعم، أعده إلى المسودة',
  },

  /** Honest refusals: each one names the obstacle and the way past it. */
  errors: {
    courseNotFound: 'هذه الدورة غير موجودة.',
    moduleNotFound: 'هذه الوحدة غير موجودة.',
    lessonNotFound: 'هذا الدرس غير موجود.',
    quizNotFound: 'لا يوجد اختبار قصير لهذا الدرس.',
    productNotCourse: 'هذا المنتج ليس دورة، فلا محتوى دروس له.',
    courseRequiresProduct: 'لا تُنشأ الدورة بذاتها. أنشئ منتجًا من نوع «دورة» وسيُنشأ محتواه معه.',
    moduleTitleRequired: 'اسم الوحدة مطلوب.',
    lessonTitleRequired: 'اسم الدرس مطلوب.',
    /*
     * Both name the next action, not just the unmet condition.
     *
     * These two gates chain: a module needs a published lesson, and a lesson
     * needs a video or text before it can be published. An administrator who
     * adds a unit and an empty lesson therefore meets the module's refusal
     * first, fixes nothing by looking at the lesson, and meets the lesson's
     * refusal second. Stating only the condition — "a module cannot be
     * published without a published lesson" — is true and leaves them exactly
     * where they were, so each sentence carries the step that clears it.
     */
    lessonNeedsContentToPublish:
      'لا يمكن نشر درس بلا مقطع ولا نص. افتح «تعديل» وأضف نصًا مرافقًا أو اربط مقطعًا من مكتبة المقاطع، ثم انشر الدرس.',
    moduleNeedsLessonToPublish:
      'لا يمكن نشر وحدة بلا درس منشور واحد على الأقل. انشر أحد دروس الوحدة أولًا — وإن كان الدرس مسودة فلن يُنشر قبل أن يحتوي على نص أو مقطع — ثم انشر الوحدة.',
    thresholdOutOfRange: 'نسبة المشاهدة يجب أن تكون بين ١ و١٠٠.',
    durationInvalid: 'مدة الدرس يجب أن تكون عددًا موجبًا من الثواني.',
    videoAssetNotFound: 'المقطع المحدد غير موجود.',
    videoAssetNotReady: 'المقطع لم تكتمل معالجته بعد، فلا يمكن ربطه بدرس الآن.',
    videoAssetInUse: 'هذا المقطع مرتبط بدرس آخر.',
    previewRequiresVideo: 'لا يمكن جعل الدرس معاينة مجانية قبل ربط مقطع أو نص به.',
    deleteBlockedByProgress:
      'لا يمكن حذف درس سجّل عليه طلاب تقدّمًا. أرشفه بدلًا من ذلك، حتى تبقى سجلات مشاهدتهم مقروءة.',
    deleteBlockedByQuizAttempts:
      'لا يمكن حذف اختبار قصير جرت عليه محاولات. أزل ارتباطه بالدرس بدلًا من حذفه.',
    quizAlreadyExists: 'لهذا الدرس اختبار قصير بالفعل.',
    quizQuestionNotPublished: 'لا يمكن إضافة سؤال غير منشور إلى اختبار قصير.',
    quizQuestionDuplicate: 'هذا السؤال مضاف بالفعل إلى هذا الاختبار القصير.',
    quizNeedsQuestion: 'الاختبار القصير يحتاج إلى سؤال واحد على الأقل.',
    maxAttemptsInvalid: 'الحد الأقصى للمحاولات يجب أن يكون عددًا موجبًا، أو فارغًا لغير محدود.',
    reorderStale: 'تغيّر الترتيب من مكان آخر قبل حفظ تغييرك. أعد تحميل الصفحة ثم رتّب من جديد.',
    moveModuleMismatch: 'لا يمكن ترتيب درس داخل وحدة لا ينتمي إليها.',
  },

  notices: {
    draftProductNote:
      'المنتج المرتبط بهذه الدورة ما زال مسودة، فلا يصل محتواها إلى أي طالب مهما كانت حالة الدروس.',
    publishGateNote: 'يظهر الدرس للطالب فقط عندما يكون الدرس ووحدته والمنتج جميعًا منشورة.',
    previewNote: 'الدروس المعلَّمة كمعاينة مجانية مفتوحة لأي زائر دون شراء.',
    progressNote: 'تغيير نسبة الإكمال لا يعيد حساب تقدّم مسجَّل سابقًا.',
  },

  empty: {
    nothingYetTitle: 'لا توجد دورات بعد',
    nothingYetBody: 'لم يُنشأ أي منتج من نوع دورة حتى الآن. أنشئ المنتج أولًا ثم ابنِ محتواه هنا.',
    nothingYetAction: 'إضافة منتج دورة',
  },

  /**
   * The video library.
   *
   * Every string here has one job: to stop an administrator guessing where a
   * value comes from. `videoGuid` is the only identifier a human carries across
   * from Bunny by hand, so it is the only one the form asks for, and the hint
   * names the exact place to copy it from rather than saying "the video id".
   * `libraryId` is shown read-only beside it precisely so nobody wonders whether
   * they were supposed to supply it too.
   *
   * The wording never says "upload" or "delete the video": this platform stores
   * an identifier, and claiming otherwise would promise an action it cannot
   * perform at the provider.
   */
  videoLibrary: {
    title: 'مكتبة المقاطع',
    description:
      'المقاطع مرفوعة لدى Bunny Stream وتُسجَّل هنا بمعرّفها. التسجيل لا يرفع المقطع ولا يحذفه من المزوّد.',

    /* Says the panel is not the only door, so nobody scrolls here mid-lesson. */
    alsoInLesson: 'يمكنك أيضًا تسجيل مقطع من داخل نموذج الدرس مباشرة وربطه به في الحال.',

    register: {
      // `heading` rather than `title`, because `title` below is the video's own
      // name field. Two different things called the same word in one object is
      // how a form ends up labelling a text input with a panel heading.
      heading: 'تسجيل مقطع جديد',
      submit: 'تسجيل المقطع',
      submitting: 'جارٍ التسجيل…',
      guid: {
        label: 'معرّف المقطع في Bunny',
        hint: 'افتح لوحة Bunny Stream ← Stream ← المكتبة ← المقطع، وانسخ قيمة Video GUID. تظهر أيضًا في آخر رابط التضمين، وهي على هيئة 8-4-4-4-12 خانة.',
        placeholder: '00000000-0000-0000-0000-000000000000',
      },
      libraryId: {
        label: 'معرّف المكتبة',
        hint: 'مقروء من إعدادات الخادم (BUNNY_STREAM_LIBRARY_ID)، ولا يُدخل يدويًا. جميع المقاطع في هذه البيئة تنتمي إليه.',
      },
      title: {
        label: 'اسم المقطع (اختياري)',
        hint: 'يُستخدم فقط إذا تعذّر سؤال Bunny عن الاسم. عند توفّر مفتاح الإدارة يُقرأ الاسم الحقيقي من المزوّد ويُستبدل به.',
      },
      durationSec: {
        label: 'المدة بالثواني (اختياري)',
        hint: 'تُقرأ من المزوّد عند توفّر مفتاح الإدارة. تُستخدم لتحديد صلاحية رابط المشاهدة بما يغطي المقطع كاملًا.',
      },
    },

    /**
     * Whether the identifier was checked against Bunny. The distinction is the
     * point of the screen: a confirmed row is known to play, an unconfirmed one
     * is only known to be well-formed, and presenting them alike would let a
     * typo reach a student.
     */
    confirmation: {
      confirmed: 'تم التحقّق من المقطع لدى Bunny وقُرئ اسمه ومدته.',
      unconfirmed:
        'سُجّل المعرّف بصيغته الصحيحة دون التحقّق منه، لعدم تهيئة مفتاح الإدارة (BUNNY_STREAM_API_KEY) في هذه البيئة. تأكّد بنفسك من أنه المقطع المقصود.',
    },

    columns: {
      title: 'المقطع',
      guid: 'المعرّف',
      duration: 'المدة',
      status: 'الحالة',
      usage: 'الاستخدام',
      createdAt: 'تاريخ التسجيل',
    },

    usage: {
      unused: 'غير مستخدم',
      lessons: 'دروس: {count}',
      simulatorIntros: 'مقدّمات محاكيات: {count}',
    },

    untitled: 'مقطع بلا اسم',

    confirmDelete: {
      title: 'إزالة تسجيل هذا المقطع؟',
      body: 'يُزال المعرّف من المنصة فقط، ويبقى المقطع كما هو في Bunny. يمكن تسجيله مرة أخرى لاحقًا.',
      confirm: 'إزالة التسجيل',
    },

    toast: {
      registered: 'سُجّل المقطع.',
      deleted: 'أُزيل تسجيل المقطع.',
    },

    empty: {
      nothingYetTitle: 'لا توجد مقاطع مسجّلة',
      nothingYetBody:
        'ارفع المقطع في لوحة Bunny Stream، ثم سجّل معرّفه هنا ليصبح متاحًا للربط بالدروس.',
      noResultsTitle: 'لا توجد مقاطع مطابقة',
      noResultsBody: 'لا يوجد مقطع يطابق البحث أو التصفية الحالية.',
    },

    errors: {
      notConfigured:
        'خدمة الفيديو غير مهيّأة في هذه البيئة، فلا يمكن تسجيل مقاطع. يلزم ضبط معرّف المكتبة ومفتاح التوقيع أولًا.',
      notFound: 'المقطع المطلوب غير موجود.',
      notFoundAtProvider:
        'لم يُعثر على مقطع بهذا المعرّف في مكتبة Bunny المهيّأة. تأكّد من نسخ المعرّف من المكتبة الصحيحة.',
      alreadyRegistered: 'هذا المقطع مسجّل بالفعل في المنصة.',
      deleteBlockedInUse:
        'لا يمكن إزالة تسجيل مقطع مرتبط بدرس أو بمقدّمة محاكٍ. افصله عنها أولًا ثم أعد المحاولة.',
    },
  },
} as const;
