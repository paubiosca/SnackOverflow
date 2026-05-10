'use client';

import { useEffect, useState } from 'react';
import { Target, TrendingDown } from 'lucide-react';

interface SmartGoal {
  target: number;
  deficit: number;
  weeklyKgLoss: number;
  baseline: number;
  baselineSource: 'apple_health_today' | 'calibrated' | 'formula';
  stravaKcal: number;
  tdeeToday: number;
  bmrFormula: number;
  profile: {
    goalType: 'deficit_fixed' | 'weight_loss_rate';
    goalValue: number;
    tdeeBaselineKcal: number | null;
  };
}

interface Props {
  consumedKcal: number;
}

const SOURCE_LABEL: Record<SmartGoal['baselineSource'], string> = {
  apple_health_today: "today's Apple Health total",
  calibrated: 'your calibrated baseline',
  formula: 'a textbook formula',
};

// Today's calorie target driven by REAL data (calibrated baseline + today's
// Strava runs - your deficit). Replaces the static formula-based goal on the
// dashboard. Updates automatically when Strava webhook lands a new run.
export default function SmartGoalCard({ consumedKcal }: Props) {
  const [data, setData] = useState<SmartGoal | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch('/api/insights/smart-goal')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { setData(d); setLoaded(true); })
      .catch(() => setLoaded(true));
  }, []);

  if (!loaded || !data) return null;

  const remaining = data.target - consumedKcal;
  const pct = Math.min(100, Math.round((consumedKcal / data.target) * 100));
  const over = consumedKcal > data.target;

  return (
    <div className="bg-white rounded-2xl border border-border-light p-4">
      <div className="flex items-center gap-2 mb-3">
        <Target className="w-5 h-5 text-accent-blue" />
        <h3 className="font-semibold text-text-primary">Today&apos;s target</h3>
        <span className="ml-auto text-xs text-text-secondary">
          {data.weeklyKgLoss.toFixed(1)} kg/wk goal
        </span>
      </div>

      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-3xl font-bold text-text-primary">{data.target.toLocaleString()}</span>
        <span className="text-sm text-text-secondary">kcal</span>
        <span className="ml-auto text-sm font-medium text-text-secondary">
          {consumedKcal.toLocaleString()} eaten
        </span>
      </div>

      <div className="w-full bg-secondary-bg rounded-full h-2 mb-3 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${over ? 'bg-accent-red' : 'bg-accent-blue'}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className={`text-sm font-medium mb-3 ${remaining < 0 ? 'text-accent-red' : 'text-text-primary'}`}>
        {remaining >= 0
          ? `${remaining.toLocaleString()} kcal left`
          : `${Math.abs(remaining).toLocaleString()} kcal over`}
      </div>

      <div className="text-xs text-text-secondary space-y-0.5 pt-3 border-t border-border-light">
        <div className="flex justify-between">
          <span>Baseline burn ({SOURCE_LABEL[data.baselineSource]})</span>
          <span className="font-mono text-text-primary">{data.baseline.toLocaleString()}</span>
        </div>
        {data.stravaKcal > 0 && (
          <div className="flex justify-between">
            <span>+ Strava run today</span>
            <span className="font-mono text-text-primary">+{data.stravaKcal.toLocaleString()}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span>− deficit ({Math.abs(data.deficit)} kcal/day)</span>
          <span className="font-mono text-text-primary">{data.deficit.toLocaleString()}</span>
        </div>
        <div className="flex justify-between font-medium pt-1 border-t border-border-light/50">
          <span className="text-text-primary">Eating target</span>
          <span className="font-mono text-text-primary">{data.target.toLocaleString()}</span>
        </div>
      </div>

      {data.baselineSource === 'formula' && (
        <p className="text-xs text-amber-700 mt-2 leading-snug flex items-start gap-1">
          <TrendingDown className="w-3 h-3 mt-0.5 shrink-0" />
          Using textbook formula — calibrate from a real-data source for a better number.
        </p>
      )}
    </div>
  );
}
