'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Lock } from 'lucide-react';

import { WatermarkOverlay } from '@/components/video/watermark-overlay';
import { Button } from '@/components/ui/button';
import { COPY } from '@/lib/copy';
import { VIDEO } from '@/lib/constants';

/**
 * Entitlement-gated lesson player.
 *
 * Progress is measured from the player's own `timeupdate` events, accumulated as
 * *elapsed playback* rather than as position. That distinction is the whole
 * point: seeking to the end moves the position but adds no elapsed time, so
 * completion cannot be reached by dragging the scrubber. The server clamps the
 * reported delta again against real time, so this client is not trusted either.
 *
 * The player is Bunny's embed, driven through Player.js over `postMessage`. The
 * iframe's document is cross-origin and is never touched directly.
 */
type PlaybackGrant = {
  sessionId: string;
  embedUrl: string;
  expiresAt: string;
  durationSec: number | null;
  resume: {
    lastPositionSec: number;
    furthestPositionSec: number;
    watchedSec: number;
    completed: boolean;
  };
  watermarkText: string;
};

type PlayerJs = {
  on: (event: string, handler: (payload?: { seconds?: number; duration?: number }) => void) => void;
  setCurrentTime: (seconds: number) => void;
};

declare global {
  interface Window {
    playerjs?: { Player: new (element: HTMLIFrameElement) => PlayerJs };
  }
}

const PLAYER_JS_SRC = 'https://assets.mediadelivery.net/playerjs/player-0.1.0.min.js';
/** Refresh this long before the token expires, so playback never stalls. */
const REFRESH_MARGIN_MS = 120_000;

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; grant: PlaybackGrant }
  | { kind: 'denied' }
  | { kind: 'unavailable'; message: string };

