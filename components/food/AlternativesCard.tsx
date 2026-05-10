'use client';

import { Check, Sparkles } from 'lucide-react';
import Card from '@/components/ui/Card';
import { useAlternatives } from '@/hooks/useAlternatives';
import { FoodAlternative } from '@/lib/types';

interface Props {
  date?: string;
}

export default function AlternativesCard({ date }: Props) {
  const { suggestions, isLoading } = useAlternatives(date);

  if (isLoading || suggestions.length === 0) return null;

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-semibold text-text-primary">Leaner options</h3>
        <span className="text-xs text-text-secondary">based on what you eat</span>
      </div>
      <div className="space-y-3">
        {suggestions.map((s) => (
          <div key={s.originalEntryId} className="border-t border-border-light pt-3 first:border-t-0 first:pt-0">
            <div className="flex items-baseline justify-between gap-3 mb-2">
              <div className="text-sm font-medium text-text-primary truncate">{s.originalName}</div>
              <div className="text-xs text-text-secondary shrink-0">{s.originalCalories} kcal</div>
            </div>
            <div className="flex flex-wrap gap-2">
              {s.alternatives.map((alt, i) => (
                <AlternativeChip key={`${alt.name}-${i}`} alt={alt} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function AlternativeChip({ alt }: { alt: FoodAlternative }) {
  const isHistory = alt.source === 'history';
  const tone = isHistory
    ? 'bg-green-50 text-green-700 border-green-200'
    : 'bg-blue-50 text-accent-blue border-blue-200';
  const Icon = isHistory ? Check : Sparkles;
  const badgeLabel = isHistory ? 'history' : 'idea';

  return (
    <div
      className={`px-3 py-2 rounded-apple border ${tone} max-w-[220px]`}
      title={isHistory && alt.occurrences ? `Eaten ${alt.occurrences}x` : undefined}
    >
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide opacity-80">
        <Icon className="w-3 h-3" />
        {badgeLabel}
      </div>
      <div className="text-sm font-medium truncate mt-0.5">{alt.name}</div>
      <div className="text-xs opacity-90">-{alt.savedKcal} kcal</div>
    </div>
  );
}
