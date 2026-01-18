'use client';

import { FoodEntry, MealType, MEAL_LABELS, MEAL_ICONS } from '@/lib/types';
import Card from '@/components/ui/Card';

interface MealSectionProps {
  mealType: MealType;
  entries: FoodEntry[];
  onDelete: (id: string) => void;
  onEdit?: (entry: FoodEntry) => void;
}

export default function MealSection({ mealType, entries, onDelete, onEdit }: MealSectionProps) {
  const totalCalories = entries.reduce((sum, e) => sum + e.calories, 0);

  return (
    <Card padding="none" className="overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-secondary-bg border-b border-border-light">
        <div className="flex items-center gap-2">
          <span className="text-xl">{MEAL_ICONS[mealType]}</span>
          <span className="font-semibold text-text-primary">{MEAL_LABELS[mealType]}</span>
        </div>
        <span className="text-sm font-medium text-text-secondary">
          {totalCalories} kcal
        </span>
      </div>

      {/* Entries */}
      {entries.length === 0 ? (
        <div className="px-4 py-6 text-center text-text-secondary text-sm">
          No food logged yet
        </div>
      ) : (
        <div className="divide-y divide-border-light">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors group cursor-pointer"
              onClick={() => onEdit?.(entry)}
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium text-text-primary truncate">{entry.name}</p>
                <p className="text-xs text-text-secondary">
                  P: {entry.protein}g • C: {entry.carbs}g • F: {entry.fat}g
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-text-primary">
                  {entry.calories} kcal
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(entry.id); }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-accent-red p-1"
                  aria-label="Delete entry"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
