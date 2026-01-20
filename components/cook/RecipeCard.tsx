'use client';

import { useState } from 'react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { Recipe } from '@/lib/types';
import { Clock, ChefHat, ChevronDown, ChevronUp, Utensils } from 'lucide-react';

interface RecipeCardProps {
  recipe: Recipe;
  onLog: (recipe: Recipe) => void | Promise<void>;
  fitsInBudget: boolean;
}

export default function RecipeCard({ recipe, onLog, fitsInBudget }: RecipeCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [isLogging, setIsLogging] = useState(false);

  const handleLog = async () => {
    setIsLogging(true);
    try {
      await onLog(recipe);
    } finally {
      setIsLogging(false);
    }
  };

  const difficultyColors = {
    easy: 'text-accent-green bg-green-50',
    medium: 'text-accent-orange bg-orange-50',
    hard: 'text-accent-red bg-red-50',
  };

  return (
    <Card>
      {/* Header */}
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <h3 className="font-semibold text-text-primary text-lg">{recipe.name}</h3>
          <p className="text-sm text-text-secondary mt-1">{recipe.description}</p>
        </div>
        {fitsInBudget && (
          <span className="text-xs bg-green-100 text-accent-green px-2 py-1 rounded-full ml-2 whitespace-nowrap">
            Fits budget
          </span>
        )}
      </div>

      {/* Meta info */}
      <div className="flex flex-wrap gap-2 mb-3">
        <span className="flex items-center gap-1 text-xs text-text-secondary bg-secondary-bg px-2 py-1 rounded-full">
          <Clock className="w-3.5 h-3.5" />
          {recipe.prepTime}
        </span>
        <span className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full capitalize ${difficultyColors[recipe.difficulty]}`}>
          <ChefHat className="w-3.5 h-3.5" />
          {recipe.difficulty}
        </span>
        <span className="flex items-center gap-1 text-xs text-text-secondary bg-secondary-bg px-2 py-1 rounded-full">
          <Utensils className="w-3.5 h-3.5" />
          {recipe.nutrition.servings} serving{recipe.nutrition.servings > 1 ? 's' : ''}
        </span>
      </div>

      {/* Nutrition per serving */}
      <div className="grid grid-cols-4 gap-2 py-3 border-y border-border-light">
        <div className="text-center">
          <div className="text-lg font-bold text-accent-blue">{recipe.nutrition.calories}</div>
          <div className="text-xs text-text-secondary">kcal</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-accent-orange">{recipe.nutrition.protein}g</div>
          <div className="text-xs text-text-secondary">protein</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-accent-green">{recipe.nutrition.carbs}g</div>
          <div className="text-xs text-text-secondary">carbs</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-accent-purple">{recipe.nutrition.fat}g</div>
          <div className="text-xs text-text-secondary">fat</div>
        </div>
      </div>

      {/* Tags */}
      {recipe.tags && recipe.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-3">
          {recipe.tags.map((tag, i) => (
            <span key={i} className="text-xs text-text-secondary bg-secondary-bg px-2 py-0.5 rounded">
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Expandable section */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-center gap-1 mt-3 py-2 text-sm text-accent-orange hover:underline"
      >
        {expanded ? 'Hide' : 'Show'} instructions
        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-border-light space-y-4">
          {/* Ingredients used */}
          <div>
            <h4 className="text-sm font-medium text-text-primary mb-2">Ingredients Used</h4>
            <div className="flex flex-wrap gap-1">
              {recipe.ingredientsUsed.map((ing, i) => (
                <span key={i} className="text-xs bg-orange-50 text-accent-orange px-2 py-1 rounded-full">
                  {ing}
                </span>
              ))}
            </div>
          </div>

          {/* Instructions */}
          <div>
            <h4 className="text-sm font-medium text-text-primary mb-2">Instructions</h4>
            <ol className="space-y-2">
              {recipe.instructions.map((step, i) => (
                <li key={i} className="flex gap-3 text-sm text-text-secondary">
                  <span className="flex-shrink-0 w-5 h-5 bg-accent-orange text-white rounded-full flex items-center justify-center text-xs font-medium">
                    {i + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}

      {/* Log button */}
      <div className="mt-4">
        <Button onClick={handleLog} fullWidth variant="secondary" disabled={isLogging}>
          {isLogging ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-accent-orange border-t-transparent rounded-full animate-spin" />
              Logging...
            </span>
          ) : (
            'Log as Meal'
          )}
        </Button>
      </div>
    </Card>
  );
}
