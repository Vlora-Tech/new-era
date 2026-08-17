import { ADMIN_COMMON_COPY } from './copy/admin-common';
import { ADMIN_MEDIA_COPY } from './copy/admin-media';
import { ADMIN_PRODUCTS_COPY } from './copy/admin-products';
import { ADMIN_QUESTIONS_COPY } from './copy/admin-questions';

/**
 * Central Arabic copy bank.
 *
 * One source of truth so wording cannot drift between a page, a toast and an
 * email. Every string the customer or an administrator can see belongs here or
 * in a validator's message; nothing user-facing should be typed inline in a
 * component.
 *
 * Source code identifiers, route segments and database names stay English.
 *
 * ── Why part of this file lives in `./copy/` ──────────────────────────────
 *
 * The administration CRUD screens are built by several people at once, and a
 * single object literal is the worst possible shape for that: two edits to the
 * same region are a merge conflict at best and a silently dropped block at
 * worst. `COPY.adminCommon`, `.adminProducts`, `.adminQuestions` and
 * `.adminMedia` are therefore authored in four sibling modules and composed in
 * below, so each screen's strings have exactly one owner and one file.
 *
 * The access pattern is unchanged — `COPY.adminProducts.fields.slug.label` reads
 * the same whether the object was written here or imported — and because each
 * module is itself `as const`, the composed type is still fully literal, so a
 * misspelled key is still a compile error.
 *
 * Nothing that already lived here was moved. The existing keys are the ones the
 * public site, the dashboard and the exam workspace already import, and moving
 * them would have been a large diff with no benefit and a real chance of a
 * dropped string.
 *
 * There is deliberately no `src/lib/copy/index.ts`: a file *and* a directory
 * both named `copy` are unambiguous only while the directory has no index for a
 * resolver to prefer.
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
    details: 'التفاصيل',
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
    // Footer column headings and the label for its second navigation landmark.
    productsGroup: 'المنتجات',
    informationGroup: 'معلومات',
    legalNavigation: 'روابط قانونية',
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
    /**
     * Described as method, never as outcome: nothing here promises a score, a
     * band or an improvement, because the platform cannot know one.
     */
    whyReasons: [
      {
        title: 'تدريب على النمط لا على السؤال',
        body: 'الأسئلة مصنّفة حسب المهارة والمهارة الفرعية، فتتدرّب على طريقة التفكير التي يتكرر استخدامها بدل حفظ إجابات بعينها.',
      },
      {
        title: 'ظروف قريبة من يوم الاختبار',
        body: 'أقسام موقوتة، وانتقال لا رجعة فيه بين الأقسام، وحفظ تلقائي للإجابات — حتى تكون التجربة مألوفة قبل أن تخوضها فعليًا.',
      },
      {
        title: 'مراجعة تدلّك على ما يحتاج إلى تقوية',
        body: 'بعد كل محاولة ترى دقتك في كل مهارة والزمن الذي استغرقته، فتعرف أين تضع جهدك في المرة القادمة.',
      },
    ],
    faqTitle: 'أسئلة شائعة',
    faq: [
      {
        question: 'هل الشراء لمرة واحدة أم اشتراك متكرر؟',
        answer:
          'الشراء لمرة واحدة لكل دورة أو محاكٍ. لا توجد اشتراكات شهرية ولا تجديد تلقائي، ويبقى ما اشتريته متاحًا في حسابك.',
      },
      {
        question: 'متى يُفتح المحتوى بعد الدفع؟',
        answer:
          'يُفتح مباشرة بعد تأكيد عملية الدفع لدى مزوّد الدفع، ويظهر المنتج في لوحتك دون خطوات إضافية.',
      },
      {
        question: 'كيف تعمل مقاطع الدروس؟',
        answer:
          'المقاطع محمية ومرتبطة بحسابك، ويحفظ الموضع الذي توقفت عنده تلقائيًا لتكمل من حيث انتهيت.',
      },
      {
        question: 'ما الفرق بين المحاكاة الكاملة والتدريب؟',
        answer:
          'المحاكاة الكاملة تلتزم بأقسام وتوقيت وقواعد انتقال ثابتة. أما التدريب فيتيح اختيار المهارة ومستوى الصعوبة وعرض الشرح فور الإجابة.',
      },
      {
        question: 'هل نتائج المحاكي درجة رسمية؟',
        answer:
          'لا. النتائج مؤشرات أداء تدريبية تساعدك على معرفة ما يحتاج إلى تقوية، ولا تمثل درجة رسمية ولا تنبؤًا بها.',
      },
      {
        question: 'هل الأسئلة منقولة من اختبارات سابقة؟',
        answer:
          'لا. جميع الأسئلة من إعداد المنصة، وتحاكي المهارات والأنماط المعلنة رسميًا دون نقل أي محتوى محمي.',
      },
    ],
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

  /**
   * The administration CRUD screens, composed from `./copy/`.
   *
   * See the note at the top of this file for why these four are separate
   * modules rather than four more blocks in this literal.
   */
  adminCommon: ADMIN_COMMON_COPY,
  adminProducts: ADMIN_PRODUCTS_COPY,
  adminQuestions: ADMIN_QUESTIONS_COPY,
  adminMedia: ADMIN_MEDIA_COPY,

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
    rightsReserved: 'جميع الحقوق محفوظة.',
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

  /**
   * The exam simulator: instructions, the timed workspace, and the review.
   *
   * Every irreversible action is described in words before it happens, because
   * the cost of a mistaken tap here is a locked section the student cannot get
   * back. The result wording never claims a score, a level or a prediction — it
   * reports what the attempt contained and nothing beyond it.
   *
   * `{...}` placeholders are substituted at the call site; the surrounding
   * Arabic stays here so the sentence is written once, whole.
   */
  exam: {
    // ── Instructions, shown while the attempt exists but has no clock ──
    instructionsTitle: 'قبل أن تبدأ',
    instructionsIntro:
      'هذه محاولة موقوتة. اقرأ التعليمات كاملة، ثم ابدأ عندما تكون مستعدًا — يبدأ العدّ فور الضغط على الزر.',
    startAction: 'ابدأ المحاولة',
    starting: 'جارٍ بدء المحاولة…',
    startFailed: 'تعذّر بدء المحاولة، حاول مرة أخرى.',
    structureTitle: 'بنية الاختبار',
    sectionsCount: 'عدد الأقسام',
    questionsCount: 'عدد الأسئلة',
    totalDuration: 'المدة الإجمالية',
    sectionDuration: 'مدة القسم',
    rulesTitle: 'قواعد المحاولة',
    rules: [
      'يبدأ وقت القسم فور بدء المحاولة، ويستمر حتى لو أغلقت الصفحة أو انقطع الاتصال.',
      'المراجعة والتعديل متاحان داخل القسم الحالي فقط.',
      'الانتقال إلى القسم التالي نهائي: لا يمكن العودة إلى قسم أُغلق ولا تعديل إجاباته.',
      'تُحفظ إجاباتك تلقائيًا على الخادم أولًا بأول، وتظهر حالة الحفظ أعلى الشاشة.',
      'عند انتهاء وقت القسم يُغلق تلقائيًا وينتقل الاختبار إلى القسم الذي يليه.',
      'لا تُعرض الإجابات الصحيحة ولا الشروح قبل تسليم المحاولة.',
    ],
    disclaimerTitle: 'قبل التعليمات: عن هذه المنصة',

    // ── The timed workspace ──
    workspaceLabel: 'شاشة المحاولة',
    sectionOfTotal: 'القسم {current} من {total}',
    questionOfTotal: 'السؤال {current} من {total}',
    timeRemaining: 'الوقت المتبقي',
    timeAlmostOver: 'اقترب انتهاء وقت القسم.',
    timeOver: 'انتهى وقت هذا القسم.',
    optionsLabel: 'الخيارات',
    passageLabel: 'النص',
    hintLabel: 'تلميح',
    flagAction: 'علّم للمراجعة',
    flagged: 'معلّم للمراجعة',
    unflagAction: 'إزالة العلامة',
    navigatorLabel: 'أسئلة القسم الحالي',
    navigatorHint: 'التنقل متاح داخل هذا القسم فقط.',
    navigatorAnswered: 'مُجاب',
    navigatorUnanswered: 'بلا إجابة',
    navigatorFlagged: 'معلّم',
    goToQuestion: 'الانتقال إلى السؤال {number}',
    previousQuestion: 'السؤال السابق',
    nextQuestion: 'السؤال التالي',

    // ── Save status, always visible ──
    saving: 'يحفظ…',
    saved: 'تم الحفظ',
    saveFailed: 'تعذّر الحفظ',
    saveFailedBody:
      'لم تصل آخر إجابة إلى الخادم. تحقّق من الاتصال، فالإجابة غير المحفوظة لا تُحتسب.',
    saveConflict: 'حُدِّثت هذه الإجابة من نافذة أخرى، وأُعيد تحميل الحالة من الخادم.',
    saveRetry: 'إعادة محاولة الحفظ',

    // ── Advancing, irreversibly ──
    advanceAction: 'إنهاء القسم والانتقال',
    submitAction: 'تسليم المحاولة',
    advanceTitle: 'إنهاء القسم الحالي',
    advanceWarning:
      'الانتقال نهائي. سيُغلق هذا القسم فورًا، ولن تتمكن من العودة إليه أو تعديل أي إجابة فيه.',
    submitTitle: 'تسليم المحاولة',
    submitWarning: 'التسليم نهائي. بعده تُحتسب النتيجة التدريبية ولا يمكن تعديل أي إجابة.',
    unansweredNotice: 'أسئلة بلا إجابة: {count}',
    flaggedNotice: 'أسئلة معلّمة للمراجعة: {count}',
    allAnswered: 'أجبت عن كل أسئلة هذا القسم.',
    confirmAdvance: 'نعم، أنهِ القسم',
    confirmSubmit: 'نعم، سلّم المحاولة',
    stayHere: 'العودة إلى القسم',
    advanceFailed: 'تعذّر إنهاء القسم، حاول مرة أخرى.',
    submitFailed: 'تعذّر تسليم المحاولة، حاول مرة أخرى.',

    // ── Leaving ──
    exitGuard: 'المحاولة ما زالت جارية والوقت مستمر. هل تريد مغادرة الصفحة؟',
    exitAction: 'الخروج من المحاولة',
    exitTitle: 'الخروج من المحاولة',
    exitWarning:
      'الوقت لا يتوقف عند الخروج. ستستمر أقسام الاختبار في العد، ويمكنك العودة عبر لوحتك ما دام الوقت باقيًا.',
    confirmExit: 'نعم، غادر الآن',

    // ── Results ──
    resultsTitle: 'مراجعة المحاولة',
    resultsSubtitle: 'هذه مراجعة تدريبية لأدائك في هذه المحاولة، وليست درجة ولا تقديرًا رسميًا.',
    resultsPendingTitle: 'لم تُسلَّم هذه المحاولة بعد',
    resultsPendingBody: 'تظهر المراجعة بعد تسليم المحاولة أو انتهاء وقتها.',
    correctCount: 'إجابات صحيحة',
    incorrectCount: 'إجابات خاطئة',
    unansweredCount: 'أسئلة بلا إجابة',
    totalCount: 'مجموع الأسئلة',
    accuracyLabel: 'نسبة الإجابات الصحيحة',
    finalisedBySubmitted: 'سُلِّمت بواسطتك',
    finalisedByExpired: 'أُنهيت بانتهاء الوقت',
    domainsTitle: 'الأداء حسب المهارة',
    subskillsTitle: 'الأداء حسب المهارة الفرعية',
    sectionsTitle: 'أوقات الأقسام',
    sectionAllowed: 'الوقت المتاح',
    sectionElapsed: 'الوقت المستغرق',
    reviewTitle: 'مراجعة الأسئلة',
    yourAnswer: 'إجابتك',
    correctAnswer: 'الإجابة الصحيحة',
    noAnswer: 'لم تُجب',
    explanationLabel: 'الشرح',
    backToAttempts: 'العودة إلى محاولاتي',
    // Repeated on the results screen so the numbers are never read alone.
    notAnOfficialScore:
      'هذه الأرقام وصف لما حدث في هذه المحاولة فقط. المنصة لا تحسب درجة رسمية ولا نسبة مئوية معيارية ولا توقّعًا لنتيجة الاختبار.',

    // ── Errors, all safe to display ──
    errors: {
      attemptNotFound: 'هذه المحاولة غير موجودة أو لم تعد متاحة.',
      simulatorNotFound: 'محاكي الاختبار غير موجود.',
      noAccess: 'لا يتوفّر لك وصول إلى هذا المحاكي.',
      versionNotPublished: 'هذا المحاكي غير جاهز للمحاولات حاليًا.',
      modeUnavailable: 'هذا النوع من المحاولات غير متاح لهذا المحاكي.',
      notStarted: 'لم تبدأ هذه المحاولة بعد.',
      alreadyFinished: 'انتهت هذه المحاولة، ولا يمكن تعديلها.',
      sectionLocked: 'أُغلق هذا القسم، ولا يمكن تعديل إجاباته.',
      sectionNotActive: 'هذا القسم ليس القسم الجاري.',
      invalidOption: 'الخيار المحدد لا ينتمي إلى هذا السؤال.',
      resultsNotReady: 'تظهر المراجعة بعد تسليم المحاولة أو انتهاء وقتها.',
      questionShortage:
        'لا توجد أسئلة منشورة كافية لتوليد هذه المحاولة، فلم يبدأ الاختبار. تواصل معنا وسنعالج الأمر.',
      generationFailed: 'تعذّر تجهيز هذه المحاولة. لم يبدأ أي وقت ولم تُحتسب أي محاولة.',
    },
  },
} as const;

export type Copy = typeof COPY;
