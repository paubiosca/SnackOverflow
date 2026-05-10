'use client';

import { useMemo, useState } from 'react';
import { FoodSuggestion } from '@/lib/types';
import { X } from 'lucide-react';

interface Props {
  item: FoodSuggestion; // expects pantry-source with optional packGrams + unit
  onConfirm: (portion: ScaledPortion) => Promise<void> | void;
  onClose: () => void;
}

export interface ScaledPortion {
  // What we'll log on the food entry.
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  // How much of the pantry stock to remove. For unit='item' (whole pack)
  // this is a fraction (0.5 = half the pack). For unit='g'/'ml' the math
  // collapses cleanly because est_calories_per_unit is per 100g/ml — the
  // server still decrements by `units` from qty_remaining.
  units: number;
  // Free-text label for the food entry name suffix (e.g. "(half · 110g)").
  label: string;
}

// Bottom-sheet picker for "how much of the pantry item are you eating".
// - If we know packGrams: show ½ / ⅓ / ¼ / Whole + a custom-grams field, and
//   compute calories from grams using the per-100g energy density.
// - If we don't know packGrams: fall back to fraction-of-pack only (no grams).
// - For unit='item' with no packGrams we just trust the per-unit kcal as-is
//   for "Whole" and scale linearly for halves.
//
// Why fractional decrement: a half-eaten pack means you should still see the
// chip with qty 0.5 — so the next tap can offer "the rest of it".
export default function PortionSheet({ item, onConfirm, onClose }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [grams, setGrams] = useState<string>('');

  const unit = item.unit ?? 'item';
  const packGrams = item.packGrams;
  // The displayed kcal on the chip is "1 unit" — meaning per-100g for unit='g'
  // or per-pack for unit='item'. Convert that to a kcal-per-gram if we can.
  const kcalPerGram = useMemo<number | null>(() => {
    if (unit === 'g' || unit === 'ml') return item.calories / 100;
    if (unit === 'item' && packGrams && packGrams > 0) return item.calories / packGrams;
    return null;
  }, [unit, packGrams, item.calories]);
  const proteinPerGram = useMemo<number | null>(() => {
    if (unit === 'g' || unit === 'ml') return item.protein / 100;
    if (unit === 'item' && packGrams && packGrams > 0) return item.protein / packGrams;
    return null;
  }, [unit, packGrams, item.protein]);
  const carbsPerGram = useMemo<number | null>(() => {
    if (unit === 'g' || unit === 'ml') return item.carbs / 100;
    if (unit === 'item' && packGrams && packGrams > 0) return item.carbs / packGrams;
    return null;
  }, [unit, packGrams, item.carbs]);
  const fatPerGram = useMemo<number | null>(() => {
    if (unit === 'g' || unit === 'ml') return item.fat / 100;
    if (unit === 'item' && packGrams && packGrams > 0) return item.fat / packGrams;
    return null;
  }, [unit, packGrams, item.fat]);

  const fractionOptions: Array<{ key: string; label: string; fraction: number }> = [
    { key: 'q', label: '¼', fraction: 0.25 },
    { key: 't', label: '⅓', fraction: 1 / 3 },
    { key: 'h', label: '½', fraction: 0.5 },
    { key: 'w', label: 'Whole', fraction: 1 },
  ];

  const submitFraction = async (fraction: number) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      // For unit='g' / 'ml': "Whole" of a 200g pack = 200g consumed. With kcal
      // per-100g, that's 2× the displayed chip number. For unit='item' with
      // packGrams known: same math via kcalPerGram. For unit='item' without
      // packGrams: trust per-unit and just multiply by fraction.
      let calories: number, protein: number, carbs: number, fat: number, units: number, label: string;
      if (kcalPerGram != null && packGrams) {
        const grams = packGrams * fraction;
        calories = Math.round(kcalPerGram * grams);
        protein = round1(proteinPerGram! * grams);
        carbs = round1(carbsPerGram! * grams);
        fat = round1(fatPerGram! * grams);
        // qty_remaining is in "units" (count of packs). Half a pack → 0.5 units.
        units = unit === 'item' ? fraction : grams / 100; // for 'g': 100g = 1 unit
        label = formatFraction(fraction) + ` · ${Math.round(grams)}g`;
      } else {
        // No grams data — fraction of per-unit nutrition.
        calories = Math.round(item.calories * fraction);
        protein = round1(item.protein * fraction);
        carbs = round1(item.carbs * fraction);
        fat = round1(item.fat * fraction);
        units = fraction;
        label = formatFraction(fraction);
      }
      await onConfirm({ calories, protein, carbs, fat, units, label });
    } finally {
      setSubmitting(false);
    }
  };

  const submitGrams = async () => {
    const g = parseFloat(grams);
    if (!isFinite(g) || g <= 0 || submitting) return;
    if (kcalPerGram == null) return;
    setSubmitting(true);
    try {
      const calories = Math.round(kcalPerGram * g);
      const protein = round1((proteinPerGram ?? 0) * g);
      const carbs = round1((carbsPerGram ?? 0) * g);
      const fat = round1((fatPerGram ?? 0) * g);
      const units = unit === 'item' && packGrams ? g / packGrams : g / 100;
      await onConfirm({ calories, protein, carbs, fat, units, label: `${g}g` });
    } finally {
      setSubmitting(false);
    }
  };

  const canDoGrams = kcalPerGram != null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div className="w-full max-w-md bg-white rounded-t-2xl shadow-xl p-5 pb-8" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-green-700 font-semibold">From pantry</p>
            <h3 className="text-base font-semibold text-text-primary mt-0.5 truncate">{item.name}</h3>
            <p className="text-xs text-text-secondary mt-0.5">
              {unit === 'g' || unit === 'ml'
                ? `${item.calories} kcal/100${unit}${packGrams ? ` · pack ${packGrams}g` : ''}`
                : `${item.calories} kcal${packGrams ? ` · pack ${packGrams}g` : ' / pack'}`}
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1 text-text-secondary"><X className="w-5 h-5" /></button>
        </div>

        <p className="text-xs text-text-secondary mb-2">How much are you eating?</p>
        <div className="grid grid-cols-4 gap-2 mb-4">
          {fractionOptions.map((o) => (
            <button
              key={o.key}
              disabled={submitting}
              onClick={() => submitFraction(o.fraction)}
              className="py-3 rounded-apple bg-secondary-bg active:bg-gray-200 text-base font-semibold text-text-primary disabled:opacity-50"
            >
              {o.label}
              {packGrams && <div className="text-[10px] font-normal text-text-secondary mt-0.5">{Math.round(packGrams * o.fraction)}g</div>}
            </button>
          ))}
        </div>

        {canDoGrams && (
          <div className="border-t border-border-light pt-3">
            <label className="text-xs text-text-secondary block mb-1">Or enter grams</label>
            <div className="flex gap-2">
              <input
                type="number"
                inputMode="decimal"
                value={grams}
                onChange={(e) => setGrams(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') submitGrams(); }}
                placeholder={packGrams ? `${packGrams}g` : '100g'}
                className="flex-1 px-3 py-2 border border-border-light rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent-green"
              />
              <button
                disabled={submitting || !grams.trim()}
                onClick={submitGrams}
                className="px-4 py-2 bg-accent-green text-white rounded-lg text-sm font-medium disabled:opacity-50"
              >
                Log
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function formatFraction(f: number): string {
  if (Math.abs(f - 0.25) < 0.01) return 'quarter';
  if (Math.abs(f - 1 / 3) < 0.01) return 'third';
  if (Math.abs(f - 0.5) < 0.01) return 'half';
  if (Math.abs(f - 1) < 0.01) return 'whole';
  return `${Math.round(f * 100)}%`;
}

function round1(n: number): number { return Math.round(n * 10) / 10; }
