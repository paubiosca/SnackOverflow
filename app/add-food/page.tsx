'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useProfile } from '@/hooks/useProfile';
import { useFoodEntries } from '@/hooks/useFoodEntries';
import { MealType, NutritionInfo, Ingredient, Recipe, MacroBudget } from '@/lib/types';
import { calculateDailyTotals } from '@/lib/calories';
import BottomNav from '@/components/ui/BottomNav';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import TextEntry from '@/components/food/TextEntry';
import IngredientInput from '@/components/cook/IngredientInput';
import IngredientsReview from '@/components/cook/IngredientsReview';
import RecipeList from '@/components/cook/RecipeList';
import { MessageSquare, AlertTriangle, ChevronLeft, ChevronRight, Calendar, ChefHat, HelpCircle, X, Check, TrendingUp, TrendingDown } from 'lucide-react';

type Mode = 'select' | 'text' | 'should_i_eat' | 'cook_input' | 'cook_analyzing' | 'cook_review' | 'cook_recipes';

// Helper to format date
const formatDate = (date: Date): string => {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';

  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
};

const getDateString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Suggest meal type based on time of day
const suggestMealType = (): MealType => {
  const hour = new Date().getHours();

  if (hour >= 5 && hour < 11) {
    return 'breakfast';
  } else if (hour >= 11 && hour < 15) {
    return 'lunch';
  } else if (hour >= 17 && hour < 21) {
    return 'dinner';
  } else {
    return 'snack';
  }
};

interface FoodPreview {
  name: string;
  nutrition: NutritionInfo;
}

