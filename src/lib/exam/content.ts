/**
 * Structured question content.
 *
 * Question text is stored as data, never as HTML. There is therefore no markup
 * to sanitise and no path by which authored content can inject script into a
 * student's page: the renderer only ever walks a known set of node types and
 * emits text.
 *
 * Three inline kinds cover what the bank needs:
 *   - `text` — Arabic prose, laid out right-to-left with the page.
 *   - `math` — a TeX fragment. Mathematics reads left-to-right even inside an
 *     Arabic sentence, so it is isolated at render time rather than trusted to
 *     the bidi algorithm.
 *   - `ltr`  — a Latin word, identifier or number that must not be reordered.
 *
 * The parsers below are total: they take `unknown` straight from a JSON column
 * and return a valid document, dropping anything unrecognised. A malformed row
 * must degrade to less content, never to a crash in the middle of a timed exam.
 */
export type Inline =
  { type: 'text'; text: string } | { type: 'math'; tex: string } | { type: 'ltr'; text: string };

export type RichTextBlock = { type: 'paragraph'; children: Inline[] };

export type RichText = { blocks: RichTextBlock[] };

export const EMPTY_RICH_TEXT: RichText = { blocks: [] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseInline(value: unknown): Inline | null {
  if (!isRecord(value)) return null;

  if (value.type === 'text' && typeof value.text === 'string') {
    return { type: 'text', text: value.text };
  }
  if (value.type === 'ltr' && typeof value.text === 'string') {
    return { type: 'ltr', text: value.text };
  }
  if (value.type === 'math' && typeof value.tex === 'string') {
    return { type: 'math', tex: value.tex };
  }
  return null;
}

/** Normalise a JSON value into a rich-text document, discarding unknown nodes. */
export function parseRichText(value: unknown): RichText {
  if (!isRecord(value) || !Array.isArray(value.blocks)) return EMPTY_RICH_TEXT;

  const blocks: RichTextBlock[] = [];
  for (const rawBlock of value.blocks) {
    if (!isRecord(rawBlock) || rawBlock.type !== 'paragraph') continue;
    const rawChildren = Array.isArray(rawBlock.children) ? rawBlock.children : [];

    const children: Inline[] = [];
    for (const rawChild of rawChildren) {
      const child = parseInline(rawChild);
      if (child) children.push(child);
    }
    blocks.push({ type: 'paragraph', children });
  }

  return { blocks };
}

/** Plain-text projection, for aria labels and log lines. Never for display. */
export function richTextToPlain(document: RichText): string {
  return document.blocks
    .map((block) =>
      block.children
        .map((child) => (child.type === 'math' ? child.tex : child.text))
        .join('')
        .trim(),
    )
    .filter(Boolean)
    .join(' ');
}
