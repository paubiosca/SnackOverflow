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

const MEAL_COLORS: Record<MealType, string> = {
  breakfast: '#f59e0b', // amber
  lunch: '#eab308',     // yellow
  dinner: '#6366f1',    // indigo
  snack: '#f97316',     // orange
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
        color: MEAL_COLORS[type],
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
    <div className="mt-4 pt-4 border-t border-border-light">
      <div className="text-xs text-text-secondary mb-3 text-center">Calories by Meal</div>

      {/* Stacked bar */}
      <div className="h-3 rounded-full overflow-hidden flex bg-gray-100">
        {mealData.map((meal) =>
          meal.percentage > 0 ? (
            <div
              key={meal.type}
              className="h-full transition-all"
              style={{
                width: `${meal.percentage}%`,
                backgroundColor: meal.color,
              }}
            />
          ) : null
        )}
      </div>

      {/* Legend with percentages */}
      <div className="grid grid-cols-2 gap-2 mt-3">
        {mealData.map((meal) => (
          <div
            key={meal.type}
            className={`flex items-center gap-2 p-2 rounded-apple ${
              meal.type === maxMeal.type && meal.calories > 0 ? 'bg-secondary-bg' : ''
            }`}
          >
            <div
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: meal.color }}
            />
            <div className="flex items-center gap-1" style={{ color: meal.color }}>
              {meal.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-text-secondary truncate">{meal.label}</div>
            </div>
            <div className="text-right">
              <span className="text-sm font-semibold text-text-primary">{meal.calories}</span>
              <span className="text-xs text-text-secondary ml-1">({meal.percentage}%)</span>
            </div>
          </div>
        ))}
      </div>

      {/* Insight */}
      {maxMeal.percentage > 40 && maxMeal.calories > 0 && (
        <div className="mt-3 text-xs text-text-secondary text-center">
          {maxMeal.label} accounts for {maxMeal.percentage}% of today&apos;s calories
        </div>
      )}
    </div>
  );
}
