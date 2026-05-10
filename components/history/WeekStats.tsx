'use client';

import { TrendingDown, TrendingUp, Flame, Target } from 'lucide-react';
import type { DayPoint } from './DeficitBarStrip';

interface Props {
  days: DayPoint[]; // last 7 chronological
  targetDeficit: number;
}

// Compact stats panel for the most recent 7 days. "Deficit" here = goal - consumed
// (positive number = ate under). Days with no data are excluded from averages.
export default function WeekStats({ days, targetDeficit }: Props) {
  const logged = days.filter((d) => d.hasData);
  const D = targetDeficit;

  if (logged.length === 0) {
    return (
      <p className="text-sm text-text-secondary text-center py-4">
        No data this week yet. Log a meal to see your stats.
      </p>
    );
  }

  const deltas = logged.map((d) => ({ date: d.date, delta: d.goal - d.consumed }));
  const avg = Math.round(deltas.reduce((s, x) => s + x.delta, 0) / deltas.length);
  const onTarget = deltas.filter((x) => Math.abs(x.delta - D) <= 200).length;
  const sortedAsc = [...deltas].sort((a, b) => a.delta - b.delta);
  const worst = sortedAsc[0];
  const best = sortedAsc[sortedAsc.length - 1];

  // Streak: consecutive days (counting back from the most recent logged day)
  // where delta >= 0 (i.e. did not exceed goal).
  let streak = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    const d = days[i];
    if (!d.hasData) break;
    if (d.goal - d.consumed >= 0) streak++;
    else break;
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <Stat
          icon={<Target className="w-4 h-4 text-accent-blue" />}
          label="Avg deficit"
          value={formatDelta(avg)}
          accent="text-accent-blue"
        />
        <Stat
          icon={<Flame className="w-4 h-4 text-accent-orange" />}
          label="On target"
          value={`${onTarget} / ${logged.length}`}
          accent="text-accent-orange"
        />
      </div>

      <div className="space-y-2">
        <Row
          icon={<TrendingDown className="w-4 h-4 text-accent-green" />}
          label="Best day"
          right={`${formatDay(best.date)} · ${formatDelta(best.delta)}`}
          tone="green"
        />
        <Row
          icon={<TrendingUp className="w-4 h-4 text-accent-red" />}
          label="Worst day"
          right={`${formatDay(worst.date)} · ${formatDelta(worst.delta)}`}
          tone="red"
        />
      </div>

      <div className="rounded-apple bg-secondary-bg px-3 py-2 flex items-center justify-between">
        <span className="text-sm text-text-secondary">Current streak</span>
        <span className="text-sm font-semibold text-text-primary">
          {streak} {streak === 1 ? 'day' : 'days'} under goal
        </span>
      </div>

      {/* Weight projections from the avg deficit. 7700 kcal ≈ 1 kg fat.
          Positive avg = real deficit = losing weight. */}
      {logged.length >= 3 && (() => {
        const weeklyKg = (avg * 7) / 7700;
        const monthlyKg = (avg * 30) / 7700;
        const fmt = (kg: number) => {
          const sign = kg > 0 ? '−' : kg < 0 ? '+' : '';
          const tone = kg > 0 ? 'text-accent-green' : kg < 0 ? 'text-accent-red' : 'text-text-primary';
          // Show g for sub-1kg, kg with 1 decimal otherwise. Easier to read at a glance.
          const abs = Math.abs(kg);
          const display = abs < 1 ? `${Math.round(abs * 1000)} g` : `${abs.toFixed(1)} kg`;
          return { sign, tone, display };
        };
        const w = fmt(weeklyKg);
        const m = fmt(monthlyKg);
        return (
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-apple bg-secondary-bg px-3 py-2">
              <div className="text-[10px] uppercase tracking-wide text-text-secondary">Projected weekly</div>
              <div className={`text-base font-semibold mt-0.5 ${w.tone}`}>
                {w.sign}{w.display}
              </div>
            </div>
            <div className="rounded-apple bg-secondary-bg px-3 py-2">
              <div className="text-[10px] uppercase tracking-wide text-text-secondary">Projected monthly</div>
              <div className={`text-base font-semibold mt-0.5 ${m.tone}`}>
                {m.sign}{m.display}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function Stat({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent: string }) {
  return (
    <div className="rounded-apple bg-secondary-bg px-3 py-2">
      <div className="flex items-center gap-1.5 text-text-secondary text-xs">
        {icon}
        {label}
      </div>
      <div className={`mt-0.5 text-base font-semibold ${accent}`}>{value}</div>
    </div>
  );
}

function Row({ icon, label, right, tone }: { icon: React.ReactNode; label: string; right: string; tone: 'green' | 'red' }) {
  const bg = tone === 'green' ? 'bg-green-50' : 'bg-red-50';
  return (
    <div className={`rounded-apple ${bg} px-3 py-2 flex items-center justify-between`}>
      <span className="flex items-center gap-2 text-sm text-text-primary">
        {icon}
        {label}
      </span>
      <span className="text-sm font-medium text-text-primary">{right}</span>
    </div>
  );
}

function formatDelta(delta: number): string {
  // Positive = under goal (deficit). Show with explicit sign so direction is clear.
  if (delta > 0) return `-${delta} kcal`;
  if (delta < 0) return `+${Math.abs(delta)} kcal`;
  return '0 kcal';
}

function formatDay(iso: string): string {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short' });
}
