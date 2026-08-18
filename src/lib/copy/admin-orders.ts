/**
 * Orders, payment attempts and the webhook inbox behind them.
 *
 * Composed into `COPY.adminOrders` by `src/lib/copy.ts`.
 *
 * This is the screen where a wrong word costs money, so four rules govern every
 * sentence in it:
 *
 *  1. **An order is a historical record, not a form.** `amountHalalas`,
 *     `productTitle` and `productType` are snapshots taken when the order was
 *     created. Nothing here offers to edit them, and the notices say why: a
 *     receipt that changes after the fact is not a receipt.
 *  2. **The gateway is the authority on money.** The platform never marks an
 *     order paid or refunded on its own say-so; it asks the provider and records
 *     the answer. Every action below is therefore worded as "اطلب" or "تحقّق",
 *     never as "غيّر الحالة".
 *  3. **Amounts are integer halalas.** They are displayed in riyals but stored
 *     without a fractional part anywhere, and the refund field says so, because a
 *     partial refund typed as `12.5` is the shape of a real defect.
 *  4. **A provider's own error text is never shown.** It is recorded server-side.
 *     What appears here is a payment outcome in Arabic.
 */
export const ADMIN_ORDERS_COPY = {
  listTitle: 'الطلبات والمدفوعات',
  listDescription: 'الطلبات ومحاولات الدفع وحالات الاسترداد، مع أثر كل عملية على وصول الطالب.',

  detailTitle: 'تفاصيل الطلب',
  detailDescription: 'الطلب ومحاولات الدفع عليه، وما ترتّب عليه من وصول.',
  backToList: 'العودة إلى الطلبات',

  columns: {
    reference: 'رقم الطلب',
    student: 'الطالب',
    email: 'البريد الإلكتروني',
    product: 'المنتج',
    productType: 'نوع المنتج',
    amount: 'المبلغ',
    status: 'حالة الطلب',
    provider: 'مزوّد الدفع',
    paymentStatus: 'حالة الدفع',
    needsReview: 'تحتاج مراجعة',
    createdAt: 'تاريخ الطلب',
    paidAt: 'تاريخ الدفع',
    updatedAt: 'آخر تحديث',
    actions: 'إجراءات الطلب',
  },

  filters: {
    status: 'حالة الطلب',
    provider: 'مزوّد الدفع',
    mode: 'وضع الدفع',
    paymentStatus: 'حالة عملية الدفع',
    needsReview: 'ما يحتاج مراجعة يدوية فقط',
    from: 'من تاريخ',
    to: 'حتى تاريخ',
    searchPlaceholder: 'ابحث برقم الطلب أو بريد الطالب أو اسم المنتج…',
    searchNote: 'يقبل البحث رقم الطلب كاملًا، أو جزءًا من بريد الطالب أو اسم المنتج.',
  },

  /** Headings for the record view. */
  sections: {
    order: 'بيانات الطلب',
    student: 'الطالب',
    payments: 'محاولات الدفع',
    access: 'أثر الطلب على الوصول',
    webhooks: 'إشعارات مزوّد الدفع',
    activity: 'الإجراءات الإدارية على هذا الطلب',
  },

  /**
   * Order fields, all read-only.
   *
   * The hints on the snapshot columns are the whole point of the group: an
   * administrator looking at an order whose product now costs more needs to know
   * that the difference is history, not an error.
   */
  fields: {
    id: { label: 'رقم الطلب', hint: 'معرّف الطلب كما يظهر للطالب وفي مراسلات الدعم.' },
    student: { label: 'الطالب', hint: 'صاحب الطلب. لا يمكن نقل طلب من حساب إلى آخر.' },
    product: { label: 'المنتج', hint: 'المنتج الحالي المرتبط بالطلب.' },
    productTitle: {
      label: 'اسم المنتج وقت الشراء',
      hint: 'نسخة محفوظة لحظة إنشاء الطلب. تغيير اسم المنتج لاحقًا لا يغيّرها.',
    },
    productType: { label: 'نوع المنتج وقت الشراء', hint: 'نسخة محفوظة مع الطلب.' },
    amount: {
      label: 'المبلغ',
      hint: 'المبلغ المتفق عليه لحظة إنشاء الطلب، ثابت لا يتغيّر بتغيّر سعر المنتج. يُخزَّن كعدد صحيح من الهللات.',
    },
    currency: { label: 'العملة', hint: 'كل المبالغ بالريال السعودي.' },
    status: { label: 'حالة الطلب', hint: 'تُشتق من نتيجة عملية الدفع لدى المزوّد.' },
    provider: { label: 'مزوّد الدفع', hint: 'الجهة التي نُفِّذت عبرها عملية الدفع.' },
    checkoutRequestKey: {
      label: 'مفتاح طلب الشراء',
      hint: 'مفتاح يمنع تكرار الطلب: إعادة الإرسال بالمفتاح نفسه تعيد الطلب ذاته بدل إنشاء طلب ثانٍ.',
    },
    createdAt: { label: 'تاريخ الطلب', hint: '' },
    paidAt: { label: 'تاريخ تأكيد الدفع', hint: 'وقت تحقّق الخادم من الدفع لدى المزوّد.' },
    failedAt: { label: 'تاريخ الفشل', hint: '' },
    cancelledAt: { label: 'تاريخ الإلغاء', hint: '' },
    refundedAt: { label: 'تاريخ الاسترداد', hint: '' },
  },

  /** `PaymentAttempt` rows under an order. */
  payments: {
    title: 'محاولات الدفع',
    description: 'كل محاولة دفع على هذا الطلب. تعدّد المحاولات طبيعي.',
    columns: {
      providerPaymentId: 'رقم العملية لدى المزوّد',
      status: 'الحالة',
      amount: 'المبلغ',
      refunded: 'المسترد',
      mode: 'الوضع',
      needsReview: 'تحتاج مراجعة',
      failure: 'سبب الفشل',
      reconcileCount: 'مرات التحقق',
      lastReconciledAt: 'آخر تحقق',
      createdAt: 'تاريخ المحاولة',
      actions: 'إجراءات المحاولة',
    },
    fields: {
      configuredMode: {
        label: 'وضع الدفع المُهيَّأ',
        hint: 'الوضع الذي كان الخادم مهيّأً له وقت إنشاء المحاولة. يُتحقق منه عند كل مطابقة، فلا تُخلط عملية تجريبية بأخرى حقيقية.',
      },
      failureMessage: {
        label: 'سبب الفشل المسجَّل',
        hint: 'نص داخلي من المزوّد يُحفظ للتشخيص، ولا يُعرض لأي طالب.',
      },
      refundedHalalas: {
        label: 'المبلغ المسترد',
        hint: 'مجموع ما استُرد من هذه المحاولة، بالهللات.',
      },
      needsReview: {
        label: 'تحتاج مراجعة يدوية',
        hint: 'تُرفع تلقائيًا عند اختلاف لا يستطيع الخادم البتّ فيه، مثل استرداد جزئي. لا يُمنح وصول ولا يُسحب حتى يبتّ فيها إنسان.',
      },
      safeMetadata: {
        label: 'بيانات مرجعية',
        hint: 'مراجع محلية فقط. لا تُخزَّن هنا أي بيانات بطاقة ولا أي حمولة كاملة من المزوّد.',
      },
    },
    empty: {
      nothingYetTitle: 'لا توجد محاولات دفع',
      nothingYetBody: 'لم تبدأ أي عملية دفع على هذا الطلب بعد.',
    },
  },

  /** `WebhookEvent` rows, matched to this order's payments. */
  webhooks: {
    title: 'إشعارات مزوّد الدفع',
    description: 'الإشعارات الواردة من المزوّد كما استُقبلت.',
    columns: {
      receivedAt: 'وقت الاستقبال',
      eventType: 'نوع الإشعار',
      status: 'حالة المعالجة',
      attemptCount: 'مرات المعالجة',
      liveMode: 'وضع حقيقي',
      processedAt: 'وقت المعالجة',
      /**
       * Deliberately "was there a fault" rather than "what was it". The stored
       * message is a raw runtime error — it can name the database host or the
       * account the server connects with — so the screen reports its existence
       * and the text stays in the logs.
       */
      hasError: 'سُجِّل تعثّر',
    },
    /** The answer under `hasError`, for a delivery whose processing threw. */
    errorRecorded: 'نعم، والتفاصيل في سجلات الخادم',
    empty: {
      nothingYetTitle: 'لا توجد إشعارات',
      nothingYetBody: 'لم يصل أي إشعار من مزوّد الدفع يخصّ هذا الطلب.',
    },
  },

  /** Entitlement consequences of this order. */
  access: {
    title: 'أثر الطلب على الوصول',
    description: 'ما فُتح أو أُغلق للطالب نتيجةً لهذا الطلب.',
    grantedNote: 'فُتح المنتج لهذا الطالب بناءً على هذا الطلب.',
    revokedNote: 'سُحب الوصول المرتبط بهذا الطلب بعد الاسترداد.',
    noneNote: 'لم يترتب على هذا الطلب أي وصول حتى الآن.',
    manageAction: 'إدارة صلاحيات هذا الطالب',
  },

  /**
   * `OrderStatus`.
   *
   * Identical to `COPY.statusLabels.orderStatus`, which the student dashboard
   * uses. Restated rather than imported because `copy.ts` composes this module
   * and reaching back into `COPY` would close a cycle. If one side is reworded,
   * reword both — a student and an administrator must not read two different
   * words for one order.
   */
  orderStatusLabels: {
    PENDING_PAYMENT: 'بانتظار الدفع',
    PAID: 'مدفوع',
    FAILED: 'فشل الدفع',
    REFUNDED: 'مسترد',
    CANCELLED: 'ملغى',
  },

  /**
   * `PaymentStatus`.
   *
   * Nine members, because a gateway distinguishes stages the order does not:
   * an authorised payment is money reserved and not yet taken, and a verified one
   * is a payment the server re-checked against the provider rather than trusted
   * from a callback.
   */
  paymentStatusLabels: {
    CREATED: 'أُنشئت',
    INITIATED: 'بدأت لدى المزوّد',
    PAID: 'مدفوعة',
    FAILED: 'فشلت',
    AUTHORIZED: 'محجوزة بانتظار التحصيل',
    CAPTURED: 'محصَّلة',
    VERIFIED: 'متحقَّق منها',
    REFUNDED: 'مستردة',
    VOIDED: 'ملغاة قبل التحصيل',
  },

  /** `PaymentProvider`. */
  providerLabels: {
    MOCK: 'محاكاة محلية',
    MOYASAR: 'ميسر',
  },

  /**
   * `PaymentMode`.
   *
   * Never abbreviated to a colour or an icon: an administrator refunding a live
   * payment while reading a test row is the mistake this label exists to prevent.
   */
  modeLabels: {
    TEST: 'تجريبي',
    LIVE: 'حقيقي',
  },

  /** `WebhookStatus`. */
  webhookStatusLabels: {
    PENDING: 'بانتظار المعالجة',
    PROCESSING: 'قيد المعالجة',
    PROCESSED: 'عولجت',
    IGNORED: 'متجاهَلة',
    FAILED: 'فشلت معالجتها',
  },

  /**
   * `ReconcileOutcome` from `reconcile.service.ts`.
   *
   * The service returns one of these from every check; the screen has to report
   * it, and "تمت العملية" for all nine would hide the two that mean nothing
   * changed and the two that mean a human is now required.
   */
  reconcileOutcomeLabels: {
    FULFILLED: 'فُتح الوصول بهذا التحقق',
    ALREADY_FULFILLED: 'الطلب مدفوع مسبقًا، ولم يتغيّر شيء',
    PENDING: 'العملية لم تُسوَّ بعد لدى المزوّد، ولا وصول',
    FAILED: 'المزوّد يفيد بأن الدفع فشل، ولا وصول',
    REVOKED: 'سُحب الوصول',
    NEEDS_REVIEW: 'تحتاج قرارًا بشريًا، ولم يُمنح شيء ولم يُسحب',
    MISMATCH: 'العملية لا تطابق الطلب، ولم يُمنح شيء',
    UNKNOWN_PAYMENT: 'لا توجد لدى المزوّد عملية بهذا الرقم',
    UNKNOWN_ORDER: 'العملية لا تحمل مرجع طلب صالحًا',
  },

  /** Actions, all of which ask the provider rather than assert an outcome. */
  actions: {
    viewStudent: 'فتح حساب الطالب',
    viewProduct: 'فتح المنتج',
    copyReference: 'نسخ رقم الطلب',
  },

  reconcile: {
    action: 'التحقق من الدفع لدى المزوّد',
    running: 'جارٍ التحقق…',
    confirmTitle: 'التحقق من هذه العملية لدى المزوّد؟',
    confirmBody:
      'يسأل الخادم مزوّد الدفع عن حالة العملية ويحدّث الطلب بناءً على جوابه وحده. آمن التكرار: لا يُفتح وصول مرتين ولا يُخصم أي مبلغ.',
    confirmAction: 'نعم، تحقّق',
    hint: 'استخدمه عندما يقول الطالب إنه دفع بينما الطلب ما زال بانتظار الدفع.',
  },

  refund: {
    action: 'طلب استرداد',
    title: 'طلب استرداد لهذا الطلب',
    description:
      'يُرسل الطلب إلى مزوّد الدفع، ثم يُعاد التحقق من العملية. لا يُغيَّر شيء في المنصة قبل أن يؤكد المزوّد الاسترداد.',
    amount: {
      label: 'مبلغ الاسترداد بالريال السعودي',
      hint: 'اتركه فارغًا لاسترداد كامل المبلغ. المبلغ يُحوَّل إلى هللات صحيحة، ولا يمكن أن يتجاوز المبلغ المدفوع ولا ما تبقّى منه.',
    },
    reason: {
      label: 'سبب الاسترداد',
      hint: 'مطلوب. يُحفظ في سجل النشاط باسمك وتاريخه.',
      placeholder: 'اكتب سببًا واضحًا يمكن الرجوع إليه لاحقًا…',
    },
    confirmTitle: 'إرسال طلب استرداد؟',
    confirmBody:
      'الاسترداد الكامل يسحب وصول الطالب إلى المنتج بعد تأكيد المزوّد. الاسترداد الجزئي لا يسحب الوصول تلقائيًا، ويُرفع للمراجعة اليدوية.',
    confirmAction: 'نعم، أرسل طلب الاسترداد',
    partialNote:
      'الاسترداد الجزئي لا يُعالَج آليًا: يُرفع للمراجعة، فتقرّر أنت ما يحدث للوصول من شاشة الصلاحيات.',
    irreversibleNote: 'لا يمكن التراجع عن استرداد نفّذه المزوّد من داخل المنصة.',
  },

  cancel: {
    action: 'إلغاء الطلب',
    confirmTitle: 'إلغاء هذا الطلب؟',
    confirmBody:
      'يُغلق الطلب بلا دفع ولا يمكن استئنافه. متاح فقط لطلب بانتظار الدفع لم تنجح عليه أي عملية. المبالغ لا تتأثر لأنه لم يُدفع شيء.',
    confirmAction: 'نعم، ألغِ الطلب',
    reason: {
      label: 'سبب الإلغاء',
      hint: 'مطلوب. يُحفظ في سجل النشاط.',
    },
  },

  review: {
    clearAction: 'إنهاء المراجعة اليدوية',
    clearConfirmTitle: 'إنهاء المراجعة اليدوية لهذه العملية؟',
    clearConfirmBody:
      'يعني ذلك أنك بتَّ في الاختلاف. لا يُمنح وصول ولا يُسحب بهذا الإجراء وحده — نفّذ ما قرّرته من شاشة الصلاحيات صراحة.',
    clearConfirmAction: 'نعم، أنهِ المراجعة',
    flagAction: 'رفع للمراجعة اليدوية',
    flagConfirmTitle: 'رفع هذه العملية للمراجعة اليدوية؟',
    flagConfirmBody: 'توضَع علامة على العملية ليعود إليها إنسان. لا يتغيّر أي مبلغ ولا أي وصول.',
    flagConfirmAction: 'نعم، ارفعها',
    reason: {
      label: 'سبب الرفع أو الإنهاء',
      hint: 'مطلوب. يُحفظ في سجل النشاط.',
    },
    badge: 'تحتاج مراجعة',
  },

  errors: {
    notFound: 'هذا الطلب غير موجود.',
    paymentNotFound: 'عملية الدفع هذه غير موجودة.',
    noPaymentAttempt: 'لم تُسجَّل أي عملية دفع لهذا الطلب، فلا شيء للتحقق منه.',
    notCancellable:
      'لا يمكن إلغاء هذا الطلب في حالته الحالية. الإلغاء متاح لطلب بانتظار الدفع فقط.',
    notRefundable: 'لا يمكن استرداد طلب غير مدفوع.',
    alreadyRefunded: 'هذا الطلب مسترد بالكامل بالفعل.',
    refundAmountInvalid: 'مبلغ الاسترداد يجب أن يكون أكبر من صفر.',
    refundAmountTooLarge: 'مبلغ الاسترداد أكبر مما تبقّى من المبلغ المدفوع.',
    refundNotSupported: 'مزوّد الدفع لهذه العملية لا يدعم الاسترداد من داخل المنصة.',
    providerUnavailable: 'تعذّر الوصول إلى مزوّد الدفع، ولم يتغيّر شيء. أعد المحاولة بعد قليل.',
    /*
     * Kept apart from `providerUnavailable` on purpose. An unrecognised status
     * means the gateway answered perfectly well with something this platform
     * does not model, and "تعذّر الوصول" would send somebody to check a service
     * that is up. `moyasar-status.ts` refuses such a status rather than guessing
     * it means "not paid yet", so nothing is granted and nothing is withdrawn.
     */
    providerUnknownStatus:
      'أفاد المزوّد بحالة لا تتعامل معها المنصة، فلم يُمنح وصول ولم يُسحب. سُجِّلت الحالة للمراجعة.',
    reasonRequired: 'السبب مطلوب، ويُحفظ في سجل النشاط.',
    modeMismatch:
      'وضع هذه العملية لا يطابق الوضع المُهيَّأ لهذا الخادم. لم يُنفَّذ أي إجراء عليها.',
    amountMismatch: 'مبلغ العملية لدى المزوّد لا يطابق مبلغ الطلب. رُفعت للمراجعة ولم يُمنح وصول.',
    editUnavailable:
      'لا تُعدَّل بيانات الطلب. المبلغ واسم المنتج نسخ محفوظة لحظة الشراء، وتغييرها يفسد سجل العملية.',
    deleteUnavailable:
      'لا تُحذف الطلبات. سجل الشراء يجب أن يبقى مقروءًا؛ ألغِ الطلب أو استرد مبلغه بدلًا من ذلك.',
  },

  notices: {
    immutableSnapshot:
      'مبلغ الطلب واسم المنتج فيه نسخ محفوظة لحظة الشراء. تغيير سعر المنتج أو اسمه اليوم لا يمسّ أي طلب سابق.',
    providerIsAuthority:
      'حالة الدفع تُقرأ من مزوّد الدفع، ولا تُغيَّر يدويًا من هنا. كل إجراء أدناه يسأل المزوّد ويسجّل جوابه.',
    amountsInSar: 'كل المبالغ بالريال السعودي، ومخزَّنة كأعداد صحيحة من الهللات.',
    refundWithdrawsAccess:
      'الاسترداد الكامل يسحب وصول الطالب إلى المنتج بعد تأكيد المزوّد. الاسترداد الجزئي لا يسحبه تلقائيًا.',
    needsReviewNote:
      'هذه العملية موقوفة على قرار بشري. لم يُمنح وصول ولم يُسحب، ولن يتغيّر ذلك تلقائيًا.',
    testModeNote: 'هذه عملية في الوضع التجريبي. لم يُحوَّل فيها أي مبلغ حقيقي.',
    auditedAction: 'يُسجَّل كل إجراء على هذا الطلب في سجل النشاط باسم منفّذه وتاريخه.',
  },

  toast: {
    reconciled: 'اكتمل التحقق، وحُدِّثت حالة الطلب.',
    reconcileUnchanged: 'اكتمل التحقق ولا جديد لدى المزوّد.',
    reconcileFailed: 'تعذّر التحقق من المزوّد، ولم يتغيّر شيء.',
    refundRequested: 'أُرسل طلب الاسترداد إلى المزوّد.',
    refundFailed: 'تعذّر تنفيذ الاسترداد، ولم يُسترد أي مبلغ.',
    cancelled: 'أُلغي الطلب.',
    cancelFailed: 'تعذّر إلغاء الطلب، ولم يتغيّر شيء.',
    reviewCleared: 'أُنهيت المراجعة اليدوية لهذه العملية.',
    reviewFlagged: 'رُفعت العملية للمراجعة اليدوية.',
    referenceCopied: 'نُسخ رقم الطلب.',
  },

  empty: {
    nothingYetTitle: 'لا توجد طلبات بعد',
    nothingYetBody: 'لم يُنشئ أي طالب طلب شراء حتى الآن.',
  },
} as const;
