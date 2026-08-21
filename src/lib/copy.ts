import { ADMIN_ATTEMPTS_COPY } from './copy/admin-attempts';
import { ADMIN_AUDIT_COPY } from './copy/admin-audit';
import { ADMIN_COMMON_COPY } from './copy/admin-common';
import { ADMIN_CONTACT_COPY } from './copy/admin-contact';
import { ADMIN_COURSES_COPY } from './copy/admin-courses';
import { ADMIN_ENTITLEMENTS_COPY } from './copy/admin-entitlements';
import { ADMIN_MEDIA_COPY } from './copy/admin-media';
import { ADMIN_ORDERS_COPY } from './copy/admin-orders';
import { ADMIN_PRODUCTS_COPY } from './copy/admin-products';
import { ADMIN_QUESTIONS_COPY } from './copy/admin-questions';
import { ADMIN_SETTINGS_COPY } from './copy/admin-settings';
import { ADMIN_SIMULATORS_COPY } from './copy/admin-simulators';
import { ADMIN_STUDENTS_COPY } from './copy/admin-students';
import { LANDING_COPY } from './copy/landing';

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
 * worst. Every `COPY.admin*` key below is therefore authored in its own sibling
 * module under `./copy/` and composed in here, so each screen's strings have
 * exactly one owner and one file. The rule is one screen, one module: a screen
 * being built writes only its own file, and this composition block is the sole
 * shared line it touches.
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
  name: 'بناء العهد الجديد',
  fullName: 'بناء العهد الجديد',
  tagline: 'استعد لاختبار القدرات بثقة',
} as const;

/**
 * Shown on the simulator detail page, before any full attempt, and on results.
 * Wording is fixed: it is the product's independence statement.
 */
export const INDEPENDENCE_DISCLAIMER =
  'منصة بناء العهد الجديد منصة تدريبية مستقلة، وليست تابعة لهيئة تقويم التعليم والتدريب أو للمركز الوطني للقياس، ولا تمثل نتائجها نتيجة رسمية أو ضمانًا لدرجة الاختبار.';

