'use client';

import { useState, useRef } from 'react';
import { MealType, NutritionInfo, MEAL_LABELS } from '@/lib/types';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { HelpCircle, ChevronDown, ChevronUp, RefreshCw, Camera, X, Image } from 'lucide-react';

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
  defaultMealType?: MealType;
}

export default function TextEntry({ apiKey, onSubmit, onCancel, defaultMealType = 'snack' }: TextEntryProps) {
  const [description, setDescription] = useState('');
  const [imageData, setImageData] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [parsedFoods, setParsedFoods] = useState<ParsedFood[]>([]);
  const [questions, setQuestions] = useState<ClarifyingQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [mealType, setMealType] = useState<MealType>(defaultMealType);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'input' | 'questions' | 'review'>('input');
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [reAnalyzingIndex, setReAnalyzingIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageData(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setImageData(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const analyzeText = async (text: string, previousAnswers?: Record<string, string>) => {
    setIsAnalyzing(true);
    setError(null);

    try {
      // Choose endpoint based on whether we have an image
      const endpoint = imageData ? '/api/analyze-food' : '/api/analyze-text';
      const body = imageData
        ? {
            imageData,
            apiKey,
            additionalContext: text,
            answers: previousAnswers,
          }
        : {
            description: text,
            apiKey,
            answers: previousAnswers,
          };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to analyze');
      }

      // Handle response from analyze-food (single food) vs analyze-text (multiple foods)
      if (imageData && data.foodName) {
        // analyze-food returns single food object
        setParsedFoods([{
          name: data.foodName,
          nutrition: data.nutrition,
          confidence: data.confidence,
          portion: data.portionSize,
        }]);
        setStep('review');
      } else if (data.foods) {
        // analyze-text returns array
        setParsedFoods(data.foods || []);

        if (data.clarifyingQuestions && data.clarifyingQuestions.length > 0) {
          setQuestions(data.clarifyingQuestions);
          setStep('questions');
        } else {
          setStep('review');
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSubmitDescription = (e: React.FormEvent) => {
    e.preventDefault();
    if (description.trim() || imageData) {
      analyzeText(description);
    }
  };

  const reAnalyzeIngredient = async (index: number) => {
    const food = parsedFoods[index];
    if (!food) return;

    setReAnalyzingIndex(index);

    try {
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

    const allAnswered = questions.every(q => newAnswers[q.id]);
    if (allAnswered) {
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
    setImageData(null);
    setParsedFoods([]);
    setQuestions([]);
    setAnswers({});
    setStep('input');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
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
          </div>

          {/* Optional Photo */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              Add a photo <span className="text-text-secondary font-normal">(optional)</span>
            </label>

            {imageData ? (
              <div className="relative rounded-apple overflow-hidden">
                <img src={imageData} alt="Food" className="w-full h-48 object-cover" />
                <button
                  type="button"
                  onClick={removeImage}
                  className="absolute top-2 right-2 w-8 h-8 bg-black/50 rounded-full flex items-center justify-center hover:bg-black/70 transition-colors"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleImageSelect}
                  className="hidden"
                  id="food-photo"
                />
                <label
                  htmlFor="food-photo"
                  className="flex-1 flex items-center justify-center gap-2 p-4 bg-secondary-bg border-2 border-dashed border-border-light rounded-apple cursor-pointer hover:border-accent-blue hover:bg-accent-blue/5 transition-all"
                >
                  <Camera className="w-5 h-5 text-text-secondary" />
                  <span className="text-sm text-text-secondary">Take photo</span>
                </label>
                <label
                  htmlFor="food-photo"
                  className="flex-1 flex items-center justify-center gap-2 p-4 bg-secondary-bg border-2 border-dashed border-border-light rounded-apple cursor-pointer hover:border-accent-blue hover:bg-accent-blue/5 transition-all"
                >
                  <Image className="w-5 h-5 text-text-secondary" />
                  <span className="text-sm text-text-secondary">Choose photo</span>
                </label>
              </div>
            )}

            <p className="mt-2 text-xs text-text-secondary">
              A photo helps AI identify portions and ingredients more accurately.
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
              disabled={(!description.trim() && !imageData) || isAnalyzing}
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
          {/* Show image if provided */}
          {imageData && (
            <div className="rounded-apple overflow-hidden">
              <img src={imageData} alt="Food" className="w-full h-32 object-cover" />
            </div>
          )}

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
            {/* Total at top */}
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

            {/* Simple list */}
            <div className="space-y-2">
              {parsedFoods.map((food, index) => {
                const isExpanded = expandedIndex === index;
                return (
                  <div key={index} className="rounded-apple overflow-hidden">
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

                    {isExpanded && (
                      <div className="px-3 pb-3 bg-secondary-bg border-t border-gray-200">
                        <div className="pt-2 space-y-2">
                          {food.portion && (
                            <div className="flex justify-between text-sm">
                              <span className="text-text-secondary">Portion</span>
                              <span className="text-text-primary">
                                {food.portion}{food.portionGrams ? ` (${food.portionGrams}g)` : ''}
                              </span>
                            </div>
                          )}
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
