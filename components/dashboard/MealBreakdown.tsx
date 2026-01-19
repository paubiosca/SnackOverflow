'use client';

import { useMemo } from 'react';
import { MealType, FoodEntry, MEAL_LABELS } from '@/lib/types';
import { Sunrise, Sun, Moon, Cookie } from 'lucide-react';
import { ReactNode } from 'react';

const MEAL_ICONS: Record<MealType, ReactNode> = {
  breakfast: <Sunrise className="w-4 h-4" />,
  lunch: <Sun className="w-4 h-4" />,
  dinner: <Moon className="w-4 h-4" />,
  snack: <Cookie className="w-4 h-4" />,
};

const MEAL_COLORS: Record<MealType, { main: string; bg: string }> = {
  breakfast: { main: '#f59e0b', bg: '#fef3c7' },
  lunch: { main: '#eab308', bg: '#fef9c3' },
  dinner: { main: '#6366f1', bg: '#e0e7ff' },
  snack: { main: '#f97316', bg: '#ffedd5' },
};

interface MealBreakdownProps {
  entries: FoodEntry[];
}

export default function MealBreakdown({ entries }: MealBreakdownProps) {
  const mealData = useMemo(() => {
    const mealTypes: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];
    const totalCalories = entries.reduce((sum, e) => sum + e.calories, 0);

    return mealTypes.map((type) => {
      const mealEntries = entries.filter((e) => e.mealType === type);
      const calories = mealEntries.reduce((sum, e) => sum + e.calories, 0);
      const percentage = totalCalories > 0 ? Math.round((calories / totalCalories) * 100) : 0;

      return {
        type,
        label: MEAL_LABELS[type],
        calories,
        percentage,
        colors: MEAL_COLORS[type],
        icon: MEAL_ICONS[type],
      };
    });
  }, [entries]);

  const totalCalories = entries.reduce((sum, e) => sum + e.calories, 0);

  if (totalCalories === 0) {
    return null;
  }

  // Find the meal with highest calories
  const maxMeal = [...mealData].sort((a, b) => b.calories - a.calories)[0];

  return (
    <div className="mt-5 pt-4 border-t border-border-light">
      <div className="text-xs text-text-secondary mb-3 text-center font-medium">
        Calories by Meal
      </div>

      {/* Stacked bar */}
      <div className="h-4 rounded-full overflow-hidden flex bg-gray-100">
        {mealData.map((meal) =>
          meal.percentage > 0 ? (
            <div
              key={meal.type}
              className="h-full transition-all"
              style={{
                width: `${meal.percentage}%`,
                backgroundColor: meal.colors.main,
              }}
            />
          ) : null
        )}
      </div>

      {/* Legend - 2x2 grid on mobile */}
      <div className="grid grid-cols-2 gap-2 mt-4">
        {mealData.map((meal) => (
          <div
            key={meal.type}
            className="flex items-center gap-2 p-2.5 rounded-xl transition-colors"
            style={{
              backgroundColor: meal.type === maxMeal.type && meal.calories > 0
                ? meal.colors.bg
                : 'transparent',
            }}
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
              style={{
                backgroundColor: meal.colors.bg,
                color: meal.colors.main,
              }}
            >
              {meal.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-text-secondary">{meal.label}</div>
              <div className="flex items-baseline gap-1">
                <span className="text-sm font-bold text-text-primary">{meal.calories}</span>
                <span className="text-xs text-text-secondary">({meal.percentage}%)</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Insight */}
      {maxMeal.percentage > 40 && maxMeal.calories > 0 && (
        <div
          className="mt-3 text-xs text-center py-2 px-3 rounded-lg"
          style={{
            backgroundColor: maxMeal.colors.bg,
            color: maxMeal.colors.main,
          }}
        >
          {maxMeal.label} accounts for {maxMeal.percentage}% of today&apos;s calories
        </div>
      )}
    </div>
  );
}