export function ProtectedPlayer({ lessonId, title }: { lessonId: string; title: string }) {
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  // Accumulated playback seconds not yet acknowledged by the server.
  const pendingDeltaRef = useRef(0);
  const lastTickRef = useRef<number | null>(null);
  const positionRef = useRef(0);
  const sessionIdRef = useRef<string | null>(null);

  const requestGrant = useCallback(async (): Promise<PlaybackGrant | null> => {
    const response = await fetch(`/api/lessons/${lessonId}/playback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    });
    const payload = (await response.json()) as {
      ok: boolean;
      data?: PlaybackGrant;
      error?: { code?: string; message?: string };
    };

    if (!payload.ok || !payload.data) {
      if (payload.error?.code === 'not_entitled') setState({ kind: 'denied' });
      else
        setState({
          kind: 'unavailable',
          message: payload.error?.message ?? COPY.common.error,
        });
      return null;
    }

    sessionIdRef.current = payload.data.sessionId;
    return payload.data;
  }, [lessonId]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const grant = await requestGrant();
      if (!cancelled && grant) {
        positionRef.current = grant.resume.lastPositionSec;
        setState({ kind: 'ready', grant });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [requestGrant]);

  const flushProgress = useCallback(
    (options: { keepalive?: boolean } = {}) => {
      const sessionId = sessionIdRef.current;
      const delta = Math.floor(pendingDeltaRef.current);
      if (!sessionId || delta <= 0) return;

      pendingDeltaRef.current = 0;

      void fetch(`/api/lessons/${lessonId}/progress`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        keepalive: options.keepalive ?? false,
        body: JSON.stringify({
          sessionId,
          positionSec: Math.floor(positionRef.current),
          deltaSec: delta,
        }),
      }).catch(() => {
        // A dropped heartbeat is not worth interrupting playback over; the next
        // one carries the accumulated time forward.
      });
    },
    [lessonId],
  );

  // Attach Player.js once the iframe has a signed source.
  useEffect(() => {
    if (state.kind !== 'ready') return;

    let disposed = false;
    const iframe = iframeRef.current;
    if (!iframe) return;

    const attach = () => {
      if (disposed || !window.playerjs || !iframeRef.current) return;
      const player = new window.playerjs.Player(iframeRef.current);

      player.on('ready', () => {
        const resumeAt = state.grant.resume.lastPositionSec;
        if (resumeAt > 0) player.setCurrentTime(resumeAt);
      });

      player.on('timeupdate', (payload) => {
        const seconds = payload?.seconds ?? 0;
        positionRef.current = seconds;

        const previous = lastTickRef.current;
        lastTickRef.current = seconds;

        // Count forward motion only. A backward jump is a seek, not watch time.
        if (previous !== null && seconds > previous) {
          const step = seconds - previous;
          // A large forward jump is a seek too; anything beyond a normal tick is
          // ignored rather than credited.
          if (step <= 5) pendingDeltaRef.current += step;
        }
      });

      player.on('pause', () => flushProgress());
      player.on('ended', () => flushProgress());
    };

    if (window.playerjs) {
      attach();
    } else {
      const script = document.createElement('script');
      script.src = PLAYER_JS_SRC;
      script.async = true;
      script.onload = attach;
      document.head.appendChild(script);
    }

    const heartbeat = window.setInterval(
      () => flushProgress(),
      VIDEO.PROGRESS_HEARTBEAT_SECONDS * 1_000,
    );

    const onHidden = () => {
      if (document.visibilityState === 'hidden') flushProgress({ keepalive: true });
    };
    document.addEventListener('visibilitychange', onHidden);

    // Re-sign before the token expires so a long lesson does not stall.
    const expiresIn = new Date(state.grant.expiresAt).getTime() - Date.now();
    const refreshTimer = window.setTimeout(
      () => {
        flushProgress();
        void requestGrant().then((grant) => {
          if (grant) setState({ kind: 'ready', grant });
        });
      },
      Math.max(30_000, expiresIn - REFRESH_MARGIN_MS),
    );

    return () => {
      disposed = true;
      window.clearInterval(heartbeat);
      window.clearTimeout(refreshTimer);
      document.removeEventListener('visibilitychange', onHidden);
      flushProgress({ keepalive: true });
    };
  }, [state, flushProgress, requestGrant]);

  if (state.kind === 'loading') {
    return (
      <div className="bg-surface-muted flex aspect-video w-full items-center justify-center rounded-panel">
        <p className="text-ink-700 text-sm">{COPY.common.loading}</p>
      </div>
    );
  }

  if (state.kind === 'denied') {
    return (
      <div className="border-line-200 bg-surface flex aspect-video w-full flex-col items-center justify-center gap-3 rounded-panel border">
        <Lock className="text-ink-600 size-7" aria-hidden="true" />
        <p className="text-ink-900 font-medium">لا تملك صلاحية مشاهدة هذا الدرس.</p>
        <Button asChild variant="secondary" size="sm">
          <Link href="/courses">{COPY.nav.courses}</Link>
        </Button>
      </div>
    );
  }

  if (state.kind === 'unavailable') {
    return (
      <div
        role="alert"
        className="border-error/30 bg-error-soft flex aspect-video w-full flex-col items-center justify-center gap-3 rounded-panel border"
      >
        <AlertTriangle className="text-error size-7" aria-hidden="true" />
        <p className="text-ink-900 font-medium">{state.message}</p>
      </div>
    );
  }

  return (
    <figure className="flex flex-col gap-3">
      <div className="border-line-500 relative aspect-video w-full overflow-hidden rounded-panel border bg-black">
        <iframe
          ref={iframeRef}
          src={state.grant.embedUrl}
          title={title}
          allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          className="absolute inset-0 size-full"
        />
        <WatermarkOverlay text={state.grant.watermarkText} />
      </div>
      <figcaption className="text-ink-700 text-sm">
        هذا المقطع محمي، والوصول إليه مرتبط بحسابك الشخصي.
      </figcaption>
    </figure>
  );
}
