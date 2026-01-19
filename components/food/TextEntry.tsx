'use client';

import { useState } from 'react';
import { MealType, NutritionInfo, MEAL_LABELS } from '@/lib/types';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { HelpCircle, Store, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';

interface ParsedFood {
  name: string;
  brand?: string | null;
  portion?: string;
  portionGrams?: number | null;
  nutrition: NutritionInfo;
  confidence: number;
}

interface ClarifyingQuestion {
  id: string;
  question: string;
  options: { label: string; value: string }[];
}

interface TextEntryProps {
  apiKey: string;
  onSubmit: (foods: { name: string; mealType: MealType; nutrition: NutritionInfo }[]) => void;
  onCancel: () => void;
}

export default function TextEntry({ apiKey, onSubmit, onCancel }: TextEntryProps) {
  const [description, setDescription] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [parsedFoods, setParsedFoods] = useState<ParsedFood[]>([]);
  const [questions, setQuestions] = useState<ClarifyingQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [mealType, setMealType] = useState<MealType>('snack');
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'input' | 'questions' | 'review'>('input');
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [reAnalyzingIndex, setReAnalyzingIndex] = useState<number | null>(null);

  const analyzeText = async (text: string, previousAnswers?: Record<string, string>) => {
    setIsAnalyzing(true);
    setError(null);

    try {
      const response = await fetch('/api/analyze-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: text,
          apiKey,
          answers: previousAnswers,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to analyze text');
      }

      setParsedFoods(data.foods || []);

      if (data.clarifyingQuestions && data.clarifyingQuestions.length > 0) {
        setQuestions(data.clarifyingQuestions);
        setStep('questions');
      } else {
        setStep('review');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSubmitDescription = (e: React.FormEvent) => {
    e.preventDefault();
    if (description.trim()) {
      analyzeText(description);
    }
  };

  const reAnalyzeIngredient = async (index: number) => {
    const food = parsedFoods[index];
    if (!food) return;

    setReAnalyzingIndex(index);

    try {
      // Build a specific prompt for this ingredient
      const ingredientDescription = `${food.name}${food.portion ? `, portion: ${food.portion}` : ''}${food.brand ? `, brand: ${food.brand}` : ''}`;

      const response = await fetch('/api/analyze-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: ingredientDescription,
          apiKey,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to re-analyze');
      }

      // If we got a result, update just this item
      if (data.foods && data.foods.length > 0) {
        const updatedFood = data.foods[0];
        const newParsedFoods = [...parsedFoods];
        newParsedFoods[index] = {
          ...newParsedFoods[index],
          nutrition: updatedFood.nutrition,
          confidence: updatedFood.confidence,
          portion: updatedFood.portion || newParsedFoods[index].portion,
          portionGrams: updatedFood.portionGrams || newParsedFoods[index].portionGrams,
        };
        setParsedFoods(newParsedFoods);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to re-analyze');
    } finally {
      setReAnalyzingIndex(null);
    }
  };

  const handleAnswerQuestion = (questionId: string, answer: string) => {
    const newAnswers = { ...answers, [questionId]: answer };
    setAnswers(newAnswers);

    // Check if all questions answered
    const allAnswered = questions.every(q => newAnswers[q.id]);
    if (allAnswered) {
      // Re-analyze with answers
      analyzeText(description, newAnswers);
    }
  };

  const handleConfirm = () => {
    const foodsWithMealType = parsedFoods.map(food => ({
      name: food.name,
      mealType,
      nutrition: food.nutrition,
    }));
    onSubmit(foodsWithMealType);
  };

  const handleStartOver = () => {
    setDescription('');
    setParsedFoods([]);
    setQuestions([]);
    setAnswers({});
    setStep('input');
  };

  return (
    <div className="space-y-4">
      {/* Step: Input */}
      {step === 'input' && (
        <form onSubmit={handleSubmitDescription} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              Describe what you ate
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., I had a grilled chicken sandwich with fries and a medium coke for lunch. Also had a small side salad with ranch dressing."
              className="w-full px-4 py-3 bg-secondary-bg border border-border-light rounded-apple text-text-primary placeholder-text-secondary focus:outline-none focus:ring-2 focus:ring-accent-blue min-h-[120px] resize-none"
              disabled={isAnalyzing}
            />
            <p className="mt-2 text-xs text-text-secondary">
              Be as specific as you can about portions, ingredients, and preparation methods.
            </p>
          </div>

          {error && (
            <Card className="bg-accent-red/10 border border-accent-red/30">
              <p className="text-accent-red text-sm">{error}</p>
            </Card>
          )}

          <div className="flex gap-3">
            <Button type="button" variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
            <Button
              type="submit"
              fullWidth
              disabled={!description.trim() || isAnalyzing}
            >
              {isAnalyzing ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Analyzing...
                </span>
              ) : (
                'Analyze with AI'
              )}
            </Button>
          </div>
        </form>
      )}

      {/* Step: Clarifying Questions */}
      {step === 'questions' && (
        <div className="space-y-4">
          <Card className="bg-amber-50 border border-amber-200">
            <div className="flex items-center gap-2 mb-3">
              <HelpCircle className="w-5 h-5 text-amber-600" />
              <h3 className="font-semibold text-text-primary">A few quick questions</h3>
            </div>
            <p className="text-sm text-text-secondary mb-4">
              Help me understand your meal better for accurate tracking.
            </p>

            <div className="space-y-4">
              {questions.map((question) => (
                <div key={question.id} className="space-y-2">
                  <p className="text-sm font-medium text-text-primary">
                    {question.question}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {question.options.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => handleAnswerQuestion(question.id, option.value)}
                        disabled={isAnalyzing}
                        className={`px-3 py-1.5 rounded-full text-sm transition-all ${
                          answers[question.id] === option.value
                            ? 'bg-accent-blue text-white'
                            : 'bg-white border border-border-light text-text-primary hover:border-accent-blue'
                        } ${isAnalyzing ? 'opacity-50' : ''}`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {isAnalyzing && (
              <div className="mt-4 flex items-center gap-2 text-text-secondary">
                <div className="w-4 h-4 border-2 border-accent-blue border-t-transparent rounded-full animate-spin" />
                <span className="text-sm">Updating estimates...</span>
              </div>
            )}
          </Card>

          <Button variant="secondary" onClick={handleStartOver}>
            Start Over
          </Button>
        </div>
      )}

      {/* Step: Review */}
      {step === 'review' && parsedFoods.length > 0 && (
        <div className="space-y-4">
          {/* Meal type selector */}
          <Card>
            <label className="block text-sm font-medium text-text-primary mb-2">
              Add to which meal?
            </label>
            <div className="grid grid-cols-4 gap-2">
              {(Object.entries(MEAL_LABELS) as [MealType, string][]).map(([type, label]) => (
                <button
                  key={type}
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
          </Card>

          {/* Parsed foods - Clean summary */}
          <Card>
            {/* Total at top - most important info */}
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-border-light">
              <div>
                <span className="text-sm text-text-secondary">{parsedFoods.length} items</span>
              </div>
              <div className="text-right">
                <span className="text-2xl font-bold text-accent-blue">
                  {parsedFoods.reduce((sum, f) => sum + f.nutrition.calories, 0)}
                </span>
                <span className="text-sm text-text-secondary ml-1">kcal</span>
              </div>
            </div>

            {/* Simple list - tap to expand */}
            <div className="space-y-2">
              {parsedFoods.map((food, index) => {
                const isExpanded = expandedIndex === index;
                return (
                  <div
                    key={index}
                    className="rounded-apple overflow-hidden"
                  >
                    {/* Collapsed view - just name and calories */}
                    <button
                      onClick={() => setExpandedIndex(isExpanded ? null : index)}
                      className="w-full p-3 bg-secondary-bg hover:bg-gray-100 transition-colors flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {food.brand && (
                          <span className="text-xs text-gray-400 bg-gray-200 px-1.5 py-0.5 rounded flex-shrink-0">
                            {food.brand}
                          </span>
                        )}
                        <span className="font-medium text-text-primary truncate">{food.name}</span>
                      </div>
                      <div className="flex items-center gap-2 ml-2">
                        <span className="text-accent-blue font-semibold">{food.nutrition.calories}</span>
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-gray-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-gray-400" />
                        )}
                      </div>
                    </button>

                    {/* Expanded details */}
                    {isExpanded && (
                      <div className="px-3 pb-3 bg-secondary-bg border-t border-gray-200">
                        <div className="pt-2 space-y-2">
                          {/* Portion */}
                          {food.portion && (
                            <div className="flex justify-between text-sm">
                              <span className="text-text-secondary">Portion</span>
                              <span className="text-text-primary">
                                {food.portion}{food.portionGrams ? ` (${food.portionGrams}g)` : ''}
                              </span>
                            </div>
                          )}
                          {/* Macros */}
                          <div className="flex justify-between text-sm">
                            <span className="text-text-secondary">Protein</span>
                            <span className="text-text-primary">{food.nutrition.protein}g</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-text-secondary">Carbs</span>
                            <span className="text-text-primary">{food.nutrition.carbs}g</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-text-secondary">Fat</span>
                            <span className="text-text-primary">{food.nutrition.fat}g</span>
                          </div>

                          {/* Re-analyze button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              reAnalyzeIngredient(index);
                            }}
                            disabled={reAnalyzingIndex === index}
                            className="mt-2 w-full py-2 text-sm text-accent-purple hover:bg-accent-purple/10 rounded-apple transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                          >
                            {reAnalyzingIndex === index ? (
                              <>
                                <span className="w-4 h-4 border-2 border-accent-purple border-t-transparent rounded-full animate-spin" />
                                Re-analyzing...
                              </>
                            ) : (
                              <>
                                <RefreshCw className="w-4 h-4" />
                                Re-analyze this item
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>

          <div className="flex gap-3">
            <Button variant="secondary" onClick={handleStartOver}>
              Start Over
            </Button>
            <Button onClick={handleConfirm} fullWidth>
              Add {parsedFoods.length} Item{parsedFoods.length > 1 ? 's' : ''} to Log
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
