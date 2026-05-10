'use client';

import { useMemo } from 'react';

export interface DayPoint {
  date: string; // YYYY-MM-DD
  consumed: number;
  goal: number; // base goal for that day (already includes planned deficit)
  hasData: boolean;
}

interface Props {
  days: DayPoint[]; // chronological, oldest -> newest, length up to 30
  targetDeficit: number; // |D|, the planned daily deficit, e.g. 500
  selectedDate: string | null;
  onSelect: (date: string) => void;
}

// Diverging bar strip: midline is the calorie goal. Bars grow up (green) when
// the user ate under goal (extra deficit) and down (red) when they went over.
// Heights are normalized to the planned daily deficit so a full-height bar
// equals "doubled your planned deficit" or "lost a full day".
export default function DeficitBarStrip({ days, targetDeficit, selectedDate, onSelect }: Props) {
  const D = Math.max(100, targetDeficit); // safety floor; keeps the math sane
  const HALF = 56; // pixels per side of the midline; tuned for iPhone viewport

  const items = useMemo(() => {
    return days.map((d) => {
      const delta = d.goal - d.consumed; // positive = under goal
      // Cap visual at 1.5×D in either direction so outliers don't crush the rest.
      const cappedRatio = Math.max(-1.5, Math.min(1.5, delta / D));
      const height = Math.abs(cappedRatio) * HALF;
      return { ...d, delta, ratio: delta / D, height, cappedRatio };
    });
  }, [days, D]);

  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <div className="select-none">
      <div className="flex items-end justify-center gap-[3px] px-1" style={{ height: HALF * 2 + 16 }}>
        {items.map((d) => {
          const above = d.delta >= 0;
          const isSelected = d.date === selectedDate;
          const isToday = d.date === todayStr;
          const overflow = Math.abs(d.cappedRatio) > 1;

          return (
            <button
              key={d.date}
              onClick={() => onSelect(d.date)}
              className="relative flex flex-col items-center justify-center group"
              style={{ height: HALF * 2 + 16, width: 10, WebkitTapHighlightColor: 'transparent' }}
              aria-label={`${d.date}: ${d.consumed} kcal, goal ${d.goal}`}
            >
              {/* Top half (under-goal, positive deficit) */}
              <div className="flex items-end justify-center" style={{ height: HALF, width: '100%' }}>
                {above && d.hasData && (
                  <div
                    className={`w-full rounded-t-sm transition-all ${
                      overflow ? 'bg-amber-400' : 'bg-accent-green'
                    } ${isSelected ? 'ring-2 ring-text-primary ring-offset-1' : ''}`}
                    style={{ height: Math.max(2, d.height) }}
                  />
                )}
              </div>

              {/* Midline */}
              <div className="w-full border-t border-dashed border-border-light" />

              {/* Bottom half (over-goal, surplus) */}
              <div className="flex items-start justify-center" style={{ height: HALF, width: '100%' }}>
                {!above && d.hasData && (
                  <div
                    className={`w-full rounded-b-sm transition-all bg-accent-red ${
                      isSelected ? 'ring-2 ring-text-primary ring-offset-1' : ''
                    }`}
                    style={{ height: Math.max(2, d.height) }}
                  />
                )}
              </div>

              {/* Today marker */}
              {isToday && (
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-accent-blue" />
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-between mt-3 text-[11px] text-text-secondary">
        <span>{days.length > 0 ? formatShort(days[0].date) : ''}</span>
        <span className="flex items-center gap-3">
          <Swatch className="bg-accent-green" label="under" />
          <Swatch className="bg-amber-400" label="bonus" />
          <Swatch className="bg-accent-red" label="over" />
        </span>
        <span>Today</span>
      </div>
    </div>
  );
}

function Swatch({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className={`inline-block w-2.5 h-2.5 rounded-sm ${className}`} />
      {label}
    </span>
  );
}

function formatShort(iso: string): string {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
