'use client';

import { useState } from 'react';
import { MealType, NutritionInfo, MEAL_LABELS } from '@/lib/types';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';

interface ParsedFood {
  name: string;
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
              <span className="text-xl">🤔</span>
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

          {/* Parsed foods */}
          <Card>
            <h3 className="font-semibold text-text-primary mb-3">
              I found {parsedFoods.length} item{parsedFoods.length > 1 ? 's' : ''}
            </h3>
            <div className="space-y-3">
              {parsedFoods.map((food, index) => (
                <div
                  key={index}
                  className="p-3 bg-secondary-bg rounded-apple"
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-medium text-text-primary">{food.name}</span>
                    <span className="text-accent-blue font-semibold">{food.nutrition.calories} kcal</span>
                  </div>
                  <div className="flex gap-3 text-xs text-text-secondary">
                    <span>P: {food.nutrition.protein}g</span>
                    <span>C: {food.nutrition.carbs}g</span>
                    <span>F: {food.nutrition.fat}g</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Total */}
            <div className="mt-4 pt-3 border-t border-border-light">
              <div className="flex justify-between items-center">
                <span className="font-medium text-text-primary">Total</span>
                <span className="text-lg font-bold text-accent-blue">
                  {parsedFoods.reduce((sum, f) => sum + f.nutrition.calories, 0)} kcal
                </span>
              </div>
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
