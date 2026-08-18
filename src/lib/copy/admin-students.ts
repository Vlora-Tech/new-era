/**
 * Student accounts: the searchable list, one account's record, and the three
 * things an administrator may do to a live account.
 *
 * Composed into `COPY.adminStudents` by `src/lib/copy.ts`.
 *
 * The wording is constrained by what this screen deliberately cannot do:
 *
 *  - **No password anything.** There is no reset, no reveal, no "send a new
 *    password". `passwordHash` never leaves the database row, and the interface
 *    says so rather than leaving an administrator hunting for the control.
 *  - **Blocking is not deleting.** A blocked account keeps its orders, its
 *    entitlements and its attempts; it simply cannot sign in. Every prompt says
 *    which of those two happened, because "أوقف الحساب" is otherwise read as
 *    "أزل الطالب".
 *  - **Forcing sign-out is a session lever, not a punishment.** It bumps
 *    `sessionVersion`, which invalidates every existing session on every device.
 *    Blocking bumps it too; the copy says so, so nobody does both expecting a
 *    different result from the second.
 */
export const ADMIN_STUDENTS_COPY = {
  listTitle: 'الطلاب',
  listDescription: 'حسابات الطلاب: البحث فيها، والاطلاع على سجل كل حساب، وإيقافه أو إعادة تفعيله.',

  detailTitle: 'حساب الطالب',
  detailDescription: 'بيانات الحساب وما يملكه من وصول، وطلباته ومحاولاته وموافقاته.',
  backToList: 'العودة إلى الطلاب',

  columns: {
    name: 'الاسم',
    email: 'البريد الإلكتروني',
    phone: 'رقم الجوال',
    role: 'الدور',
    state: 'حالة الحساب',
    entitlementCount: 'المنتجات المتاحة',
    orderCount: 'الطلبات',
    attemptCount: 'المحاولات',
    createdAt: 'تاريخ التسجيل',
    lastActivityAt: 'آخر نشاط',
    actions: 'إجراءات الحساب',
  },

  filters: {
    role: 'الدور',
    state: 'حالة الحساب',
    hasEntitlements: 'من يملك منتجًا واحدًا على الأقل',
    registeredFrom: 'مسجَّل من تاريخ',
    registeredTo: 'مسجَّل حتى تاريخ',
    searchPlaceholder: 'ابحث بالاسم أو البريد الإلكتروني أو رقم الجوال…',
    searchNote: 'يطابق البحث بداية البريد أو الاسم كاملًا أو جزءًا منه، دون حساسية لحالة الأحرف.',
  },

  /** Headings for the record view. */
  sections: {
    account: 'بيانات الحساب',
    access: 'الوصول إلى المنتجات',
    orders: 'الطلبات',
    attempts: 'محاولات الاختبار',
    consents: 'الموافقات المسجّلة',
    activity: 'الإجراءات الإدارية على هذا الحساب',
  },

  /**
   * Read-only fields, all of them.
   *
   * Editing a student's own details is not offered: the address is the sign-in
   * identifier and changing it under someone is an account takeover with extra
   * steps. The note says as much instead of showing a disabled input.
   */
  fields: {
    name: { label: 'الاسم الكامل', hint: 'كما سجّله الطالب عند إنشاء الحساب.' },
    email: {
      label: 'البريد الإلكتروني',
      hint: 'معرّف تسجيل الدخول. مخزَّن بحروف صغيرة، ولا يتكرر بين حسابين.',
    },
    phone: { label: 'رقم الجوال', hint: 'اختياري، ولا يُستخدم في تسجيل الدخول.' },
    role: {
      label: 'الدور',
      hint: 'الدور يقرّر الوصول إلى لوحة التحكم. لا يُمنح دور المدير من هذه الشاشة.',
    },
    state: { label: 'حالة الحساب', hint: 'الحساب الموقوف لا يستطيع تسجيل الدخول.' },
    createdAt: { label: 'تاريخ التسجيل', hint: '' },
    updatedAt: { label: 'آخر تحديث للحساب', hint: '' },
    blockedAt: { label: 'تاريخ الإيقاف', hint: '' },
    blockedReason: {
      label: 'سبب الإيقاف',
      hint: 'يُحفظ للسجل الإداري. لا يظهر للطالب في أي شاشة.',
    },
    sessionVersion: {
      label: 'رقم إصدار الجلسة',
      hint: 'يزيد عند الإيقاف أو عند إنهاء الجلسات، فتصبح كل الجلسات القائمة غير صالحة.',
    },
  },

  notProvided: 'لم يُضف',

  /** `UserRole`. */
  roleLabels: {
    STUDENT: 'طالب',
    ADMIN: 'مدير',
  },

  /**
   * Account state.
   *
   * Derived from `isBlocked`, not an enum in the schema. Kept here as a pair so
   * the list filter, the badge and the detail row cannot word it three ways.
   */
  stateLabels: {
    active: 'نشط',
    blocked: 'موقوف',
  },

  block: {
    action: 'إيقاف الحساب',
    confirmTitle: 'إيقاف هذا الحساب؟',
    confirmBody:
      'لن يتمكن صاحب الحساب من تسجيل الدخول، وستُنهى جلساته المفتوحة على كل الأجهزة فورًا. طلباته وصلاحياته ومحاولاته تبقى محفوظة كما هي، ولا يُسترد أي مبلغ.',
    confirmAction: 'نعم، أوقف الحساب',
    reason: {
      label: 'سبب الإيقاف',
      hint: 'مطلوب. يُحفظ في سجل النشاط باسمك وتاريخه، ولا يظهر للطالب.',
      placeholder: 'اكتب سببًا واضحًا يمكن الرجوع إليه لاحقًا…',
    },
  },

  unblock: {
    action: 'إعادة تفعيل الحساب',
    confirmTitle: 'إعادة تفعيل هذا الحساب؟',
    confirmBody:
      'يعود صاحب الحساب قادرًا على تسجيل الدخول والوصول إلى ما يملكه. لا تُستعاد الجلسات القديمة، فسيحتاج إلى تسجيل دخول جديد.',
    confirmAction: 'نعم، أعد التفعيل',
  },

  forceSignOut: {
    action: 'إنهاء كل الجلسات',
    confirmTitle: 'إنهاء كل جلسات هذا الحساب؟',
    confirmBody:
      'تُغلق كل الجلسات المفتوحة على كل الأجهزة، ويحتاج صاحب الحساب إلى تسجيل الدخول من جديد. الحساب يبقى نشطًا ولا يتأثر أي شيء آخر.',
    confirmAction: 'نعم، أنهِ الجلسات',
    hint: 'استخدمه عند الاشتباه في مشاركة الحساب أو في وصول غير مصرّح به إلى جهاز.',
  },

  /** Related-record tables inside the account view. */
  related: {
    access: {
      title: 'الوصول إلى المنتجات',
      description: 'ما يملك هذا الحساب حق فتحه الآن، ومن أين جاء ذلك الوصول.',
      columns: {
        product: 'المنتج',
        status: 'الحالة',
        grantedAt: 'تاريخ المنح',
        revokedAt: 'تاريخ السحب',
        sourceOrder: 'الطلب المصدر',
      },
      manageAction: 'إدارة الصلاحيات',
      empty: {
        nothingYetTitle: 'لا يملك هذا الحساب أي منتج',
        nothingYetBody: 'لم يُمنح هذا الحساب وصولًا إلى أي منتج، سواء بشراء أو بمنح إداري.',
      },
    },
    orders: {
      title: 'الطلبات',
      description: 'كل عمليات الشراء لهذا الحساب بمبالغها وحالتها.',
      columns: {
        reference: 'رقم الطلب',
        product: 'المنتج',
        amount: 'المبلغ',
        status: 'الحالة',
        createdAt: 'تاريخ الطلب',
      },
      viewAllAction: 'عرض كل طلبات هذا الحساب',
      empty: {
        nothingYetTitle: 'لا توجد طلبات',
        nothingYetBody: 'لم يُنشئ هذا الحساب أي طلب شراء.',
      },
    },
    attempts: {
      title: 'محاولات الاختبار',
      description: 'محاولات المحاكي لهذا الحساب ونتائجها التدريبية.',
      columns: {
        simulator: 'المحاكي',
        mode: 'النمط',
        status: 'الحالة',
        startedAt: 'تاريخ البدء',
        submittedAt: 'تاريخ التسليم',
        correct: 'إجابات صحيحة',
      },
      viewAllAction: 'عرض كل محاولات هذا الحساب',
      empty: {
        nothingYetTitle: 'لا توجد محاولات',
        nothingYetBody: 'لم يبدأ هذا الحساب أي محاولة اختبار.',
      },
    },
    consents: {
      title: 'الموافقات المسجّلة',
      description:
        'نسخة الشروط وسياسة الخصوصية التي وافق عليها الحساب وتاريخ الموافقة. سجل غير قابل للتعديل.',
      columns: {
        acceptedAt: 'تاريخ الموافقة',
        termsVersion: 'نسخة الشروط',
        privacyVersion: 'نسخة سياسة الخصوصية',
      },
      empty: {
        nothingYetTitle: 'لا توجد موافقات مسجّلة',
        nothingYetBody: 'لم تُسجَّل لهذا الحساب أي موافقة على المستندات النظامية.',
      },
    },
    activity: {
      title: 'الإجراءات الإدارية على هذا الحساب',
      description: 'ما فعله المديرون بهذا الحساب، من سجل النشاط.',
      viewAllAction: 'عرض في سجل النشاط',
      empty: {
        nothingYetTitle: 'لا توجد إجراءات إدارية',
        nothingYetBody: 'لم يُنفَّذ على هذا الحساب أي إجراء إداري مسجَّل.',
      },
    },
  },

  errors: {
    notFound: 'هذا الحساب غير موجود.',
    reasonRequired: 'سبب الإيقاف مطلوب، ويُحفظ في سجل النشاط.',
    alreadyBlocked: 'هذا الحساب موقوف بالفعل.',
    notBlocked: 'هذا الحساب غير موقوف، فلا شيء لإعادة تفعيله.',
    // A locked-out administrator cannot unlock themselves, and the platform
    // could be left with no usable admin at all.
    cannotBlockSelf: 'لا يمكنك إيقاف حسابك أنت.',
    cannotBlockAdmin:
      'لا يمكن إيقاف حساب مدير من هذه الشاشة. غيّر دوره أولًا بأداة الإدارة في الخادم.',
    cannotSignOutSelf: 'لا يمكنك إنهاء جلساتك أنت من هنا. استخدم تسجيل الخروج.',
    roleChangeUnavailable:
      'تغيير الأدوار غير متاح من لوحة التحكم. يُمنح دور المدير بأداة الإدارة في الخادم فقط.',
    deleteUnavailable:
      'لا تُحذف حسابات الطلاب من هنا. الحساب مرتبط بطلبات وموافقات ومحاولات يجب أن تبقى مقروءة؛ أوقفه بدلًا من ذلك.',
    passwordUnavailable:
      'لا يمكن الاطلاع على كلمة المرور ولا تغييرها من هنا. كلمات المرور مخزَّنة مجزَّأة ولا يمكن استرجاعها.',
  },

  notices: {
    readOnlyAccount:
      'بيانات الحساب هنا للاطلاع فقط. البريد الإلكتروني معرّف تسجيل الدخول، ولا يُغيَّر نيابة عن صاحبه.',
    noPasswordTools:
      'لا توجد أدوات لكلمة المرور في هذه الشاشة: لا عرض ولا تغيير ولا إعادة تعيين. كلمات المرور مخزَّنة مجزَّأة.',
    blockingIsReversible: 'الإيقاف قابل للتراجع في أي وقت، ولا يحذف شيئًا من سجل الحساب.',
    blockingIsNotRefund: 'إيقاف الحساب لا يسترد أي مبلغ ولا يسحب أي صلاحية وصول.',
    auditedAction: 'يُسجَّل كل إجراء على هذا الحساب في سجل النشاط باسم منفّذه وتاريخه.',
  },

  toast: {
    blocked: 'أُوقف الحساب وأُنهيت جلساته.',
    unblocked: 'أُعيد تفعيل الحساب.',
    signedOut: 'أُنهيت كل جلسات هذا الحساب.',
    blockFailed: 'تعذّر إيقاف الحساب، ولم يتغيّر شيء.',
    unblockFailed: 'تعذّرت إعادة التفعيل، ولم يتغيّر شيء.',
    signOutFailed: 'تعذّر إنهاء الجلسات، ولم يتغيّر شيء.',
  },

  empty: {
    nothingYetTitle: 'لا توجد حسابات بعد',
    nothingYetBody: 'لم يُسجَّل أي طالب في المنصة حتى الآن.',
  },
} as const;
