/**
 * Entitlements: who may open what, and the append-only history of how that
 * changed.
 *
 * Composed into `COPY.adminEntitlements` by `src/lib/copy.ts`.
 *
 * The screen shows two tables that must never be described in the same words.
 * `Entitlement` is the *current* state — one row per student and product — and
 * `EntitlementEvent` is the record of every transition, which nothing rewrites.
 * A refund followed by a repurchase must leave both facts visible; wording that
 * treats the history as a mirror of the current row is how somebody comes to
 * believe access was never withdrawn.
 *
 * The other constant here is that access and money are separate levers. Granting
 * access does not create an order and does not take payment; revoking it does not
 * refund anything. Both facts are stated at the moment of the action, because
 * both are the assumption an administrator brings to the button.
 */
export const ADMIN_ENTITLEMENTS_COPY = {
  listTitle: 'الصلاحيات والوصول',
  listDescription: 'صلاحيات الوصول إلى المنتجات: المنح والسحب وسجل التغييرات الكامل.',

  detailTitle: 'صلاحية وصول',
  detailDescription: 'حالة الوصول الحالية لهذا الطالب إلى هذا المنتج، وسجل تغيّرها.',
  backToList: 'العودة إلى الصلاحيات',

  columns: {
    student: 'الطالب',
    email: 'البريد الإلكتروني',
    product: 'المنتج',
    productType: 'نوع المنتج',
    status: 'حالة الوصول',
    grantedAt: 'تاريخ المنح',
    revokedAt: 'تاريخ السحب',
    sourceOrder: 'الطلب المصدر',
    lastEvent: 'آخر تغيير',
    actions: 'إجراءات الصلاحية',
  },

  filters: {
    status: 'حالة الوصول',
    product: 'المنتج',
    productType: 'نوع المنتج',
    source: 'مصدر الوصول',
    from: 'من تاريخ',
    to: 'حتى تاريخ',
    searchPlaceholder: 'ابحث ببريد الطالب أو اسمه أو اسم المنتج…',
  },

  /** Headings for the record view. */
  sections: {
    summary: 'الوصول الحالي',
    history: 'سجل التغييرات',
    order: 'الطلب المصدر',
  },

  fields: {
    student: { label: 'الطالب', hint: 'صاحب الوصول. لا يُنقل وصول من حساب إلى آخر.' },
    product: { label: 'المنتج', hint: 'المنتج الذي يُفتح لهذا الطالب.' },
    status: {
      label: 'حالة الوصول',
      hint: 'صف حالي واحد لكل طالب ومنتج. التاريخ الكامل في سجل التغييرات أدناه.',
    },
    grantedAt: { label: 'تاريخ المنح', hint: 'أول مرة فُتح فيها هذا المنتج لهذا الطالب.' },
    revokedAt: { label: 'تاريخ السحب', hint: 'آخر مرة سُحب فيها الوصول، إن سُحب.' },
    sourceOrder: {
      label: 'الطلب المصدر',
      hint: 'الطلب الذي أنتج هذا الوصول آخر مرة. يبقى فارغًا في المنح الإداري.',
    },
    reason: {
      label: 'السبب',
      hint: 'مطلوب في كل إجراء إداري. يُحفظ مع الحدث في السجل ولا يظهر للطالب.',
    },
  },

  /**
   * `EntitlementStatus`.
   *
   * Worded from the student's side — "الوصول متاح" rather than "نشط" — and
   * identical to `COPY.statusLabels.entitlementStatus`, which the dashboard uses.
   * Restated rather than imported: `copy.ts` composes this module, so reaching
   * back into `COPY` would close a cycle. If one side is reworded, reword both.
   */
  statusLabels: {
    ACTIVE: 'الوصول متاح',
    REVOKED: 'الوصول ملغى',
  },

  /** `EntitlementEventType`: the three transitions the history records. */
  eventTypeLabels: {
    GRANTED: 'مُنح الوصول',
    REVOKED: 'سُحب الوصول',
    REACTIVATED: 'أُعيد الوصول',
  },

  /** Where a transition came from, derived from the event's order and actor. */
  sourceLabels: {
    order: 'شراء',
    admin: 'منح إداري',
    system: 'إجراء تلقائي',
  },
  sourceHints: {
    order: 'نتج عن طلب مدفوع تحقّق منه الخادم لدى مزوّد الدفع.',
    admin: 'نفّذه مدير من لوحة التحكم، وسببه مسجَّل مع الحدث.',
    system: 'نفّذته المنصة تلقائيًا، كسحب الوصول بعد استرداد مؤكَّد.',
  },

  grant: {
    action: 'منح وصول',
    title: 'منح وصول إلى منتج',
    description: 'يفتح المنتج لهذا الطالب فورًا دون إنشاء طلب ودون تحصيل أي مبلغ.',
    fields: {
      student: {
        label: 'الطالب',
        hint: 'ابحث بالبريد الإلكتروني. الحساب الموقوف يمكن منحه وصولًا، لكنه لن يستطيع تسجيل الدخول لاستخدامه.',
      },
      product: {
        label: 'المنتج',
        hint: 'يمكن منح الوصول إلى منتج مسودة أو مؤرشف؛ سيفتحه الطالب رغم أنه غير معروض للبيع.',
      },
      reason: {
        label: 'سبب المنح',
        hint: 'مطلوب. يُحفظ في سجل التغييرات وفي سجل النشاط باسمك وتاريخه.',
        placeholder: 'مثال: تعويض عن عطل في المقاطع بتاريخ كذا…',
      },
    },
    confirmTitle: 'منح هذا الوصول؟',
    confirmBody:
      'سيفتح المنتج لهذا الطالب فورًا. لا يُنشأ أي طلب ولا يُحصَّل أي مبلغ، ولن يظهر هذا الوصول في سجل مشترياته.',
    confirmAction: 'نعم، امنح الوصول',
    alreadyActiveNote: 'هذا الطالب يملك وصولًا فعّالًا إلى هذا المنتج بالفعل.',
  },

  revoke: {
    action: 'سحب الوصول',
    title: 'سحب الوصول إلى منتج',
    description: 'يغلق المنتج عن الطالب فورًا. لا يسترد أي مبلغ ولا يلغي أي طلب.',
    fields: {
      reason: {
        label: 'سبب السحب',
        hint: 'مطلوب. يُحفظ في سجل التغييرات وفي سجل النشاط.',
        placeholder: 'مثال: استرداد كامل مؤكَّد من مزوّد الدفع…',
      },
    },
    confirmTitle: 'سحب هذا الوصول؟',
    confirmBody:
      'لن يستطيع الطالب فتح المنتج بعد الآن. المبالغ لا تتأثر: السحب لا يسترد شيئًا. محاولاته السابقة ونتائجها وتقدّمه في الدروس تبقى محفوظة.',
    confirmAction: 'نعم، اسحب الوصول',
    activeAttemptWarning:
      'لهذا الطالب محاولة اختبار جارية على هذا المنتج. سحب الوصول الآن يمنعه من إكمالها والوقت مستمر.',
  },

  reactivate: {
    action: 'إعادة الوصول',
    title: 'إعادة وصول مسحوب',
    description: 'يعيد فتح المنتج لهذا الطالب.',
    fields: {
      reason: {
        label: 'سبب الإعادة',
        hint: 'مطلوب. يُحفظ في سجل التغييرات وفي سجل النشاط.',
      },
    },
    confirmTitle: 'إعادة هذا الوصول؟',
    confirmBody:
      'يعود المنتج مفتوحًا للطالب فورًا. لا يُنشأ طلب ولا يُحصَّل مبلغ، ويبقى سحب الوصول السابق مسجَّلًا في السجل.',
    confirmAction: 'نعم، أعد الوصول',
  },

  /** `EntitlementEvent`: append-only, and described as such. */
  history: {
    title: 'سجل التغييرات',
    description: 'كل تغيّر في الوصول مسجَّل هنا بترتيبه الزمني.',
    columns: {
      createdAt: 'التاريخ',
      type: 'التغيير',
      reason: 'السبب',
      order: 'الطلب',
      actor: 'المنفّذ',
      source: 'المصدر',
    },
    systemActor: 'المنصة',
    noReason: 'لا يوجد سبب مسجَّل',
    empty: {
      nothingYetTitle: 'لا توجد أحداث',
      nothingYetBody: 'لم يُسجَّل أي تغيّر على هذا الوصول بعد.',
    },
  },

  errors: {
    notFound: 'صلاحية الوصول هذه غير موجودة.',
    userNotFound: 'هذا الحساب غير موجود.',
    productNotFound: 'هذا المنتج غير موجود.',
    reasonRequired: 'السبب مطلوب في كل إجراء إداري على الصلاحيات.',
    alreadyActive: 'هذا الطالب يملك وصولًا فعّالًا إلى هذا المنتج، فلا شيء لمنحه.',
    alreadyRevoked: 'هذا الوصول مسحوب بالفعل.',
    noEntitlement: 'لا توجد صلاحية وصول لهذا الطالب على هذا المنتج.',
    cannotGrantToAdmin: 'حسابات المديرين تصل إلى المحتوى بدورها، فلا معنى لمنحها صلاحية شراء.',
    deleteUnavailable:
      'لا تُحذف صلاحيات الوصول. السجل يجب أن يبقى مقروءًا؛ اسحب الوصول بدلًا من ذلك.',
    editUnavailable: 'لا تُعدَّل تواريخ المنح والسحب يدويًا، فهي وقائع مسجَّلة لا حقول نموذج.',
    historyImmutable: 'سجل التغييرات لا يُعدَّل ولا يُحذف منه.',
  },

  notices: {
    accessIsNotMoney:
      'منح الوصول لا ينشئ طلبًا ولا يحصّل مبلغًا، وسحبه لا يسترد شيئًا. الأمران منفصلان عمدًا.',
    historyIsAppendOnly:
      'سجل التغييرات يُضاف إليه فقط. لا يُصحَّح خطأ بحذف حدث، بل بإجراء جديد يُسجَّل بدوره.',
    refundRevokesAutomatically:
      'الاسترداد الكامل المؤكَّد يسحب الوصول تلقائيًا. لا حاجة إلى سحبه يدويًا بعده.',
    revokeKeepsProgress:
      'سحب الوصول لا يحذف تقدّم الطالب ولا محاولاته. إن أُعيد الوصول لاحقًا يجد كل شيء كما تركه.',
    auditedAction:
      'يُسجَّل كل إجراء هنا في سجل النشاط باسم منفّذه وتاريخه، إضافةً إلى سجل الصلاحية.',
  },

  toast: {
    granted: 'مُنح الوصول، وأصبح المنتج مفتوحًا للطالب.',
    grantFailed: 'تعذّر منح الوصول، ولم يتغيّر شيء.',
    grantUnchanged: 'هذا الوصول ممنوح بالفعل، ولم يتغيّر شيء.',
    revoked: 'سُحب الوصول.',
    revokeFailed: 'تعذّر سحب الوصول، ولم يتغيّر شيء.',
    revokeUnchanged: 'هذا الوصول مسحوب بالفعل، ولم يتغيّر شيء.',
    reactivated: 'أُعيد الوصول.',
    reactivateFailed: 'تعذّرت إعادة الوصول، ولم يتغيّر شيء.',
  },

  empty: {
    nothingYetTitle: 'لا توجد صلاحيات وصول بعد',
    nothingYetBody: 'لم يُمنح أي طالب وصولًا إلى منتج، لا بشراء ولا بمنح إداري.',
    nothingYetAction: 'منح وصول',
  },
} as const;
