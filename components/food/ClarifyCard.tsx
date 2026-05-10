'use client';

import { useState } from 'react';
import { FoodEntry } from '@/lib/types';
import { HelpCircle, X } from 'lucide-react';

interface Props {
  entry: FoodEntry;
  onAnswer: (answer: string) => Promise<unknown>;
  onDismiss?: () => void;
}

// Inline (non-modal) clarification card. Used at the bottom of /add-food so
// follow-up questions show up next to where the user is logging without
// stealing the screen. The dashboard still uses ClarifySheet (full bottom
// sheet) for the same data.
export default function ClarifyCard({ entry, onAnswer, onDismiss }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [free, setFree] = useState('');

  const submit = async (answer: string) => {
    if (!answer.trim() || submitting) return;
    setSubmitting(true);
    try {
      await onAnswer(answer);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-apple border border-amber-200 bg-amber-50 p-4">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <HelpCircle className="w-4 h-4 text-amber-600 shrink-0" />
          <p className="text-xs uppercase tracking-wide text-amber-700 font-semibold">Quick refine</p>
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            aria-label="Dismiss"
            className="p-1 -m-1 text-amber-700/70 hover:text-amber-900"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <h4 className="text-sm font-semibold text-text-primary truncate mb-1">{entry.name}</h4>
      <p className="text-sm text-text-primary mb-3">{entry.clarifyingQuestion}</p>

      {entry.clarifyingSuggestions && entry.clarifyingSuggestions.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {entry.clarifyingSuggestions.map((opt) => (
            <button
              key={opt.value}
              disabled={submitting}
              onClick={() => submit(opt.value)}
              className="px-3 py-1.5 rounded-full bg-white border border-amber-300 text-sm font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50 touch-manipulation"
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <input
          type="text"
          value={free}
          onChange={(e) => setFree(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submit(free); }}
          placeholder="Or describe in your own words…"
          className="flex-1 px-3 py-2 border border-amber-300 bg-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
        />
        <button
          disabled={submitting || !free.trim()}
          onClick={() => submit(free)}
          className="px-3 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium disabled:opacity-50"
        >
          Refine
        </button>
      </div>

      <p className="text-[11px] text-text-secondary mt-2">
        Current estimate: {entry.calories} kcal · re-analyzes in the background.
      </p>
    </div>
  );
}
