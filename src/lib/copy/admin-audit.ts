/**
 * The audit log: who did what, to which record, and when.
 *
 * Composed into `COPY.adminAudit` by `src/lib/copy.ts`.
 *
 * `actionLabels` is keyed by the exact string stored in `AuditLog.action`, which
 * is the value side of `AUDIT_ACTIONS` in
 * `src/services/audit/audit.service.ts` — the column is `String` in the schema,
 * not an enum, so a lookup is the only way to render a row in Arabic. Keeping the
 * two files in step is a real obligation: an action added there without a label
 * here renders through `unknownAction`, which is honest but useless.
 *
 * Three things this screen deliberately refuses to be:
 *
 *  - **It is not editable.** The trail is append-only. There is no delete, no
 *    correction and no bulk clear, because a trail somebody can tidy is not
 *    evidence of anything.
 *  - **It is not a debug log.** Rows describe administrative decisions, not
 *    requests. A page nobody changed anything on leaves no row.
 *  - **It is not a place secrets can appear.** Metadata is filtered before it is
 *    written, and any field whose name looks like a credential is stored as a
 *    redaction marker. The viewer says so, so a reader does not mistake
 *    `[redacted]` for the actual stored value.
 */
export const ADMIN_AUDIT_COPY = {
  listTitle: 'سجل النشاط',
  listDescription: 'سجل الإجراءات الإدارية: من نفّذ الإجراء، ومتى، وعلى أي عنصر.',

  detailTitle: 'تفاصيل الإجراء',
  detailDescription: 'الإجراء كما سُجِّل، مع ما تغيّر قبله وبعده.',
  backToList: 'العودة إلى سجل النشاط',

  columns: {
    createdAt: 'التاريخ والوقت',
    actor: 'المنفّذ',
    actorEmail: 'بريد المنفّذ',
    action: 'الإجراء',
    targetType: 'نوع العنصر',
    targetId: 'معرّف العنصر',
    summary: 'ملخّص التغيير',
    requestId: 'معرّف الطلب',
    actions: 'إجراءات السجل',
  },

  filters: {
    action: 'الإجراء',
    actionGroup: 'مجال الإجراء',
    targetType: 'نوع العنصر',
    actor: 'المنفّذ',
    targetId: 'معرّف العنصر',
    from: 'من تاريخ',
    to: 'حتى تاريخ',
    searchPlaceholder: 'ابحث ببريد المنفّذ أو معرّف العنصر…',
    searchNote: 'يقبل البحث بريد المنفّذ كاملًا أو جزءًا منه، أو معرّف عنصر كاملًا.',
  },

  fields: {
    createdAt: { label: 'التاريخ والوقت', hint: 'لحظة تنفيذ الإجراء بتوقيت الرياض.' },
    actor: {
      label: 'المنفّذ',
      hint: 'الحساب الذي نفّذ الإجراء. يُحفظ بريده نسخةً ثابتة، فيبقى السجل مقروءًا حتى لو حُذف الحساب لاحقًا.',
    },
    action: { label: 'الإجراء', hint: 'نوع التغيير، من قائمة مغلقة لا تُكتب يدويًا.' },
    targetType: { label: 'نوع العنصر', hint: 'الجدول الذي ينتمي إليه العنصر المتأثر.' },
    targetId: { label: 'معرّف العنصر', hint: 'معرّف الصف المتأثر، إن كان له معرّف.' },
    requestId: {
      label: 'معرّف الطلب',
      hint: 'يربط هذا الصف بسطور السجل التقني للطلب نفسه، للتشخيص.',
    },
    metadata: {
      label: 'تفاصيل التغيير',
      hint: 'الحقول التي تغيّرت فقط، بقيمتها قبل التغيير وبعده.',
    },
  },

  /** Rendered when the actor column is null: the platform acted, not a person. */
  systemActor: 'المنصة',
  systemActorHint: 'إجراء تلقائي لم ينفّذه شخص، مثل معالجة إشعار من مزوّد الدفع.',
  deletedActor: 'حساب محذوف',
  noTarget: 'بلا عنصر محدد',
  unknownAction: 'إجراء غير معروف',
  unknownActionHint:
    'هذا الإجراء مسجَّل في قاعدة البيانات بلا وصف عربي مطابق. الصف صحيح، والناقص هو الترجمة.',
  unknownTargetType: 'نوع غير معروف',

  /**
   * Arabic labels for every value in `AUDIT_ACTIONS`.
   *
   * Written as noun phrases rather than sentences, because they are read in a
   * narrow table column next to a name and a timestamp: "نشر منتج" scans, "قام
   * فلان بنشر المنتج" does not.
   */
  actionLabels: {
    // ── Catalogue ──
    'product.created': 'إنشاء منتج',
    'product.updated': 'تعديل منتج',
    'product.published': 'نشر منتج',
    'product.unpublished': 'إرجاع منتج إلى المسودة',
    'product.archived': 'أرشفة منتج',
    'product.deleted': 'حذف منتج',

    // ── Question bank ──
    'question.created': 'إنشاء سؤال',
    'question.updated': 'تعديل سؤال',
    'question.workflow_changed': 'تغيير حالة مراجعة سؤال',
    'question.published': 'نشر سؤال',
    'question.retired': 'سحب سؤال من الخدمة',
    'question.deleted': 'حذف سؤال',

    // ── Media ──
    'media.uploaded': 'رفع صورة',
    'media.replaced': 'استبدال صورة',
    'media.deleted': 'حذف صورة',

    // ── Course content ──
    'course.updated': 'تعديل إعدادات دورة',
    'module.created': 'إنشاء وحدة',
    'module.updated': 'تعديل وحدة',
    'module.deleted': 'حذف وحدة',
    'module.reordered': 'إعادة ترتيب الوحدات',
    'module.published': 'نشر وحدة',
    'module.unpublished': 'إرجاع وحدة إلى المسودة',
    'module.archived': 'أرشفة وحدة',
    'lesson.created': 'إنشاء درس',
    'lesson.updated': 'تعديل درس',
    'lesson.deleted': 'حذف درس',
    'lesson.reordered': 'إعادة ترتيب الدروس',
    'lesson.published': 'نشر درس',
    'lesson.unpublished': 'إرجاع درس إلى المسودة',
    'lesson.archived': 'أرشفة درس',
    'lesson_quiz.created': 'إضافة سؤال قصير إلى درس',
    'lesson_quiz.updated': 'تعديل إعدادات سؤال قصير',
    'lesson_quiz.deleted': 'إزالة سؤال قصير من درس',
    'lesson_quiz.questions_changed': 'تغيير أسئلة سؤال قصير',
    'lesson_quiz.reordered': 'إعادة ترتيب أسئلة سؤال قصير',

    'video.registered': 'تسجيل مقطع فيديو',
    'video.updated': 'تحديث بيانات مقطع فيديو',
    'video.deleted': 'إزالة تسجيل مقطع فيديو',

    // ── Exam simulators ──
    'simulator.updated': 'تعديل إعدادات محاكٍ',
    'exam_version.created': 'إنشاء إصدار اختبار',
    'exam_version.updated': 'تعديل إصدار اختبار',
    'exam_version.duplicated': 'إنشاء نسخة من إصدار اختبار',
    'exam_version.deleted': 'حذف إصدار اختبار',
    'exam_version.published': 'نشر إصدار اختبار',
    'exam_version.retired': 'سحب إصدار اختبار من الخدمة',
    'exam_version.activated': 'اعتماد إصدار اختبار',
    'exam_version.deactivated': 'إلغاء اعتماد إصدار اختبار',
    'exam_section.created': 'إنشاء قسم اختبار',
    'exam_section.updated': 'تعديل قسم اختبار',
    'exam_section.deleted': 'حذف قسم اختبار',
    'exam_section.reordered': 'إعادة ترتيب أقسام الاختبار',
    'exam_section.questions_changed': 'تغيير أسئلة قسم اختبار',
    'blueprint_rule.created': 'إنشاء قاعدة اختيار أسئلة',
    'blueprint_rule.updated': 'تعديل قاعدة اختيار أسئلة',
    'blueprint_rule.deleted': 'حذف قاعدة اختيار أسئلة',
    'blueprint_rule.reordered': 'إعادة ترتيب قواعد الاختيار',

    // ── Student accounts ──
    'student.blocked': 'إيقاف حساب',
    'student.unblocked': 'إعادة تفعيل حساب',
    'student.sessions_revoked': 'إنهاء جلسات حساب',
    'student.updated': 'تعديل بيانات حساب',
    'student.role_changed': 'تغيير دور حساب',

    // ── Orders and payments ──
    'order.cancelled': 'إلغاء طلب',
    'order.reconcile_requested': 'طلب تحقق من دفع',
    'payment.refund_requested': 'طلب استرداد',
    'payment.refund_failed': 'فشل تنفيذ استرداد',
    'payment.review_flagged': 'رفع عملية للمراجعة اليدوية',
    'payment.review_cleared': 'إنهاء مراجعة يدوية',
    'payment.reconcile.fulfilled': 'فتح وصول بعد تأكيد دفع',
    'payment.reconcile.revoked': 'سحب وصول بعد استرداد',
    'payment.reconcile.mismatch': 'اختلاف بين عملية دفع وطلبها',
    'payment.reconcile.needs_review': 'رفع عملية دفع للمراجعة',
    'payment.reconcile.transition_refused': 'رفض تغيير حالة طلب',

    // ── Access ──
    'entitlement.granted': 'منح وصول',
    'entitlement.revoked': 'سحب وصول',
    'entitlement.reactivated': 'إعادة وصول',

    // ── Platform settings ──
    'setting.updated': 'تعديل إعداد',
  },

  /**
   * Coarse grouping for the action filter.
   *
   * The action list is long enough that a flat `<select>` of seventy options is
   * unusable; the group narrows it first. Keys match the first dot-separated
   * segment family, not the segment itself, so `module.*` and `lesson.*` both sit
   * under the course group where an administrator would look for them.
   */
  actionGroupLabels: {
    product: 'المنتجات',
    question: 'بنك الأسئلة',
    media: 'الصور والوسائط',
    course: 'محتوى الدورات',
    simulator: 'محاكيات الاختبار',
    student: 'حسابات الطلاب',
    order: 'الطلبات والمدفوعات',
    entitlement: 'الصلاحيات والوصول',
    setting: 'الإعدادات',
  },

  /** Arabic names for `AuditTargetType`, spelled as the Prisma model. */
  targetTypeLabels: {
    Product: 'منتج',
    Question: 'سؤال',
    QuestionStimulus: 'مادة مرافقة',
    MediaAsset: 'صورة',
    Course: 'دورة',
    CourseModule: 'وحدة',
    Lesson: 'درس',
    LessonQuiz: 'سؤال قصير',
    VideoAsset: 'مقطع فيديو',
    ExamSimulator: 'محاكي اختبار',
    ExamVersion: 'إصدار اختبار',
    ExamSection: 'قسم اختبار',
    ExamBlueprintRule: 'قاعدة اختيار أسئلة',
    ExamAttempt: 'محاولة اختبار',
    Order: 'طلب',
    PaymentAttempt: 'عملية دفع',
    User: 'حساب',
    Entitlement: 'صلاحية وصول',
    SiteSetting: 'إعداد',
  },

  /** The before/after viewer. */
  metadata: {
    title: 'تفاصيل التغيير',
    description: 'الحقول التي تغيّرت في هذا الإجراء.',
    fieldColumn: 'الحقل',
    beforeColumn: 'قبل',
    afterColumn: 'بعد',
    valueColumn: 'القيمة',
    createdNote: 'إجراء إنشاء: لا توجد قيم سابقة، وكل ما هو مذكور أُضيف.',
    deletedNote: 'إجراء حذف: القيم المذكورة هي ما كان عليه العنصر قبل حذفه.',
    emptyValue: 'فارغ',
    redactedNote: 'الحقول التي قد تحمل سرًا تُستبدل قيمتها قبل كتابتها في السجل.',
    truncatedNote: 'القيم الطويلة جدًا محفوظة مقتطعة، والبنى العميقة محفوظة كإشارة إلى وجودها.',
    /**
     * The disclosure controls.
     *
     * A row's details are collapsed in the list and opened in place, so reading
     * one change never costs the reader the position they had in the table.
     * `showValue` opens a single long value — a pasted description, a nested
     * object — rather than letting it stretch the column it sits in.
     */
    showChanges: 'عرض تفاصيل التغيير',
    showValue: 'عرض القيمة كاملة',
    /** The summary cell for a row that carries no metadata at all. */
    noneShort: 'بلا تفاصيل',
    /** `{count}` is how many fields the row records a change to. */
    fieldsChanged: 'حقول متغيّرة: {count}',
    empty: {
      nothingYetTitle: 'لا توجد تفاصيل مسجّلة',
      nothingYetBody:
        'لم تُسجَّل تفاصيل مع هذا الإجراء، وهو ما يحدث لإجراء لا يحمل تغييرًا في الحقول.',
    },
  },

  actions: {
    openTarget: 'فتح العنصر',
    openActor: 'فتح حساب المنفّذ',
    copyTargetId: 'نسخ معرّف العنصر',
    copyRequestId: 'نسخ معرّف الطلب',
  },

  notices: {
    appendOnly:
      'هذا السجل يُضاف إليه فقط. لا يمكن تعديل صف ولا حذفه ولا تفريغ السجل من لوحة التحكم.',
    writtenWithChange:
      'يُكتب صف السجل داخل المعاملة نفسها التي نفّذت التغيير، فلا يُسجَّل إجراء لم يتم فعلًا، ولا يتم إجراء بلا تسجيل.',
    noSecrets: 'لا تدخل هذا السجل أي كلمات مرور ولا رموز ولا بيانات بطاقات.',
    notEveryRead: 'يسجَّل التغيير لا الاطلاع: فتح شاشة أو تصفح قائمة لا ينتج عنه صف هنا.',
    targetMayBeGone:
      'قد يشير صف إلى عنصر حُذف بعد ذلك. بقاء الصف مقصود: حذف العنصر واقعة يجب أن تبقى مقروءة.',
  },

  errors: {
    notFound: 'هذا الصف غير موجود في سجل النشاط.',
    targetUnavailable: 'العنصر المرتبط بهذا الصف لم يعد موجودًا.',
    editUnavailable: 'سجل النشاط لا يُعدَّل.',
    deleteUnavailable: 'لا يمكن حذف صفوف سجل النشاط ولا تفريغه.',
    exportUnavailable: 'تصدير السجل غير متاح من هذه الشاشة.',
  },

  empty: {
    nothingYetTitle: 'لا توجد إجراءات مسجّلة بعد',
    nothingYetBody: 'لم يُنفَّذ أي إجراء إداري حتى الآن، فالسجل فارغ.',
  },
} as const;
