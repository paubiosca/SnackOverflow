'use client';

import { useState } from 'react';
import { FoodEntry } from '@/lib/types';
import { X } from 'lucide-react';

interface Props {
  entry: FoodEntry;
  onAnswer: (answer: string) => Promise<unknown>;
  onClose: () => void;
}

// Bottom-sheet style answer surface for a `needs_clarification` row.
// Shows the model's question, suggested chips, and a free-text fallback.
export default function ClarifySheet({ entry, onAnswer, onClose }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [free, setFree] = useState('');

  const submit = async (answer: string) => {
    if (!answer.trim() || submitting) return;
    setSubmitting(true);
    try {
      await onAnswer(answer);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-md bg-white rounded-t-2xl shadow-xl p-5 pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-amber-600 font-semibold">Quick refine</p>
            <h3 className="text-base font-semibold text-text-primary mt-0.5 truncate">{entry.name}</h3>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1 text-text-secondary">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-text-primary mb-4">{entry.clarifyingQuestion}</p>

        {entry.clarifyingSuggestions && entry.clarifyingSuggestions.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {entry.clarifyingSuggestions.map((opt) => (
              <button
                key={opt.value}
                disabled={submitting}
                onClick={() => submit(opt.value)}
                className="px-4 py-2 rounded-full bg-amber-50 border border-amber-200 text-sm font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50 touch-manipulation"
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}

        <div className="border-t border-border-light pt-3">
          <label className="text-xs text-text-secondary block mb-1">Or describe in your own words</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={free}
              onChange={(e) => setFree(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submit(free);
              }}
              placeholder="e.g. medium portion, no dressing"
              className="flex-1 px-3 py-2 border border-border-light rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
            />
            <button
              disabled={submitting || !free.trim()}
              onClick={() => submit(free)}
              className="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium disabled:opacity-50"
            >
              Refine
            </button>
          </div>
        </div>

        <p className="text-xs text-text-secondary mt-3">
          Current estimate: {entry.calories} kcal · refining will re-analyze in the background.
        </p>
      </div>
    </div>
  );
}
