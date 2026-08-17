'use client';

import { useEffect, useState } from 'react';

/**
 * Viewer watermark.
 *
 * A moving, semi-transparent mark carrying the signed-in student's name and a
 * fragment of their account id. It raises the cost of casually passing a
 * recording around, because the recording identifies who made it.
 *
 * It is a deterrent, not a control. Together with expiring signed URLs it
 * discourages link sharing; neither can stop a screen recorder, and the product
 * does not claim otherwise.
 */
const POSITIONS = [
  { top: '12%', insetInlineStart: '8%' },
  { top: '34%', insetInlineEnd: '10%' },
  { bottom: '26%', insetInlineStart: '14%' },
  { bottom: '12%', insetInlineEnd: '12%' },
] as const;

const MOVE_INTERVAL_MS = 7_000;

export function WatermarkOverlay({ text }: { text: string }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    // Someone who has asked for reduced motion gets a static mark rather than
    // one that repositions underneath them.
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;

    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % POSITIONS.length);
    }, MOVE_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, []);

  const position = POSITIONS[index] ?? POSITIONS[0];

  return (
    <div className="pointer-events-none absolute inset-0 z-10 select-none" aria-hidden="true">
      <span
        className="absolute rounded bg-black/45 px-2 py-1 text-[11px] tracking-tight text-white/70 transition-all duration-700"
        style={position}
      >
        <bdi dir="ltr">{text}</bdi>
      </span>
    </div>
  );
}
