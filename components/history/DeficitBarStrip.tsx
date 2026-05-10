'use client';

import { useMemo } from 'react';

export interface DayPoint {
  date: string; // YYYY-MM-DD
  consumed: number;
  goal: number;
  hasData: boolean;
}

interface Props {
  days: DayPoint[];
  targetDeficit: number;
  selectedDate: string | null;
  onSelect: (date: string) => void;
}

// Diverging bar strip: a single horizontal midline runs the full width of the
// chart at vertical center. Each day is two stacked half-columns: the top half
// grows downward toward the midline (under-goal = green/gold), the bottom half
// grows upward away from the midline (over-goal = red).
export default function DeficitBarStrip({ days, targetDeficit, selectedDate, onSelect }: Props) {
  const D = Math.max(100, targetDeficit);
  const HALF = 64;
  const HEIGHT = HALF * 2;
  const barWidth = days.length <= 7 ? 28 : days.length <= 14 ? 18 : 10;
  const gap = days.length <= 7 ? 6 : 3;

  const items = useMemo(() => {
    return days.map((d) => {
      const delta = d.goal - d.consumed;
      const cappedRatio = Math.max(-1.5, Math.min(1.5, delta / D));
      const height = Math.min(HALF, Math.abs(cappedRatio) * HALF);
      return { ...d, delta, height, overflow: Math.abs(cappedRatio) > 1 };
    });
  }, [days, D]);

  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <div className="select-none">
      <div
        className="relative flex justify-center px-1"
        style={{ height: HEIGHT, gap: `${gap}px` }}
      >
        {/* Single midline drawn behind the bars, spanning the full chart width. */}
        <div
          className="absolute left-0 right-0 border-t border-dashed border-border-light pointer-events-none"
          style={{ top: HALF }}
        />

        {items.map((d) => {
          const above = d.delta >= 0;
          const isSelected = d.date === selectedDate;
          const isToday = d.date === todayStr;

          return (
            <button
              key={d.date}
              onClick={() => onSelect(d.date)}
              className="relative flex flex-col items-stretch"
              style={{ height: HEIGHT, width: barWidth, WebkitTapHighlightColor: 'transparent' }}
              aria-label={`${d.date}: ${d.consumed} kcal, goal ${d.goal}`}
            >
              {/* Top half: bar sits at the bottom of this half, grows upward. */}
              <div className="flex items-end justify-center" style={{ height: HALF }}>
                {above && d.hasData && d.height > 0 && (
                  <div
                    className={`w-full rounded-t-sm transition-all ${
                      d.overflow ? 'bg-amber-400' : 'bg-accent-green'
                    } ${isSelected ? 'ring-2 ring-text-primary ring-offset-1' : ''}`}
                    style={{ height: Math.max(2, d.height) }}
                  />
                )}
              </div>

              {/* Bottom half: bar sits at the top of this half, grows downward. */}
              <div className="flex items-start justify-center" style={{ height: HALF }}>
                {!above && d.hasData && d.height > 0 && (
                  <div
                    className={`w-full rounded-b-sm transition-all bg-accent-red ${
                      isSelected ? 'ring-2 ring-text-primary ring-offset-1' : ''
                    }`}
                    style={{ height: Math.max(2, d.height) }}
                  />
                )}
              </div>

              {isToday && (
                <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-accent-blue" />
              )}
            </button>
          );
        })}
      </div>

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