export const COPY = {
  /**
   * The catalogue card's size line.
   *
   * Counting words only, with no numeral of their own: the card supplies the
   * figure through `formatNumber`, and the two are joined at the call site. They
   * are the plural forms, because the card drops the item entirely at zero and
   * one is rare enough on a published course not to earn a second string.
   */
  catalog: {
    units: 'وحدات',
    lessons: 'دروس',

    /**
     * The product page itself — the masthead, the curriculum and the rail.
     *
     * These strings were previously written inline in
     * `(public)/courses/[slug]/page.tsx`, which is the drift the copy bank
     * exists to prevent. Every label here is either a heading or the name of a
     * figure the page reads out of the database. There is deliberately no
     * "what you will learn" list and no support turnaround: the first has no
     * column behind it, and the second would be a service promise nobody has
     * made. See `contact.responseNote`, which is what the product does say.
     */
    detail: {
      breadcrumb: 'مسار التصفح',
      curriculumTitle: 'محتوى الدورة',
      aboutTitle: 'عن الدورة',
      noModules: 'لم تُضَف وحدات بعد.',
      previewBadge: 'معاينة',
      /* The padlock is a shape, not a word — this is the word, for a screen reader. */
      lockedPrefix: 'يُفتح بعد الشراء:',
      moduleOrdinal: 'الوحدة {index}',
      /* The plate's three figures. Labels only: the numerals arrive formatted. */
      statUnits: 'الوحدات',
      statLessons: 'الدروس',
      statDuration: 'المدة الإجمالية',
      /* The rail's standing card, over the three lines of `panel.courseIncludes`. */
      includedTitle: 'ما يشمله اشتراكك في الدورة',

      /*
       * Counted nouns, in all six Arabic forms, for `formatCount`.
       *
       * The catalogue card next door prints «٢ دروس» and its comment explains
       * why it is allowed to: it is a line of chrome in a grid, and a dual/plural
       * table was not worth it there. On this page the same phrase is the
       * course's own summary line, directly under its title, and «١ وحدات» in
       * that position is simply a mistake in Arabic. `one` and `two` carry no
       * `{count}` on purpose — «وحدة واحدة» and «وحدتان» already contain the
       * number, and printing a numeral beside them is the error twice.
       */
      counts: {
        units: {
          one: 'وحدة واحدة',
          two: 'وحدتان',
          few: '{count} وحدات',
          many: '{count} وحدة',
          other: '{count} وحدة',
        },
        lessons: {
          one: 'درس واحد',
          two: 'درسان',
          few: '{count} دروس',
          many: '{count} درسًا',
          other: '{count} درس',
        },
      },
    },

    /**
     * The product page's side panel.
     *
     * Three panels rather than one panel with a swapped button, because the
     * three readers want different things and only one of them is buying. A
     * price and «شراء لمرة واحدة» in front of somebody who has already paid is
     * not merely redundant — it reads as a second charge, which is the single
     * most expensive misreading this page can produce. Someone mid-payment is
     * given their own order back instead of a control that would open a second
     * one.
     *
     * `{...}` placeholders are substituted at the call site with values that are
     * already formatted — Arabic-Indic digits, Riyadh dates.
     */
    panel: {
      // ── Buying: shown only to a reader who could actually buy ──
      oneTimePurchase: 'شراء لمرة واحدة. لا اشتراك ولا تجديد تلقائي.',
      buyCourse: 'اشترِ الدورة',
      buySimulator: 'احصل على المحاكي',
      courseIncludes: [
        'وصول دائم بعد الشراء.',
        'أسئلة قصيرة بعد الدروس التي تتضمنها.',
        'يحفظ موضع المشاهدة تلقائيًا.',
      ],
      simulatorNote:
        'النتائج مؤشرات أداء تدريبية تساعدك على تحديد ما يحتاج إلى تقوية، ولا تمثل درجة رسمية.',

      // ── Owned: the purchase is done and the page becomes a way in ──
      ownedCourseTitle: 'هذه الدورة في حسابك',
      ownedSimulatorTitle: 'هذا المحاكي في حسابك',
      ownedBody: 'وصولك دائم، وتستأنف من حيث توقفت في أي وقت.',
      accessSince: 'مفعّل لديك منذ {date}',
      startCourse: 'ابدأ الدرس الأول',
      continueCourse: 'أكمل من حيث توقفت',
      reviewCourse: 'راجع الدروس',
      startSimulator: 'ابدأ المحاكاة',
      progressLabel: 'إنجازك في الدورة',
      progressCount: 'أكملت {completed} من {total}',
      /* A course an administrator has not filled yet. Saying so beats a
         disabled button with no explanation. */
      ownedButEmpty: 'لم تُنشر دروس هذه الدورة بعد. ستظهر هنا فور نشرها.',

      // ── Mid-payment: an order exists and is unpaid ──
      pendingTitle: 'لديك طلب بانتظار الدفع',
      pendingBody:
        'أنشأت طلبًا لهذا المنتج ولم يكتمل دفعه بعد. أكمل الطلب نفسه بدلًا من إنشاء طلب جديد.',
      pendingAction: 'أكمل الدفع',
      pendingOrderDate: 'تاريخ الطلب',
    },
  },

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
    loadFailedBody: 'حدثت مشكلة أثناء الاتصال بالخادم. أعد المحاولة.',
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
    /*
     * Added with the 2026 landing page. `faq` is a section anchor rather than a
     * route: it resolves to `/#faq`, which works from every public page because
     * a root-relative hash navigates home first. `start` is the header's own
     * call to action, deliberately shorter than `register` — the bar has less
     * room than a form's submit button.
     */
    faq: 'الأسئلة الشائعة',
    start: 'ابدأ الآن',
  },

  contact: {
    eyebrow: 'نحن هنا للمساعدة',
    title: 'كيف يمكننا مساعدتك؟',
    description:
      'أرسل استفسارك عن الحساب أو الطلبات أو محتوى المنصة، وسيصل مباشرة إلى فريق نيو إيرا.',
    responseNote: 'نراجع الرسائل الواردة عبر المنصة. لا ترسل كلمات مرور أو بيانات دفع.',
    directTitle: 'تفضّل التواصل المباشر؟',
    directDescription: 'يمكنك استخدام بيانات التواصل المتاحة، أو إرسال النموذج وسيصلنا فورًا.',
    unavailable: 'لم تُضبط بعد.',
    form: {
      title: 'أرسل رسالتك',
      description: 'اكتب التفاصيل التي تساعدنا على فهم استفسارك بوضوح.',
      name: {
        label: 'الاسم',
        placeholder: 'اكتب اسمك',
        required: 'اكتب اسمًا من حرفين على الأقل.',
        tooLong: 'يجب ألا يتجاوز الاسم ١٠٠ حرف.',
      },
      email: {
        label: 'البريد الإلكتروني',
        placeholder: 'name@example.com',
        invalid: 'اكتب بريدًا إلكترونيًا صحيحًا.',
      },
      subject: {
        label: 'الموضوع',
        placeholder: 'مثال: استفسار عن دورة',
        tooLong: 'يجب ألا يتجاوز الموضوع ١٦٠ حرفًا.',
      },
      message: {
        label: 'الرسالة',
        placeholder: 'اكتب استفسارك بالتفصيل…',
        tooShort: 'اكتب رسالة من ١٠ أحرف على الأقل.',
        tooLong: 'يجب ألا تتجاوز الرسالة ٥٠٠٠ حرف.',
      },
      submit: 'إرسال الرسالة',
      submitting: 'جارٍ الإرسال…',
      successTitle: 'وصلت رسالتك',
      successBody: 'شكرًا لتواصلك. أصبحت رسالتك الآن لدى فريق نيو إيرا.',
      sendAnother: 'إرسال رسالة أخرى',
      failed: 'تعذّر إرسال الرسالة. لم يُحفظ شيء، حاول مرة أخرى.',
    },
  },

  /**
   * The 2026 landing page, authored in `./copy/landing.ts`.
   *
   * `home` below is what remains of the page this replaced. It is deliberately
   * not merged into `landing`: four other surfaces still read from it (both
   * catalogue pages, the root layout's meta description, and the dashboard's
   * next-steps rail), so it is now shared copy rather than page copy.
   */
  landing: LANDING_COPY,

  /**
   * What survives of the landing page this replaced.
   *
   * It is no longer page copy — the 2026 landing page reads from `landing`
   * above — but four other surfaces still import these six strings, and
   * moving them would only relocate the coupling:
   *
   *   `supporting`     → the root layout, as the site's meta description
   *   `coursesBody`    → the courses catalogue, as its own description
   *   `simulatorsBody` → the simulators catalogue, likewise
   *   `pathSteps`      → the dashboard's next-steps rail, so the signed-in
   *                      advice cannot drift from the marketing promise
   *   `ctaPrimary` / `ctaSecondary` → `marketing/cta-section.tsx`
   *
   * Thirty-six further keys went with the old page — its hero, the four
   * movements of the method, the featured ledger, the sample question and the
   * old FAQ. They had no reader left, and a copy bank whose entries outlive
   * their screens stops being a source of truth and becomes an archive.
   */
  home: {
    supporting:
      'استعد لاختبار القدرات العامة المحوسب بطريقة أوضح وأذكى، من خلال شروحات مبسطة، ومفاتيح للحل، وأسئلة تدريبية، واختبارات محاكية تساعدك على فهم السؤال والتعامل مع أنماطه بثقة.',
    pathSteps: [
      { title: 'افهم', body: 'شروحات مبسطة لكل مهارة، بلغة واضحة ومن دون حشو.' },
      { title: 'تدرّب', body: 'أسئلة تدريبية مصنّفة حسب المهارة ومستوى الصعوبة.' },
      { title: 'اختبر نفسك', body: 'اختبارات محاكية بأقسام وتوقيت يشبه تجربة الاختبار.' },
      { title: 'ادخل الاختبار بثقة', body: 'مراجعة لأدائك تُظهر ما يحتاج إلى تقوية قبل الموعد.' },
    ],
    coursesBody:
      'دروس مرتبة في وحدات، مع سؤال قصير بعد كل درس يثبّت الفكرة قبل الانتقال إلى ما بعدها.',
    simulatorsBody:
      'اختبارات مقسّمة إلى أقسام موقوتة، مع حفظ تلقائي للإجابات ومراجعة مفصّلة بعد التسليم.',
    ctaPrimary: 'ابدأ التدريب الآن',
    ctaSecondary: 'استكشف الدورات',
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
    /*
     * «اختباراتي», not «محاكياتي».
     *
     * The possessive of «محاكٍ» reads as an odd, technical word in a student's
     * own navigation — it names the machinery rather than the thing they sat.
     * The product itself is still «محاكي اختبار» in the catalogue and on its own
     * card, because that is what is being sold and describing it as a plain
     * اختبار would overclaim: this platform's exams are simulations, and the
     * independence statement rests on that distinction. Only the student's
     * personal shelf is renamed.
     *
     * Spelled with hamzat al-wasl («اختباراتي»), matching «اختبار القدرات
     * العامة» and every other use of the word in this file.
     */
    mySimulators: 'اختباراتي',
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

    /*
     * The overview's colour-coded surface.
     *
     * The hues are the colour code from globals.css and they carry the same
     * meanings here as on the homepage: blue opens the sequence and marks the
     * courses, gold marks effort and therefore the attempts, teal marks the
     * simulator, green marks readiness and therefore the score. Orders are
     * deliberately left neutral — a purchase is not one of the four movements
     * of the method, and giving it a hue would turn the code into a palette.
     */
    statCourses: 'دورات مفعّلة',
    statSimulators: 'محاكيات مفعّلة',
    statAttempts: 'محاولات مسجّلة',
    statBestScore: 'أفضل نتيجة',
    /* Shown instead of a score when nothing has been graded yet: a zero here
       would read as a result rather than as an absence. */
    statNoScore: 'لا نتيجة بعد',

    /*
     * The caption under each tile's numeral.
     *
     * Each is rendered only while it is actually true, which is why the attempt
     * one is a live count rather than a fixed phrase: the design mocked it as
     * «منها واحدة قيد التنفيذ», and printing that sentence for a student with no
     * live attempt would be the one invented figure on a strip whose whole rule
     * is that every number is read from the database.
     *
     * The first two are statements about the purchase model, not about counts,
     * so they hold for any non-zero value — and are hidden at zero, where
     * "permanent access" to nothing would read as a taunt.
     */
    statCoursesHint: 'وصول دائم',
    statSimulatorsHint: 'جاهزة للبدء',
    statAttemptsInProgress: 'منها {count} قيد التنفيذ',

    journeyTitle: 'طريقك حتى يوم الاختبار',

    startHereTitle: 'ابدأ من هنا',
    startHereBody: 'اختر مسارك وسيظهر محتواه في لوحتك مباشرة.',
    startCoursesTitle: 'دورات مرئية',
    startCoursesBody: 'شروحات مبسّطة لكل مهارة، بلغة واضحة ومن دون حشو.',
    startSimulatorsTitle: 'اختبارات محاكية',
    startSimulatorsBody: 'أقسام موقوتة وأجواء تشبه يوم الاختبار الحقيقي.',

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

    /*
     * Creating an attempt, which is a different act from starting one.
     *
     * `COPY.exam.startAction` starts the *clock* on an attempt that already
     * exists, on the instructions screen. This begins one step earlier: it asks
     * the server for an attempt and takes the student to those instructions. The
     * two are worded apart because the clock has not started yet here, and a
     * student who reads "ابدأ المحاولة" in both places would reasonably think
     * the first press already began the timing.
     */
    startSimulator: 'ابدأ المحاكاة',
    startingSimulator: 'جارٍ تجهيز المحاولة…',
    startSimulatorFailed: 'تعذّر تجهيز المحاولة، حاول مرة أخرى.',
    resumeSimulator: 'متابعة المحاولة',

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
    contactMessages: 'رسائل التواصل',
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

    /*
     * The rail's three groups. The order they impose — build the catalogue,
     * operate it, govern it — was already the order of the eleven items; naming
     * it turns a long undifferentiated list into three short ones.
     */
    railGroups: {
      catalog: 'الكتالوج',
      operations: 'التشغيل',
      governance: 'الحكم',
    },
    logoutFailed: 'تعذّر تسجيل الخروج، حاول مرة أخرى.',

    notBuiltTitle: 'لم تُبنَ هذه الشاشة بعد',
    notBuiltBody: 'المسار جاهز داخل لوحة التحكم، أما أدوات هذه الشاشة فلم تُنفَّذ بعد.',

    overviewDescription: 'ملخص موجز لحالة المنصة.',
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
      publishedProducts: 'منتجات منشورة',
      draftProducts: 'منتجات مسودة',
      students: 'حسابات طلاب',
      publishedQuestions: 'أسئلة منشورة',
      inReviewQuestions: 'أسئلة قيد المراجعة',
      draftQuestions: 'أسئلة مسودة',
      paidOrders: 'طلبات مدفوعة',
      pendingOrders: 'طلبات بانتظار الدفع',
    },
    /**
     * The work queue.
     *
     * Every row is a count of things that need a person to do something, and
     * every row links to the screen where that something is done. It is
     * deliberately not a second block of statistics: the counts above describe
     * the platform, these describe an obligation, and mixing the two would bury
     * "a payment is waiting on your decision" among "we have 264 questions".
     *
     * Zero is the good answer here, and it is stated as one — an empty queue
     * reads as "nothing is waiting", never as a screen that failed to load.
     */
    attention: {
      title: 'يحتاج إلى إجراء',
      allClearTitle: 'لا شيء ينتظر إجراءً',
      allClearBody: 'لا توجد مدفوعات موقوفة على قرار، ولا أسئلة قيد المراجعة، ولا محاكيات معطّلة.',

      paymentsNeedReview: 'مدفوعات تنتظر قرارًا',
      paymentsNeedReviewNote: 'استرداد جزئي أو حالة غير قاطعة لا يقررها النظام تلقائيًا.',

      questionsInReview: 'أسئلة قيد المراجعة',
      questionsInReviewNote: 'أُرسلت للمراجعة وتنتظر اعتمادًا أو إعادة إلى المسودة.',

      failedWebhooks: 'إشعارات دفع فاشلة',
      failedWebhooksNote: 'وصلت من مزوّد الدفع وتعذّرت معالجتها.',

      simulatorsWithoutVersion: 'محاكيات بلا إصدار مفعّل',
      simulatorsWithoutVersionNote: 'منشورة للبيع، ولا يستطيع الطالب بدء محاولة عليها.',

      review: 'مراجعة',
    },

    /** The audit trail's most recent rows, as a window onto the full screen. */
    recent: {
      title: 'آخر النشاط',
      note: 'أحدث الإجراءات الإدارية، بأسماء منفّذيها وأوقاتها.',
      viewAll: 'عرض السجل كاملًا',
      emptyTitle: 'لا يوجد نشاط مسجَّل بعد',
      emptyBody: 'يظهر هنا كل إجراء إداري فور تنفيذه.',
      systemActor: 'النظام',
    },
  },

  /**
   * The administration CRUD screens, composed from `./copy/`.
   *
   * See the note at the top of this file for why each of these is a separate
   * module rather than one more block in this literal. Ordered chrome-first,
   * then by the order the sections appear in the administration navigation, so
   * this list reads the same way the sidebar does.
   */
  adminCommon: ADMIN_COMMON_COPY,
  adminContact: ADMIN_CONTACT_COPY,
  adminProducts: ADMIN_PRODUCTS_COPY,
  adminCourses: ADMIN_COURSES_COPY,
  adminQuestions: ADMIN_QUESTIONS_COPY,
  adminSimulators: ADMIN_SIMULATORS_COPY,
  adminStudents: ADMIN_STUDENTS_COPY,
  adminOrders: ADMIN_ORDERS_COPY,
  adminEntitlements: ADMIN_ENTITLEMENTS_COPY,
  adminAttempts: ADMIN_ATTEMPTS_COPY,
  adminSettings: ADMIN_SETTINGS_COPY,
  adminAudit: ADMIN_AUDIT_COPY,
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
   * The lesson page — the watching surface itself.
   *
   * Kept apart from `COPY.lessonQuiz`, which owns the check that follows the
   * video. Everything here labels the frame around the lesson: the way back to
   * the course, how far through the course the student is, and the curriculum
   * rail beside the player.
   *
   * `{...}` placeholders are substituted at the call site.
   */
  learn: {
    /* The eyebrow over the course title in the lesson header. It names what the
       title beneath it *is*, because the bar carries no other context. */
    courseEyebrow: 'الدورة',
    backToCourse: 'العودة إلى صفحة الدورة',

    /* Progress across the whole course, counted in lessons finished. Stated in
       words as well as drawn as a meter, so the bar is never the only carrier. */
    progressLabel: 'إنجازك {done} من {total}',

    /* The curriculum rail. */
    curriculumTitle: 'محتوى الدورة',
    moduleOrdinal: 'الوحدة {index} — {title}',

    /* Lesson row states in the rail. Each is a word, never a colour alone. */
    lessonCurrent: 'قيد المشاهدة',
    lessonCompleted: 'مكتمل',
    lessonPreview: 'معاينة مجانية',

    navigationLabel: 'التنقل بين الدروس',

    /* The video slot's two honest empty states. */
    lockedTitle: 'هذا الدرس متاح بعد شراء الدورة.',
    lockedAction: 'عرض الدورة',
    noVideo: 'لم يُربط مقطع بهذا الدرس بعد.',
  },

  /**
   * The short check that can follow a lesson.
   *
   * Kept apart from `COPY.exam` on purpose. A lesson quiz has no clock, no
   * sections, no irreversible advance and no independence statement to carry: it
   * is a handful of questions a student may sit again. Borrowing the simulator's
   * wording would import promises this surface does not make — above all the
   * finality that makes the exam's warnings necessary.
   *
   * The product's own name for the object is «الاختبار القصير», the same words
   * the administration screens use in `COPY.adminCourses.quiz`. One thing, one
   * name, on both sides of the wall.
   *
   * `{...}` placeholders are substituted at the call site; the Arabic stays here
   * so each sentence is written once, whole.
   */
  lessonQuiz: {
    title: 'اختبار قصير',
    description: 'أسئلة قصيرة على هذا الدرس، نتيجتها تدريبية لك وحدك.',

    // ── Before the first attempt ──
    questionCountLabel: 'عدد الأسئلة',
    attemptsLabel: 'المحاولات المتاحة',
    attemptsUnlimited: 'غير محدودة',
    attemptsRemaining: 'المتبقي لك: {count}',
    feedbackImmediate: 'تظهر الإجابة الصحيحة بعد كل سؤال.',
    feedbackAfterSubmission: 'تظهر الإجابات الصحيحة بعد التسليم.',
    startAction: 'ابدأ الاختبار القصير',
    starting: 'جارٍ التجهيز…',
    startFailed: 'تعذّر بدء الاختبار القصير، حاول مرة أخرى.',
    retakeAction: 'أعد المحاولة',

    // ── Answering ──
    questionOfTotal: 'السؤال {current} من {total}',
    /* Deliberately not `questionOfTotal`. «السؤال ٢ من ٣» over a list of all
       three questions would name a position the student is not standing at;
       this counts what they have done. */
    answeredOfTotal: 'أجبت عن {current} من {total}',
    optionsLabel: 'الخيارات',
    passageLabel: 'النص',
    saving: 'يحفظ…',
    saved: 'تم الحفظ',
    /* Two lengths, because the state appears twice: a chip beside the counter
       and, when it is a failure, a sentence that says what it costs. */
    saveFailedLabel: 'تعذّر الحفظ',
    saveFailedBody: 'لم تصل الإجابة إلى الخادم. تحقّق من الاتصال ثم أعد المحاولة.',
    /* Said before the fact, because in immediate mode the first tap settles the
       question and there is no way back to it. */
    immediateLockNotice: 'في هذا الاختبار القصير تُحتسب الإجابة فور اختيارها ولا يمكن تغييرها.',

    // ── Submitting ──
    submitAction: 'سلّم الإجابات',
    submitting: 'جارٍ التسليم…',
    submitFailed: 'تعذّر التسليم، حاول مرة أخرى.',
    submitTitle: 'تسليم الاختبار القصير',
    submitWarning: 'بعد التسليم تظهر الإجابات الصحيحة، ولا يمكن تعديل إجابات هذه المحاولة.',
    confirmSubmit: 'نعم، سلّم',
    cancelSubmit: 'العودة إلى الأسئلة',
    unansweredNotice: 'أسئلة بلا إجابة: {count}',
    allAnswered: 'أجبت عن كل الأسئلة.',

    // ── The result ──
    resultTitle: 'نتيجة المحاولة',
    scoreLabel: 'النتيجة',
    correctCount: 'إجابات صحيحة',
    incorrectCount: 'إجابات خاطئة',
    unansweredCount: 'أسئلة بلا إجابة',
    outOfTotal: 'من {total}',
    yourAnswer: 'إجابتك',
    correctAnswer: 'الإجابة الصحيحة',
    noAnswer: 'لم تُجب',
    correctMark: 'إجابة صحيحة',
    incorrectMark: 'إجابة خاطئة',
    explanationLabel: 'الشرح',
    bestScoreLabel: 'أفضل نتيجة لك',
    attemptsUsedLabel: 'المحاولات المستخدمة',
    attemptsExhausted: 'استنفدت محاولاتك في هذا الاختبار القصير. تظل مراجعة آخر محاولة متاحة لك.',
    /* The counterpart of the simulator's «notAnOfficialScore»: a percentage on a
       screen is read as a grade unless the screen says otherwise. */
    notAGrade: 'هذه النتيجة تخص هذا الدرس وحده، ولا تُحتسب في أي تقييم ولا تظهر لأحد غيرك.',

    /* The curriculum marker. A noun phrase, because it labels a lesson row
       rather than addressing the reader. */
    curriculumMarker: 'يتضمن اختبارًا قصيرًا',

    errors: {
      notFound: 'لا يوجد اختبار قصير لهذا الدرس.',
      noAccess: 'هذا الاختبار القصير متاح بعد شراء الدورة.',
      attemptNotFound: 'هذه المحاولة غير موجودة أو لم تعد متاحة.',
      attemptFinished: 'سُلِّمت هذه المحاولة، ولا يمكن تعديل إجاباتها.',
      answerLocked: 'ظهرت إجابة هذا السؤال بالفعل، ولا يمكن تغييرها.',
      attemptsExhausted: 'استنفدت محاولاتك في هذا الاختبار القصير.',
      invalidOption: 'الخيار المحدد لا ينتمي إلى هذا السؤال.',
      questionNotInAttempt: 'هذا السؤال ليس ضمن هذه المحاولة.',
      noQuestions: 'لا توجد أسئلة متاحة في هذا الاختبار القصير حاليًا.',
    },
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
    /*
     * Two names for the navigator, and they are not redundant.
     *
     * `navigatorLabel` is the landmark's accessible name, and it says which
     * questions these are — a screen-reader user meets it out of context, with
     * no grid in front of them. `navigatorTitle` is the visible heading, beside
     * which `navigatorHint` already says «داخل هذا القسم فقط»; printing the long
     * form there wrapped to two lines and collided with that chip.
     */
    navigatorLabel: 'أسئلة القسم الحالي',
    navigatorTitle: 'خريطة الأسئلة',
    navigatorHint: 'داخل هذا القسم فقط',
    navigatorAnswered: 'مُجاب',
    navigatorUnanswered: 'بلا إجابة',
    navigatorFlagged: 'معلّم',
    goToQuestion: 'الانتقال إلى السؤال {number}',

    /*
     * The header's answered meter.
     *
     * A COUNT, not a score, and that distinction is the whole reason the wording
     * is «{answered} من {total}» rather than a percentage. The bar beside it is
     * `aria-hidden` like every bar in the product, so this line is the accessible
     * value and has to stand on its own.
     */
    answeredMeterLabel: 'الأسئلة المُجابة',
    answeredOfTotal: '{answered} من {total}',

    /*
     * Option labels, by POSITION.
     *
     * `option.key` is the bank's own identifier and is not for reading; a
     * student says «اخترت ب», so the paper is lettered the way a Saudi exam
     * paper is lettered. The list is long enough for any question the bank can
     * hold, and `optionKeyFallback` covers a question that somehow exceeds it
     * rather than rendering an empty chip.
     */
    optionLetters: ['أ', 'ب', 'ج', 'د', 'هـ', 'و', 'ز', 'ح'],
    optionKeyFallback: '•',
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
