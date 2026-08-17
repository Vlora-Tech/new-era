import type { Inline, RichText } from '@/lib/exam/content';
import { cn } from '@/lib/utils';

/**
 * The structured-content renderer.
 *
 * Isolated on purpose. It is the only place that knows how an inline node
 * becomes an element, so introducing KaTeX later means replacing `MathInline`
 * and nothing else — no page, no workspace and no review screen imports a math
 * library or touches a TeX string directly. Until then TeX renders as
 * monospaced source, which is honest: it shows exactly what was authored rather
 * than a half-typeset approximation.
 *
 * Bidirectional isolation is the other reason this is centralised. The page runs
 * right-to-left; a Latin identifier or an equation inside an Arabic sentence
 * must not be reordered by the surrounding text's direction. `<bdi>` isolates
 * the run from its neighbours and the inner `dir="ltr"` fixes its own
 * direction, which together keep `f(x) = 2x + 1` intact next to Arabic prose.
 * Getting this wrong does not merely look wrong — it changes what the
 * expression says.
 */
function MathInline({ tex }: { tex: string }) {
  return (
    <bdi>
      <span
        dir="ltr"
        // `math` is announced as a distinct run rather than read as Arabic text.
        role="math"
        aria-label={tex}
        className="bg-surface-muted rounded-[4px] px-1 font-mono text-[0.95em]"
      >
        {tex}
      </span>
    </bdi>
  );
}

function InlineNode({ node }: { node: Inline }) {
  if (node.type === 'text') return <>{node.text}</>;
  if (node.type === 'math') return <MathInline tex={node.tex} />;
  return (
    <bdi>
      <span dir="ltr">{node.text}</span>
    </bdi>
  );
}

/** Render a rich-text document. Paragraphs only; there is no markup to trust. */
export function RichTextView({
  document,
  className,
  paragraphClassName,
}: {
  document: RichText;
  className?: string;
  paragraphClassName?: string;
}) {
  if (document.blocks.length === 0) return null;

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {document.blocks.map((block, blockIndex) => (
        <p key={blockIndex} className={cn('text-ink-900 leading-relaxed', paragraphClassName)}>
          {block.children.map((child, childIndex) => (
            <InlineNode key={childIndex} node={child} />
          ))}
        </p>
      ))}
    </div>
  );
}
