'use client';

import { useState } from 'react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { Ingredient, INGREDIENT_CATEGORY_LABELS, IngredientCategory } from '@/lib/types';
import { X, Plus, Edit2, Check } from 'lucide-react';

interface IngredientsReviewProps {
  ingredients: Ingredient[];
  onConfirm: (ingredients: Ingredient[]) => void;
  onBack: () => void;
  confidence: number;
}

export default function IngredientsReview({
  ingredients: initialIngredients,
  onConfirm,
  onBack,
  confidence,
}: IngredientsReviewProps) {
  const [ingredients, setIngredients] = useState<Ingredient[]>(initialIngredients);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newIngredient, setNewIngredient] = useState({ name: '', amount: '', category: 'other' as IngredientCategory });

  const handleRemove = (id: string) => {
    setIngredients(ingredients.filter(i => i.id !== id));
  };

  const handleStartEdit = (ingredient: Ingredient) => {
    setEditingId(ingredient.id);
    setEditValue(`${ingredient.name} (${ingredient.amount})`);
  };

  const handleSaveEdit = (id: string) => {
    const match = editValue.match(/^(.+?)\s*(?:\((.+)\))?$/);
    if (match) {
      setIngredients(ingredients.map(i =>
        i.id === id
          ? { ...i, name: match[1].trim(), amount: match[2]?.trim() || i.amount }
          : i
      ));
    }
    setEditingId(null);
    setEditValue('');
  };

  const handleAdd = () => {
    if (newIngredient.name.trim()) {
      const newId = `new-${Date.now()}`;
      setIngredients([
        ...ingredients,
        {
          id: newId,
          name: newIngredient.name.trim(),
          amount: newIngredient.amount.trim() || 'some',
          category: newIngredient.category,
        },
      ]);
      setNewIngredient({ name: '', amount: '', category: 'other' });
      setShowAddForm(false);
    }
  };

  // Group ingredients by category
  const groupedIngredients = ingredients.reduce((acc, ingredient) => {
    if (!acc[ingredient.category]) {
      acc[ingredient.category] = [];
    }
    acc[ingredient.category].push(ingredient);
    return acc;
  }, {} as Record<IngredientCategory, Ingredient[]>);

  const categoryOrder: IngredientCategory[] = ['protein', 'vegetable', 'fruit', 'grain', 'dairy', 'fat', 'seasoning', 'other'];

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="font-semibold text-text-primary">Review Ingredients</h3>
            <p className="text-sm text-text-secondary">
              {ingredients.length} ingredients identified
            </p>
          </div>
          <div className="text-right">
            <div className="text-xs text-text-secondary">Confidence</div>
            <div className={`font-semibold ${
              confidence >= 80 ? 'text-accent-green' :
              confidence >= 60 ? 'text-accent-orange' : 'text-accent-red'
            }`}>
              {confidence}%
            </div>
          </div>
        </div>

        {/* Grouped ingredients */}
        <div className="space-y-4">
          {categoryOrder.map(category => {
            const items = groupedIngredients[category];
            if (!items || items.length === 0) return null;

            return (
              <div key={category}>
                <div className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-2">
                  {INGREDIENT_CATEGORY_LABELS[category]}
                </div>
                <div className="flex flex-wrap gap-2">
                  {items.map(ingredient => (
                    <div
                      key={ingredient.id}
                      className="flex items-center gap-1 bg-secondary-bg rounded-full pl-3 pr-1 py-1"
                    >
                      {editingId === ingredient.id ? (
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit(ingredient.id)}
                          className="bg-transparent text-sm text-text-primary focus:outline-none w-32"
                          autoFocus
                        />
                      ) : (
                        <span className="text-sm text-text-primary">
                          {ingredient.name}
                          <span className="text-text-secondary ml-1">({ingredient.amount})</span>
                        </span>
                      )}
                      <div className="flex">
                        {editingId === ingredient.id ? (
                          <button
                            onClick={() => handleSaveEdit(ingredient.id)}
                            className="p-1 hover:bg-white rounded-full transition-colors"
                          >
                            <Check className="w-3.5 h-3.5 text-accent-green" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleStartEdit(ingredient)}
                            className="p-1 hover:bg-white rounded-full transition-colors"
                          >
                            <Edit2 className="w-3.5 h-3.5 text-text-secondary" />
                          </button>
                        )}
                        <button
                          onClick={() => handleRemove(ingredient.id)}
                          className="p-1 hover:bg-white rounded-full transition-colors"
                        >
                          <X className="w-3.5 h-3.5 text-text-secondary hover:text-accent-red" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Add ingredient form */}
        {showAddForm ? (
          <div className="mt-4 pt-4 border-t border-border-light">
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={newIngredient.name}
                onChange={(e) => setNewIngredient({ ...newIngredient, name: e.target.value })}
                placeholder="Ingredient name"
                className="flex-1 px-3 py-2 bg-secondary-bg border border-border-light rounded-apple text-sm focus:outline-none focus:ring-2 focus:ring-accent-orange"
              />
              <input
                type="text"
                value={newIngredient.amount}
                onChange={(e) => setNewIngredient({ ...newIngredient, amount: e.target.value })}
                placeholder="Amount"
                className="w-24 px-3 py-2 bg-secondary-bg border border-border-light rounded-apple text-sm focus:outline-none focus:ring-2 focus:ring-accent-orange"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={newIngredient.category}
                onChange={(e) => setNewIngredient({ ...newIngredient, category: e.target.value as IngredientCategory })}
                className="flex-1 px-3 py-2 bg-secondary-bg border border-border-light rounded-apple text-sm focus:outline-none focus:ring-2 focus:ring-accent-orange"
              >
                {categoryOrder.map(cat => (
                  <option key={cat} value={cat}>{INGREDIENT_CATEGORY_LABELS[cat]}</option>
                ))}
              </select>
              <Button size="sm" onClick={handleAdd}>Add</Button>
              <Button size="sm" variant="secondary" onClick={() => setShowAddForm(false)}>Cancel</Button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowAddForm(true)}
            className="mt-4 flex items-center gap-2 text-sm text-accent-orange hover:underline"
          >
            <Plus className="w-4 h-4" />
            Add ingredient
          </button>
        )}
      </Card>

      {/* Action buttons */}
      <div className="flex gap-3">
        <Button variant="secondary" onClick={onBack}>
          Back
        </Button>
        <Button
          onClick={() => onConfirm(ingredients)}
          fullWidth
          disabled={ingredients.length === 0}
        >
          Find Recipes ({ingredients.length})
        </Button>
      </div>
    </div>
  );
}