export default function AddFood() {
  const router = useRouter();
  const { profile, calorieGoal, macroTargets } = useProfile();
  const { add, entries } = useFoodEntries();

  const [mode, setMode] = useState<Mode>('select');
  const [error, setError] = useState<string | null>(null);
  const [selectedMealType, setSelectedMealType] = useState<MealType>(suggestMealType());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  // "Should I eat this?" state
  const [foodQuery, setFoodQuery] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [foodPreview, setFoodPreview] = useState<FoodPreview | null>(null);

  // Cook mode state
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [ingredientConfidence, setIngredientConfidence] = useState(0);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [remainingBudget, setRemainingBudget] = useState<MacroBudget>({
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
  });

  // Calculate current totals and remaining budget
  const currentTotals = calculateDailyTotals(entries);

  useEffect(() => {
    if (profile) {
      setRemainingBudget({
        calories: Math.max(0, calorieGoal - currentTotals.calories),
        protein: Math.max(0, macroTargets.protein - currentTotals.protein),
        carbs: Math.max(0, macroTargets.carbs - currentTotals.carbs),
        fat: Math.max(0, macroTargets.fat - currentTotals.fat),
      });
    }
  // Note: macroTargets is derived from calorieGoal, so we don't include it as a dependency
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, profile, calorieGoal]);

  useEffect(() => {
    setSelectedMealType(suggestMealType());
  }, []);

  const goToPreviousDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() - 1);
    setSelectedDate(newDate);
  };

  const goToNextDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + 1);
    if (newDate <= new Date()) {
      setSelectedDate(newDate);
    }
  };

  const isToday = selectedDate.toDateString() === new Date().toDateString();

  // "Should I eat this?" handler
  const handleAnalyzeFood = async () => {
    if (!foodQuery.trim()) return;

    if (!profile?.openaiApiKey) {
      setError('Please add your OpenAI API key in Profile to use this feature');
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setFoodPreview(null);

    try {
      const response = await fetch('/api/analyze-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: foodQuery,
          apiKey: profile.openaiApiKey,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to analyze food');
      }

      if (data.foods && data.foods.length > 0) {
        // Combine all foods into one preview
        const combinedNutrition = data.foods.reduce(
          (acc: NutritionInfo, food: { nutrition: NutritionInfo }) => ({
            calories: acc.calories + food.nutrition.calories,
            protein: acc.protein + food.nutrition.protein,
            carbs: acc.carbs + food.nutrition.carbs,
            fat: acc.fat + food.nutrition.fat,
          }),
          { calories: 0, protein: 0, carbs: 0, fat: 0 }
        );

        const foodNames = data.foods.map((f: { name: string }) => f.name).join(', ');

        setFoodPreview({
          name: foodNames,
          nutrition: combinedNutrition,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze food');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleLogPreviewedFood = async () => {
    if (!foodPreview) return;

    await add({
      name: foodPreview.name,
      mealType: selectedMealType,
      calories: foodPreview.nutrition.calories,
      protein: foodPreview.nutrition.protein,
      carbs: foodPreview.nutrition.carbs,
      fat: foodPreview.nutrition.fat,
      isManualEntry: false,
      date: getDateString(selectedDate),
    });
    router.push('/');
  };

  const handleTextSubmit = async (foods: { name: string; mealType: MealType; nutrition: NutritionInfo }[]) => {
    console.log('[handleTextSubmit] Starting to add', foods.length, 'foods');
    try {
      await Promise.all(foods.map(food =>
        add({
          name: food.name,
          mealType: food.mealType,
          calories: food.nutrition.calories,
          protein: food.nutrition.protein,
          carbs: food.nutrition.carbs,
          fat: food.nutrition.fat,
          isManualEntry: false,
          date: getDateString(selectedDate),
        })
      ));
      console.log('[handleTextSubmit] All foods added, navigating to /');
      router.push('/');
    } catch (error) {
      console.error('[handleTextSubmit] Error:', error);
    }
  };

  const handleCancel = () => {
    setError(null);
    setIngredients([]);
    setRecipes([]);
    setFoodQuery('');
    setFoodPreview(null);
    setMode('select');
  };

  // Cook mode handlers
  const handleAnalyzeIngredients = async (image: string | null, textInput: string) => {
    if (!profile?.openaiApiKey) {
      setError('Please add your OpenAI API key in Settings');
      setMode('select');
      return;
    }

    setMode('cook_analyzing');
    setError(null);

    try {
      const response = await fetch('/api/analyze-ingredients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageData: image,
          textInput,
          apiKey: profile.openaiApiKey,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to analyze ingredients');
      }

      setIngredients(data.ingredients);
      setIngredientConfidence(data.confidence);
      setMode('cook_review');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze ingredients');
      setMode('cook_input');
    }
  };

  const handleConfirmIngredients = async (confirmedIngredients: Ingredient[]) => {
    if (!profile?.openaiApiKey) {
      setError('Please add your OpenAI API key in Settings');
      return;
    }

    setIngredients(confirmedIngredients);
    setMode('cook_analyzing');
    setError(null);

    try {
      const response = await fetch('/api/suggest-recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ingredients: confirmedIngredients,
          remainingBudget,
          apiKey: profile.openaiApiKey,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get recipe suggestions');
      }

      setRecipes(data.recipes);
      setMode('cook_recipes');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get recipes');
      setMode('cook_review');
    }
  };

  const handleLogRecipe = async (recipe: Recipe) => {
    await add({
      name: recipe.name,
      mealType: selectedMealType,
      calories: recipe.nutrition.calories,
      protein: recipe.nutrition.protein,
      carbs: recipe.nutrition.carbs,
      fat: recipe.nutrition.fat,
      isManualEntry: false,
      date: getDateString(selectedDate),
    });
    setRemainingBudget(prev => ({
      calories: Math.max(0, prev.calories - recipe.nutrition.calories),
      protein: Math.max(0, prev.protein - recipe.nutrition.protein),
      carbs: Math.max(0, prev.carbs - recipe.nutrition.carbs),
      fat: Math.max(0, prev.fat - recipe.nutrition.fat),
    }));
  };

  // Calculate impact if food is added
  const getImpact = (nutrition: NutritionInfo) => {
    const newTotal = currentTotals.calories + nutrition.calories;
    const percentOfGoal = Math.round((newTotal / calorieGoal) * 100);
    const remaining = calorieGoal - newTotal;
    const isOverBudget = remaining < 0;

    return { newTotal, percentOfGoal, remaining, isOverBudget };
  };

  return (
    <main className="min-h-screen pb-24">
      {/* Header */}
      <header className="bg-white px-4 pt-12 pb-4 sticky top-0 z-40 shadow-sm">
        <h1 className="text-2xl font-bold text-text-primary mb-3">Add Food</h1>

        {/* Date Picker */}
        <div className="flex items-center justify-center gap-2 bg-secondary-bg rounded-apple p-2">
          <button
            onClick={goToPreviousDay}
            className="p-2 hover:bg-white rounded-full transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-text-secondary" />
          </button>

          <div className="flex items-center gap-2 px-3">
            <Calendar className="w-4 h-4 text-accent-blue" />
            <span className={`font-medium ${isToday ? 'text-accent-blue' : 'text-text-primary'}`}>
              {formatDate(selectedDate)}
            </span>
          </div>

          <button
            onClick={goToNextDay}
            disabled={isToday}
            className={`p-2 rounded-full transition-colors ${
              isToday ? 'opacity-30 cursor-not-allowed' : 'hover:bg-white'
            }`}
          >
            <ChevronRight className="w-5 h-5 text-text-secondary" />
          </button>
        </div>
      </header>

      <div className="px-4 py-4 page-transition">
        {/* Error display */}
        {error && (
          <Card className="mb-4 bg-accent-red/10 border border-accent-red/30">
            <p className="text-accent-red">{error}</p>
          </Card>
        )}

        {/* Mode: Select */}
        {mode === 'select' && (
          <div className="space-y-4">
            <p className="text-text-secondary text-center mb-6">
              How would you like to log your food?
            </p>

            {/* Should I Eat This? - NEW FEATURE */}
            <button
              onClick={() => setMode('should_i_eat')}
              className="w-full p-6 bg-gradient-to-br from-accent-blue/5 to-accent-purple/5 rounded-apple-lg shadow-apple hover:shadow-apple-lg transition-shadow border-2 border-accent-blue/20"
            >
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-gradient-to-br from-accent-blue to-accent-purple rounded-full flex items-center justify-center">
                  <HelpCircle className="w-8 h-8 text-white" />
                </div>
                <div className="text-left">
                  <h3 className="font-semibold text-text-primary text-lg">Should I Eat This?</h3>
                  <p className="text-text-secondary text-sm">
                    Check how a food would impact your daily intake
                  </p>
                </div>
              </div>
            </button>

            <button
              onClick={() => setMode('text')}
              className="w-full p-6 bg-white rounded-apple-lg shadow-apple hover:shadow-apple-lg transition-shadow"
            >
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-accent-purple/10 rounded-full flex items-center justify-center">
                  <MessageSquare className="w-8 h-8 text-accent-purple" />
                </div>
                <div className="text-left">
                  <h3 className="font-semibold text-text-primary text-lg">Log Your Meal</h3>
                  <p className="text-text-secondary text-sm">
                    Describe what you ate + add a photo
                  </p>
                </div>
              </div>
            </button>

            <button
              onClick={() => setMode('cook_input')}
              className="w-full p-6 bg-white rounded-apple-lg shadow-apple hover:shadow-apple-lg transition-shadow border-2 border-accent-orange/20"
            >
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-accent-orange/10 rounded-full flex items-center justify-center">
                  <ChefHat className="w-8 h-8 text-accent-orange" />
                </div>
                <div className="text-left">
                  <h3 className="font-semibold text-text-primary text-lg">What Should I Cook?</h3>
                  <p className="text-text-secondary text-sm">
                    Get recipe ideas based on your ingredients
                  </p>
                </div>
              </div>
            </button>

            {!profile?.openaiApiKey && (
              <Card className="bg-amber-50 border border-amber-200">
                <div className="flex gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-amber-800 font-medium">AI not configured</p>
                    <p className="text-xs text-amber-700 mt-1">
                      Add your OpenAI API key in Profile to enable AI features
                    </p>
                  </div>
                </div>
              </Card>
            )}
          </div>
        )}

        {/* Mode: Should I Eat This? */}
        {mode === 'should_i_eat' && (
          <div className="space-y-4">
            <Card>
              <h3 className="font-semibold text-text-primary mb-3 flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-accent-blue" />
                Should I Eat This?
              </h3>
              <p className="text-sm text-text-secondary mb-4">
                Enter a food to see its nutrition and how it would affect your daily intake.
              </p>

              <textarea
                value={foodQuery}
                onChange={(e) => setFoodQuery(e.target.value)}
                placeholder="e.g., 'Big Mac with medium fries' or 'avocado toast with 2 eggs'"
                className="w-full px-4 py-3 bg-secondary-bg border border-border-light rounded-apple text-text-primary placeholder-text-secondary focus:outline-none focus:ring-2 focus:ring-accent-blue min-h-[80px] resize-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleAnalyzeFood();
                  }
                }}
              />

              <div className="flex gap-3 mt-4">
                <Button variant="secondary" onClick={handleCancel}>
                  Cancel
                </Button>
                <Button
                  onClick={handleAnalyzeFood}
                  fullWidth
                  disabled={!foodQuery.trim() || isAnalyzing}
                >
                  {isAnalyzing ? 'Analyzing...' : 'Check Nutrition'}
                </Button>
              </div>
            </Card>

            {/* Current Status */}
            <Card className="bg-secondary-bg">
              <h4 className="text-sm font-medium text-text-secondary mb-2">Your Current Status Today</h4>
              <div className="flex justify-between items-center">
                <span className="text-text-primary">Calories consumed</span>
                <span className="font-semibold text-text-primary">{currentTotals.calories} / {calorieGoal}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                <div
                  className={`h-2 rounded-full transition-all ${
                    currentTotals.calories > calorieGoal ? 'bg-accent-red' : 'bg-accent-blue'
                  }`}
                  style={{ width: `${Math.min(100, (currentTotals.calories / calorieGoal) * 100)}%` }}
                />
              </div>
              <p className="text-xs text-text-secondary mt-2">
                {remainingBudget.calories > 0
                  ? `${remainingBudget.calories} calories remaining`
                  : `${Math.abs(remainingBudget.calories)} calories over budget`}
              </p>
            </Card>

            {/* Food Preview Results */}
            {foodPreview && (
              <Card className="border-2 border-accent-blue/30">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h4 className="font-semibold text-text-primary">{foodPreview.name}</h4>
                    <p className="text-sm text-text-secondary">Estimated nutrition</p>
                  </div>
                  <button
                    onClick={() => setFoodPreview(null)}
                    className="p-1 hover:bg-secondary-bg rounded-full"
                  >
                    <X className="w-4 h-4 text-text-secondary" />
                  </button>
                </div>

                {/* Nutrition breakdown */}
                <div className="grid grid-cols-4 gap-2 mb-4">
                  <div className="text-center p-2 bg-secondary-bg rounded-apple">
                    <p className="text-lg font-bold text-accent-blue">{foodPreview.nutrition.calories}</p>
                    <p className="text-xs text-text-secondary">Calories</p>
                  </div>
                  <div className="text-center p-2 bg-secondary-bg rounded-apple">
                    <p className="text-lg font-bold text-accent-orange">{foodPreview.nutrition.protein}g</p>
                    <p className="text-xs text-text-secondary">Protein</p>
                  </div>
                  <div className="text-center p-2 bg-secondary-bg rounded-apple">
                    <p className="text-lg font-bold text-accent-green">{foodPreview.nutrition.carbs}g</p>
                    <p className="text-xs text-text-secondary">Carbs</p>
                  </div>
                  <div className="text-center p-2 bg-secondary-bg rounded-apple">
                    <p className="text-lg font-bold text-accent-purple">{foodPreview.nutrition.fat}g</p>
                    <p className="text-xs text-text-secondary">Fat</p>
                  </div>
                </div>

                {/* Impact Analysis */}
                {(() => {
                  const impact = getImpact(foodPreview.nutrition);
                  return (
                    <div className={`p-4 rounded-apple ${impact.isOverBudget ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
                      <div className="flex items-center gap-2 mb-2">
                        {impact.isOverBudget ? (
                          <TrendingUp className="w-5 h-5 text-accent-red" />
                        ) : (
                          <TrendingDown className="w-5 h-5 text-accent-green" />
                        )}
                        <span className={`font-semibold ${impact.isOverBudget ? 'text-accent-red' : 'text-accent-green'}`}>
                          {impact.isOverBudget ? 'Over Budget' : 'Within Budget'}
                        </span>
                      </div>
                      <p className="text-sm text-text-primary">
                        After eating this, you'll be at <strong>{impact.newTotal}</strong> calories ({impact.percentOfGoal}% of your goal).
                      </p>
                      <p className="text-sm text-text-secondary mt-1">
                        {impact.isOverBudget
                          ? `You'll be ${Math.abs(impact.remaining)} calories over your daily goal.`
                          : `You'll have ${impact.remaining} calories left for the day.`}
                      </p>
                    </div>
                  );
                })()}

                {/* Action buttons */}
                <div className="flex gap-3 mt-4">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setFoodPreview(null);
                      setFoodQuery('');
                    }}
                    className="flex items-center gap-2"
                  >
                    <X className="w-4 h-4" />
                    Skip It
                  </Button>
                  <Button
                    onClick={handleLogPreviewedFood}
                    fullWidth
                    className="flex items-center justify-center gap-2"
                  >
                    <Check className="w-4 h-4" />
                    Log It
                  </Button>
                </div>
              </Card>
            )}
          </div>
        )}

        {/* Mode: Text (Log Your Meal) */}
        {mode === 'text' && profile?.openaiApiKey && (
          <TextEntry
            apiKey={profile.openaiApiKey}
            onSubmit={handleTextSubmit}
            onCancel={handleCancel}
            defaultMealType={selectedMealType}
          />
        )}

        {/* Mode: Cook Input */}
        {mode === 'cook_input' && (
          <IngredientInput
            onAnalyze={handleAnalyzeIngredients}
            onCancel={handleCancel}
            isAnalyzing={false}
          />
        )}

        {/* Mode: Cook Analyzing */}
        {mode === 'cook_analyzing' && (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 border-4 border-accent-orange border-t-transparent rounded-full animate-spin mb-6" />
            <h2 className="text-xl font-semibold text-text-primary mb-2">
              {ingredients.length > 0 ? 'Finding recipes...' : 'Identifying ingredients...'}
            </h2>
            <p className="text-text-secondary text-center">
              {ingredients.length > 0
                ? 'AI is creating delicious recipe suggestions for you'
                : 'AI is analyzing what you have available'}
            </p>
          </div>
        )}

        {/* Mode: Cook Review */}
        {mode === 'cook_review' && (
          <IngredientsReview
            ingredients={ingredients}
            onConfirm={handleConfirmIngredients}
            onBack={() => setMode('cook_input')}
            confidence={ingredientConfidence}
          />
        )}

        {/* Mode: Cook Recipes */}
        {mode === 'cook_recipes' && (
          <div className="space-y-4">
            <Card>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Log recipes as which meal?
              </label>
              <div className="grid grid-cols-4 gap-2">
                {(['breakfast', 'lunch', 'dinner', 'snack'] as MealType[]).map((type) => {
                  const isSuggested = type === suggestMealType();
                  return (
                    <button
                      key={type}
                      onClick={() => setSelectedMealType(type)}
                      className={`py-2 px-2 text-xs rounded-apple border-2 transition-all capitalize ${
                        selectedMealType === type
                          ? 'border-accent-orange bg-orange-50 text-accent-orange'
                          : isSuggested
                          ? 'border-accent-orange/30 text-text-secondary'
                          : 'border-border-light text-text-secondary'
                      }`}
                    >
                      {type}
                    </button>
                  );
                })}
              </div>
            </Card>

            <RecipeList
              recipes={recipes}
              remainingBudget={remainingBudget}
              onLog={handleLogRecipe}
              onBack={() => setMode('cook_review')}
              onDone={() => router.push('/')}
            />
          </div>
        )}
      </div>

      <BottomNav />
    </main>
  );
}
