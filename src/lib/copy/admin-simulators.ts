/**
 * Exam simulators: the simulator's own settings, its versions, each version's
 * sections, and the blueprint rules that fill a section from the question bank.
 *
 * Composed into `COPY.adminSimulators` by `src/lib/copy.ts`.
 *
 * Three rules shape the wording:
 *
 *  1. **A version is a contract, not a draft folder.** Once published it is what
 *     live attempts are generated from, and `ExamAttempt` keeps a settings
 *     snapshot taken at creation. Editing a published version would silently
 *     change what "the same exam" means between two students, so the interface
 *     refuses and says to publish a new version instead.
 *  2. **The active version is a separate decision from publication.** A
 *     simulator points at exactly one `activeExamVersionId`; publishing a version
 *     does not activate it. Two confirmations, worded apart, because collapsing
 *     them is how a half-checked version reaches students.
 *  3. **Nothing here may describe the simulator as reproducing a real
 *     examination.** The source fields record where the *structure* was described
 *     publicly and when New Era reviewed that description — never a copied paper.
 *     `resultDisclaimer` is mandatory before publication for the same reason.
 */
export const ADMIN_SIMULATORS_COPY = {
  listTitle: 'محاكيات الاختبار',
  listDescription:
    'إعداد محاكيات الاختبار: الأقسام والتوقيت وقواعد اختيار الأسئلة وإصدارات كل محاكٍ.',
  listNote: 'لإضافة محاكٍ جديد أنشئ منتجًا من نوع «محاكي اختبار» أولًا.',
  goToProducts: 'الانتقال إلى المنتجات',

  detailTitle: 'إعداد المحاكي',
  detailDescription: 'إعدادات المحاكي وإصداراته، وأيّ إصدار هو المعتمد للمحاولات الجديدة.',
  backToSimulators: 'العودة إلى المحاكيات',
  openProduct: 'فتح صفحة المنتج',

  columns: {
    title: 'المحاكي',
    product: 'المنتج',
    productStatus: 'حالة المنتج',
    track: 'المسار',
    activeVersion: 'الإصدار المعتمد',
    versionCount: 'الإصدارات',
    modes: 'أنماط المحاولة',
    attemptCount: 'المحاولات',
    updatedAt: 'آخر تحديث',
    actions: 'إجراءات المحاكي',
  },

  filters: {
    track: 'المسار',
    versionStatus: 'حالة الإصدار',
    hasActiveVersion: 'التي لها إصدار معتمد فقط',
    searchPlaceholder: 'ابحث باسم المحاكي أو معرّف منتجه…',
  },

  /** Headings that split the screen into readable regions. */
  sections: {
    settings: 'إعدادات المحاكي',
    versions: 'الإصدارات',
    structure: 'بنية الإصدار',
    examSections: 'أقسام الاختبار',
    blueprint: 'قواعد اختيار الأسئلة',
    source: 'مصدر البنية',
    coverage: 'التحقق من التغطية',
  },

  /** The `ExamSimulator` row: track, modes, intro video, active version. */
  settings: {
    title: 'إعدادات المحاكي',
    description: 'تسري على كل إصدارات هذا المحاكي.',
    fields: {
      track: {
        label: 'المسار',
        hint: 'المسار الذي يستهدفه هذا المحاكي. يقيّد الأسئلة التي تصلح لقواعد اختياره، فتغييره بعد بدء المحاولات يغيّر ما تولّده الإصدارات الجديدة.',
      },
      fullSimulationEnabled: {
        label: 'إتاحة المحاكاة الكاملة',
        hint: 'المحاولة الموقوتة بأقسامها وقواعد انتقالها. إيقافها يمنع بدء محاولات جديدة، ولا يمسّ محاولة جارية أو مسلَّمة.',
      },
      trainingModeEnabled: {
        label: 'إتاحة وضع التدريب',
        hint: 'يختار الطالب المهارة والصعوبة ويرى الشرح فور الإجابة. لا يستخدم أقسام الإصدار ولا توقيتها.',
      },
      introVideoAsset: {
        label: 'مقطع تعريفي',
        hint: 'اختياري. يظهر قبل بدء المحاولة كتعريف بالمحاكي، ولا يُحتسب من وقت أي قسم.',
      },
      activeExamVersion: {
        label: 'الإصدار المعتمد',
        hint: 'الإصدار الذي تُولَّد منه المحاولات الجديدة. الإصدارات المنشورة الأخرى تبقى محفوظة، وتستمر المحاولات القائمة على إصدارها هي.',
      },
    },
    toast: { updated: 'حُفظت إعدادات المحاكي.' },
  },

  /** `ExamVersion`: the frozen definition an attempt is generated from. */
  versions: {
    title: 'الإصدارات',
    description:
      'كل إصدار تعريف كامل للاختبار: أقسامه وتوقيته وقواعد أسئلته. المحاولات تُولَّد من الإصدار المعتمد.',
    createAction: 'إصدار جديد',
    createTitle: 'إضافة إصدار',
    createDescription:
      'يُنشأ الإصدار كمسودة برقم يلي آخر إصدار. لا يصل إلى أي طالب قبل نشره واعتماده.',
    duplicateAction: 'إنشاء نسخة من هذا الإصدار',
    duplicateHint: 'تُنسخ الأقسام والقواعد إلى إصدار مسودة جديد، فتعدّلها دون المساس بالمنشور.',
    editTitle: 'تعديل الإصدار',

    columns: {
      versionNumber: 'رقم الإصدار',
      status: 'الحالة',
      selectionMode: 'طريقة الاختيار',
      totalQuestions: 'عدد الأسئلة',
      totalDuration: 'المدة الإجمالية',
      sectionCount: 'الأقسام',
      isActive: 'معتمد',
      publishedAt: 'تاريخ النشر',
      attemptCount: 'المحاولات',
      updatedAt: 'آخر تحديث',
      actions: 'إجراءات الإصدار',
    },

    fields: {
      versionNumber: {
        label: 'رقم الإصدار',
        hint: 'يُحدَّد تلقائيًا ولا يتكرر داخل المحاكي الواحد. يظهر في سجلات المحاولات لتمييز ما خاضه كل طالب.',
      },
      selectionMode: {
        label: 'طريقة اختيار الأسئلة',
        hint: 'القائمة الثابتة تعني أسئلة بعينها لكل طالب. السحب من البنك يعني اختيار عدد أسئلة كل قسم عشوائيًا من الأسئلة المنشورة عند بدء كل محاولة.',
      },
      totalQuestions: {
        label: 'إجمالي عدد الأسئلة',
        hint: 'يجب أن يساوي مجموع أعداد أسئلة الأقسام، وإلا رُفض النشر.',
      },
      totalDurationSec: {
        label: 'المدة الإجمالية بالثواني',
        hint: 'يجب أن تساوي مجموع مدد الأقسام، وإلا رُفض النشر.',
      },
      resultDisclaimer: {
        label: 'إشعار النتيجة',
        hint: 'نص يظهر قبل المحاولة ومع نتيجتها، يوضّح أنها نتيجة تدريبية لا درجة رسمية. النشر ممنوع بدونه.',
      },
      changeSummary: {
        label: 'ملخّص التغيير',
        hint: 'ما الذي يختلف في هذا الإصدار عمّا سبقه. يُقرأ لاحقًا لفهم سبب اختلاف نتائج إصدارين.',
      },
    },

    /**
     * Provenance of the *structure*.
     *
     * `sourceRetrievedAt` is the date New Era read the source, not the source's
     * own publication date — the schema says so and the hint repeats it, because
     * the two are routinely confused and only one of them is a fact we can
     * assert.
     */
    source: {
      title: 'مصدر البنية',
      description: 'من أين جاء وصف بنية الاختبار وتوقيته.',
      note: 'لا يُنقل إلى المنصة أي سؤال أو نص من مادة اختبار رسمية. المسجَّل هنا وصف البنية المعلنة فقط.',
      fields: {
        sourceLabel: {
          label: 'اسم المصدر',
          hint: 'الجهة أو المستند الذي وصف البنية، مثل: الدليل الإرشادي المعلن.',
        },
        sourceUrl: {
          label: 'رابط المصدر',
          hint: 'رابط عام يمكن الرجوع إليه، إن وُجد.',
        },
        sourceRetrievedAt: {
          label: 'تاريخ مراجعة المصدر',
          hint: 'التاريخ الذي راجعت فيه المنصة هذا المصدر، لا تاريخ نشر المصدر نفسه.',
        },
        sourceNote: {
          label: 'ملاحظة على المصدر',
          hint: 'ما لم يذكره المصدر صراحة وما اجتهدت فيه المنصة، حتى يكون الاجتهاد مقروءًا لاحقًا.',
        },
      },
    },

    empty: {
      nothingYetTitle: 'لا توجد إصدارات بعد',
      nothingYetBody: 'هذا المحاكي بلا إصدار. أنشئ إصدارًا وأضف أقسامه قبل أن يمكن اعتماده.',
      nothingYetAction: 'إضافة أول إصدار',
    },

    confirmDelete: {
      title: 'حذف هذا الإصدار؟',
      body: 'تُحذف معه أقسامه وقواعده. الحذف متاح للمسودات فقط، ولا يمكن التراجع بعد التأكيد.',
      confirm: 'نعم، احذف الإصدار',
    },

    toast: {
      created: 'أُضيف الإصدار كمسودة.',
      updated: 'حُفظت تعديلات الإصدار.',
      duplicated: 'أُنشئت نسخة مسودة من الإصدار.',
      deleted: 'حُذف الإصدار.',
      published: 'نُشر الإصدار.',
      retired: 'سُحب الإصدار من الخدمة.',
      activated: 'اعتُمد الإصدار للمحاولات الجديدة.',
      deactivated: 'أُلغي اعتماد الإصدار.',
    },
  },

  /** `ExamSection`: a timed block inside a version. */
  examSections: {
    title: 'أقسام الاختبار',
    description: 'كل قسم له مدته وعدد أسئلته وقواعد التنقل داخله.',
    createAction: 'قسم جديد',
    createTitle: 'إضافة قسم',
    editTitle: 'تعديل القسم',

    columns: {
      position: 'الترتيب',
      title: 'اسم القسم',
      duration: 'المدة',
      questionCount: 'عدد الأسئلة',
      rules: 'قواعد القسم',
      ruleCount: 'قواعد الاختيار',
      actions: 'إجراءات القسم',
    },

    fields: {
      title: {
        label: 'اسم القسم',
        hint: 'يظهر للطالب أعلى الشاشة أثناء المحاولة، ويُحفظ كنسخة ثابتة في كل محاولة.',
      },
      durationSec: {
        label: 'مدة القسم بالثواني',
        hint: 'العدّ من الخادم لا من المتصفح، ويستمر ولو أُغلقت الصفحة. عند انتهائها يُغلق القسم تلقائيًا.',
      },
      questionCount: {
        label: 'عدد أسئلة القسم',
        hint: 'العدد الذي يراه الطالب في هذا القسم. مع القواعد يجب أن تنتج القواعد هذا العدد بالضبط.',
      },
      calculatorEnabled: {
        label: 'إتاحة الآلة الحاسبة',
        hint: 'أداة داخل شاشة المحاولة. فعّلها للأقسام الكمية فقط.',
      },
      scratchpadEnabled: {
        label: 'إتاحة ورقة المسوّدة',
        hint: 'مساحة كتابة مؤقتة لا تُحفظ ولا تُصحَّح.',
      },
      allowReviewWithinSection: {
        label: 'السماح بالمراجعة داخل القسم',
        hint: 'يتيح للطالب التنقل بين أسئلة القسم الحالي وتعديل إجاباته ما دام مفتوحًا.',
      },
      lockOnAdvance: {
        label: 'إغلاق القسم عند الانتقال',
        hint: 'الانتقال نهائي: لا عودة إلى القسم ولا تعديل لإجاباته. إيقافه يجعل الاختبار أبعد عن ظروف الاختبار الحقيقي.',
      },
      pauseEnabled: {
        label: 'السماح بإيقاف الوقت مؤقتًا',
        hint: 'يوقف عدّ الوقت داخل القسم. غير مفعّل افتراضيًا لأنه لا وجود له في اختبار موقوت.',
      },
    },

    /** `SelectionMode.FIXED`: an explicit, ordered list of questions. */
    fixedQuestions: {
      title: 'أسئلة القسم المحددة',
      description:
        'قائمة ثابتة يراها كل طالب بالترتيب نفسه. تُثبَّت نسخة كل سؤال عند بدء المحاولة.',
      addAction: 'إضافة سؤال من البنك',
      removeAction: 'إزالة السؤال',
      columns: {
        position: 'الترتيب',
        stem: 'نص السؤال',
        domain: 'المهارة',
        difficulty: 'الصعوبة',
        questionVersion: 'نسخة السؤال',
        actions: 'إجراءات السؤال',
      },
      empty: {
        nothingYetTitle: 'لا توجد أسئلة محددة لهذا القسم',
        nothingYetBody: 'أضف الأسئلة من بنك الأسئلة المنشورة حتى يكتمل عدد أسئلة القسم.',
        nothingYetAction: 'إضافة سؤال من البنك',
      },
    },

    empty: {
      nothingYetTitle: 'لا توجد أقسام بعد',
      nothingYetBody: 'هذا الإصدار بلا أقسام. أضف قسمًا واحدًا على الأقل قبل النشر.',
      nothingYetAction: 'إضافة أول قسم',
    },

    confirmDelete: {
      title: 'حذف هذا القسم؟',
      body: 'تُحذف معه قواعد اختياره وقائمة أسئلته المحددة. لا يمكن التراجع بعد التأكيد.',
      confirm: 'نعم، احذف القسم',
    },

    toast: {
      created: 'أُضيف القسم.',
      updated: 'حُفظت تعديلات القسم.',
      deleted: 'حُذف القسم.',
      reordered: 'حُفظ ترتيب الأقسام.',
      questionAdded: 'أُضيف السؤال إلى القسم.',
      questionRemoved: 'أُزيل السؤال من القسم.',
    },
  },

  /**
   * `ExamBlueprintRule`: how a section is filled from the bank.
   *
   * `percentage` feeds a largest-remainder allocation across the section's
   * question count; `questionCount` is an explicit override. Saying which of the
   * two is in force matters, because a rule that sets both is ambiguous and the
   * server has to pick one.
   */
  blueprint: {
    title: 'قواعد اختيار الأسئلة',
    description:
      'تصف القواعد ما الذي يجب أن يحتويه القسم: أي مهارة، وأي مستوى صعوبة، وبأي نسبة. تُطبَّق عند بدء كل محاولة على الأسئلة المنشورة وقتها.',

    /**
     * What a section does now that the rules are stored and unapplied.
     *
     * Stated on the section itself, not only in the coverage panel: the editor
     * used to show a rule table here, and an empty space where a table was would
     * read as "nothing decides this section" — which is the one thing it is not.
     */
    bankDraw: {
      title: 'اختيار الأسئلة',
      description:
        'يسحب هذا القسم {count} من الأسئلة المنشورة في البنك عند بدء كل محاولة. تختلف الأسئلة بين محاولة وأخرى، ولا يتكرّر السؤال الواحد داخل المحاولة.',
      questionCountUnit: 'سؤالًا',
    },
    createAction: 'قاعدة جديدة',
    createTitle: 'إضافة قاعدة',
    editTitle: 'تعديل القاعدة',

    columns: {
      position: 'الترتيب',
      domain: 'المهارة',
      subskill: 'المهارة الفرعية',
      difficulty: 'الصعوبة',
      track: 'المسار',
      share: 'الحصة',
      available: 'المتاح في البنك',
      actions: 'إجراءات القاعدة',
    },

    fields: {
      domain: {
        label: 'المهارة',
        hint: 'المهارة التي تُسحب منها أسئلة هذه القاعدة.',
      },
      subskill: {
        label: 'المهارة الفرعية',
        hint: 'اختياري. يضيّق الاختيار داخل المهارة، ويجب أن يطابق التسمية المستخدمة في البنك حرفيًا.',
      },
      difficulty: {
        label: 'مستوى الصعوبة',
        hint: 'اتركه فارغًا لتشمل القاعدة كل المستويات.',
      },
      track: {
        label: 'المسار',
        hint: 'اتركه فارغًا ليأخذ مسار المحاكي. حدّده فقط عندما تختلف قاعدة بعينها عنه.',
      },
      percentage: {
        label: 'النسبة المئوية',
        hint: 'حصة القاعدة من عدد أسئلة القسم. تُوزَّع الكسور بطريقة أكبر الباقي حتى يكتمل العدد بلا زيادة ولا نقص.',
      },
      questionCount: {
        label: 'عدد أسئلة صريح',
        hint: 'يتجاوز النسبة لهذه القاعدة. استخدم النسبة أو العدد، لا كليهما في القاعدة الواحدة.',
      },
    },

    /**
     * Coverage check.
     *
     * Rules can be arithmetically valid and still impossible: a section asking
     * for twelve hard geometry questions when the bank has published four cannot
     * be generated, and the student would meet that failure at the moment they
     * press "ابدأ". The check is offered before publication for that reason.
     */
    coverage: {
      title: 'التحقق من التغطية',
      description: 'يقارن ما يحتاجه هذا الإصدار بما هو منشور فعلًا في البنك الآن.',
      runAction: 'تحقّق من التغطية',
      running: 'جارٍ التحقق…',
      requiredLabel: 'المطلوب',
      availableLabel: 'المتاح',
      /** The bank read as a whole, now that a section draws from all of it. */
      bankSizeLabel: 'المنشور في البنك',
      shortfallLabel: 'النقص',
      /** One row per section: what it will draw when a student starts. */
      sectionDrawLabel: 'يسحب',
      okTitle: 'التغطية كافية',
      okBody: 'يوجد في البنك ما يكفي من الأسئلة المنشورة لتوليد كل قسم في هذا الإصدار.',
      shortageTitle: 'التغطية غير كافية',
      shortageBody:
        'عدد الأسئلة المنشورة في البنك أقل ممّا يحتاجه هذا الإصدار. المحاولة ستفشل عند التوليد، فانشر أسئلة إضافية أو أنقص عدد أسئلة الأقسام.',
      /**
       * A `FIXED` version has no rules to satisfy — its questions are named one
       * by one. Saying so is better than showing an empty "كافية" panel, which
       * would read as a check that ran and passed.
       */
      notApplicableTitle: 'لا تنطبق على هذا الإصدار',
      notApplicableBody:
        'هذا الإصدار يعمل بقائمة أسئلة ثابتة، فلا قواعد اختيار تُقاس تغطيتها. المطلوب هنا أن يكتمل عدد أسئلة كل قسم.',
      /** Shown against a section whose rules cannot be turned into whole numbers. */
      allocationTitle: 'توزيع غير قابل للتطبيق',
    },

    empty: {
      nothingYetTitle: 'لا توجد قواعد لهذا القسم',
      nothingYetBody:
        'القسم يعمل بطريقة القواعد لكنه بلا قاعدة واحدة، فلا يمكن توليد أسئلته. أضف أول قاعدة.',
      nothingYetAction: 'إضافة أول قاعدة',
    },

    confirmDelete: {
      title: 'حذف هذه القاعدة؟',
      body: 'يتغيّر توزيع أسئلة القسم في المحاولات الجديدة. المحاولات السابقة لا تتأثر.',
      confirm: 'نعم، احذف القاعدة',
    },

    toast: {
      created: 'أُضيفت القاعدة.',
      updated: 'حُفظت تعديلات القاعدة.',
      deleted: 'حُذفت القاعدة.',
      reordered: 'حُفظ ترتيب القواعد.',
    },
  },

  reorder: {
    label: 'الترتيب',
    moveUp: 'تحريك للأعلى',
    moveDown: 'تحريك للأسفل',
    hint: 'يُحفظ الترتيب فور تغييره.',
    saving: 'جارٍ حفظ الترتيب…',
    failed: 'تعذّر حفظ الترتيب، ولم يتغيّر شيء.',
  },

  /** `ExamVersionStatus`. */
  statusLabels: {
    DRAFT: 'مسودة',
    PUBLISHED: 'منشور',
    RETIRED: 'مسحوب من الخدمة',
  },

  /**
   * `SelectionMode`.
   *
   * `BLUEPRINT` used to read «قواعد اختيار». It draws a section's question count
   * from the whole published bank now — the rules are stored and unapplied — so
   * the label says what happens rather than what the column is called.
   */
  selectionModeLabels: {
    FIXED: 'قائمة أسئلة ثابتة',
    BLUEPRINT: 'سحب من البنك',
  },

  /**
   * `QuestionTrack`.
   *
   * Restated from `COPY.statusLabels.questionTrack` word for word: `copy.ts`
   * composes this module, so importing `COPY` back would close a cycle. If either
   * side is reworded, reword both.
   */
  trackLabels: {
    SCIENTIFIC: 'المسار العلمي',
    THEORETICAL: 'المسار النظري',
    BOTH: 'المساران',
    CUSTOM: 'مسار مخصص',
  },

  /**
   * The separator between items joined into one line — the modes column, the
   * shortfall sentence a refused publication carries.
   *
   * It lives here rather than as a literal in the components for the same reason
   * every other displayed character does: it is Arabic punctuation, `،` is not
   * `,`, and a screen that mixed the two would read as two different documents.
   */

  /** Shown where a version is flagged as the simulator's active one. */
  activeLabels: {
    active: 'الإصدار المعتمد',
    inactive: 'غير معتمد',
  },

  /**
   * Version transitions.
   *
   * Publication and activation are separate, and each confirmation says what the
   * *other* one still has to happen. Retiring is described in terms of running
   * attempts, because that is the fear the button raises.
   */
  transitions: {
    publish: 'نشر الإصدار',
    publishConfirmTitle: 'نشر هذا الإصدار؟',
    publishConfirmBody:
      'يصبح الإصدار جاهزًا للاعتماد وتُجمَّد بنيته: لا تُعدَّل أقسامه ولا قواعده بعد النشر. لن تُولَّد منه محاولات حتى تعتمده صراحة.',
    publishConfirmAction: 'نعم، انشر',

    retire: 'سحب من الخدمة',
    retireConfirmTitle: 'سحب هذا الإصدار من الخدمة؟',
    retireConfirmBody:
      'لن تُولَّد منه محاولات جديدة. المحاولات الجارية تكمل عليه، والمسلَّمة تحتفظ بنتائجها ونسخها كما هي.',
    retireConfirmAction: 'نعم، اسحبه',

    activate: 'اعتماد للمحاولات الجديدة',
    activateConfirmTitle: 'اعتماد هذا الإصدار؟',
    activateConfirmBody:
      'كل محاولة جديدة على هذا المحاكي ستُولَّد من هذا الإصدار. المحاولات الجارية تكمل على إصدارها الحالي ولا تنتقل.',
    activateConfirmAction: 'نعم، اعتمده',

    deactivate: 'إلغاء الاعتماد',
    deactivateConfirmTitle: 'إلغاء اعتماد هذا الإصدار؟',
    deactivateConfirmBody:
      'يبقى المحاكي بلا إصدار معتمد، فلا يستطيع أي طالب بدء محاولة جديدة عليه حتى تعتمد إصدارًا آخر.',
    deactivateConfirmAction: 'نعم، ألغِ الاعتماد',
  },

  errors: {
    simulatorNotFound: 'هذا المحاكي غير موجود.',
    versionNotFound: 'هذا الإصدار غير موجود.',
    sectionNotFound: 'هذا القسم غير موجود.',
    ruleNotFound: 'هذه القاعدة غير موجودة.',
    productNotSimulator: 'هذا المنتج ليس محاكي اختبار، فلا إعداد اختبار له.',
    simulatorRequiresProduct:
      'لا يُنشأ المحاكي بذاته. أنشئ منتجًا من نوع «محاكي اختبار» وسيُنشأ إعداده معه.',

    versionImmutableAfterPublish:
      'لا يمكن تعديل بنية إصدار منشور، لأن المحاولات تُولَّد منه. أنشئ نسخة مسودة جديدة وعدّلها ثم انشرها.',
    versionDeleteBlockedByStatus: 'لا يمكن حذف إصدار منشور أو مسحوب. الحذف متاح للمسودات فقط.',
    versionDeleteBlockedByAttempts:
      'لا يمكن حذف إصدار جرت عليه محاولات. اسحبه من الخدمة بدلًا من ذلك، حتى تبقى نتائج تلك المحاولات مقروءة.',
    versionDeleteBlockedByActive: 'لا يمكن حذف الإصدار المعتمد. اعتمد إصدارًا آخر أولًا.',
    versionNumberConflict:
      'أُنشئ إصدار بالرقم نفسه في اللحظة ذاتها، فلم يُنشأ إصدارك. حدّث الصفحة ثم أعد المحاولة.',

    disclaimerRequiredToPublish:
      'لا يمكن النشر قبل كتابة إشعار النتيجة، فهو ما يظهر للطالب مع نتيجته.',
    sectionsRequiredToPublish: 'لا يمكن نشر إصدار بلا أقسام. أضف قسمًا واحدًا على الأقل.',
    rulesRequiredToPublish:
      'قسم يعمل بطريقة القواعد وليس له قاعدة واحدة لا يمكن توليد أسئلته. أضف قواعده أو حوّله إلى قائمة ثابتة.',
    fixedQuestionsRequiredToPublish:
      'قسم يعمل بقائمة ثابتة يجب أن يحتوي على عدد الأسئلة المعلن له بالضبط.',
    fixedQuestionsNotPublished:
      'بعض أسئلة القائمة الثابتة لم تعد منشورة في البنك، فلا يمكن توليد الاختبار منها. أزلها واستبدلها بأسئلة منشورة قبل النشر.',
    fixedQuestionsDuplicatedAcrossSections:
      'سؤال واحد مضاف إلى أكثر من قسم في هذا الإصدار، فسيظهر للطالب مرتين. أبقِه في قسم واحد.',
    questionCountMismatch:
      'إجمالي عدد أسئلة الإصدار لا يساوي مجموع أعداد أسئلة أقسامه. صحّح أحدهما ثم أعد المحاولة.',
    durationMismatch: 'المدة الإجمالية للإصدار لا تساوي مجموع مدد أقسامه.',
    percentageSumInvalid: 'مجموع نسب قواعد القسم يجب ألا يتجاوز ١٠٠٪.',
    ruleNeedsShare: 'حدّد للقاعدة نسبة مئوية أو عدد أسئلة صريحًا.',
    ruleShareConflict: 'لا يمكن تحديد نسبة وعدد أسئلة للقاعدة نفسها. اختر أحدهما.',
    ruleAllocationMismatch:
      'قواعد القسم لا تنتج عدد أسئلته المعلن. عدّل النسب أو الأعداد حتى يتطابقا.',
    questionShortage:
      'لا توجد أسئلة منشورة كافية لتلبية قواعد هذا القسم. انشر أسئلة إضافية في البنك أو خفّف القواعد قبل النشر.',

    /**
     * A move the version's current state does not allow — retiring a draft,
     * publishing something already published. Worded as "من حالته الحالية" so it
     * covers every such pair without pretending to name the one that was tried.
     */
    invalidTransition:
      'لا يمكن تنفيذ هذا الإجراء على الإصدار في حالته الحالية. حدّث الصفحة ثم أعد المحاولة.',
    /**
     * A reorder whose list no longer describes what the server holds — a row
     * was added or removed in another tab while this one was being dragged.
     * Refused whole rather than applied partially, because a partly-applied
     * order is an order nobody chose.
     */
    reorderStale: 'تغيّرت العناصر منذ فتح الصفحة، فلم يُحفظ الترتيب. حدّث الصفحة ثم رتّب من جديد.',
    fixedQuestionsExceedCount:
      'عدد الأسئلة المضافة إلى القسم بلغ العدد المعلن له. ارفع عدد أسئلة القسم أو أزل سؤالًا قبل الإضافة.',
    ruleCountExceedsSection:
      'العدد المحدد لهذه القاعدة أكبر من عدد أسئلة القسم، فلا يمكن أن تتحقق.',

    activateRequiresPublished: 'لا يُعتمد إلا إصدار منشور. انشر الإصدار أولًا ثم اعتمده.',
    retireBlockedByActive:
      'لا يمكن سحب الإصدار المعتمد من الخدمة. اعتمد إصدارًا آخر أو ألغِ الاعتماد أولًا.',
    modesAllDisabled:
      'لا يمكن إيقاف المحاكاة الكاملة ووضع التدريب معًا، فلن يبقى للطالب ما يفتحه في هذا المحاكي.',
    trackImmutableAfterAttempts: 'لا يمكن تغيير مسار محاكٍ جرت عليه محاولات.',
    /**
     * The published version was checked against the *current* track: every rule
     * that لم تحدد مسارًا لنفسها ترث مسار المحاكي. Narrowing it afterwards would
     * leave a version marked منشور ومعتمد while its أسئلة no longer suffice.
     */
    trackFrozenWhileActive:
      'لا يمكن تغيير مسار محاكٍ له إصدار معتمد، لأن قواعد ذلك الإصدار فُحصت على المسار الحالي. ألغِ اعتماد الإصدار أولًا، ثم غيّر المسار، ثم أعد فحص التغطية قبل اعتماده من جديد.',
    positionConflict: 'يوجد عنصر آخر في هذا الترتيب. أعد تحميل الصفحة ثم رتّب من جديد.',
    durationInvalid: 'المدة يجب أن تكون عددًا موجبًا من الثواني.',
    questionNotPublished: 'لا يمكن إضافة سؤال غير منشور إلى قسم اختبار.',
    questionDuplicate: 'هذا السؤال مضاف بالفعل إلى هذا القسم.',
    questionNotInSection: 'هذا السؤال ليس ضمن أسئلة هذا القسم. حدّث الصفحة ثم أعد المحاولة.',
    questionTrackMismatch: 'هذا السؤال لا يصلح لمسار هذا المحاكي.',
    videoAssetNotFound: 'المقطع التعريفي المحدد غير موجود.',
  },

  notices: {
    publishedIsFrozen:
      'هذا الإصدار منشور، فبنيته مجمّدة. لتغيير الأقسام أو القواعد أنشئ نسخة مسودة منه وانشرها بعد تعديلها.',
    activeVersionNote: 'المحاولات الجديدة تُولَّد من الإصدار المعتمد وحده.',
    noActiveVersionNote:
      'لا يوجد إصدار معتمد لهذا المحاكي، فلا يستطيع أي طالب بدء محاولة عليه الآن.',
    attemptsUseSnapshots:
      'كل محاولة تحتفظ بنسخة ثابتة من الأقسام والأسئلة كما وُلِّدت لها، فلا يغيّر تعديلٌ لاحق نتيجة محاولة سابقة.',
    disclaimerIsLegal:
      'إشعار النتيجة التزام محدَّد: النتيجة تدريبية، وليست درجة رسمية ولا تنبؤًا بها.',
  },

  empty: {
    nothingYetTitle: 'لا توجد محاكيات بعد',
    nothingYetBody:
      'لم يُنشأ أي منتج من نوع محاكي اختبار حتى الآن. أنشئ المنتج أولًا ثم اضبط إعداده هنا.',
    nothingYetAction: 'إضافة منتج محاكٍ',
  },
} as const;
