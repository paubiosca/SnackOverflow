'use client';

import { useEffect, useState } from 'react';
import { Flame } from 'lucide-react';

interface StatusResponse {
  connected: boolean;
  appleConnected: boolean;
  stravaConnected: boolean;
  today: { activeKcal: number | null; bmrKcal: number | null; totalKcal: number | null; steps: number | null } | null;
  stravaKcal: number;
  combined: { activeKcal: number; totalKcal: number | null };
}

interface Props {
  /** Today's eaten kcal — used for net calorie display. */
  consumedKcal: number;
}

// Today's burned calories. Combines Apple Health (basal + walking) with Strava
// (Garmin runs). Hidden when neither source is connected — the user opts in via
// the profile page. Shows a small breakdown when both sources contribute.
export default function BurnedCaloriesTile({ consumedKcal }: Props) {
  const [data, setData] = useState<StatusResponse | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch('/api/health/status')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { setData(d); setLoaded(true); })
      .catch(() => setLoaded(true));
  }, []);

  if (!loaded || !data || !data.connected) return null;

  // Prefer the combined total (apple total + strava). If Apple total is missing
  // (no ingest yet today), fall back to combined active + bmr if we have it.
  const appleTotal = data.today?.totalKcal ?? null;
  const burned = (appleTotal ?? 0) + data.stravaKcal;
  if (!burned) return null;

  const net = consumedKcal - burned;
  const appleActive = data.today?.activeKcal ?? 0;
  const stravaKcal = data.stravaKcal;
  const showBreakdown = appleActive > 0 && stravaKcal > 0;

  return (
    <div className="bg-white rounded-2xl border border-border-light p-4 flex items-center gap-4">
      <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center">
        <Flame className="w-5 h-5 text-orange-500" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-text-secondary uppercase tracking-wide">Burned today</div>
        <div className="text-lg font-semibold text-text-primary">{burned} kcal</div>
        <div className="text-xs text-text-secondary truncate">
          {showBreakdown ? (
            <>{appleActive} walk + {stravaKcal} run · {data.today?.steps?.toLocaleString() ?? 0} steps</>
          ) : data.today?.steps ? (
            <>{data.today.steps.toLocaleString()} steps</>
          ) : stravaKcal > 0 ? (
            <>{stravaKcal} kcal from Strava</>
          ) : null}
        </div>
      </div>
      <div className="text-right">
        <div className="text-xs text-text-secondary uppercase tracking-wide">Net</div>
        <div className={`text-lg font-semibold ${net < 0 ? 'text-green-600' : 'text-text-primary'}`}>
          {net >= 0 ? '+' : ''}{net} kcal
        </div>
      </div>
    </div>
  );
}
