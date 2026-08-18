import { COPY } from '@/lib/copy';

import { IconRights, IconVerified } from '../icons';
import { SectionShell } from '../parts';

/**
 * The content-rights statement.
 *
 * This is the only section on the page that exists for a legal reason rather
 * than a commercial one. The regulation governing the official exam treats its
 * questions as confidential intellectual property, so the platform carries only
 * original or documented-licensed material — never leaked items and never
 * تجميعات. Every question row in the database has a required `authorOrLicensor`
 * and a rights declaration, and the card on the right is a drawing of exactly
 * those two fields.
 *
 * The wording is a commitment, not a marketing line. It should not be softened
 * or shortened for layout, and the section should not be dropped to save a
 * scroll.
 */
const RIGHTS = COPY.landing.rights;

export function Rights() {
  return (
    <SectionShell id="rights">
      <div className="rounded-shell border-line-200 reveal from-brand-50 to-accent-teal-soft/50 relative overflow-hidden border bg-linear-to-br via-white p-7 sm:p-10 lg:p-14">
        <span aria-hidden="true" className="bg-grid-fade absolute inset-0 opacity-70" />

        <div className="relative grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-16">
          <div>
            <h2 className="text-ink-900 text-h2">{RIGHTS.title}</h2>
            <p className="text-ink-700 text-lead measure-ar mt-5">{RIGHTS.body}</p>
          </div>

          <div className="rounded-card border-line-200 bg-surface shadow-card border p-6">
            <span
              aria-hidden="true"
              className="bg-gradient-tile flex size-14 items-center justify-center rounded-[16px] text-white"
            >
              <IconRights className="size-7" strokeWidth={1.75} />
            </span>

            <dl className="mt-6 flex flex-col gap-5">
              <div>
                <dt className="text-ink-600 text-[12.5px]">{RIGHTS.statusLabel}</dt>
                <dd className="text-accent-green mt-1 flex items-center gap-2 text-[16px] font-semibold">
                  <IconVerified className="size-4.5" aria-hidden="true" />
                  {RIGHTS.statusValue}
                </dd>
              </div>
              <div className="border-line-200 border-t pt-5">
                <dt className="text-ink-600 text-[12.5px]">{RIGHTS.sourceLabel}</dt>
                <dd className="text-ink-900 mt-1 text-[16px] font-semibold">
                  {RIGHTS.sourceValue}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </SectionShell>
  );
}
