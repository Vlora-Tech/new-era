/**
 * Chrome shared by every administration CRUD screen.
 *
 * Composed into `COPY.adminCommon` by `src/lib/copy.ts`; the note above that
 * composition explains why the administration strings live in separate modules.
 *
 * Nothing screen-specific belongs here, and the test is the noun: the moment a
 * sentence has to say "منتج" or "سؤال" it has stopped being shareable and
 * belongs in that screen's module. The alternative is a string generic enough to
 * fit everywhere, which reads as machine translation on every screen that
 * borrows it.
 */
export const ADMIN_COMMON_COPY = {
  /**
   * Column headings that recur across the lists.
   *
   * `actions` goes into a visually hidden `<th>`: that column carries buttons
   * rather than a label, and a header cell with no accessible name leaves every
   * control in it unannounced when a screen reader walks the table by column.
   */
  table: {
    id: 'المعرّف',
    createdAt: 'تاريخ الإنشاء',
    updatedAt: 'آخر تحديث',
    createdBy: 'أنشأه',
    updatedBy: 'عدّله',
    status: 'الحالة',
    actions: 'إجراءات',
    /** Appended to a table's screen-reader caption. */
    captionSuffix: 'جدول بيانات',
  },

  pagination: {
    label: 'التنقل بين الصفحات',
    previous: 'الصفحة السابقة',
    next: 'الصفحة التالية',
    first: 'الصفحة الأولى',
    last: 'الصفحة الأخيرة',
    pageOfTotal: 'الصفحة {current} من {total}',
    /** `{from}` and `{to}` are row numbers; `{total}` is the whole result set. */
    rangeSummary: 'عرض {from}–{to} من {total}',
    perPage: 'عدد الصفوف في الصفحة',
  },

  search: {
    label: 'بحث',
    placeholder: 'اكتب كلمة للبحث…',
    submit: 'ابحث',
    clear: 'مسح البحث',
    /** Said plainly, so a filtered list is never read as the whole list. */
    activeNote: 'النتائج المعروضة مقيّدة بالبحث الحالي.',
  },

  filter: {
    label: 'تصفية',
    all: 'الكل',
    apply: 'تطبيق',
    clear: 'إزالة كل عوامل التصفية',
    activeCount: 'عوامل تصفية مفعّلة: {count}',
  },

  sort: {
    label: 'الترتيب',
    newestFirst: 'الأحدث أولًا',
    oldestFirst: 'الأقدم أولًا',
    alphabetical: 'أبجديًا',
    ascending: 'تصاعدي',
    descending: 'تنازلي',
  },

  actions: {
    create: 'إضافة',
    save: 'حفظ',
    saving: 'جارٍ الحفظ…',
    cancel: 'إلغاء',
    delete: 'حذف',
    deleting: 'جارٍ الحذف…',
    edit: 'تعديل',
    view: 'عرض',
    duplicate: 'إنشاء نسخة',
    refresh: 'تحديث',
    backToList: 'العودة إلى القائمة',
    retry: 'إعادة المحاولة',
  },

  /**
   * Delete prompts.
   *
   * `blocked*` is a refusal rather than a warning. Every edge that touches money,
   * entitlement history or a submitted attempt is `Restrict` in the schema, so
   * the server declines instead of cascading; saying why is what stops an
   * administrator from pressing the same button again.
   */
  confirmDelete: {
    title: 'تأكيد الحذف',
    body: 'سيُحذف هذا العنصر نهائيًا، ولا يمكن التراجع بعد التأكيد.',
    confirm: 'نعم، احذف',
    cancel: 'تراجع',
    blockedTitle: 'لا يمكن حذف هذا العنصر',
    blockedBody:
      'هذا العنصر مستخدم في مكان آخر، وحذفه سيترك محتوى يشير إلى شيء غير موجود. أوقفه أو أرشفه بدلًا من حذفه.',
  },

  toast: {
    createSuccess: 'تمت الإضافة.',
    updateSuccess: 'حُفظت التعديلات.',
    deleteSuccess: 'تم الحذف.',
    // Each failure states what did *not* happen. A rejected save leaves the form
    // looking exactly as it did a moment earlier, which is indistinguishable
    // from a save that worked unless the sentence says otherwise.
    createFailed: 'تعذّرت الإضافة، ولم يُحفظ أي شيء.',
    updateFailed: 'تعذّر حفظ التعديلات، ولم يتغيّر شيء.',
    deleteFailed: 'تعذّر الحذف، ولم يتغيّر شيء.',
    noChanges: 'لا توجد تعديلات لحفظها.',
  },

  /**
   * Two different absences, worded apart on purpose.
   *
   * `nothingYet` means the platform genuinely holds none of these, and its
   * action is "add the first one". `noResults` means rows exist but none match
   * the current search or filter, where offering "add one" would be advice for
   * the wrong problem. The third case — a query that threw — is `ErrorState` and
   * deliberately has no entry here, because an outage worded as emptiness reads
   * as a true fact about the business.
   */
  emptiness: {
    nothingYetTitle: 'لا توجد عناصر بعد',
    nothingYetBody: 'لم يُضف أي عنصر حتى الآن.',
    noResultsTitle: 'لا نتائج مطابقة',
    noResultsBody:
      'توجد عناصر، لكن لا شيء منها يطابق البحث أو عوامل التصفية الحالية. وسّع النطاق أو أزل التصفية.',
    noResultsAction: 'إزالة كل عوامل التصفية',
  },

  form: {
    requiredMark: 'مطلوب',
    optionalMark: 'اختياري',
    /**
     * The empty row of a `<select>` inside a form.
     *
     * Deliberately not `filter.all` ("الكل"): above a list that row means "do not
     * narrow the results", while inside a form it means "nothing has been chosen
     * yet" — the same control, two opposite claims. A punctuation placeholder
     * such as an em dash reads correctly on screen and announces as nothing at
     * all, which leaves a screen-reader user with an unlabelled first option.
     */
    unchosen: 'لم يُحدَّد بعد',
    /** Summary panel above a rejected form, linking to the fields at fault. */
    errorsTitle: 'تحقّق من الحقول التالية',
    errorsBody: 'لم يُرسل النموذج. صحّح الحقول المذكورة ثم أعد المحاولة.',
    errorsCount: 'حقول تحتاج إلى تصحيح: {count}',
    unsavedTitle: 'لديك تعديلات غير محفوظة',
    unsavedBody: 'إن غادرت الآن ستفقد ما لم يُحفظ.',
    unsavedLeave: 'غادر دون حفظ',
    unsavedStay: 'ابقَ في الصفحة',
  },

  notices: {
    /** Stated on the mutating screens, because the trail is not a secret. */
    auditedAction: 'يُسجَّل كل إجراء إداري في سجل النشاط باسم منفّذه وتاريخه.',
    /** For a control that exists as chrome before the capability behind it does. */
    unavailableHere: 'هذه الأداة غير متاحة في هذه الشاشة بعد.',
  },
} as const;
