'use client';

import { useState, useEffect } from 'react';
import { FoodEntry, MealType, MEAL_LABELS } from '@/lib/types';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

interface EditFoodModalProps {
  entry: FoodEntry | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (id: string, updates: Partial<FoodEntry>) => void;
  onDelete: (id: string) => void;
}

export default function EditFoodModal({ entry, isOpen, onClose, onSave, onDelete }: EditFoodModalProps) {
  const [name, setName] = useState('');
  const [mealType, setMealType] = useState<MealType>('snack');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [date, setDate] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (entry) {
      setName(entry.name);
      setMealType(entry.mealType as MealType);
      setCalories(entry.calories.toString());
      setProtein(entry.protein.toString());
      setCarbs(entry.carbs.toString());
      setFat(entry.fat.toString());
      setDate(entry.date);
    }
  }, [entry]);

  const handleSave = () => {
    if (!entry) return;
    onSave(entry.id, {
      name,
      mealType,
      calories: parseFloat(calories) || 0,
      protein: parseFloat(protein) || 0,
      carbs: parseFloat(carbs) || 0,
      fat: parseFloat(fat) || 0,
      date,
    });
    onClose();
  };

  const handleDelete = () => {
    if (!entry) return;
    onDelete(entry.id);
    onClose();
  };

  if (!entry) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Food Entry">
      {showDeleteConfirm ? (
        <div className="space-y-4">
          <p className="text-text-secondary">
            Are you sure you want to delete &quot;{entry.name}&quot;?
          </p>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setShowDeleteConfirm(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete} fullWidth>
              Delete
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <Input
            label="Food Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-4 py-3 bg-secondary-bg border border-border-light rounded-apple text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-blue"
            />
          </div>

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
                  className={`py-2 px-2 text-xs rounded-apple border-2 transition-all ${
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

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Calories"
              type="number"
              value={calories}
              onChange={(e) => setCalories(e.target.value)}
            />
            <Input
              label="Protein (g)"
              type="number"
              value={protein}
              onChange={(e) => setProtein(e.target.value)}
            />
            <Input
              label="Carbs (g)"
              type="number"
              value={carbs}
              onChange={(e) => setCarbs(e.target.value)}
            />
            <Input
              label="Fat (g)"
              type="number"
              value={fat}
              onChange={(e) => setFat(e.target.value)}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              variant="danger"
              onClick={() => setShowDeleteConfirm(true)}
            >
              Delete
            </Button>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave} fullWidth>
              Save Changes
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
