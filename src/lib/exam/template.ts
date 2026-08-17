/**
 * Placeholder substitution for the exam's Arabic copy.
 *
 * Sentences such as `'السؤال {current} من {total}'` are written whole in
 * `COPY.exam` rather than assembled from fragments at the call site. Arabic
 * word order and agreement do not survive concatenation, and a translator
 * looking at three separate strings cannot see the sentence they form.
 *
 * Values arrive already formatted — Arabic-Indic digits from `formatNumber`,
 * durations from `formatDuration` — so this only splices text.
 */
export function fillTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);
}
