'use client';

import { useState } from 'react';
import { Zap, Check } from 'lucide-react';

// Single-input backfill: user types their average daily active calories,
// we fill the last 30 days with it. Imperfect but unlocks the calibration
// insight without any Shortcut / export / per-day entry. Hidden once they
// have real Apple Health data flowing.
export default function QuickBackfill() {
  const [active, setActive] = useState('');
  const [bmr, setBmr] = useState('');
  const [steps, setSteps] = useState('');
  const [days, setDays] = useState('30');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const a = Number(active);
    if (!a || a <= 0) {
      setError('Enter a number greater than 0');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/health/quick-backfill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          active_kcal: a,
          bmr_kcal: bmr ? Number(bmr) : undefined,
          steps: steps ? Number(steps) : undefined,
          days: Number(days) || 30,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Backfill failed');
      setDone(`Filled ${data.written} days (${data.fromDate} → ${data.toDate}).`);
      setActive('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Backfill failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-border-light p-4">
      <div className="flex items-center gap-2 mb-2">
        <Zap className="w-5 h-5 text-amber-500" />
        <h3 className="font-semibold text-text-primary">Quick backfill</h3>
      </div>
      <p className="text-sm text-text-secondary mb-3">
        Don&apos;t want to set up the Shortcut? Type your average daily active calories and
        we&apos;ll fill the last 30 days with that number. You can replace it with real
        per-day data later.
      </p>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <label className="block">
          <span className="text-xs text-text-secondary">Active kcal/day *</span>
          <input
            type="number"
            inputMode="numeric"
            value={active}
            onChange={(e) => setActive(e.target.value)}
            placeholder="e.g. 450"
            className="w-full mt-0.5 px-3 py-2 border border-border-light rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent-blue"
          />
        </label>
        <label className="block">
          <span className="text-xs text-text-secondary">Days back</span>
          <input
            type="number"
            inputMode="numeric"
            value={days}
            onChange={(e) => setDays(e.target.value)}
            className="w-full mt-0.5 px-3 py-2 border border-border-light rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent-blue"
          />
        </label>
        <label className="block">
          <span className="text-xs text-text-secondary">BMR kcal/day (optional)</span>
          <input
            type="number"
            inputMode="numeric"
            value={bmr}
            onChange={(e) => setBmr(e.target.value)}
            placeholder="e.g. 1620"
            className="w-full mt-0.5 px-3 py-2 border border-border-light rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent-blue"
          />
        </label>
        <label className="block">
          <span className="text-xs text-text-secondary">Steps/day (optional)</span>
          <input
            type="number"
            inputMode="numeric"
            value={steps}
            onChange={(e) => setSteps(e.target.value)}
            placeholder="e.g. 8000"
            className="w-full mt-0.5 px-3 py-2 border border-border-light rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent-blue"
          />
        </label>
      </div>

      <button
        onClick={submit}
        disabled={busy || !active}
        className="w-full px-4 py-2.5 bg-accent-blue text-white rounded-lg text-sm font-medium disabled:opacity-50 active:scale-95 transition-transform touch-manipulation"
      >
        {busy ? 'Filling…' : 'Backfill'}
      </button>

      {done && (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-green-700">
          <Check className="w-3.5 h-3.5" /> {done}
        </div>
      )}
      {error && <div className="mt-2 text-xs text-accent-red">{error}</div>}
    </div>
  );
}
