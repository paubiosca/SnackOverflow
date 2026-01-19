'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useProfile } from '@/hooks/useProfile';
import { useFoodEntries } from '@/hooks/useFoodEntries';
import { AIFoodAnalysis, MealType, NutritionInfo } from '@/lib/types';
import BottomNav from '@/components/ui/BottomNav';
import Card from '@/components/ui/Card';
import CameraCapture from '@/components/food/CameraCapture';
import AIAnalysis from '@/components/food/AIAnalysis';
import ManualEntry from '@/components/food/ManualEntry';
import TextEntry from '@/components/food/TextEntry';
import { MessageSquare, Camera, PenLine, AlertTriangle, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';

type Mode = 'select' | 'camera' | 'analyzing' | 'results' | 'manual' | 'text';

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
  // Use local date to avoid timezone issues
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function AddFood() {
  const router = useRouter();
  const { profile } = useProfile();
  const { add } = useFoodEntries();

  const [mode, setMode] = useState<Mode>('select');
  const [imageData, setImageData] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AIFoodAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRefining, setIsRefining] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [selectedMealType, setSelectedMealType] = useState<MealType>('snack');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const goToPreviousDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() - 1);
    setSelectedDate(newDate);
  };

  const goToNextDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + 1);
    // Don't allow future dates
    if (newDate <= new Date()) {
      setSelectedDate(newDate);
    }
  };

  const isToday = selectedDate.toDateString() === new Date().toDateString();

  const analyzeImage = async (image: string, prevAnalysis?: AIFoodAnalysis, currentAnswers?: Record<string, string>) => {
    if (!profile?.openaiApiKey) {
      setError('Please add your OpenAI API key in Settings to use AI analysis');
      setMode('select');
      return;
    }

    setMode('analyzing');
    setError(null);

    try {
      const response = await fetch('/api/analyze-food', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageData: image,
          apiKey: profile.openaiApiKey,
          previousAnalysis: prevAnalysis,
          answers: currentAnswers,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to analyze image');
      }

      setAnalysis(data);
      setMode('results');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze image');
      setMode('select');
    }
  };

  const handleCapture = (image: string) => {
    setImageData(image);
    analyzeImage(image);
  };

  const handleAnswerQuestion = async (questionId: string, answer: string) => {
    const newAnswers = { ...answers, [questionId]: answer };
    setAnswers(newAnswers);

    // Check if all questions are answered
    if (analysis?.clarifyingQuestions) {
      const allAnswered = analysis.clarifyingQuestions.every(
        q => newAnswers[q.id]
      );

      if (allAnswered && imageData) {
        setIsRefining(true);
        await analyzeImage(imageData, analysis, newAnswers);
        setIsRefining(false);
      }
    }
  };

  const handleConfirm = (confirmedAnalysis: AIFoodAnalysis) => {
    add({
      name: confirmedAnalysis.foodName,
      mealType: selectedMealType,
      calories: confirmedAnalysis.nutrition.calories,
      protein: confirmedAnalysis.nutrition.protein,
      carbs: confirmedAnalysis.nutrition.carbs,
      fat: confirmedAnalysis.nutrition.fat,
      isManualEntry: false,
      aiConfidence: confirmedAnalysis.confidence,
      photoUrl: imageData || undefined,
      date: getDateString(selectedDate),
    });
    router.push('/');
  };

  const handleManualSubmit = (data: { name: string; mealType: MealType; nutrition: NutritionInfo }) => {
    add({
      name: data.name,
      mealType: data.mealType,
      calories: data.nutrition.calories,
      protein: data.nutrition.protein,
      carbs: data.nutrition.carbs,
      fat: data.nutrition.fat,
      isManualEntry: true,
      date: getDateString(selectedDate),
    });
    router.push('/');
  };

  const handleTextSubmit = (foods: { name: string; mealType: MealType; nutrition: NutritionInfo }[]) => {
    foods.forEach(food => {
      add({
        name: food.name,
        mealType: food.mealType,
        calories: food.nutrition.calories,
        protein: food.nutrition.protein,
        carbs: food.nutrition.carbs,
        fat: food.nutrition.fat,
        isManualEntry: false,
        date: getDateString(selectedDate),
      });
    });
    router.push('/');
  };

  const handleRetry = () => {
    setImageData(null);
    setAnalysis(null);
    setAnswers({});
    setMode('camera');
  };

  const handleCancel = () => {
    setImageData(null);
    setAnalysis(null);
    setAnswers({});
    setError(null);
    setMode('select');
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
            {!isToday && (
              <span className="text-xs text-text-secondary">
                ({selectedDate.toLocaleDateString()})
              </span>
            )}
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

            <button
              onClick={() => setMode('text')}
              className="w-full p-6 bg-white rounded-apple-lg shadow-apple hover:shadow-apple-lg transition-shadow"
            >
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-accent-purple/10 rounded-full flex items-center justify-center">
                  <MessageSquare className="w-8 h-8 text-accent-purple" />
                </div>
                <div className="text-left">
                  <h3 className="font-semibold text-text-primary text-lg">Describe Your Meal</h3>
                  <p className="text-text-secondary text-sm">
                    Tell AI what you ate in your own words
                  </p>
                </div>
              </div>
            </button>

            <button
              onClick={() => setMode('camera')}
              className="w-full p-6 bg-white rounded-apple-lg shadow-apple hover:shadow-apple-lg transition-shadow"
            >
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-accent-blue/10 rounded-full flex items-center justify-center">
                  <Camera className="w-8 h-8 text-accent-blue" />
                </div>
                <div className="text-left">
                  <h3 className="font-semibold text-text-primary text-lg">Snap a Photo</h3>
                  <p className="text-text-secondary text-sm">
                    AI will analyze your food automatically
                  </p>
                </div>
              </div>
            </button>

            <button
              onClick={() => setMode('manual')}
              className="w-full p-6 bg-white rounded-apple-lg shadow-apple hover:shadow-apple-lg transition-shadow"
            >
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-accent-green/10 rounded-full flex items-center justify-center">
                  <PenLine className="w-8 h-8 text-accent-green" />
                </div>
                <div className="text-left">
                  <h3 className="font-semibold text-text-primary text-lg">Enter Manually</h3>
                  <p className="text-text-secondary text-sm">
                    Type in the food and nutrition info
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
                      Add your OpenAI API key in Profile to enable photo analysis
                    </p>
                  </div>
                </div>
              </Card>
            )}
          </div>
        )}

        {/* Mode: Camera */}
        {mode === 'camera' && (
          <CameraCapture onCapture={handleCapture} onCancel={handleCancel} />
        )}

        {/* Mode: Analyzing */}
        {mode === 'analyzing' && (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 border-4 border-accent-blue border-t-transparent rounded-full animate-spin mb-6" />
            <h2 className="text-xl font-semibold text-text-primary mb-2">Analyzing your food...</h2>
            <p className="text-text-secondary text-center">
              Our AI is identifying ingredients and calculating nutrition
            </p>
          </div>
        )}

        {/* Mode: Results */}
        {mode === 'results' && analysis && imageData && (
          <div className="space-y-4">
            {/* Meal type selector */}
            <Card>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Add to which meal?
              </label>
              <div className="grid grid-cols-4 gap-2">
                {(['breakfast', 'lunch', 'dinner', 'snack'] as MealType[]).map((type) => (
                  <button
                    key={type}
                    onClick={() => setSelectedMealType(type)}
                    className={`py-2 px-2 text-xs rounded-apple border-2 transition-all capitalize ${
                      selectedMealType === type
                        ? 'border-accent-blue bg-blue-50 text-accent-blue'
                        : 'border-border-light text-text-secondary'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </Card>

            <AIAnalysis
              imageData={imageData}
              analysis={analysis}
              onConfirm={handleConfirm}
              onRetry={handleRetry}
              onCancel={handleCancel}
              isRefining={isRefining}
              onAnswerQuestion={handleAnswerQuestion}
            />
          </div>
        )}

        {/* Mode: Manual */}
        {mode === 'manual' && (
          <ManualEntry onSubmit={handleManualSubmit} onCancel={handleCancel} />
        )}

        {/* Mode: Text */}
        {mode === 'text' && profile?.openaiApiKey && (
          <TextEntry
            apiKey={profile.openaiApiKey}
            onSubmit={handleTextSubmit}
            onCancel={handleCancel}
          />
        )}
      </div>

      <BottomNav />
    </main>
  );
}
