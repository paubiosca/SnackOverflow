'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, X, Check, AlertCircle } from 'lucide-react';
import { FoodEntry } from '@/lib/types';

interface ProcessingTrayProps {
  entries: FoodEntry[];
  onRemove: (id: string) => void;
  // Vertical offset (px) above the bottom edge. Defaults to 72 to clear BottomNav.
  bottomOffset?: number;
}

interface TrackedEntry {
  entry: FoodEntry;
  phase: 'pending' | 'resolved' | 'failed' | 'fading';
}

const LINGER_MS = 2400;
const FADE_MS = 350;

// Sticky tray with three phases per row:
//   pending  -> blue spinner + the user's input
//   resolved -> green strip with the AI's parsed name + calories (lingers ~2.4s)
//   failed   -> red strip with a Remove button
// Per-entry timeouts are stored in refs and only set ONCE per phase change,
// so unrelated re-renders (e.g. ongoing polling for other rows) can't reset
// the linger and cause the result strip to vanish before the user reads it.
export default function ProcessingTray({ entries, onRemove, bottomOffset = 72 }: ProcessingTrayProps) {
  const [tracked, setTracked] = useState<Record<string, TrackedEntry>>({});
  const lingerTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const fadeTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Sync `tracked` from incoming entries.
  useEffect(() => {
    setTracked((prev) => {
      const next: Record<string, TrackedEntry> = { ...prev };

      for (const e of entries) {
        const status = e.status ?? 'resolved';
        const existing = next[e.id];

        if (status === 'pending') {
          next[e.id] = { entry: e, phase: 'pending' };
        } else if (status === 'resolved' || status === 'failed') {
          // Only flip to result if we were tracking it as pending — keeps old
          // already-resolved entries from the day's list out of the tray.
          if (existing && existing.phase === 'pending') {
            next[e.id] = { entry: e, phase: status };
          } else if (existing) {
            next[e.id] = { ...existing, entry: e };
          }
        } else if (status === 'needs_clarification' && existing) {
          // ClarifyCard / ClarifySheet handle these.
          delete next[e.id];
        }
      }

      for (const id of Object.keys(next)) {
        if (!entries.find((e) => e.id === id)) delete next[id];
      }

      return next;
    });
  }, [entries]);

  // Schedule the linger -> fade transitions whenever an entry first enters
  // `resolved` or `failed`. Skip if we already scheduled one for this id.
  useEffect(() => {
    for (const [id, t] of Object.entries(tracked)) {
      if ((t.phase === 'resolved' || t.phase === 'failed') && !lingerTimers.current[id]) {
        lingerTimers.current[id] = setTimeout(() => {
          setTracked((prev) => {
            if (!prev[id]) return prev;
            return { ...prev, [id]: { ...prev[id], phase: 'fading' } };
          });
          delete lingerTimers.current[id];
        }, LINGER_MS);
      }
      if (t.phase === 'fading' && !fadeTimers.current[id]) {
        fadeTimers.current[id] = setTimeout(() => {
          setTracked((prev) => {
            const next = { ...prev };
            delete next[id];
            return next;
          });
          delete fadeTimers.current[id];
        }, FADE_MS);
      }
    }
    // Clean up timers for entries that disappeared.
    for (const id of Object.keys(lingerTimers.current)) {
      if (!tracked[id]) {
        clearTimeout(lingerTimers.current[id]);
        delete lingerTimers.current[id];
      }
    }
    for (const id of Object.keys(fadeTimers.current)) {
      if (!tracked[id]) {
        clearTimeout(fadeTimers.current[id]);
        delete fadeTimers.current[id];
      }
    }
  }, [tracked]);

  // Final unmount cleanup so timers don't fire after the component is gone.
  useEffect(() => {
    const linger = lingerTimers.current;
    const fade = fadeTimers.current;
    return () => {
      for (const t of Object.values(linger)) clearTimeout(t);
      for (const t of Object.values(fade)) clearTimeout(t);
    };
  }, []);

  const rows = Object.values(tracked);
  if (rows.length === 0) return null;

  return (
    <div
      className="fixed left-0 right-0 z-40 px-4 pointer-events-none"
      style={{ bottom: bottomOffset }}
    >
      <div className="max-w-md mx-auto space-y-2">
        {rows.map(({ entry, phase }) => {
          const fading = phase === 'fading';
          const tone =
            phase === 'resolved' || phase === 'fading'
              ? 'border-green-200 bg-green-50/95'
              : phase === 'failed'
                ? 'border-red-200 bg-red-50/95'
                : 'border-border-light bg-white/95';

          return (
            <div
              key={entry.id}
              className={`pointer-events-auto flex items-center gap-2 px-3 py-2 backdrop-blur shadow-apple rounded-apple border transition-all duration-300 ${tone} ${
                fading ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'
              }`}
            >
              {phase === 'pending' && (
                <>
                  <Loader2 className="w-4 h-4 text-accent-blue animate-spin shrink-0" />
                  <span className="flex-1 min-w-0 text-sm text-text-primary truncate">
                    {entry.inputDescription || entry.name || 'Analyzing food'}
                  </span>
                  <button
                    onClick={() => onRemove(entry.id)}
                    className="p-1 rounded-full text-text-secondary hover:bg-secondary-bg active:bg-gray-200 touch-manipulation"
                    aria-label="Cancel pending entry"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </>
              )}

              {(phase === 'resolved' || phase === 'fading') && (
                <>
                  <Check className="w-4 h-4 text-accent-green shrink-0" />
                  <span className="flex-1 min-w-0 text-sm text-text-primary truncate">
                    {entry.name}
                  </span>
                  <span className="text-sm font-semibold text-accent-green shrink-0">
                    {entry.calories} kcal
                  </span>
                </>
              )}

              {phase === 'failed' && (
                <>
                  <AlertCircle className="w-4 h-4 text-accent-red shrink-0" />
                  <span className="flex-1 min-w-0 text-sm text-text-primary truncate">
                    Couldn&apos;t analyze {entry.inputDescription || entry.name || 'this entry'}
                  </span>
                  <button
                    onClick={() => onRemove(entry.id)}
                    className="text-xs font-medium text-accent-red"
                  >
                    Remove
                  </button>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
