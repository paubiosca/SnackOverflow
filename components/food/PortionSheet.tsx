'use client';

import { useEffect, useMemo, useState } from 'react';
import { FoodSuggestion } from '@/lib/types';
import { X, AlertCircle } from 'lucide-react';

interface Props {
  item: FoodSuggestion;
  onConfirm: (portion: ScaledPortion) => Promise<void> | void;
  onClose: () => void;
}

export interface ScaledPortion {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  units: number;
  label: string;
}

// Picker for "how much of this pantry item are you eating".
// - Bottom sheet on mobile (one-thumb reach), centered modal on desktop.
// - If the imported pantry item has 0/unknown kcal (Open Food Facts miss),
//   a yellow strip lets you type the per-pack kcal inline before logging,
//   so the row isn't useless.
// - Closes on Escape, on backdrop tap, and on the X button.
export default function PortionSheet({ item, onConfirm, onClose }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [grams, setGrams] = useState<string>('');
  // Local override for missing pantry calories. Defaults to whatever the chip
  // showed; the user can edit and the math below picks up the new number.
  const [kcalOverride, setKcalOverride] = useState<string>(String(item.calories || ''));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const unit = item.unit ?? 'item';
  const packGrams = item.packGrams;

  // The effective kcal for "1 unit". Override beats the imported value so the
  // user can rescue a 0-kcal Open-Food-Facts miss in 5 seconds.
  const effectiveKcal = useMemo(() => {
    const n = parseFloat(kcalOverride);
    return Number.isFinite(n) && n > 0 ? n : (item.calories || 0);
  }, [kcalOverride, item.calories]);
  const kcalMissing = effectiveKcal <= 0;

  const kcalPerGram = useMemo<number | null>(() => {
    if (effectiveKcal <= 0) return null;
    if (unit === 'g' || unit === 'ml') return effectiveKcal / 100;
    if (unit === 'item' && packGrams && packGrams > 0) return effectiveKcal / packGrams;
    return null;
  }, [effectiveKcal, unit, packGrams]);

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

  const fractionOptions = [
    { key: 'q', label: '¼', fraction: 0.25 },
    { key: 't', label: '⅓', fraction: 1 / 3 },
    { key: 'h', label: '½', fraction: 0.5 },
    { key: 'w', label: 'Whole', fraction: 1 },
  ];

  const submitFraction = async (fraction: number) => {
    if (submitting || kcalMissing) return;
    setSubmitting(true);
    try {
      let calories: number, protein: number, carbs: number, fat: number, units: number, label: string;
      if (kcalPerGram != null && packGrams) {
        const g = packGrams * fraction;
        calories = Math.round(kcalPerGram * g);
        protein = round1((proteinPerGram ?? 0) * g);
        carbs = round1((carbsPerGram ?? 0) * g);
        fat = round1((fatPerGram ?? 0) * g);
        units = unit === 'item' ? fraction : g / 100;
        label = `${formatFraction(fraction)} · ${Math.round(g)}g`;
      } else {
        calories = Math.round(effectiveKcal * fraction);
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
    if (!isFinite(g) || g <= 0 || submitting || kcalPerGram == null) return;
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
    // items-end on mobile (bottom sheet); items-center on desktop (centered modal).
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md max-h-[90vh] overflow-y-auto bg-white rounded-t-2xl sm:rounded-2xl shadow-xl p-5 pb-[max(env(safe-area-inset-bottom,0px),24px)] sm:pb-5"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-green-700 font-semibold">From pantry</p>
            <h3 className="text-base font-semibold text-text-primary mt-0.5 truncate">{item.name}</h3>
            <p className="text-xs text-text-secondary mt-0.5">
              {unit === 'g' || unit === 'ml'
                ? `${effectiveKcal || '—'} kcal/100${unit}${packGrams ? ` · pack ${packGrams}g` : ''}`
                : `${effectiveKcal || '—'} kcal${packGrams ? ` · pack ${packGrams}g` : ' / pack'}`}
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1 text-text-secondary hover:text-text-primary">
            <X className="w-5 h-5" />
          </button>
        </div>

        {kcalMissing && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 mb-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-900 mb-1">
              <AlertCircle className="w-3.5 h-3.5" />
              Calories not found for this product
            </div>
            <label className="text-xs text-amber-900/80 block mb-1">
              Type kcal {unit === 'g' ? 'per 100g' : unit === 'ml' ? 'per 100ml' : 'per pack'}
            </label>
            <input
              type="number"
              inputMode="decimal"
              value={kcalOverride}
              onChange={(e) => setKcalOverride(e.target.value)}
              autoFocus
              placeholder={unit === 'item' ? '120' : '32'}
              className="w-full px-3 py-2 border border-amber-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
            />
          </div>
        )}

        <p className="text-xs text-text-secondary mb-2">How much are you eating?</p>
        <div className="grid grid-cols-4 gap-2 mb-4">
          {fractionOptions.map((o) => (
            <button
              key={o.key}
              disabled={submitting || kcalMissing}
              onClick={() => submitFraction(o.fraction)}
              className="py-3 rounded-apple bg-secondary-bg active:bg-gray-200 hover:bg-gray-100 text-base font-semibold text-text-primary disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
            >
              {o.label}
              {packGrams && <div className="text-[10px] font-normal text-text-secondary mt-0.5">{Math.round(packGrams * o.fraction)}g</div>}
              {!packGrams && unit === 'item' && effectiveKcal > 0 && (
                <div className="text-[10px] font-normal text-text-secondary mt-0.5">{Math.round(effectiveKcal * o.fraction)} kcal</div>
              )}
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
                className="px-4 py-2 bg-accent-green text-white rounded-lg text-sm font-medium disabled:opacity-50 active:scale-95 transition-transform touch-manipulation"
              >
                Log
              </button>
            </div>
          </div>
        )}

        {kcalMissing && (
          <p className="text-[11px] text-text-secondary mt-3 leading-snug">
            Tip: zero-cal mixers like tonic? Just type a small number (e.g. 30 for a 200ml bottle).
            Your edit only applies to this log; the pantry item stays unchanged for next time.
          </p>
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
