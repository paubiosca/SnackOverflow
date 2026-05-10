'use client';

import { useMemo } from 'react';

export interface DayPoint {
  date: string;
  consumed: number;
  goal: number;
  hasData: boolean;
}

interface Props {
  days: DayPoint[];
  targetDeficit: number; // |D|, planned daily deficit, e.g. 500
  selectedDate: string | null;
  onSelect: (date: string) => void;
}

// Diverging bar chart with a real Y-axis. Vertical scale: each kcal of
// (goal − consumed) maps to a fixed pixel height. Solid horizontal lines at
// 0 (the calorie goal) and ±D (planned deficit threshold). Faint ticks every
// `step` kcal in between, labelled on the right gutter.
//
// Bars stack two colors so a "bonus" day reads as strictly better than
// "on target": green up to the target deficit line, then a brighter gold
// gradient on top for the overflow above D.
export default function DeficitBarStrip({ days, targetDeficit, selectedDate, onSelect }: Props) {
  const D = Math.max(100, targetDeficit);
  const HALF = 90; // px per side; total chart height = 180
  const MAX_KCAL = Math.ceil(D * 1.5 / 100) * 100; // round up to nearest 100
  const PX_PER_KCAL = HALF / MAX_KCAL;
  const GUTTER = 36; // right-side y-axis label gutter

  const barWidth = days.length <= 7 ? 28 : days.length <= 14 ? 16 : 9;
  const gap = days.length <= 7 ? 8 : days.length <= 14 ? 4 : 3;

  // Pick a tick step that's a round 100/200/250/500 close to D/2.
  const step = useMemo(() => {
    const candidates = [100, 200, 250, 500];
    const ideal = D / 2;
    return candidates.reduce((best, c) => (Math.abs(c - ideal) < Math.abs(best - ideal) ? c : best), 200);
  }, [D]);

  const ticks = useMemo(() => {
    const out: number[] = [];
    for (let v = step; v <= MAX_KCAL; v += step) out.push(v);
    return out; // positive offsets; mirrored above and below the midline
  }, [step, MAX_KCAL]);

  const items = useMemo(() => {
    return days.map((d) => {
      const delta = d.goal - d.consumed; // + = under goal, − = over
      const clamped = Math.max(-MAX_KCAL, Math.min(MAX_KCAL, delta));
      // Split the positive bar into the "green" portion (0..D) and the
      // "gold bonus" portion (D..clamped) so they stack visually.
      const greenKcal = Math.max(0, Math.min(D, clamped));
      const goldKcal = Math.max(0, clamped - D);
      const redKcal = Math.max(0, -clamped);
      return {
        ...d,
        delta,
        greenPx: greenKcal * PX_PER_KCAL,
        goldPx: goldKcal * PX_PER_KCAL,
        redPx: redKcal * PX_PER_KCAL,
      };
    });
  }, [days, MAX_KCAL, D, PX_PER_KCAL]);

  const todayStr = new Date().toISOString().slice(0, 10);
  const targetTopOffset = HALF - D * PX_PER_KCAL;
  const targetBottomOffset = HALF + D * PX_PER_KCAL;

  return (
    <div className="select-none">
      <div className="relative" style={{ height: HALF * 2, paddingRight: GUTTER }}>
        {/* Tick lines + labels (faint dashed) */}
        {ticks.map((v) => {
          const topY = HALF - v * PX_PER_KCAL;
          const botY = HALF + v * PX_PER_KCAL;
          if (v === D) return null; // target line drawn separately
          return (
            <div key={v}>
              <div
                className="absolute left-0 border-t border-dashed border-gray-200 pointer-events-none"
                style={{ top: topY, right: GUTTER }}
              />
              <div
                className="absolute left-0 border-t border-dashed border-gray-200 pointer-events-none"
                style={{ top: botY, right: GUTTER }}
              />
              <span
                className="absolute right-0 text-[10px] text-text-secondary leading-none -translate-y-1/2"
                style={{ top: topY }}
              >
                +{v}
              </span>
              <span
                className="absolute right-0 text-[10px] text-text-secondary leading-none -translate-y-1/2"
                style={{ top: botY }}
              >
                −{v}
              </span>
            </div>
          );
        })}

        {/* Target deficit line (above midline) — strong, colored */}
        <div
          className="absolute left-0 border-t-2 border-amber-400 pointer-events-none"
          style={{ top: targetTopOffset, right: GUTTER }}
        />
        <span
          className="absolute right-0 text-[10px] font-semibold text-amber-600 leading-none -translate-y-1/2"
          style={{ top: targetTopOffset }}
        >
          target
        </span>

        {/* Mirror "lost-day" line below midline at -D — softer red */}
        <div
          className="absolute left-0 border-t border-red-300 pointer-events-none"
          style={{ top: targetBottomOffset, right: GUTTER }}
        />

        {/* Midline (goal) — solid */}
        <div
          className="absolute left-0 border-t-[1.5px] border-gray-400 pointer-events-none"
          style={{ top: HALF, right: GUTTER }}
        />
        <span
          className="absolute right-0 text-[10px] font-semibold text-text-primary leading-none -translate-y-1/2"
          style={{ top: HALF }}
        >
          goal
        </span>

        {/* Bars */}
        <div className="absolute inset-0 flex justify-center" style={{ paddingRight: GUTTER, gap: `${gap}px` }}>
          {items.map((d) => {
            const isSelected = d.date === selectedDate;
            const isToday = d.date === todayStr;
            return (
              <button
                key={d.date}
                onClick={() => onSelect(d.date)}
                className="relative h-full"
                style={{ width: barWidth, WebkitTapHighlightColor: 'transparent' }}
                aria-label={`${d.date}: ${d.consumed} kcal, goal ${d.goal}`}
              >
                {/* Positive (under-goal): bottom = midline, grows up */}
                {d.hasData && d.greenPx > 0 && (
                  <div
                    className={`absolute left-0 right-0 bg-accent-green transition-all ${
                      d.goldPx > 0 ? '' : 'rounded-t-sm'
                    } ${isSelected ? 'ring-2 ring-text-primary ring-offset-1' : ''}`}
                    style={{ top: HALF - d.greenPx, height: d.greenPx }}
                  />
                )}
                {d.hasData && d.goldPx > 0 && (
                  <div
                    className={`absolute left-0 right-0 rounded-t-sm transition-all ${
                      isSelected ? 'ring-2 ring-text-primary ring-offset-1' : ''
                    }`}
                    style={{
                      top: HALF - d.greenPx - d.goldPx,
                      height: d.goldPx,
                      background: 'linear-gradient(to top, #fbbf24, #fde047)',
                      boxShadow: '0 0 6px rgba(251, 191, 36, 0.55)',
                    }}
                  />
                )}
                {/* Negative (over-goal): top = midline, grows down */}
                {d.hasData && d.redPx > 0 && (
                  <div
                    className={`absolute left-0 right-0 rounded-b-sm bg-accent-red transition-all ${
                      isSelected ? 'ring-2 ring-text-primary ring-offset-1' : ''
                    }`}
                    style={{ top: HALF, height: d.redPx }}
                  />
                )}

                {isToday && (
                  <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-accent-blue" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Axis caption */}
      <div className="flex items-center justify-between mt-3 text-[11px] text-text-secondary">
        <span>{days.length > 0 ? formatShort(days[0].date) : ''}</span>
        <span>kcal vs goal</span>
        <span>Today</span>
      </div>
    </div>
  );
}

function formatShort(iso: string): string {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
