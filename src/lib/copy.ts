/**
 * Central Arabic copy bank.
 *
 * One source of truth so wording cannot drift between a page, a toast and an
 * email. Every string the customer or an administrator can see belongs here or
 * in a validator's message; nothing user-facing should be typed inline in a
 * component.
 *
 * Source code identifiers, route segments and database names stay English.
 */
export const BRAND = {
  name: 'نيو إيرا',
  fullName: 'بناء العهد الجديد',
  tagline: 'استعد لاختبار القدرات بثقة',
} as const;

/**
 * Shown on the simulator detail page, before any full attempt, and on results.
 * Wording is fixed: it is the product's independence statement.
 */
export const INDEPENDENCE_DISCLAIMER =
  'منصة نيو إيرا منصة تدريبية مستقلة، وليست تابعة لهيئة تقويم التعليم والتدريب أو للمركز الوطني للقياس، ولا تمثل نتائجها نتيجة رسمية أو ضمانًا لدرجة الاختبار.';

export const COPY = {
  common: {
    error: 'حدث خطأ، حاول مرة أخرى.',
    unexpectedError: 'حدث خطأ غير متوقع. تم تسجيل المشكلة وسنعمل على معالجتها.',
    loading: 'جارٍ التحميل…',
    save: 'حفظ',
    saving: 'جارٍ الحفظ…',
    saved: 'تم الحفظ',
    saveFailed: 'تعذّر الحفظ — سيعاد المحاولة تلقائيًا',
    cancel: 'إلغاء',
    confirm: 'تأكيد',
    back: 'رجوع',
    next: 'التالي',
    previous: 'السابق',
    close: 'إغلاق',
    edit: 'تعديل',
    delete: 'حذف',
    search: 'بحث',
    filter: 'تصفية',
    all: 'الكل',
    yes: 'نعم',
    no: 'لا',
    required: 'مطلوب',
    optional: 'اختياري',
    retry: 'إعادة المحاولة',
    notAvailable: 'غير متاح',
    riyal: 'ر.س.',
    // Distinct from an empty state: an outage must never read as "no data".
    loadFailedTitle: 'تعذّر تحميل البيانات',
    loadFailedBody: 'حدثت مشكلة أثناء الاتصال بالخادم. هذه ليست نتيجة فارغة — أعد المحاولة.',
  },

  nav: {
    home: 'الرئيسية',
    courses: 'الدورات',
    simulators: 'محاكيات الاختبار',
    howItWorks: 'كيف تعمل المنصة؟',
    login: 'تسجيل الدخول',
    register: 'أنشئ حسابك',
    dashboard: 'لوحتي',
    logout: 'تسجيل الخروج',
    contact: 'تواصل معنا',
    privacy: 'سياسة الخصوصية',
    terms: 'الشروط والأحكام',
    refundPolicy: 'سياسة الاسترداد',
    openMenu: 'فتح القائمة',
    closeMenu: 'إغلاق القائمة',
    mainNavigation: 'التنقل الرئيسي',
  },

  home: {
    eyebrow: 'استعد لاختبار القدرات بثقة',
    heading: 'درجتك تبدأ من هنا',
    supporting:
      'استعد لاختبار القدرات العامة المحوسب بطريقة أوضح وأذكى، من خلال شروحات مبسطة، ومفاتيح للحل، وأسئلة تدريبية، واختبارات محاكية تساعدك على فهم السؤال والتعامل مع أنماطه بثقة.',
    primaryAction: 'ابدأ استعدادك الآن',
    secondaryAction: 'استكشف الدورات والاختبارات',
    learningLine: 'افهم أكثر • تدرّب أكثر • اختبر نفسك • ادخل الاختبار بثقة',
    safeExamClaim: 'تدريبات أصلية تحاكي المهارات والأنماط المعلنة رسميًا لاختبار القدرات العامة.',
    pathTitle: 'أربع خطوات حتى يوم الاختبار',
    pathSteps: [
      { title: 'افهم', body: 'شروحات مبسطة لكل مهارة، بلغة واضحة ومن دون حشو.' },
      { title: 'تدرّب', body: 'أسئلة تدريبية مصنّفة حسب المهارة ومستوى الصعوبة.' },
      { title: 'اختبر نفسك', body: 'اختبارات محاكية بأقسام وتوقيت يشبه تجربة الاختبار.' },
      { title: 'ادخل الاختبار بثقة', body: 'مراجعة لأدائك تُظهر ما يحتاج إلى تقوية قبل الموعد.' },
    ],
    productsTitle: 'مساران واضحان للاستعداد',
    coursesTitle: 'دورات مرئية',
    coursesBody:
      'دروس مرتبة في وحدات، مع سؤال قصير بعد كل درس يثبّت الفكرة قبل الانتقال إلى ما بعدها.',
    simulatorsTitle: 'محاكيات الاختبار',
    simulatorsBody:
      'اختبارات مقسّمة إلى أقسام موقوتة، مع حفظ تلقائي للإجابات ومراجعة مفصّلة بعد التسليم.',
    featuredTitle: 'من محتوى المنصة',
    featuredEmpty: 'لا توجد منتجات منشورة بعد. تابعنا قريبًا.',
    howTitle: 'كيف تشتري وتتعلّم؟',
    howSteps: [
      { title: 'أنشئ حسابك', body: 'تسجيل مباشر بالبريد وكلمة المرور، ويبدأ حسابك فورًا.' },
      { title: 'اشترِ ما تحتاجه', body: 'شراء لمرة واحدة لكل دورة أو محاكٍ، بلا اشتراكات متكررة.' },
      { title: 'ابدأ فورًا', body: 'يُفتح المحتوى مباشرة بعد تأكيد عملية الدفع.' },
    ],
    whyTitle: 'لماذا هذه الطريقة مفيدة؟',
    faqTitle: 'أسئلة شائعة',
  },

  auth: {
    loginTitle: 'تسجيل الدخول',
    loginSubtitle: 'أدخل بياناتك للمتابعة إلى لوحتك.',
    registerTitle: 'أنشئ حسابك',
    registerSubtitle: 'يبدأ حسابك فورًا بعد التسجيل، بلا رموز تحقق ولا انتظار موافقة.',
    fullName: 'الاسم الكامل',
    email: 'البريد الإلكتروني',
    phone: 'رقم الجوال',
    password: 'كلمة المرور',
    confirmPassword: 'تأكيد كلمة المرور',
    acceptTerms: 'أوافق على الشروط والأحكام وسياسة الخصوصية',
    submitLogin: 'تسجيل الدخول',
    submitRegister: 'إنشاء الحساب',
    haveAccount: 'لديك حساب بالفعل؟',
    noAccount: 'ليس لديك حساب؟',
    // Deliberately identical for a wrong password and an unknown address, so
    // the form cannot be used to discover which addresses are registered.
    invalidCredentials: 'البريد الإلكتروني أو كلمة المرور غير صحيحة.',
    registerFailed: 'تعذّر إنشاء الحساب بهذه البيانات.',
    accountBlocked: 'هذا الحساب موقوف حاليًا. تواصل معنا للمساعدة.',
    loginSuccess: 'تم تسجيل الدخول.',
    registerSuccess: 'تم إنشاء حسابك.',
    logoutSuccess: 'تم تسجيل الخروج.',
    tooManyAttempts: 'محاولات كثيرة — الرجاء المحاولة بعد قليل.',
    sessionExpired: 'انتهت الجلسة، سجّل الدخول مرة أخرى.',
    passwordHint: 'ثمانية أحرف على الأقل.',
  },

  dashboard: {
    title: 'لوحتي',
    welcome: 'أهلًا بك',
    continueLearning: 'أكمل من حيث توقفت',
    myCourses: 'دوراتي',
    mySimulators: 'محاكياتي',
    myAttempts: 'محاولاتي',
    myOrders: 'طلباتي',
    myAccount: 'حسابي',
    noCourses: 'لم تشترِ أي دورة بعد.',
    noCoursesAction: 'تصفّح الدورات',
    noSimulators: 'لم تشترِ أي محاكٍ بعد.',
    noSimulatorsAction: 'تصفّح المحاكيات',
    noAttempts: 'لم تبدأ أي محاولة بعد.',
    noOrders: 'لا توجد طلبات بعد.',
    progress: 'نسبة الإنجاز',

    home: 'الرئيسية',
    navigationLabel: 'أقسام لوحتي',
    openMenu: 'فتح قائمة لوحتي',
    closeMenu: 'إغلاق قائمة لوحتي',
    signedInAs: 'مسجّل الدخول باسم',
    logoutFailed: 'تعذّر تسجيل الخروج، حاول مرة أخرى.',
    overviewSubtitle: 'ما تملكه الآن، وآخر محاولاتك، وآخر طلباتك.',

    coursesSubtitle: 'الدورات التي يتوفّر لك الوصول إليها.',
    simulatorsSubtitle: 'محاكيات الاختبار التي يتوفّر لك الوصول إليها.',
    attemptsSubtitle: 'سجل محاولاتك في محاكيات الاختبار.',
    ordersSubtitle: 'سجل عمليات الشراء ومبالغها وحالتها.',
    accountSubtitle: 'بيانات حسابك كما هي مسجّلة لدينا.',

    noCoursesBody: 'بعد شراء أي دورة سيظهر الوصول إليها هنا مباشرة.',
    noSimulatorsBody: 'بعد شراء أي محاكٍ سيظهر الوصول إليه هنا مباشرة.',
    noAttemptsBody: 'ستظهر هنا محاولاتك في محاكيات الاختبار بعد أول محاولة.',
    noAttemptsAction: 'تصفّح المحاكيات',
    noOrdersBody: 'ستظهر هنا كل عمليات الشراء مع مبالغها وحالتها.',
    noOrdersAction: 'تصفّح المنتجات',

    recentAttempts: 'آخر المحاولات',
    recentOrders: 'آخر الطلبات',
    viewAll: 'عرض الكل',
    openItem: 'فتح',

    outOf: 'من',
    accessGrantedAt: 'تاريخ الوصول',
    attemptDate: 'تاريخ المحاولة',
    attemptSubmittedAt: 'تاريخ التسليم',
    attemptCorrectCount: 'الإجابات الصحيحة',
    orderDate: 'تاريخ الطلب',
    orderAmount: 'المبلغ',
    orderReference: 'رقم الطلب',

    accountName: 'الاسم الكامل',
    accountEmail: 'البريد الإلكتروني',
    accountPhone: 'رقم الجوال',
    accountCreatedAt: 'تاريخ إنشاء الحساب',
    accountNotProvided: 'لم يُضف',
    // Editing is intentionally absent until the account service exists; saying so
    // is better than showing a control that silently does nothing.
    accountReadOnlyNote: 'تعديل بيانات الحساب غير متاح حاليًا. للتغيير تواصل معنا.',
  },

  /**
   * Database enum values rendered in Arabic.
   *
   * Keyed by the exact enum member so a status can never be shown as a raw
   * English identifier, and so a new member added to the schema surfaces as a
   * TypeScript error here rather than as untranslated text in the interface.
   */
  statusLabels: {
    orderStatus: {
      PENDING_PAYMENT: 'بانتظار الدفع',
      PAID: 'مدفوع',
      FAILED: 'فشل الدفع',
      REFUNDED: 'مسترد',
      CANCELLED: 'ملغى',
    },
    attemptStatus: {
      CREATED: 'لم تبدأ',
      IN_PROGRESS: 'قيد التنفيذ',
      SUBMITTED: 'مُسلَّمة',
      EXPIRED: 'انتهى وقتها',
      ABANDONED: 'متروكة',
    },
    attemptMode: {
      FULL_SIMULATION: 'محاكاة كاملة',
      TRAINING: 'وضع التدريب',
    },
    entitlementStatus: {
      ACTIVE: 'الوصول متاح',
      REVOKED: 'الوصول ملغى',
    },
    productType: {
      COURSE: 'دورة',
      EXAM_SIMULATOR: 'محاكي اختبار',
    },
    questionTrack: {
      SCIENTIFIC: 'المسار العلمي',
      THEORETICAL: 'المسار النظري',
      BOTH: 'المساران',
      CUSTOM: 'مسار مخصص',
    },
  },

  admin: {
    title: 'لوحة التحكم',
    overview: 'نظرة عامة',
    products: 'المنتجات',
    courses: 'الدورات',
    questionBank: 'بنك الأسئلة',
    simulators: 'محاكيات الاختبار',
    students: 'الطلاب',
    orders: 'الطلبات والمدفوعات',
    entitlements: 'الصلاحيات والوصول',
    attempts: 'المحاولات والنتائج',
    settings: 'الإعدادات',
    auditLog: 'سجل النشاط',
    signedInAs: 'مسجّل الدخول باسم',
  },

  /**
   * The administration area's own chrome and its screen-level copy.
   *
   * Most of these screens exist as routes before they exist as features. The
   * wording says so plainly: an unbuilt screen must never be dressed up as an
   * empty table or a zeroed metric, because both read as a true business fact.
   */
  adminPages: {
    shellLabel: 'أقسام لوحة التحكم',
    openMenu: 'فتح قائمة لوحة التحكم',
    closeMenu: 'إغلاق قائمة لوحة التحكم',
    currentSection: 'القسم الحالي',
    logoutFailed: 'تعذّر تسجيل الخروج، حاول مرة أخرى.',

    notBuiltTitle: 'لم تُبنَ هذه الشاشة بعد',
    notBuiltBody:
      'المسار جاهز داخل لوحة التحكم، أما أدوات هذه الشاشة فلم تُنفَّذ بعد. لا تُعرض هنا أي بيانات أو أرقام حتى تكتمل.',

    overviewDescription:
      'ملخص موجز لحالة المنصة. كل رقم هنا مقروء مباشرة من قاعدة البيانات، ولا يوجد أي تقدير أو توقّع.',
    productsDescription: 'إدارة ما يُعرض للبيع: الدورات ومحاكيات الاختبار، مع أسعارها وحالة نشرها.',
    coursesDescription: 'بناء محتوى الدورات: الوحدات والدروس ومقاطع الفيديو والأسئلة القصيرة.',
    questionsDescription: 'بنك الأسئلة: الإنشاء والتصنيف ومسار المراجعة والنشر وإصدارات كل سؤال.',
    simulatorsDescription:
      'إعداد محاكيات الاختبار: الأقسام والتوقيت وقواعد اختيار الأسئلة وإصدارات الاختبار.',
    studentsDescription: 'حسابات الطلاب: البحث فيها، والاطلاع عليها، وإيقافها أو إعادة تفعيلها.',
    ordersDescription: 'الطلبات ومحاولات الدفع وحالات الاسترداد، مع أثر كل عملية.',
    entitlementsDescription: 'صلاحيات الوصول إلى المنتجات: المنح والسحب وسجل التغييرات الكامل.',
    attemptsDescription: 'محاولات الاختبار ونتائجها التدريبية، للمتابعة والتشخيص.',
    settingsDescription:
      'إعدادات المنصة: بيانات التواصل وإصدارات المستندات النظامية والقيم الافتراضية.',
    auditLogDescription: 'سجل الإجراءات الإدارية: من نفّذ الإجراء، ومتى، وعلى أي عنصر.',

    counts: {
      title: 'أعداد حالية',
      note: 'أعداد فعلية في لحظة فتح الصفحة. ليست مؤشرات أداء ولا اتجاهات زمنية.',
      publishedProducts: 'منتجات منشورة',
      draftProducts: 'منتجات مسودة',
      students: 'حسابات طلاب',
      publishedQuestions: 'أسئلة منشورة',
      inReviewQuestions: 'أسئلة قيد المراجعة',
      draftQuestions: 'أسئلة مسودة',
      paidOrders: 'طلبات مدفوعة',
      pendingOrders: 'طلبات بانتظار الدفع',
    },
    overviewRestTitle: 'بقية شاشة النظرة العامة لم تُبنَ بعد',
    overviewRestBody:
      'ستُضاف هنا لاحقًا أدوات المتابعة التفصيلية. لن تُعرض قبل ذلك أي رسوم أو أرقام تقديرية.',
  },

  errors: {
    unauthorized: 'يجب تسجيل الدخول للمتابعة.',
    forbidden: 'ليس لديك صلاحية للوصول إلى هذه الصفحة.',
    notFound: 'الصفحة غير موجودة',
    notFoundBody: 'الرابط الذي فتحته غير صحيح أو أن الصفحة لم تعد متاحة.',
    notFoundAction: 'العودة إلى الرئيسية',
    serverError: 'حدث خطأ في الخادم',
    serverErrorBody: 'واجهنا مشكلة أثناء تنفيذ طلبك. حاول مرة أخرى بعد قليل.',
    validation: 'تحقّق من البيانات المُدخلة.',
    rateLimited: 'محاولات كثيرة — الرجاء المحاولة لاحقًا.',
  },

  legal: {
    independenceDisclaimer: INDEPENDENCE_DISCLAIMER,
    trainingResultLabel: 'نتيجة تدريبية',
    trainingIndicatorLabel: 'مؤشر أداء تدريبي',
    sampleContentLabel: 'محتوى تدريبي تجريبي من إعداد المنصة',
  },

  /**
   * Checkout, payment and order copy.
   *
   * Two rules shape the wording here. Nothing tells the student that access has
   * been granted until the server has verified the payment with the provider, so
   * there is no "تم الدفع" string that a browser callback alone can trigger. And
   * every failure reads as a payment outcome, never as a provider error message:
   * a gateway's English text is recorded server-side and never shown.
   */
  commerce: {
    checkoutTitle: 'إتمام الشراء',
    checkoutSubtitle: 'راجع تفاصيل طلبك قبل الدفع.',
    orderSummary: 'ملخص الطلب',
    orderReference: 'رقم الطلب',
    orderDate: 'تاريخ الطلب',
    orderStatus: 'حالة الطلب',
    productLabel: 'المنتج',
    amountDue: 'المبلغ المستحق',
    amountPaid: 'المبلغ المدفوع',
    currencyNote: 'كل المبالغ بالريال السعودي.',
    buyNow: 'اشترِ الآن',
    payNow: 'ادفع الآن',
    preparingCheckout: 'جارٍ تجهيز صفحة الدفع…',
    backToOrders: 'العودة إلى طلباتي',
    backToDashboard: 'العودة إلى لوحتي',
    openProduct: 'افتح المنتج',

    // ── Card form guidance ────────────────────────────────────────────────
    cardDetailsTitle: 'بيانات البطاقة',
    cardholderNameGuidance:
      'اكتب اسم حامل البطاقة كما يظهر عليها، باسمين على الأقل وبالأحرف اللاتينية.',
    otpNote:
      'قد يطلب منك البنك إدخال رمز تحقق (3-D Secure) أثناء الدفع. هذا إجراء من بنكك لتأكيد العملية، وليس تحققًا من حسابك في المنصة.',
    supportedNetworks: 'نقبل مدى وفيزا وماستركارد.',
    securityNote: 'تُدخل بيانات بطاقتك لدى مزوّد الدفع مباشرة، ولا تُخزَّن على خوادم المنصة.',
    paymentFormUnavailable: 'الدفع غير متاح حاليًا',
    paymentFormUnavailableBody:
      'لم تُضبط إعدادات الدفع على هذا الخادم بعد، لذلك لا يمكن إتمام الشراء الآن. حاول لاحقًا أو تواصل معنا.',

    // ── Development-only mock payment ─────────────────────────────────────
    mockBadge: 'دفع تجريبي',
    mockTitle: 'دفع تجريبي — لا تُنفَّذ أي عملية دفع حقيقية',
    mockBody:
      'هذه شاشة تطوير محلية. لا يُخصم أي مبلغ، ولا تُستخدم أي بطاقة، ولا يُتصل بأي بنك أو مزوّد دفع. الأزرار أدناه تحاكي نتيجة الدفع فقط لاختبار المنصة.',
    mockNoMoneyNote: 'لن تُحوَّل أي أموال. هذه محاكاة كاملة تعمل داخل خادم التطوير فقط.',
    mockSucceed: 'محاكاة دفع ناجح',
    mockFail: 'محاكاة دفع فاشل',
    mockProcessing: 'جارٍ تنفيذ المحاكاة…',

    // ── Result page ───────────────────────────────────────────────────────
    resultTitle: 'نتيجة عملية الدفع',
    resultPaidTitle: 'تم تأكيد الدفع',
    resultPaidBody: 'تحقّقنا من عملية الدفع لدى مزوّد الدفع، وأصبح المنتج متاحًا في لوحتك.',
    resultPendingTitle: 'الدفع قيد التأكيد',
    resultPendingBody:
      'لم يصلنا تأكيد نهائي لعملية الدفع بعد. لا تعِد الدفع — سنحدّث حالة الطلب تلقائيًا فور وصول التأكيد، ويمكنك تحديث الحالة يدويًا من هنا.',
    resultFailedTitle: 'لم تكتمل عملية الدفع',
    resultFailedBody: 'لم يُخصم أي مبلغ. يمكنك المحاولة مرة أخرى أو استخدام بطاقة أخرى.',
    resultCancelledTitle: 'أُلغي الطلب',
    resultCancelledBody: 'أُلغي هذا الطلب ولم يُخصم منه أي مبلغ.',
    resultRefundedTitle: 'استُرد المبلغ',
    resultRefundedBody: 'استُرد مبلغ هذا الطلب، ولذلك أُوقف الوصول إلى المنتج المرتبط به.',
    refreshStatus: 'تحديث حالة الدفع',
    refreshingStatus: 'جارٍ التحقق…',
    statusRefreshed: 'حُدِّثت حالة الطلب.',
    statusUnchanged: 'لا يوجد تحديث جديد لحالة الطلب بعد.',
    // Said plainly, because "wait and refresh" is otherwise read as "pay again".
    doNotPayTwice: 'لا تُكرر عملية الدفع. إن خُصم منك مبلغ دون فتح المنتج، تواصل معنا برقم الطلب.',

    // ── Errors ────────────────────────────────────────────────────────────
    productNotFound: 'هذا المنتج غير موجود.',
    productNotPurchasable: 'هذا المنتج غير متاح للشراء حاليًا.',
    alreadyOwned: 'أنت تملك هذا المنتج بالفعل، ويمكنك فتحه من لوحتك.',
    orderNotFound: 'هذا الطلب غير موجود.',
    orderAlreadyPaid: 'هذا الطلب مدفوع بالفعل.',
    orderNotPayable: 'لا يمكن إتمام الدفع لهذا الطلب في حالته الحالية.',
    checkoutKeyReused: 'استُخدم مفتاح الطلب هذا لمنتج آخر. أعد فتح صفحة المنتج وحاول من جديد.',
    paymentNotAttached: 'لم تُسجَّل أي عملية دفع لهذا الطلب بعد.',
    paymentAlreadyAttached: 'رقم عملية الدفع هذا مرتبط بطلب آخر.',
    paymentFailed: 'لم تكتمل عملية الدفع.',
    paymentNeedsReview: 'هذا الطلب قيد المراجعة اليدوية. سنتواصل معك بشأنه.',
    commerceDisabled: 'الشراء غير متاح حاليًا. حاول لاحقًا.',
    checkoutFailed: 'تعذّر بدء عملية الشراء. حاول مرة أخرى.',
  },
} as const;

export type Copy = typeof COPY;
