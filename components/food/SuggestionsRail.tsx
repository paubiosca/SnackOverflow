'use client';

import { useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { FoodSuggestion, MealType } from '@/lib/types';
import { Clock, Repeat, Sparkles, ShoppingBasket, Check } from 'lucide-react';

interface Props {
  mealType: MealType;
  onPick: (s: FoodSuggestion) => void | Promise<void>;
}

const ADDED_FLASH_MS = 1400;

const SOURCE_META: Record<FoodSuggestion['source'], { icon: React.ReactNode; label: string; tone: string }> = {
  'time-of-day': { icon: <Clock className="w-3.5 h-3.5" />, label: 'Around now', tone: 'bg-blue-50 text-blue-700 border-blue-200' },
  'recent':      { icon: <Sparkles className="w-3.5 h-3.5" />, label: 'Recent', tone: 'bg-gray-50 text-text-primary border-border-light' },
  'frequent':    { icon: <Repeat className="w-3.5 h-3.5" />, label: 'Often', tone: 'bg-purple-50 text-purple-700 border-purple-200' },
  'pantry':      { icon: <ShoppingBasket className="w-3.5 h-3.5" />, label: 'In pantry', tone: 'bg-green-50 text-green-700 border-green-200' },
};

// Horizontal chip rail of one-tap log suggestions. Sources unified into a single
// surface so users don't have to think about "where to look" — all the smart
// shortcuts live in one place.
export default function SuggestionsRail({ mealType, onPick }: Props) {
  const { data: session } = useSession();
  const [items, setItems] = useState<FoodSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  // Per-chip "just added" flash. Ref-keyed timers so concurrent taps don't
  // reset each other's flash (parent re-renders during polling won't either).
  const [addedKeys, setAddedKeys] = useState<Set<string>>(new Set());
  const [pendingKeys, setPendingKeys] = useState<Set<string>>(new Set());
  const flashTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    const timers = flashTimers.current;
    return () => {
      for (const t of Object.values(timers)) clearTimeout(t);
    };
  }, []);

  const handleTap = async (key: string, s: FoodSuggestion) => {
    setPendingKeys((p) => new Set(p).add(key));
    try {
      await onPick(s);
      setAddedKeys((p) => new Set(p).add(key));
      if (flashTimers.current[key]) clearTimeout(flashTimers.current[key]);
      flashTimers.current[key] = setTimeout(() => {
        setAddedKeys((p) => {
          const next = new Set(p);
          next.delete(key);
          return next;
        });
        delete flashTimers.current[key];
      }, ADDED_FLASH_MS);
    } finally {
      setPendingKeys((p) => {
        const next = new Set(p);
        next.delete(key);
        return next;
      });
    }
  };

  useEffect(() => {
    if (!session?.user) return;
    let cancelled = false;
    fetch('/api/food/suggestions')
      .then((r) => (r.ok ? r.json() : { suggestions: [] }))
      .then((data) => {
        if (cancelled) return;
        setItems(data.suggestions || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
    return () => { cancelled = true; };
  }, [session]);

  if (loading) {
    return (
      <div className="-mx-4 px-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-text-primary">Quick log</h3>
          <span className="text-xs text-text-secondary">loading…</span>
        </div>
        <div className="flex gap-2 overflow-hidden pb-2 -mx-1 px-1">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="skeleton shrink-0 rounded-2xl"
              style={{ width: 160, height: 64 }}
            />
          ))}
        </div>
      </div>
    );
  }
  if (items.length === 0) return null;

  // Two-mode rail: 'pantry' shows only pantry chips, 'around' shows everything
  // else (time-of-day / recent / frequent). Mode persists for the lifetime of
  // the page; defaults to whichever has items.
  const pantryItems = items.filter((i) => i.source === 'pantry');
  const aroundItems = items.filter((i) => i.source !== 'pantry');
  const defaultMode: 'pantry' | 'around' = pantryItems.length > 0 ? 'pantry' : 'around';
  // Mode toggle is rendered inside the rail; we use a ref-less pattern via a
  // useState in the parent function, hoisted via setMode below.
  return <Rail
    pantryItems={pantryItems}
    aroundItems={aroundItems}
    defaultMode={defaultMode}
    addedKeys={addedKeys}
    pendingKeys={pendingKeys}
    onTap={(key, s) => handleTap(key, { ...s, mealType })}
  />;
}

