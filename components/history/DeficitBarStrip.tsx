'use client';

import { useMemo } from 'react';

export interface DayPoint {
  date: string;
  consumed: number;
  goal: number;            // chart midline value; in the new model this is TDEE
  hasData: boolean;
  // Total kcal burned for the day (TDEE). Optional — when present, rendered
  // as a tiny number below each bar so you can scan daily expenditure.
  burnedKcal?: number;
}

interface Props {
  days: DayPoint[];
  targetDeficit: number; // |D|, planned daily deficit, e.g. 500
  selectedDate: string | null;
  onSelect: (date: string) => void;
}

// Compute the average surplus across logged days. Positive = ate over goal on
// average; negative = ate under (the desired direction).
function avgSurplus(days: DayPoint[]): number | null {
  const logged = days.filter((d) => d.hasData);
  if (logged.length === 0) return null;
  const sum = logged.reduce((s, d) => s + (d.consumed - d.goal), 0);
  return sum / logged.length;
}

// Apple-Health-style energy balance bars. Vertical axis is "kcal vs burn":
//   surplus (consumed > TDEE) -> bar grows UP, red, labelled "+N"
//   deficit (consumed < TDEE) -> bar grows DOWN, green, labelled "−N"
// The amber "target" line sits BELOW the midline at −D (your planned daily
// deficit). A green bar that reaches the target line means you hit your plan;
// extending past it stacks a brighter gold gradient = bonus deficit.
// A tiny burn-kcal label is drawn below each bar for at-a-glance daily TDEE.
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

  // Actual average across the visible window. Positive surplus → above midline
  // (red side, bad). Negative → below (green side, good). Clamped to chart
  // bounds so an outlier window doesn't push the line off-screen.
  const avg = avgSurplus(days);
  const avgClamped = avg == null ? null : Math.max(-MAX_KCAL, Math.min(MAX_KCAL, avg));
  // Same convention as the bars: surplus (avg > 0) → above midline; deficit
  // (avg < 0) → below. With y growing downward, that means HALF − avg*PX.
  const avgOffset = avgClamped == null ? null : HALF - avgClamped * PX_PER_KCAL;
  // Avg label colour: blue if averaging UNDER goal (good direction), red if OVER.
  const avgLabel = avg == null ? null : (avg < 0 ? `avg −${Math.round(-avg)}` : `avg +${Math.round(avg)}`);
  const avgUnderGoal = avg != null && avg < 0;

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

        {/* Average actual line across the window. Distinct dotted blue/red so
            it's easy to compare against the target line at a glance. */}
        {avgOffset != null && avgLabel != null && (
          <>
            <div
              className={`absolute left-0 border-t-2 border-dotted pointer-events-none ${
                avgUnderGoal ? 'border-accent-blue' : 'border-accent-red'
              }`}
              style={{ top: avgOffset, right: GUTTER }}
            />
            <span
              className={`absolute right-0 text-[10px] font-semibold leading-none -translate-y-1/2 ${
                avgUnderGoal ? 'text-accent-blue' : 'text-accent-red'
              }`}
              style={{ top: avgOffset }}
            >
              {avgLabel}
            </span>
          </>
        )}

        {/* Midline (burn / TDEE) */}
        <div
          className="absolute left-0 border-t-[1.5px] border-gray-400 pointer-events-none"
          style={{ top: HALF, right: GUTTER }}
        />
        <span
          className="absolute right-0 text-[10px] font-semibold text-text-primary leading-none -translate-y-1/2"
          style={{ top: HALF }}
        >
          burn
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

      {/* Burned-kcal x-axis: one tiny label per day below the bars. Vertical
          rotation when bars are narrow (30d view) so 4-digit numbers fit. */}
      <div
        className="flex justify-center px-1 mt-1"
        style={{ paddingRight: GUTTER, gap: `${gap}px` }}
      >
        {items.map((d) => (
          <div
            key={`burn-${d.date}`}
            className="flex items-start justify-center text-[8px] leading-none text-text-secondary tabular-nums"
            style={{ width: barWidth, minHeight: 18 }}
          >
            {d.burnedKcal && d.burnedKcal > 0 ? (
              <span className={barWidth < 14 ? 'rotate-90 translate-y-2 origin-left whitespace-nowrap' : ''}>
                {formatBurn(d.burnedKcal)}
              </span>
            ) : null}
          </div>
        ))}
      </div>

      {/* Axis caption */}
      <div className="flex items-center justify-between mt-2 text-[11px] text-text-secondary">
        <span>{days.length > 0 ? formatShort(days[0].date) : ''}</span>
        <span>kcal vs burn · day burn below</span>
        <span>Today</span>
      </div>
    </div>
  );
}

// Compact format: 2189 → "2.2k", 870 → "870". Keeps the x-axis label tiny
// while still being scannable.
function formatBurn(kcal: number): string {
  if (kcal >= 1000) return `${(kcal / 1000).toFixed(1)}k`;
  return `${Math.round(kcal)}`;
}

function formatShort(iso: string): string {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
