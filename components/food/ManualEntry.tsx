'use client';

import { useState } from 'react';
import { MealType, MEAL_LABELS, NutritionInfo } from '@/lib/types';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Card from '@/components/ui/Card';

interface ManualEntryProps {
  onSubmit: (data: { name: string; mealType: MealType; nutrition: NutritionInfo }) => void;
  onCancel: () => void;
}

export default function ManualEntry({ onSubmit, onCancel }: ManualEntryProps) {
  const [name, setName] = useState('');
  const [mealType, setMealType] = useState<MealType>('snack');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name,
      mealType,
      nutrition: {
        calories: parseFloat(calories) || 0,
        protein: parseFloat(protein) || 0,
        carbs: parseFloat(carbs) || 0,
        fat: parseFloat(fat) || 0,
      },
    });
  };

  const isValid = name && calories;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Food Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g., Chicken Salad"
        required
      />

      <div>
        <label className="block text-sm font-medium text-text-primary mb-2">
          Meal Type
        </label>
        <div className="grid grid-cols-4 gap-2">
          {(Object.entries(MEAL_LABELS) as [MealType, string][]).map(([type, label]) => (
            <button
              key={type}
              type="button"
              onClick={() => setMealType(type)}
              className={`py-2 px-3 text-sm rounded-apple border-2 transition-all ${
                mealType === type
                  ? 'border-accent-blue bg-blue-50 text-accent-blue'
                  : 'border-border-light text-text-secondary'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <Card className="bg-secondary-bg">
        <h4 className="font-medium text-text-primary mb-3">Nutrition Info</h4>
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Calories"
            type="number"
            value={calories}
            onChange={(e) => setCalories(e.target.value)}
            placeholder="0"
            required
          />
          <Input
            label="Protein (g)"
            type="number"
            value={protein}
            onChange={(e) => setProtein(e.target.value)}
            placeholder="0"
          />
          <Input
            label="Carbs (g)"
            type="number"
            value={carbs}
            onChange={(e) => setCarbs(e.target.value)}
            placeholder="0"
          />
          <Input
            label="Fat (g)"
            type="number"
            value={fat}
            onChange={(e) => setFat(e.target.value)}
            placeholder="0"
          />
        </div>
      </Card>

      <div className="flex gap-3">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" fullWidth disabled={!isValid}>
          Add to Log
        </Button>
      </div>
    </form>
  );
}
