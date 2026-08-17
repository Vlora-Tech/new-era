import type { PrismaClient } from '@prisma/client';

/**
 * Fictional course content for local development.
 *
 * Every lesson, description and price here is invented for demonstration.
 * Video assets are intentionally absent: a Bunny GUID is a real identifier in a
 * real library, and inventing one would produce a lesson that looks playable and
 * is not. Lessons therefore seed without video and the player shows its
 * "not configured" state, which is the honest result.
 */
export async function seedCourseContent(
  prisma: PrismaClient,
  options: { authorId: string | null },
): Promise<void> {
  void options;

  const published = await prisma.product.upsert({
    where: { slug: 'qudurat-verbal-foundations' },
    update: {},
    create: {
      type: 'COURSE',
      slug: 'qudurat-verbal-foundations',
      title: 'أساسيات القسم اللفظي',
      shortDescription:
        'ابدأ من القواعد: التناظر اللفظي، إكمال الجمل، والخطأ السياقي، بشرح مبسط وأمثلة تدريبية.',
      longDescription:
        'دورة تمهيدية تشرح مهارات القسم اللفظي في اختبار القدرات العامة خطوة بخطوة. تبدأ كل وحدة بشرح الفكرة، ثم نموذج محلول، ثم سؤال قصير يثبّت الفهم قبل الانتقال إلى المهارة التالية.',
      status: 'PUBLISHED',
      priceHalalas: 19_900,
      featured: true,
      publishedAt: new Date(),
      course: {
        create: {
          category: 'القسم اللفظي',
          level: 'تمهيدي',
          completionThresholdPercent: 90,
          modules: {
            create: [
              {
                title: 'التناظر اللفظي',
                position: 1,
                status: 'PUBLISHED',
                lessons: {
                  create: [
                    {
                      title: 'ما هو التناظر اللفظي؟',
                      position: 1,
                      status: 'PUBLISHED',
                      isPreview: true,
                      content:
                        'التناظر اللفظي يقيس قدرتك على إدراك العلاقة بين كلمتين، ثم البحث عن الزوج الذي تربطه العلاقة نفسها.',
                    },
                    {
                      title: 'علاقات الجزء بالكل',
                      position: 2,
                      status: 'PUBLISHED',
                      content:
                        'من أكثر العلاقات تكرارًا: أن تكون الكلمة الأولى جزءًا من الثانية. الترتيب مهم، فاعكسه ولاحظ الفرق.',
                    },
                    {
                      title: 'علاقات السبب والنتيجة',
                      position: 3,
                      status: 'PUBLISHED',
                      content:
                        'حين تقود الكلمة الأولى إلى الثانية، نكون أمام علاقة سببية. انتبه إلى اتجاه العلاقة قبل الاختيار.',
                    },
                  ],
                },
              },
              {
                title: 'إكمال الجمل والخطأ السياقي',
                position: 2,
                status: 'PUBLISHED',
                lessons: {
                  create: [
                    {
                      title: 'قراءة الجملة قبل الخيارات',
                      position: 1,
                      status: 'PUBLISHED',
                      content:
                        'اقرأ الجملة كاملة وكوّن توقعًا للمعنى الناقص قبل النظر إلى الخيارات، حتى لا تسحبك الخيارات بعيدًا.',
                    },
                    {
                      title: 'كيف تكتشف الكلمة الشاذة؟',
                      position: 2,
                      status: 'PUBLISHED',
                      content:
                        'في الخطأ السياقي تكون الجملة سليمة نحويًا، لكن كلمة واحدة تناقض المعنى العام. ابحث عن التناقض لا عن الخطأ الإملائي.',
                    },
                  ],
                },
              },
            ],
          },
        },
      },
    },
  });

  const draft = await prisma.product.upsert({
    where: { slug: 'qudurat-quantitative-foundations' },
    update: {},
    create: {
      type: 'COURSE',
      slug: 'qudurat-quantitative-foundations',
      title: 'أساسيات القسم الكمي',
      shortDescription: 'الحساب والهندسة والجبر وتفسير البيانات، بأسلوب يركّز على طريقة التفكير.',
      status: 'DRAFT',
      priceHalalas: 24_900,
      course: {
        create: {
          category: 'القسم الكمي',
          level: 'تمهيدي',
          modules: {
            create: [
              {
                title: 'الحساب',
                position: 1,
                status: 'DRAFT',
                lessons: {
                  create: [
                    {
                      title: 'النسب والتناسب',
                      position: 1,
                      status: 'DRAFT',
                      content: 'مسودة درس قيد الإعداد.',
                    },
                  ],
                },
              },
            ],
          },
        },
      },
    },
  });

  console.log(`  courses: ensured "${published.title}" (published), "${draft.title}" (draft)`);
}
