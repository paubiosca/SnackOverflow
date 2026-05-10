'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { FoodSuggestion, MealType } from '@/lib/types';
import { Clock, Repeat, Sparkles, ShoppingBasket } from 'lucide-react';

interface Props {
  mealType: MealType;
  onPick: (s: FoodSuggestion) => void | Promise<void>;
}

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

  return (
    <div className="-mx-4 px-4 mb-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-text-primary">Quick log</h3>
        <span className="text-xs text-text-secondary">tap to add</span>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((s, i) => {
          const meta = SOURCE_META[s.source];
          return (
            <button
              key={`${s.source}-${s.name}-${i}`}
              onClick={() => onPick({ ...s, mealType })}
              className={`shrink-0 px-3 py-2 rounded-2xl border ${meta.tone} text-left min-w-[140px] max-w-[200px] active:scale-95 transition-transform touch-manipulation`}
            >
              <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide opacity-80">
                {meta.icon}
                {meta.label}
                {s.source === 'pantry' && s.qtyRemaining ? <span className="ml-auto">×{s.qtyRemaining}</span> : null}
                {s.source !== 'pantry' && s.occurrences && s.occurrences > 1 ? <span className="ml-auto">×{s.occurrences}</span> : null}
              </div>
              <div className="text-sm font-medium truncate mt-1">{s.name}</div>
              <div className="text-xs opacity-80">{s.calories} kcal</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
