'use client';

import { FoodEntry, MealType, MEAL_LABELS } from '@/lib/types';
import Card from '@/components/ui/Card';
import { Sunrise, Sun, Moon, Cookie, Trash2 } from 'lucide-react';
import { ReactNode } from 'react';

const MEAL_ICONS: Record<MealType, ReactNode> = {
  breakfast: <Sunrise className="w-5 h-5 text-amber-500" />,
  lunch: <Sun className="w-5 h-5 text-yellow-500" />,
  dinner: <Moon className="w-5 h-5 text-indigo-500" />,
  snack: <Cookie className="w-5 h-5 text-orange-400" />,
};

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
          {MEAL_ICONS[mealType]}
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
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
