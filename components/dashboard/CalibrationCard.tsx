'use client';

import { useEffect, useState } from 'react';
import { Scale, TrendingDown, TrendingUp, Check } from 'lucide-react';

interface Calibration {
  daysWithFood: number;
  daysWithActivity: number;
  cumulativeConsumed: number;
  cumulativeBurned: number;
  startWeight: number | null;
  endWeight: number | null;
  actualKgLost: number | null;
  expectedKgLost: number | null;
  delta: number | null;
  status: 'insufficient_data' | 'on_track' | 'losing_less_than_expected' | 'losing_more_than_expected';
  dailyAdjustmentKcal: number | null;
  message: string;
  window: { days: number };
}

// Renders the deficit calibration: predicted weight loss from cumulative
// (consumed - burned) vs actual weight delta. Hidden until there's enough
// data (14+ days of both food + activity), so it doesn't show as a sad
// empty state.
export default function CalibrationCard() {
  const [data, setData] = useState<Calibration | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch('/api/insights/calibration?days=30')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { setData(d); setLoaded(true); })
      .catch(() => setLoaded(true));
  }, []);

  if (!loaded || !data || data.status === 'insufficient_data') return null;

  const isOnTrack = data.status === 'on_track';
  const losingLess = data.status === 'losing_less_than_expected';

  const tone = isOnTrack
    ? 'border-green-200 bg-green-50'
    : losingLess
      ? 'border-amber-200 bg-amber-50'
      : 'border-blue-200 bg-blue-50';

  const Icon = isOnTrack ? Check : losingLess ? TrendingUp : TrendingDown;
  const iconTone = isOnTrack ? 'text-green-600' : losingLess ? 'text-amber-600' : 'text-blue-600';

  return (
    <div className={`rounded-2xl border p-4 ${tone}`}>
      <div className="flex items-center gap-2 mb-2">
        <Scale className="w-5 h-5 text-text-primary" />
        <h3 className="font-semibold text-text-primary">Goal calibration</h3>
        <span className="ml-auto text-xs text-text-secondary">last {data.window.days}d</span>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <div className="text-[10px] uppercase tracking-wide text-text-secondary">Predicted</div>
          <div className="text-lg font-semibold text-text-primary">
            {data.expectedKgLost != null
              ? `${data.expectedKgLost > 0 ? '−' : '+'}${Math.abs(data.expectedKgLost).toFixed(1)} kg`
              : '—'}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wide text-text-secondary">Actual</div>
          <div className="text-lg font-semibold text-text-primary">
            {data.actualKgLost != null
              ? `${data.actualKgLost > 0 ? '−' : '+'}${Math.abs(data.actualKgLost).toFixed(1)} kg`
              : '—'}
          </div>
        </div>
      </div>

      <div className="flex items-start gap-2">
        <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${iconTone}`} />
        <p className="text-sm text-text-primary leading-snug">{data.message}</p>
      </div>
    </div>
  );
}
