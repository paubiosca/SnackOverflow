'use client';

import { useEffect, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { FoodEntry } from '@/lib/types';

interface ProcessingTrayProps {
  entries: FoodEntry[];
  onRemove: (id: string) => void;
  // Vertical offset (px) above the bottom edge. Defaults to 72 to clear BottomNav.
  bottomOffset?: number;
}

interface TrackedEntry {
  entry: FoodEntry;
  // True once the entry has left 'pending' — kept around briefly for fade-out.
  exiting: boolean;
}

// Sticky tray showing in-flight food logs. Reads from the parent's entries
// (already polled by useFoodEntries) and animates rows out when they resolve.
export default function ProcessingTray({ entries, onRemove, bottomOffset = 72 }: ProcessingTrayProps) {
  const [tracked, setTracked] = useState<Record<string, TrackedEntry>>({});

  useEffect(() => {
    setTracked((prev) => {
      const next: Record<string, TrackedEntry> = { ...prev };

      // Add or refresh pending rows.
      for (const e of entries) {
        if (e.status === 'pending') {
          next[e.id] = { entry: e, exiting: false };
        } else if (next[e.id] && !next[e.id].exiting) {
          // Pending → resolved/failed/needs_clarification: start exit animation.
          next[e.id] = { entry: e, exiting: true };
        }
      }

      // Drop rows that no longer exist in the parent list at all.
      for (const id of Object.keys(next)) {
        if (!entries.find((e) => e.id === id)) {
          delete next[id];
        }
      }

      return next;
    });
  }, [entries]);

  // After the exit animation, remove the row from local state.
  useEffect(() => {
    const exitingIds = Object.entries(tracked)
      .filter(([, t]) => t.exiting)
      .map(([id]) => id);
    if (exitingIds.length === 0) return;
    const timer = setTimeout(() => {
      setTracked((prev) => {
        const next = { ...prev };
        for (const id of exitingIds) delete next[id];
        return next;
      });
    }, 350);
    return () => clearTimeout(timer);
  }, [tracked]);

  const rows = Object.values(tracked);
  if (rows.length === 0) return null;

  return (
    <div
      className="fixed left-0 right-0 z-40 px-4 pointer-events-none"
      style={{ bottom: bottomOffset }}
    >
      <div className="max-w-md mx-auto space-y-2">
        {rows.map(({ entry, exiting }) => {
          const label = entry.inputDescription || entry.name || 'Analyzing food';
          return (
            <div
              key={entry.id}
              className={`pointer-events-auto flex items-center gap-2 px-3 py-2 bg-white/95 backdrop-blur shadow-apple rounded-apple border border-border-light transition-all duration-300 ${
                exiting ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'
              }`}
            >
              <Loader2 className="w-4 h-4 text-accent-blue animate-spin shrink-0" />
              <span className="flex-1 min-w-0 text-sm text-text-primary truncate">{label}</span>
              <button
                onClick={() => onRemove(entry.id)}
                className="p-1 rounded-full text-text-secondary hover:bg-secondary-bg active:bg-gray-200 touch-manipulation"
                aria-label="Cancel pending entry"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
