'use client';

import { useEffect, useState } from 'react';
import { FoodEntry } from '@/lib/types';
import { X, Sparkles } from 'lucide-react';

interface Props {
  entry: FoodEntry;
  onSubmit: (note: string) => Promise<unknown>;
  onClose: () => void;
}

// Bottom-sheet for adding a free-text refinement to an existing entry without
// re-uploading the photo. Examples: "only ate half", "no dressing", "small
// bowl not large", "two slices not three". The note is appended to the
// entry's additional_context server-side, the row goes back to pending, and
// the worker re-analyzes the original photo with the new hints.
export default function RefineSheet({ entry, onSubmit, onClose }: Props) {
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = async (text: string) => {
    if (!text.trim() || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit(text.trim());
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  // Quick chips for common refinements — single tap, no typing.
  const QUICK = [
    'I only ate half',
    'I only ate a quarter',
    'No sauce / no dressing',
    'Smaller portion than it looks',
    'Larger portion than it looks',
  ];

  return (
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
          <div className="min-w-0 flex items-start gap-3">
            {entry.photoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={entry.photoUrl} alt="" className="w-12 h-12 rounded-md object-cover bg-secondary-bg shrink-0" />
            )}
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-wide text-accent-blue font-semibold flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Refine
              </p>
              <h3 className="text-base font-semibold text-text-primary mt-0.5 truncate">{entry.name}</h3>
              <p className="text-xs text-text-secondary mt-0.5">
                {entry.calories} kcal · we&apos;ll re-analyze the same photo
              </p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1 text-text-secondary hover:text-text-primary">
            <X className="w-5 h-5" />
          </button>
        </div>

        {entry.additionalContext && (
          <p className="text-[11px] text-text-secondary bg-secondary-bg rounded-md px-2 py-1.5 mb-3 whitespace-pre-line">
            <span className="font-semibold">Earlier note: </span>{entry.additionalContext}
          </p>
        )}

        <div className="flex flex-wrap gap-1.5 mb-3">
          {QUICK.map((q) => (
            <button
              key={q}
              disabled={submitting}
              onClick={() => submit(q)}
              className="text-xs px-3 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 active:bg-blue-100 disabled:opacity-50"
            >
              {q}
            </button>
          ))}
        </div>

        <label className="text-xs text-text-secondary block mb-1">Or describe the change</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submit(note); }}
            autoFocus
            placeholder="e.g. ate two thirds of this box"
            className="flex-1 px-3 py-2 border border-border-light rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent-blue"
          />
          <button
            disabled={submitting || !note.trim()}
            onClick={() => submit(note)}
            className="px-4 py-2 bg-accent-blue text-white rounded-lg text-sm font-medium disabled:opacity-50"
          >
            Refine
          </button>
        </div>
        <p className="text-[11px] text-text-secondary mt-2">
          The AI re-runs in the background. Calories will update in a few seconds.
        </p>
      </div>
    </div>
  );
}
