'use client';

import { useEffect, useState } from 'react';
import { Flame } from 'lucide-react';

interface DailyActivity {
  activeKcal: number | null;
  bmrKcal: number | null;
  totalKcal: number | null;
  steps: number | null;
}

interface Props {
  /** Net calories: consumed - total burned. Used for the headline number. */
  consumedKcal: number;
}

// Renders today's burned calories from a connected wearable (via Terra) and
// the resulting net calories for the day. Hidden when no wearable is connected
// to avoid a noisy zero-state — the user opts in by connecting a device on
// the profile page.
export default function BurnedCaloriesTile({ consumedKcal }: Props) {
  const [today, setToday] = useState<DailyActivity | null>(null);
  const [connected, setConnected] = useState<boolean>(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch('/api/health/status')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        setConnected(!!data.connected);
        setToday(data.today ?? null);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  if (!loaded || !connected) return null;
  const burned = today?.totalKcal ?? today?.activeKcal ?? 0;
  if (!burned) return null;

  const net = consumedKcal - burned;

  return (
    <div className="bg-white rounded-2xl border border-border-light p-4 flex items-center gap-4">
      <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center">
        <Flame className="w-5 h-5 text-orange-500" />
      </div>
      <div className="flex-1">
        <div className="text-xs text-text-secondary uppercase tracking-wide">Burned today</div>
        <div className="text-lg font-semibold text-text-primary">{burned} kcal</div>
        {today?.steps ? (
          <div className="text-xs text-text-secondary">{today.steps.toLocaleString()} steps</div>
        ) : null}
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