interface RailProps {
  pantryItems: FoodSuggestion[];
  aroundItems: FoodSuggestion[];
  defaultMode: 'pantry' | 'around';
  addedKeys: Set<string>;
  pendingKeys: Set<string>;
  onTap: (key: string, s: FoodSuggestion) => void;
}
function Rail({ pantryItems, aroundItems, defaultMode, addedKeys, pendingKeys, onTap }: RailProps) {
  const [mode, setMode] = useState<'pantry' | 'around'>(defaultMode);
  const visible = mode === 'pantry' ? pantryItems : aroundItems;
  return (
    <div className="-mx-4 px-4 mb-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-text-primary">Quick log</h3>
        <div className="segmented-control flex">
          <button
            onClick={() => setMode('pantry')}
            disabled={pantryItems.length === 0}
            className={`segmented-control-item px-3 py-1 text-xs font-medium ${
              mode === 'pantry' ? 'active text-text-primary' : 'text-text-secondary'
            } disabled:opacity-40`}
          >
            Pantry
            {pantryItems.length > 0 && <span className="ml-1 opacity-60">{pantryItems.length}</span>}
          </button>
          <button
            onClick={() => setMode('around')}
            disabled={aroundItems.length === 0}
            className={`segmented-control-item px-3 py-1 text-xs font-medium ${
              mode === 'around' ? 'active text-text-primary' : 'text-text-secondary'
            } disabled:opacity-40`}
          >
            Around now
          </button>
        </div>
      </div>
      {visible.length === 0 ? (
        <div className="text-xs text-text-secondary py-3 px-1">
          {mode === 'pantry' ? 'No pantry items yet — scan a receipt to add some.' : 'No history-based suggestions yet.'}
        </div>
      ) : (
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {visible.map((s, i) => {
          const meta = SOURCE_META[s.source];
          const key = `${s.source}-${s.name}-${i}`;
          const isAdded = addedKeys.has(key);
          const isPending = pendingKeys.has(key);
          return (
            <button
              key={key}
              onClick={() => onTap(key, s)}
              disabled={isPending}
              className={`relative shrink-0 px-3 py-2 rounded-2xl border text-left min-w-[140px] max-w-[200px] active:scale-95 transition-all duration-200 touch-manipulation ${
                isAdded
                  ? 'bg-green-100 border-green-400 ring-2 ring-green-300 scale-[1.03] shadow-sm'
                  : isPending
                    ? `${meta.tone} opacity-70 scale-[0.97]`
                    : meta.tone
              }`}
            >
              <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide opacity-80">
                {meta.icon}
                {meta.label}
                {s.source === 'pantry' && s.qtyRemaining ? <span className="ml-auto">×{s.qtyRemaining}</span> : null}
                {s.source !== 'pantry' && s.occurrences && s.occurrences > 1 ? <span className="ml-auto">×{s.occurrences}</span> : null}
              </div>
              <div className="text-sm font-medium truncate mt-1">{s.name}</div>
              <div className="text-xs opacity-80">
                {s.calories} kcal
                {s.source === 'pantry' && (s.unit === 'g' || s.unit === 'ml') ? ` /100${s.unit}` : ''}
              </div>
              {isAdded && (
                <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-green-500/15 backdrop-blur-[1px]">
                  <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-green-600 text-white text-xs font-semibold shadow">
                    <Check className="w-3.5 h-3.5" />
                    Added
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </div>
      )}
    </div>
  );
}
