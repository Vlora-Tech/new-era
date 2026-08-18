/**
 * Platform settings: the small validated key/value store behind
 * `SiteSetting`.
 *
 * Composed into `COPY.adminSettings` by `src/lib/copy.ts`.
 *
 * `SiteSetting` holds legal versions, contact details and one product default.
 * It deliberately holds no secrets — no API key, no signing secret, no provider
 * credential — and the notice says so at the top of the screen, because a
 * settings table is exactly where somebody eventually tries to paste one.
 *
 * The legal version fields carry the only genuinely dangerous consequence on
 * this screen, and their hints spell it out. A consent row records the version
 * string that was in force when a person agreed. Publishing a new version is
 * therefore a statement that the text changed; typing a new string because the
 * old one "looked wrong" silently claims that everyone who agreed before agreed
 * to something else.
 */
export const ADMIN_SETTINGS_COPY = {
  title: 'الإعدادات',
  description: 'إعدادات المنصة: بيانات التواصل وإصدارات المستندات النظامية والقيم الافتراضية.',

  saveAction: 'حفظ الإعدادات',
  saving: 'جارٍ الحفظ…',
  resetAction: 'استعادة القيم المحفوظة',
  lastUpdated: 'آخر تحديث',
  updatedBy: 'عدّله',
  neverUpdated: 'لم يُعدَّل بعد',

  /** Section headings, one per key family. */
  groups: {
    legal: {
      title: 'المستندات النظامية',
      description:
        'أرقام إصدارات الشروط وسياسة الخصوصية المعمول بها الآن. تُسجَّل مع كل موافقة جديدة.',
    },
    contact: {
      title: 'بيانات التواصل',
      description: 'ما يُعرض للزوار في صفحة التواصل وتذييل الموقع.',
    },
    exam: {
      title: 'إعدادات الاختبار',
      description: 'قيم افتراضية يستخدمها المحاكي وتصنيف المسارات.',
    },
  },

  /**
   * One entry per `SiteSetting` key. The stored key is named in each comment so
   * a reader can move between this file and the row without guessing.
   */
  fields: {
    /** Key: `legal.termsVersion` */
    termsVersion: {
      label: 'إصدار الشروط والأحكام',
      hint: 'نص قصير يميّز نسخة المستند، مثل: 2026-08-17.1. تُحفظ هذه القيمة مع موافقة كل مستخدم جديد، فلا تغيّرها إلا عند تغيّر نص المستند فعلًا.',
      placeholder: '2026-08-17.1',
    },
    /** Key: `legal.privacyVersion` */
    privacyVersion: {
      label: 'إصدار سياسة الخصوصية',
      hint: 'نص قصير يميّز نسخة المستند. تُحفظ مع موافقة كل مستخدم جديد على النحو نفسه.',
      placeholder: '2026-08-17.1',
    },
    /** Key: `contact.email` */
    contactEmail: {
      label: 'البريد الإلكتروني للتواصل',
      hint: 'يظهر للزوار في صفحة التواصل. استخدم عنوانًا مُراقَبًا فعلًا.',
      placeholder: 'support@example.com',
    },
    /** Key: `contact.phone` */
    contactPhone: {
      label: 'رقم التواصل',
      hint: 'اختياري. اتركه فارغًا إن لم يكن هناك رقم يُردّ عليه — رقم معطّل أسوأ من غيابه.',
      placeholder: '+9665XXXXXXXX',
    },
    /** Key: `exam.trackMapping` */
    examTrackMapping: {
      label: 'تصنيف المسارات',
      hint: 'يربط أسماء المسارات المعلنة بالمسارين العلمي والنظري في المنصة. سجّل معه اسم المصدر وتاريخ مراجعته، فهو تصنيف مأخوذ عن جهة أخرى لا اجتهاد داخلي.',
      sourceLabel: 'ملاحظة المصدر',
      sourceHint: 'من أين جاء هذا التصنيف ومتى راجعته المنصة.',
      scientificLabel: 'المسارات المحسوبة على المسار العلمي',
      theoreticalLabel: 'المسارات المحسوبة على المسار النظري',
      listHint: 'اكتب كل مسار في سطر مستقل، بالاسم المعلن حرفيًا.',
    },
  },

  /**
   * Changing a legal version is the one action here with a confirmation, and the
   * body states the consequence in terms of consent records rather than of the
   * field being edited.
   */
  confirmLegalChange: {
    title: 'تغيير إصدار مستند نظامي؟',
    body: 'ستُسجَّل هذه القيمة الجديدة مع موافقة كل من يسجّل بعد الآن. الموافقات السابقة تبقى مرتبطة بإصدارها القديم.',
    confirm: 'نعم، غيّر الإصدار',
    cancel: 'تراجع',
    reminder: 'تأكد من نشر نص المستند الجديد قبل تغيير رقم إصداره.',
  },

  notices: {
    noSecrets:
      'لا تُحفظ هنا أي أسرار: مفاتيح مزوّد الدفع وأسرار التوقيع ومفاتيح التخزين تُقرأ من متغيّرات البيئة على الخادم، ولا تظهر في أي شاشة.',
    appliesImmediately: 'يسري الإعداد فور حفظه، بلا إعادة تشغيل ولا انتظار.',
    legalVersionMeaning:
      'رقم الإصدار ليس تاريخ تعديل: هو ما يُثبت لاحقًا أي نص وافق عليه كل مستخدم. لا تغيّره إلا مع تغيّر النص.',
    contactIsPublic: 'بيانات التواصل تُعرض لأي زائر. لا تضع فيها بريدًا شخصيًا أو رقمًا خاصًا.',
    trackMappingSource:
      'تصنيف المسارات مأخوذ عن مصدر معلن. احتفظ باسم المصدر وتاريخ مراجعته حتى يبقى الاجتهاد مقروءًا.',
    auditedAction: 'يُسجَّل كل تعديل هنا في سجل النشاط باسم منفّذه وتاريخه، مع القيمة قبله وبعده.',
  },

  errors: {
    notFound: 'هذا الإعداد غير موجود.',
    unknownKey: 'هذا المفتاح ليس من الإعدادات المعروفة، فلم يُحفظ شيء.',
    invalidValue: 'قيمة هذا الإعداد لا تطابق الشكل المطلوب له.',
    versionFormat: 'رقم الإصدار يجب أن يكون نصًا قصيرًا بلا مسافات، مثل: 2026-08-17.1.',
    emailFormat: 'اكتب بريدًا إلكترونيًا صحيحًا.',
    phoneFormat: 'اكتب رقم جوال سعودي صحيح، أو اترك الحقل فارغًا.',
    trackMappingFormat:
      'تصنيف المسارات يجب أن يحتوي على قائمتي المسار العلمي والنظري، ولو كانت إحداهما فارغة.',
    trackMappingDuplicate: 'المسار الواحد لا يمكن أن يكون علميًا ونظريًا في الوقت نفسه.',
    /**
     * The server's refusal when a legal version arrives changed but unconfirmed.
     *
     * The screen asks first, so an administrator using the form never sees this.
     * It exists for the request that skipped the form — and that is the request
     * worth refusing, because the consequence it carries is invisible from the
     * outside: every consent recorded from that moment names a different text.
     */
    legalChangeUnconfirmed:
      'تغيير إصدار مستند نظامي يحتاج إلى تأكيد صريح، ولم يصل التأكيد. لم يُحفظ شيء.',
    saveFailed: 'تعذّر حفظ الإعدادات، ولم يتغيّر شيء.',
    noChanges: 'لا توجد تعديلات لحفظها.',
  },

  toast: {
    saved: 'حُفظت الإعدادات.',
    savedOne: 'حُفظ الإعداد.',
    saveFailed: 'تعذّر الحفظ، ولم يتغيّر شيء.',
  },

  /**
   * A settings screen is never truly empty — the keys exist in code even when no
   * row has been written yet — so this is the "not seeded" case, distinct from a
   * failed read, which renders `ErrorState`.
   */
  empty: {
    nothingYetTitle: 'لم تُضبط الإعدادات بعد',
    nothingYetBody:
      'لا توجد قيم محفوظة لهذه الإعدادات. تُعرض القيم الافتراضية حتى تحفظ قيمك، فاحفظها ولو دون تغيير لتثبيتها.',
  },
} as const;
