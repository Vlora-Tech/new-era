import { COPY } from '@/lib/copy';

import { IconChevron } from '../icons';
import { SectionIntro, SectionShell } from '../parts';

/**
 * The FAQ.
 *
 * Native `<details>`, no JavaScript. Two attributes do what the canvas's
 * ninety-line script did:
 *
 *   `name="landing-faq"` makes the group mutually exclusive — opening one row
 *   closes the others, natively. Browsers that do not support the attribute
 *   simply allow several open at once, which is a graceful degradation rather
 *   than a break.
 *
 *   `open` on the first row reproduces the canvas's "first answer visible on
 *   load" without waiting for hydration, so the section never reflows.
 *
 * The two questions that matter most — independence from the exam authority,
 * and that a simulator result is not an official score — are first and second
 * on purpose. They are the same statements the footer and every results screen
 * carry, and they are answered here before anyone is asked to pay.
 *
 * The column is 900px, which is the canvas's, and narrower than the rest of the
 * page: a disclosure row is read left-to-right across its whole width, and at
 * 1240 the chevron ends up a hand's width from the question it belongs to.
 */
const FAQ = COPY.landing.faq;

export function Faq() {
  return (
    <SectionShell id="faq">
      <div className="mx-auto max-w-[900px]">
        <SectionIntro title={FAQ.title} />

        <div className="mt-11 flex flex-col gap-3 text-start">
          {FAQ.items.map((item, index) => (
            <details
              key={item.question}
              name="landing-faq"
              open={index === 0}
              className="group rounded-plate border-line-200 bg-surface open:border-brand-300 open:shadow-card-lg reveal border shadow-xs transition-[border-color,box-shadow] duration-200 ease-out"
            >
              <summary className="focus-visible:outline-brand-700 flex cursor-pointer list-none items-center justify-between gap-4 p-5 text-start focus-visible:outline-2 focus-visible:outline-offset-2 [&::-webkit-details-marker]:hidden">
                <span className="text-ink-900 text-h4">{item.question}</span>
                <span className="bg-surface-muted text-ink-700 group-open:bg-brand-100 group-open:text-brand-700 flex size-8 shrink-0 items-center justify-center rounded-full transition-colors duration-200 ease-out">
                  <IconChevron
                    className="size-4 transition-transform duration-200 ease-out group-open:rotate-180"
                    aria-hidden="true"
                  />
                </span>
              </summary>

              <p className="text-ink-700 px-5 pb-5 text-[15px] leading-[1.85] font-light">
                {item.answer}
              </p>
            </details>
          ))}
        </div>
      </div>
    </SectionShell>
  );
}
