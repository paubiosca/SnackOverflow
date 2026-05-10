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

// Apple-Health-style energy balance bars. Vertical axis is "kcal vs goal":
//   surplus (ate > goal)  -> bar grows UP, red, labelled "+200" etc.
//   deficit (ate < goal)  -> bar grows DOWN, green, labelled "−200" etc.
// The amber "target" line sits BELOW the midline at −D (your planned daily
// deficit). A green bar that reaches the target line means you hit your plan;
// extending past it stacks a brighter gold gradient = bonus deficit.
export default function DeficitBarStrip({ days, targetDeficit, selectedDate, onSelect }: Props) {
  const D = Math.max(100, targetDeficit);
  const HALF = 90; // px per side; total chart height = 180
  const MAX_KCAL = Math.ceil((D * 1.5) / 100) * 100; // round up to nearest 100
  const PX_PER_KCAL = HALF / MAX_KCAL;
  const GUTTER = 36;

  const barWidth = days.length <= 7 ? 28 : days.length <= 14 ? 16 : 9;
  const gap = days.length <= 7 ? 8 : days.length <= 14 ? 4 : 3;

  const step = useMemo(() => {
    const candidates = [100, 200, 250, 500];
    const ideal = D / 2;
    return candidates.reduce((best, c) => (Math.abs(c - ideal) < Math.abs(best - ideal) ? c : best), 200);
  }, [D]);

  const ticks = useMemo(() => {
    const out: number[] = [];
    for (let v = step; v <= MAX_KCAL; v += step) out.push(v);
    return out;
  }, [step, MAX_KCAL]);

  const items = useMemo(() => {
    return days.map((d) => {
      // surplus = consumed - goal. Positive means over-eating.
      const surplus = d.consumed - d.goal;
      const clamped = Math.max(-MAX_KCAL, Math.min(MAX_KCAL, surplus));
      const redKcal = Math.max(0, clamped);                            // surplus → red, up
      const deficitKcal = Math.max(0, -clamped);                       // |under-goal|
      const greenKcal = Math.min(D, deficitKcal);                      // green: 0 .. D below midline
      const goldKcal = Math.max(0, deficitKcal - D);                   // gold: D .. clamped below
      return {
        ...d,
        surplus,
        redPx: redKcal * PX_PER_KCAL,
        greenPx: greenKcal * PX_PER_KCAL,
        goldPx: goldKcal * PX_PER_KCAL,
      };
    });
  }, [days, MAX_KCAL, D, PX_PER_KCAL]);

  const todayStr = new Date().toISOString().slice(0, 10);
  // Target line is BELOW the midline now (deficit goes down).
  const targetBelowOffset = HALF + D * PX_PER_KCAL;

  return (
    <div className="select-none">
      <div className="relative" style={{ height: HALF * 2, paddingRight: GUTTER }}>
        {/* Tick lines + labels: "+v" above (surplus), "−v" below (deficit) */}
        {ticks.map((v) => {
          const topY = HALF - v * PX_PER_KCAL; // above midline
          const botY = HALF + v * PX_PER_KCAL; // below midline
          if (v === D) return null;            // target line drawn separately
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

        {/* Target deficit line — below midline, amber. Hitting/passing this is good. */}
        <div
          className="absolute left-0 border-t-2 border-amber-400 pointer-events-none"
          style={{ top: targetBelowOffset, right: GUTTER }}
        />
        <span
          className="absolute right-0 text-[10px] font-semibold text-amber-600 leading-none -translate-y-1/2"
          style={{ top: targetBelowOffset }}
        >
          target
        </span>

        {/* Midline (goal) */}
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
        <div
          className="absolute inset-0 flex justify-center"
          style={{ paddingRight: GUTTER, gap: `${gap}px` }}
        >
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
                {/* Surplus (over goal): top of bar starts at midline, grows UP, red. */}
                {d.hasData && d.redPx > 0 && (
                  <div
                    className={`absolute left-0 right-0 rounded-t-sm bg-accent-red transition-all ${
                      isSelected ? 'ring-2 ring-text-primary ring-offset-1' : ''
                    }`}
                    style={{ top: HALF - d.redPx, height: d.redPx }}
                  />
                )}
                {/* Deficit (under goal): top of bar at midline, grows DOWN. Green up to D, then gold. */}
                {d.hasData && d.greenPx > 0 && (
                  <div
                    className={`absolute left-0 right-0 bg-accent-green transition-all ${
                      d.goldPx > 0 ? '' : 'rounded-b-sm'
                    } ${isSelected ? 'ring-2 ring-text-primary ring-offset-1' : ''}`}
                    style={{ top: HALF, height: d.greenPx }}
                  />
                )}
                {d.hasData && d.goldPx > 0 && (
                  <div
                    className={`absolute left-0 right-0 rounded-b-sm transition-all ${
                      isSelected ? 'ring-2 ring-text-primary ring-offset-1' : ''
                    }`}
                    style={{
                      top: HALF + d.greenPx,
                      height: d.goldPx,
                      background: 'linear-gradient(to bottom, #fbbf24, #fde047)',
                      boxShadow: '0 0 6px rgba(251, 191, 36, 0.55)',
                    }}
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
