/**
 * The products screens: list, create, edit, and the publication transitions.
 *
 * Composed into `COPY.adminProducts` by `src/lib/copy.ts`.
 *
 * The refusal messages are the reason this file is long. Every one of them names
 * the actual obstacle — a taken slug, a missing price, an order that must not
 * lose its product — because a generic "تعذّر الحفظ" on a form the administrator
 * has just filled in leaves them with nothing to do but try again identically.
 */
export const ADMIN_PRODUCTS_COPY = {
  listTitle: 'المنتجات',
  listDescription: 'الدورات ومحاكيات الاختبار المعروضة للبيع، مع أسعارها وحالة نشرها.',
  createAction: 'منتج جديد',
  createTitle: 'إضافة منتج',
  createDescription: 'يُنشأ المنتج كمسودة، فلا يظهر للطلاب حتى تنشره صراحة.',
  editTitle: 'تعديل المنتج',
  editDescription: 'التعديلات تسري على العرض الحالي فقط؛ الطلبات السابقة لا تتغيّر.',

  columns: {
    title: 'اسم المنتج',
    type: 'النوع',
    slug: 'المعرّف في الرابط',
    status: 'حالة النشر',
    price: 'السعر',
    featured: 'مميّز',
    updatedAt: 'آخر تحديث',
    actions: 'إجراءات المنتج',
  },

  filters: {
    type: 'النوع',
    status: 'حالة النشر',
    featured: 'المميّزة فقط',
    searchPlaceholder: 'ابحث باسم المنتج أو معرّفه…',
  },

  /**
   * One `{ label, hint }` pair per column of `Product`.
   *
   * The hints carry the consequences an administrator cannot see from the form:
   * that a slug is part of a public URL, that the type decides which content
   * tree the product owns, and that a price change never rewrites history.
   */
  fields: {
    type: {
      label: 'نوع المنتج',
      hint: 'يُحدَّد عند الإنشاء فقط. النوع يقرّر ما إذا كان للمنتج شجرة دروس أو إعداد محاكٍ، فلا يمكن تبديله بعد ذلك.',
    },
    slug: {
      label: 'المعرّف في الرابط',
      hint: 'أحرف لاتينية صغيرة وأرقام وشرطات فقط، مثل: verbal-foundations. يظهر في رابط صفحة المنتج، وتغييره بعد النشر يكسر الروابط المنشورة سابقًا.',
    },
    title: {
      label: 'اسم المنتج',
      hint: 'الاسم كما يراه الطالب في القائمة وفي صفحة المنتج.',
    },
    shortDescription: {
      label: 'وصف مختصر',
      hint: 'سطر أو سطران يظهران في بطاقة المنتج داخل القائمة وفي نتائج البحث.',
    },
    longDescription: {
      label: 'وصف تفصيلي',
      hint: 'يظهر في صفحة المنتج. اتركه فارغًا إن لم يكن هناك ما يُضاف على الوصف المختصر.',
    },
    coverAsset: {
      label: 'صورة الغلاف',
      hint: 'صورة عامة تُعرض في القائمة وفي صفحة المنتج. لا تضع فيها محتوى مدفوعًا: الصورة العامة تُخدَّم بلا تحقق من الوصول.',
    },
    status: {
      label: 'حالة النشر',
      hint: 'المسودة لا تظهر للطلاب ولا تُشترى. النشر يجعل المنتج قابلًا للشراء بسعره الحالي.',
    },
    priceHalalas: {
      label: 'السعر بالريال السعودي',
      hint: 'يُخزَّن السعر كعدد صحيح من الهللات، بلا كسور عشرية في قاعدة البيانات. كل طلب سابق يحتفظ بسعره وقت الشراء، فتعديل السعر هنا لا يغيّر أي طلب قديم.',
    },
    featured: {
      label: 'إبراز في الصفحة الرئيسية',
      hint: 'يظهر المنتج ضمن المختارات في الصفحة الرئيسية. لا يؤثر على السعر ولا على صلاحيات الوصول.',
    },
  },

  /**
   * Enum labels for `ProductType` and `ProductStatus`.
   *
   * `COPY.statusLabels.productType` already carries the catalogue-facing wording
   * and the strings here are identical to it by design. They are restated rather
   * than referenced because `copy.ts` composes this module — importing `COPY`
   * back would close a cycle. If one side is ever reworded, reword both.
   */
  typeLabels: {
    COURSE: 'دورة',
    EXAM_SIMULATOR: 'محاكي اختبار',
  },
  statusLabels: {
    DRAFT: 'مسودة',
    PUBLISHED: 'منشور',
    ARCHIVED: 'مؤرشف',
  },

  /**
   * Publication transitions.
   *
   * Each confirmation states what actually changes for a student and, just as
   * importantly, what does not: unpublishing a product withdraws it from the
   * catalogue, but the people who already bought it keep their access, and their
   * orders keep their amounts.
   */
  transitions: {
    publish: 'نشر المنتج',
    publishConfirmTitle: 'نشر هذا المنتج؟',
    publishConfirmBody:
      'بعد النشر يظهر المنتج في القائمة العامة ويصبح قابلًا للشراء بسعره الحالي فورًا. راجع السعر والوصف قبل المتابعة.',
    publishConfirmAction: 'نعم، انشر',

    unpublish: 'إرجاع إلى المسودة',
    unpublishConfirmTitle: 'إرجاع المنتج إلى المسودة؟',
    unpublishConfirmBody:
      'سيختفي المنتج من القائمة العامة ولن يمكن شراؤه. الطلبات السابقة ومبالغها وصلاحيات الوصول الممنوحة لا تتأثر.',
    unpublishConfirmAction: 'نعم، أرجعه إلى المسودة',

    archive: 'أرشفة المنتج',
    archiveConfirmTitle: 'أرشفة هذا المنتج؟',
    archiveConfirmBody:
      'المنتج المؤرشف لا يظهر ولا يُشترى، ويبقى محفوظًا مع طلباته. من اشتراه سابقًا يحتفظ بوصوله إليه.',
    archiveConfirmAction: 'نعم، أرشف',

    restore: 'إعادة إلى المسودة',
    restoreConfirmTitle: 'إعادة المنتج إلى المسودة؟',
    restoreConfirmBody: 'يعود المنتج قابلًا للتحرير، ويبقى مخفيًا عن الطلاب حتى تنشره من جديد.',
    restoreConfirmAction: 'نعم، أعده إلى المسودة',
  },

  /** Honest refusals: each one names the obstacle and the way past it. */
  errors: {
    notFound: 'هذا المنتج غير موجود.',
    slugTaken: 'هذا المعرّف مستخدم في منتج آخر. اختر معرّفًا مختلفًا.',
    priceRequiredToPublish: 'لا يمكن نشر منتج بلا سعر محدَّد. حدّد السعر أولًا ثم انشر.',
    descriptionRequiredToPublish: 'لا يمكن النشر قبل كتابة الوصف المختصر، فهو ما يظهر في القائمة.',
    typeImmutable: 'لا يمكن تغيير نوع المنتج بعد إنشائه، لأنه يحدّد المحتوى المرتبط به.',
    deleteBlockedByOrders:
      'لا يمكن حذف منتج له طلبات أو صلاحيات وصول ممنوحة. أرشفه بدلًا من ذلك، حتى يبقى سجل الشراء ووصول من اشتروه سليمين.',
    coverAssetNotFound: 'صورة الغلاف المحددة غير موجودة.',
    coverAssetNotPublic:
      'صورة الغلاف يجب أن تكون صورة عامة. الصور المحمية مخصّصة لمحتوى بنك الأسئلة ولا تُعرض في القائمة العامة.',
    slugImmutableAfterOrders: 'لا يمكن تغيير معرّف منتج له طلبات مرتبطة به.',
  },

  toast: {
    created: 'أُضيف المنتج كمسودة.',
    updated: 'حُفظت تعديلات المنتج.',
    published: 'نُشر المنتج وأصبح قابلًا للشراء.',
    unpublished: 'أُرجع المنتج إلى المسودة.',
    archived: 'أُرشف المنتج.',
    deleted: 'حُذف المنتج.',
  },

  empty: {
    nothingYetTitle: 'لا توجد منتجات بعد',
    nothingYetBody: 'لم يُضف أي منتج حتى الآن. ابدأ بإضافة دورة أو محاكي اختبار.',
    nothingYetAction: 'إضافة أول منتج',
  },
} as const;
