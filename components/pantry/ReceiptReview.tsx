'use client';

import { useState } from 'react';
import { Check, AlertTriangle, Trash2, ExternalLink, ShieldCheck, Sparkles, Database } from 'lucide-react';

export interface ReviewItem {
  rawText: string;
  normalizedName: string;
  brand: string | null;
  qty: number;
  packSize: string | null;
  packGrams: number | null;
  store: string | null;
  unit: 'g' | 'item' | 'ml';
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  nutritionSource: 'off' | 'web' | 'estimate';
  nutritionConfidence: 'high' | 'medium' | 'low';
  citation: string | null;
  productImageUrl: string | null;
  judgeReason: string | null;
}

interface Props {
  initial: ReviewItem[];
  store: string | null;
  purchasedAt: string | null;
  onConfirm: (items: ReviewItem[]) => Promise<void>;
  onCancel: () => void;
}

const SOURCE_META: Record<ReviewItem['nutritionSource'], { label: string; icon: React.ReactNode; tone: string }> = {
  off: { label: 'Open Food Facts', icon: <Database className="w-3 h-3" />, tone: 'bg-green-50 text-green-700 border-green-200' },
  web: { label: 'Web', icon: <Sparkles className="w-3 h-3" />, tone: 'bg-blue-50 text-blue-700 border-blue-200' },
  estimate: { label: 'Estimate', icon: <ShieldCheck className="w-3 h-3" />, tone: 'bg-amber-50 text-amber-700 border-amber-200' },
};

// Per-item editable card with a confidence badge and judge warning. The user
// can adjust quantity/macros and remove obvious noise (e.g. tiny condiments
// they don't want to track).
export default function ReceiptReview({ initial, store, purchasedAt, onConfirm, onCancel }: Props) {
  const [items, setItems] = useState<ReviewItem[]>(initial);
  const [submitting, setSubmitting] = useState(false);

  const update = (idx: number, patch: Partial<ReviewItem>) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };
  const remove = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      await onConfirm(items);
    } finally {
      setSubmitting(false);
    }
  };

  const flagged = items.filter((i) => i.judgeReason).length;

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">Review items</h2>
          <p className="text-xs text-text-secondary">
            {store ?? 'Receipt'}{purchasedAt ? ` · ${purchasedAt}` : ''} · {items.length} items
          </p>
        </div>
        {flagged > 0 && (
          <span className="text-xs font-medium text-amber-700 flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" />
            {flagged} flagged
          </span>
        )}
      </div>

      <div className="space-y-2">
        {items.map((it, idx) => {
          const meta = SOURCE_META[it.nutritionSource];
          return (
            <div
              key={idx}
              className={`rounded-apple border p-3 bg-white ${
                it.judgeReason ? 'border-amber-300 bg-amber-50/50' : 'border-border-light'
              }`}
            >
              <div className="flex items-start gap-3">
                {it.productImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={it.productImageUrl} alt="" className="w-12 h-12 rounded-md object-cover bg-secondary-bg shrink-0" />
                ) : (
                  <div className="w-12 h-12 rounded-md bg-secondary-bg shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <input
                    type="text"
                    value={it.normalizedName}
                    onChange={(e) => update(idx, { normalizedName: e.target.value })}
                    className="w-full text-sm font-semibold text-text-primary bg-transparent focus:outline-none focus:ring-1 focus:ring-accent-blue rounded px-1 -ml-1"
                  />
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-text-secondary">
                    {it.brand && <span className="truncate">{it.brand}</span>}
                    {it.packSize && <span>· {it.packSize}</span>}
                  </div>
                </div>
                <button
                  onClick={() => remove(idx)}
                  className="p-1.5 text-text-secondary active:text-accent-red"
                  aria-label="Remove"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="mt-2 flex items-center gap-2">
                <span className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full border ${meta.tone}`}>
                  {meta.icon}
                  {meta.label}
                  <span className="opacity-60">· {it.nutritionConfidence}</span>
                </span>
                {it.citation && (
                  <a
                    href={it.citation}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[10px] text-accent-blue inline-flex items-center gap-0.5"
                  >
                    source <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                )}
              </div>

              {it.judgeReason && (
                <div className="mt-2 flex items-start gap-1.5 text-xs text-amber-800">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>{it.judgeReason}</span>
                </div>
              )}

              <div className="grid grid-cols-5 gap-2 mt-3">
                <NumField label={`qty`} value={it.qty} onChange={(v) => update(idx, { qty: v })} />
                <NumField label={it.unit === 'g' ? 'kcal/100g' : 'kcal'} value={it.kcal} onChange={(v) => update(idx, { kcal: v })} />
                <NumField label="P" value={it.protein} onChange={(v) => update(idx, { protein: v })} />
                <NumField label="C" value={it.carbs} onChange={(v) => update(idx, { carbs: v })} />
                <NumField label="F" value={it.fat} onChange={(v) => update(idx, { fat: v })} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex gap-2 pt-2">
        <button
          onClick={onCancel}
          disabled={submitting}
          className="flex-1 py-3 text-sm font-medium text-text-secondary bg-secondary-bg rounded-apple disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={handleConfirm}
          disabled={submitting || items.length === 0}
          className="flex-[2] py-3 text-sm font-semibold text-white bg-accent-blue rounded-apple flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <Check className="w-4 h-4" />
          {submitting ? 'Adding…' : `Add ${items.length} to pantry`}
        </button>
      </div>
    </div>
  );
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="block text-[10px] uppercase tracking-wide text-text-secondary">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="mt-0.5 w-full px-1.5 py-1 text-sm bg-secondary-bg border border-border-light rounded text-text-primary focus:outline-none focus:ring-1 focus:ring-accent-blue"
      />
    </label>
  );
}
