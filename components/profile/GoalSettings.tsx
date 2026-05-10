'use client';

import { useEffect, useState } from 'react';
import { useProfile } from '@/hooks/useProfile';
import { Target, Save, Check } from 'lucide-react';

const KCAL_PER_KG = 7700;

// Editable goal-driver settings:
//   - Usual daily burn (calibrated baseline TDEE in kcal)
//   - Weight loss target (kg/week → daily deficit)
// These are the two numbers shown in the dashboard breakdown:
//   "2,400 usual burn − 550 deficit"
// Live preview shows the resulting target as you type, so the user sees
// the math change instantly. Saves via existing /api/profile PUT.
export default function GoalSettings() {
  const { profile, updateProfile } = useProfile();
  const [baseline, setBaseline] = useState('');
  const [weeklyKg, setWeeklyKg] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    if (!profile) return;
    setBaseline(String(profile.tdeeBaselineKcal ?? ''));
    // Convert any goal_type into kg/week for the UI. deficit_fixed stores a
    // negative kcal/day; weight_loss_rate stores kg/week directly.
    if (profile.goalType === 'weight_loss_rate' && profile.goalValue != null) {
      setWeeklyKg(String(profile.goalValue));
    } else if (profile.goalType === 'deficit_fixed' && profile.goalValue != null) {
      const kgPerWeek = (Math.abs(Number(profile.goalValue)) * 7) / KCAL_PER_KG;
      setWeeklyKg(kgPerWeek.toFixed(2));
    }
  }, [profile]);

  if (!profile) return null;

  const baselineNum = Number(baseline);
  const weeklyKgNum = Number(weeklyKg);
  const dailyDeficit = Math.round((weeklyKgNum * KCAL_PER_KG) / 7);
  const previewTargetRest = baselineNum - dailyDeficit;
  const valid = baselineNum > 1000 && baselineNum < 6000 && weeklyKgNum >= 0 && weeklyKgNum <= 1.5;

  const handleSave = async () => {
    if (!valid || saving) return;
    setSaving(true);
    try {
      await updateProfile({
        tdeeBaselineKcal: Math.round(baselineNum),
        goalType: 'weight_loss_rate',
        goalValue: weeklyKgNum,
      });
      setSavedAt(Date.now());
      setTimeout(() => setSavedAt(null), 1500);
    } finally {
      setSaving(false);
    }
  };

  const dirty =
    Number(baseline) !== (profile.tdeeBaselineKcal ?? 0) ||
    weeklyKgNum !== (profile.goalType === 'weight_loss_rate' ? Number(profile.goalValue ?? 0) : NaN);

  return (
    <div className="bg-white rounded-2xl border border-border-light p-4">
      <div className="flex items-center gap-2 mb-3">
        <Target className="w-5 h-5 text-accent-blue" />
        <h3 className="font-semibold text-text-primary">Goal &amp; baseline</h3>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <label className="block">
          <span className="text-xs text-text-secondary">Usual daily burn</span>
          <div className="relative mt-0.5">
            <input
              type="number"
              inputMode="numeric"
              value={baseline}
              onChange={(e) => setBaseline(e.target.value)}
              placeholder="2400"
              className="w-full pr-10 px-3 py-2 border border-border-light rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent-blue"
            />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-text-secondary pointer-events-none">
              kcal
            </span>
          </div>
        </label>
        <label className="block">
          <span className="text-xs text-text-secondary">Weekly target</span>
          <div className="relative mt-0.5">
            <input
              type="number"
              step="0.05"
              inputMode="decimal"
              value={weeklyKg}
              onChange={(e) => setWeeklyKg(e.target.value)}
              placeholder="0.5"
              className="w-full pr-12 px-3 py-2 border border-border-light rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent-blue"
            />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-text-secondary pointer-events-none">
              kg/wk
            </span>
          </div>
        </label>
      </div>

      <div className="rounded-lg bg-secondary-bg p-3 mb-3 text-xs text-text-primary space-y-0.5">
        <div className="flex justify-between">
          <span className="text-text-secondary">Daily deficit</span>
          <span className="font-mono">{Number.isFinite(dailyDeficit) ? dailyDeficit : 0} kcal</span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-secondary">Rest day target</span>
          <span className="font-mono">{Number.isFinite(previewTargetRest) ? previewTargetRest.toLocaleString() : '—'} kcal</span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-secondary">+ a 600 kcal run</span>
          <span className="font-mono">{Number.isFinite(previewTargetRest) ? (previewTargetRest + 600).toLocaleString() : '—'} kcal</span>
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={!valid || !dirty || saving}
        className="w-full px-4 py-2.5 bg-accent-blue text-white rounded-lg text-sm font-medium disabled:opacity-50 active:scale-95 transition-transform touch-manipulation flex items-center justify-center gap-2"
      >
        {savedAt ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
        {savedAt ? 'Saved' : saving ? 'Saving…' : 'Save'}
      </button>

      <p className="text-xs text-text-secondary mt-2 leading-snug">
        Usual daily burn = your typical TDEE excluding tracked workouts. Strava runs add to this
        automatically. Set higher if you walk a lot, lower if you&apos;re mostly desk-bound.
      </p>
    </div>
  );
}
