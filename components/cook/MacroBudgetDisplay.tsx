'use client';

import { MacroBudget } from '@/lib/types';

interface MacroBudgetDisplayProps {
  remaining: MacroBudget;
  compact?: boolean;
}

export default function MacroBudgetDisplay({ remaining, compact = false }: MacroBudgetDisplayProps) {
  const items = [
    { label: 'Calories', value: remaining.calories, unit: 'kcal', color: 'text-accent-blue' },
    { label: 'Protein', value: remaining.protein, unit: 'g', color: 'text-accent-orange' },
    { label: 'Carbs', value: remaining.carbs, unit: 'g', color: 'text-accent-green' },
    { label: 'Fat', value: remaining.fat, unit: 'g', color: 'text-accent-purple' },
  ];

  if (compact) {
    return (
      <div className="flex gap-3 text-xs">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-1">
            <span className="text-text-secondary">{item.label}:</span>
            <span className={`font-medium ${item.value > 0 ? item.color : 'text-accent-red'}`}>
              {item.value}{item.unit}
            </span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="bg-secondary-bg rounded-apple p-3">
      <div className="text-xs text-text-secondary mb-2">Remaining Budget Today</div>
      <div className="grid grid-cols-4 gap-2">
        {items.map((item) => (
          <div key={item.label} className="text-center">
            <div className={`text-lg font-bold ${item.value > 0 ? item.color : 'text-accent-red'}`}>
              {item.value}
            </div>
            <div className="text-xs text-text-secondary">{item.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
