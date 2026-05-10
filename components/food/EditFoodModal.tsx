'use client';

import { useState, useEffect } from 'react';
import { FoodEntry, MealType, MEAL_LABELS } from '@/lib/types';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { ChevronDown, ChevronUp, Sparkles } from 'lucide-react';

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
  const [showReasoning, setShowReasoning] = useState(false);

  useEffect(() => {
    if (entry) {
      setName(entry.name);
      setMealType(entry.mealType as MealType);
      setCalories(entry.calories.toString());
      setProtein(entry.protein.toString());
      setCarbs(entry.carbs.toString());
      setFat(entry.fat.toString());
      setDate(entry.date);
      setShowReasoning(false);
    }
  }, [entry]);

  const allPhotos = entry
    ? [
        ...(entry.photoUrl ? [entry.photoUrl] : []),
        ...(Array.isArray(entry.photoUrls) ? entry.photoUrls : []),
      ]
    : [];
  const breakdown = entry?.analysis;
  const hasReasoning = !!(breakdown || allPhotos.length > 0 || entry?.clarifyingQuestion || entry?.clarifyingAnswer);

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

          {hasReasoning && (
            <div className="border border-border-light rounded-apple-lg overflow-hidden">
              <button
                type="button"
                onClick={() => setShowReasoning((s) => !s)}
                className="w-full flex items-center justify-between px-3 py-2.5 bg-secondary-bg hover:bg-gray-100 active:bg-gray-200"
              >
                <span className="flex items-center gap-2 text-sm font-medium text-text-primary">
                  <Sparkles className="w-4 h-4 text-accent-blue" />
                  How we estimated this
                  {typeof breakdown?.confidence === 'number' && (
                    <span className="text-xs font-normal text-text-secondary">
                      · {breakdown.confidence}% confident
                    </span>
                  )}
                </span>
                {showReasoning ? <ChevronUp className="w-4 h-4 text-text-secondary" /> : <ChevronDown className="w-4 h-4 text-text-secondary" />}
              </button>

              {showReasoning && (
                <div className="p-3 space-y-3">
                  {allPhotos.length > 0 && (
                    <div className="flex gap-2 overflow-x-auto -mx-1 px-1">
                      {allPhotos.map((url, idx) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={idx}
                          src={url}
                          alt={`Photo ${idx + 1}`}
                          className="w-24 h-24 object-cover rounded-apple shrink-0"
                        />
                      ))}
                    </div>
                  )}

                  {entry?.inputDescription && (
                    <div className="text-xs">
                      <p className="text-text-secondary mb-0.5">You wrote</p>
                      <p className="text-text-primary">&ldquo;{entry.inputDescription}&rdquo;</p>
                    </div>
                  )}

                  {breakdown?.rationale && (
                    <div className="text-sm text-text-primary leading-relaxed bg-blue-50/60 border border-blue-100 rounded-apple px-3 py-2">
                      {breakdown.rationale}
                    </div>
                  )}

                  {breakdown?.components && breakdown.components.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-1.5">
                        Breakdown
                      </p>
                      <ul className="divide-y divide-border-light border border-border-light rounded-apple overflow-hidden">
                        {breakdown.components.map((c, idx) => (
                          <li key={idx} className="px-3 py-2 flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm text-text-primary truncate">
                                {c.name}
                                {c.brand && <span className="text-text-secondary font-normal"> · {c.brand}</span>}
                              </p>
                              <p className="text-[11px] text-text-secondary mt-0.5">
                                {c.portionDisplay}
                                {typeof c.confidence === 'number' && ` · ${c.confidence}% confident`}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-sm font-semibold text-text-primary">{c.nutrition.calories} kcal</p>
                              <p className="text-[11px] text-text-secondary">
                                P{c.nutrition.protein} · C{c.nutrition.carbs} · F{c.nutrition.fat}
                              </p>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {(entry?.clarifyingQuestion || entry?.clarifyingAnswer) && (
                    <div className="text-xs space-y-1">
                      {entry.clarifyingQuestion && (
                        <p>
                          <span className="text-text-secondary">Asked: </span>
                          <span className="text-text-primary">{entry.clarifyingQuestion}</span>
                        </p>
                      )}
                      {entry.clarifyingAnswer && (
                        <p>
                          <span className="text-text-secondary">You answered: </span>
                          <span className="text-text-primary">{entry.clarifyingAnswer}</span>
                        </p>
                      )}
                    </div>
                  )}

                  {!breakdown && allPhotos.length === 0 && (
                    <p className="text-xs text-text-secondary">
                      No AI breakdown was saved for this entry (logged manually or before this feature).
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

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
