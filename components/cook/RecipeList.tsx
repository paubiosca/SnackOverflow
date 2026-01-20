'use client';

import RecipeCard from './RecipeCard';
import Button from '@/components/ui/Button';
import { Recipe, MacroBudget } from '@/lib/types';
import MacroBudgetDisplay from './MacroBudgetDisplay';

interface RecipeListProps {
  recipes: Recipe[];
  remainingBudget: MacroBudget;
  onLog: (recipe: Recipe) => void | Promise<void>;
  onBack: () => void;
  onDone: () => void;
}

export default function RecipeList({
  recipes,
  remainingBudget,
  onLog,
  onBack,
  onDone,
}: RecipeListProps) {
  const checkFitsInBudget = (recipe: Recipe): boolean => {
    return (
      recipe.nutrition.calories <= remainingBudget.calories &&
      recipe.nutrition.protein <= remainingBudget.protein + 10 && // Allow some flexibility
      recipe.nutrition.carbs <= remainingBudget.carbs + 10 &&
      recipe.nutrition.fat <= remainingBudget.fat + 5
    );
  };

  // Sort recipes: those that fit budget first
  const sortedRecipes = [...recipes].sort((a, b) => {
    const aFits = checkFitsInBudget(a);
    const bFits = checkFitsInBudget(b);
    if (aFits && !bFits) return -1;
    if (!aFits && bFits) return 1;
    return 0;
  });

  return (
    <div className="space-y-4">
      {/* Budget display */}
      <MacroBudgetDisplay remaining={remainingBudget} />

      {/* Recipe count */}
      <div className="text-center text-sm text-text-secondary">
        Found <span className="font-semibold text-text-primary">{recipes.length}</span> recipe{recipes.length !== 1 ? 's' : ''} for you
      </div>

      {/* Recipe cards */}
      <div className="space-y-4">
        {sortedRecipes.map(recipe => (
          <RecipeCard
            key={recipe.id}
            recipe={recipe}
            onLog={onLog}
            fitsInBudget={checkFitsInBudget(recipe)}
          />
        ))}
      </div>

      {/* Action buttons */}
      <div className="flex gap-3 pt-4">
        <Button variant="secondary" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onDone} fullWidth>
          Done
        </Button>
      </div>
    </div>
  );
}
