/**
 * Image upload: the picker, the limits, and one refusal per validation step.
 *
 * Composed into `COPY.adminMedia` by `src/lib/copy.ts`.
 *
 * The pipeline in `docs/media-storage.md` rejects a file at five different
 * points, and each one has its own sentence here. Collapsing them into a single
 * "الملف غير صالح" would leave an administrator re-uploading the same 6 MB
 * photograph, because the message would not distinguish a file that is too large
 * from one whose bytes disagree with its extension.
 *
 * The limits are written out in words. The machine-readable copies live in
 * `src/validators/admin-media.ts` as `MEDIA_PURPOSE_RULES`; if one changes, the
 * other must change with it.
 */
export const ADMIN_MEDIA_COPY = {
  title: 'الصور والوسائط',
  description: 'صور أغلفة المنتجات وصور بنك الأسئلة، مع حدودها وقواعد عرضها.',

  pickFile: 'اختر ملفًا',
  changeFile: 'اختر ملفًا آخر',
  dropHint: 'اسحب الصورة إلى هنا، أو اضغط للاختيار من جهازك.',
  selectedFile: 'الملف المختار',
  noFileSelected: 'لم يُختر أي ملف بعد.',
  fileSize: 'الحجم',
  fileType: 'النوع',
  dimensions: 'الأبعاد',

  limits: {
    types: 'الصيغ المقبولة: JPEG و PNG و WebP.',
    // Not a format preference: SVG is a document format that can execute script,
    // so accepting it would be accepting stored XSS wearing an image extension.
    noSvg: 'صيغة SVG غير مقبولة، لأنها مستند قد يحتوي على سكربت لا صورة ثابتة.',
    coverSize: 'الحد الأقصى لحجم صورة الغلاف ٣ ميغابايت.',
    stimulusSize: 'الحد الأقصى لحجم صورة السؤال ٢ ميغابايت.',
    reencodeNote:
      'تُقرأ الصورة ويُعاد ترميزها عند الرفع، فتُحذف بياناتها الوصفية وأي شيء مخبّأ بعد بيانات الصورة، ويُطبَّق حد أقصى للأبعاد.',
  },

  upload: 'رفع الصورة',
  uploading: 'جارٍ الرفع…',
  /** `{percent}` is the completed share of the transfer. */
  progress: 'اكتمل {percent}٪ من الرفع',
  uploadSuccess: 'رُفعت الصورة.',

  replace: 'استبدال الصورة',
  replaceConfirmTitle: 'استبدال هذه الصورة؟',
  replaceConfirmBody: 'ستحل الصورة الجديدة محل الحالية في كل مكان تُعرض فيه.',
  replaceConfirmAction: 'نعم، استبدلها',

  remove: 'إزالة الصورة',
  removeConfirmTitle: 'إزالة هذه الصورة؟',
  removeConfirmBody: 'سيبقى العنصر بلا صورة حتى تُرفع صورة أخرى.',
  removeConfirmAction: 'نعم، أزلها',

  /**
   * Visibility is a commercial distinction, not a technical one, so the hints
   * say what each choice means for the business rather than which folder the
   * bytes land in.
   */
  visibilityLabels: {
    PUBLIC: 'عامة',
    PROTECTED: 'محمية',
  },
  visibilityHints: {
    PUBLIC:
      'تُعرض لأي زائر وتُخزَّن في ذاكرة التخزين المؤقت مدة طويلة. مناسبة لأغلفة المنتجات فقط.',
    PROTECTED: 'محتوى مدفوع. لا يوجد لها رابط عام دائم، ويُتحقق من صلاحية الوصول عند كل طلب عرض.',
  },

  errors: {
    /** `{limit}` is the cap for the chosen purpose, written in words. */
    tooLarge: 'حجم الملف أكبر من الحد المسموح ({limit}). صغّر الصورة ثم أعد المحاولة.',
    wrongType: 'نوع الملف غير مقبول. الصيغ المقبولة: JPEG و PNG و WebP.',
    // The declared type is a claim by the uploader; the sniff is the check.
    magicMismatch: 'محتوى الملف لا يطابق نوعه المعلن، فلم يُقبل.',
    /** `{max}` is the maximum edge length in pixels. */
    dimensionsTooLarge: 'أبعاد الصورة أكبر من الحد المسموح ({max} بكسل). صغّرها ثم أعد المحاولة.',
    decodeFailed: 'تعذّرت قراءة الصورة. قد يكون الملف تالفًا أو ليس صورة أصلًا.',
    uploadFailed: 'تعذّر رفع الملف، ولم يُحفظ شيء.',
    storageUnavailable:
      'رفع الملفات غير متاح على هذا الخادم، لأن مزوّد التخزين لم يُعتمد بعد. الملفات المرفوعة محليًا لا تبقى بعد إعادة النشر.',
    deleteBlockedInUse:
      'لا يمكن حذف صورة مستخدمة في منتج أو سؤال. أزل ارتباطها أولًا، حتى لا يبقى محتوى يشير إلى صورة غير موجودة.',
    notFound: 'هذه الصورة غير موجودة.',
  },

  empty: {
    nothingYetTitle: 'لا توجد صور بعد',
    nothingYetBody: 'لم تُرفع أي صورة حتى الآن.',
  },
} as const;
