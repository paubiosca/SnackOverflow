'use client';

import { useState } from 'react';
import { Gender, ActivityLevel, UserProfile } from '@/lib/types';
import { calculateBMR, calculateTDEE } from '@/lib/calories';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { ArrowLeft, ArrowRight, Loader2, Check, Sparkles } from 'lucide-react';

type OnboardingStep =
  | 'gender'
  | 'age'
  | 'height'
  | 'weight'
  | 'activity'
  | 'eating_habits'
  | 'meal_frequency'
  | 'snacking'
  | 'drinks'
  | 'goal'
  | 'pace'
  | 'analyzing'
  | 'results';

interface OnboardingData {
  gender: Gender | null;
  ageRange: string | null;
  age: number | null;
  heightCm: number | null;
  weightKg: number | null;
  activityLevel: ActivityLevel | null;
  eatingHabits: string | null;
  mealFrequency: string | null;
  snackingHabit: string | null;
  drinkHabits: string | null;
  goalType: 'lose' | 'maintain' | 'gain' | null;
  weeklyGoal: number | null;
}

interface AIAnalysis {
  estimatedCurrentIntake: number;
  recommendedIntake: number;
  explanation: string;
  tips: string[];
}

interface ButtonOnboardingProps {
  onComplete: (profileData: Omit<UserProfile, 'id' | 'createdAt'>) => Promise<void>;
  isSubmitting: boolean;
  apiKey?: string;
}

const STEPS: OnboardingStep[] = [
  'gender',
  'age',
  'height',
  'weight',
  'activity',
  'eating_habits',
  'meal_frequency',
  'snacking',
  'drinks',
  'goal',
  'pace',
  'analyzing',
  'results'
];

export default function ButtonOnboarding({ onComplete, isSubmitting, apiKey }: ButtonOnboardingProps) {
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('gender');
  const [data, setData] = useState<OnboardingData>({
    gender: null,
    ageRange: null,
    age: null,
    heightCm: null,
    weightKg: null,
    activityLevel: null,
    eatingHabits: null,
    mealFrequency: null,
    snackingHabit: null,
    drinkHabits: null,
    goalType: null,
    weeklyGoal: null,
  });
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [customHeight, setCustomHeight] = useState('');
  const [customWeight, setCustomWeight] = useState('');
  const [customAge, setCustomAge] = useState('');

  const currentStepIndex = STEPS.indexOf(currentStep);
  const progress = ((currentStepIndex) / (STEPS.length - 1)) * 100;

  const goToNextStep = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < STEPS.length) {
      setCurrentStep(STEPS[nextIndex]);
    }
  };

  const goToPrevStep = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(STEPS[prevIndex]);
    }
  };

  const selectOption = <K extends keyof OnboardingData>(key: K, value: OnboardingData[K]) => {
    setData(prev => ({ ...prev, [key]: value }));
    // Auto-advance after selection (with slight delay for visual feedback)
    setTimeout(() => goToNextStep(), 200);
  };

  const analyzeAndRecommend = async () => {
    setCurrentStep('analyzing');

    // Calculate basic metrics
    const age = data.age || getAgeFromRange(data.ageRange || '25-34');
    const bmr = calculateBMR(data.weightKg!, data.heightCm!, age, data.gender!);
    const tdee = calculateTDEE(data.weightKg!, data.heightCm!, age, data.gender!, data.activityLevel!);

    try {
      const response = await fetch('/api/onboarding-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          age,
          bmr,
          tdee,
          apiKey,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setAnalysis(result);
      } else {
        // Fallback calculation without AI
        setAnalysis(calculateFallbackAnalysis(data, bmr, tdee));
      }
    } catch (error) {
      console.error('Analysis error:', error);
      setAnalysis(calculateFallbackAnalysis(data, bmr, tdee));
    }

    setCurrentStep('results');
  };

  const calculateFallbackAnalysis = (
    data: OnboardingData,
    bmr: number,
    tdee: number
  ): AIAnalysis => {
    // Estimate current intake based on eating habits
    let intakeMultiplier = 1.0;

    if (data.eatingHabits === 'large_portions') intakeMultiplier += 0.2;
    if (data.eatingHabits === 'often_overeat') intakeMultiplier += 0.3;
    if (data.mealFrequency === 'irregular') intakeMultiplier += 0.1;
    if (data.snackingHabit === 'frequent') intakeMultiplier += 0.15;
    if (data.snackingHabit === 'constant') intakeMultiplier += 0.25;
    if (data.drinkHabits === 'sugary_drinks') intakeMultiplier += 0.15;
    if (data.drinkHabits === 'alcohol_regular') intakeMultiplier += 0.1;

    const estimatedCurrentIntake = Math.round(tdee * intakeMultiplier);

    // Calculate recommended based on goal
    let deficit = 0;
    if (data.goalType === 'lose') {
      deficit = (data.weeklyGoal || 0.5) * 1100; // ~1100 cal deficit per 0.5kg/week
    } else if (data.goalType === 'gain') {
      deficit = -(data.weeklyGoal || 0.25) * 1100;
    }

    const recommendedIntake = Math.max(1200, Math.round(tdee - deficit));

    return {
      estimatedCurrentIntake,
      recommendedIntake,
      explanation: `Based on your profile and habits, you're likely eating around ${estimatedCurrentIntake.toLocaleString()} calories daily. To reach your goal, we recommend ${recommendedIntake.toLocaleString()} calories per day.`,
      tips: [
        data.snackingHabit === 'frequent' || data.snackingHabit === 'constant'
          ? 'Try to be more mindful of snacking between meals'
          : 'Your snacking habits seem balanced',
        data.drinkHabits === 'sugary_drinks'
          ? 'Switching to water or unsweetened drinks could save 200-400 calories daily'
          : 'Good job keeping liquid calories in check',
        'Track consistently for the first 2 weeks to get accurate data',
      ],
    };
  };

  const getAgeFromRange = (range: string): number => {
    const ages: Record<string, number> = {
      '18-24': 21,
      '25-34': 30,
      '35-44': 40,
      '45-54': 50,
      '55-64': 60,
      '65+': 68,
    };
    return ages[range] || 30;
  };

  const handleComplete = async () => {
    const age = data.age || getAgeFromRange(data.ageRange || '25-34');
    const deficit = data.goalType === 'lose'
      ? -Math.round((data.weeklyGoal || 0.5) * 7700 / 7)
      : data.goalType === 'gain'
        ? Math.round((data.weeklyGoal || 0.25) * 7700 / 7)
        : 0;

    const profileData: Omit<UserProfile, 'id' | 'createdAt'> = {
      name: 'User',
      age,
      gender: data.gender!,
      heightCm: data.heightCm!,
      weightKg: data.weightKg!,
      activityApproach: 'static',
      activityLevel: data.activityLevel!,
      goalType: 'deficit_fixed',
      goalValue: deficit,
      dailyWaterGoalMl: 2000,
      activeCalorieGoal: 450,
      openaiApiKey: apiKey,
    };

    await onComplete(profileData);
  };

  const renderStep = () => {
    switch (currentStep) {
      case 'gender':
        return (
          <StepContainer
            title="What's your biological sex?"
            subtitle="This helps us calculate your metabolism accurately"
          >
            <div className="grid grid-cols-2 gap-4">
              <OptionButton
                selected={data.gender === 'male'}
                onClick={() => selectOption('gender', 'male')}
                icon="👨"
                label="Male"
              />
              <OptionButton
                selected={data.gender === 'female'}
                onClick={() => selectOption('gender', 'female')}
                icon="👩"
                label="Female"
              />
            </div>
          </StepContainer>
        );

      case 'age':
        return (
          <StepContainer
            title="What's your age?"
            subtitle="Metabolism changes with age"
          >
            <div className="grid grid-cols-2 gap-3">
              {['18-24', '25-34', '35-44', '45-54', '55-64', '65+'].map((range) => (
                <OptionButton
                  key={range}
                  selected={data.ageRange === range}
                  onClick={() => selectOption('ageRange', range)}
                  label={range}
                />
              ))}
            </div>
            <div className="mt-4">
              <p className="text-sm text-text-secondary mb-2">Or enter exact age:</p>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={customAge}
                  onChange={(e) => setCustomAge(e.target.value)}
                  placeholder="e.g., 28"
                  className="flex-1 px-4 py-3 rounded-xl border border-border-light focus:border-accent-blue focus:outline-none"
                />
                <Button
                  onClick={() => {
                    const age = parseInt(customAge);
                    if (age >= 18 && age <= 100) {
                      setData(prev => ({ ...prev, age, ageRange: null }));
                      goToNextStep();
                    }
                  }}
                  disabled={!customAge || parseInt(customAge) < 18}
                >
                  Next
                </Button>
              </div>
            </div>
          </StepContainer>
        );

      case 'height':
        return (
          <StepContainer
            title="What's your height?"
            subtitle="Select or enter your height in cm"
          >
            <div className="grid grid-cols-3 gap-3">
              {[155, 160, 165, 170, 175, 180, 185, 190, 195].map((height) => (
                <OptionButton
                  key={height}
                  selected={data.heightCm === height}
                  onClick={() => selectOption('heightCm', height)}
                  label={`${height} cm`}
                  sublabel={`${Math.floor(height / 30.48)}'${Math.round((height % 30.48) / 2.54)}"`}
                />
              ))}
            </div>
            <div className="mt-4">
              <p className="text-sm text-text-secondary mb-2">Different height?</p>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={customHeight}
                  onChange={(e) => setCustomHeight(e.target.value)}
                  placeholder="Height in cm"
                  className="flex-1 px-4 py-3 rounded-xl border border-border-light focus:border-accent-blue focus:outline-none"
                />
                <Button
                  onClick={() => {
                    const height = parseInt(customHeight);
                    if (height >= 100 && height <= 250) {
                      selectOption('heightCm', height);
                    }
                  }}
                  disabled={!customHeight}
                >
                  Next
                </Button>
              </div>
            </div>
          </StepContainer>
        );

      case 'weight':
        return (
          <StepContainer
            title="What's your current weight?"
            subtitle="Enter your weight in kg"
          >
            <div className="grid grid-cols-4 gap-3">
              {[55, 60, 65, 70, 75, 80, 85, 90, 95, 100, 105, 110].map((weight) => (
                <OptionButton
                  key={weight}
                  selected={data.weightKg === weight}
                  onClick={() => selectOption('weightKg', weight)}
                  label={`${weight}`}
                  sublabel="kg"
                  compact
                />
              ))}
            </div>
            <div className="mt-4">
              <p className="text-sm text-text-secondary mb-2">Different weight?</p>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={customWeight}
                  onChange={(e) => setCustomWeight(e.target.value)}
                  placeholder="Weight in kg"
                  className="flex-1 px-4 py-3 rounded-xl border border-border-light focus:border-accent-blue focus:outline-none"
                />
                <Button
                  onClick={() => {
                    const weight = parseFloat(customWeight);
                    if (weight >= 30 && weight <= 300) {
                      selectOption('weightKg', weight);
                    }
                  }}
                  disabled={!customWeight}
                >
                  Next
                </Button>
              </div>
            </div>
          </StepContainer>
        );

      case 'activity':
        return (
          <StepContainer
            title="How active are you?"
            subtitle="Be honest - this affects your calorie calculation"
          >
            <div className="space-y-3">
              <OptionButton
                selected={data.activityLevel === 'sedentary'}
                onClick={() => selectOption('activityLevel', 'sedentary')}
                icon="🪑"
                label="Sedentary"
                description="Desk job, little exercise"
                fullWidth
              />
              <OptionButton
                selected={data.activityLevel === 'light'}
                onClick={() => selectOption('activityLevel', 'light')}
                icon="🚶"
                label="Lightly Active"
                description="Light exercise 1-3 days/week"
                fullWidth
              />
              <OptionButton
                selected={data.activityLevel === 'moderate'}
                onClick={() => selectOption('activityLevel', 'moderate')}
                icon="🏃"
                label="Moderately Active"
                description="Moderate exercise 3-5 days/week"
                fullWidth
              />
              <OptionButton
                selected={data.activityLevel === 'active'}
                onClick={() => selectOption('activityLevel', 'active')}
                icon="💪"
                label="Very Active"
                description="Hard exercise 6-7 days/week"
                fullWidth
              />
              <OptionButton
                selected={data.activityLevel === 'very_active'}
                onClick={() => selectOption('activityLevel', 'very_active')}
                icon="🏋️"
                label="Extra Active"
                description="Very hard exercise, physical job"
                fullWidth
              />
            </div>
          </StepContainer>
        );

      case 'eating_habits':
        return (
          <StepContainer
            title="How would you describe your portions?"
            subtitle="This helps estimate your current intake"
          >
            <div className="space-y-3">
              <OptionButton
                selected={data.eatingHabits === 'small_portions'}
                onClick={() => selectOption('eatingHabits', 'small_portions')}
                icon="🥗"
                label="Small portions"
                description="I often leave food on my plate"
                fullWidth
              />
              <OptionButton
                selected={data.eatingHabits === 'normal_portions'}
                onClick={() => selectOption('eatingHabits', 'normal_portions')}
                icon="🍽️"
                label="Normal portions"
                description="I eat until I'm satisfied"
                fullWidth
              />
              <OptionButton
                selected={data.eatingHabits === 'large_portions'}
                onClick={() => selectOption('eatingHabits', 'large_portions')}
                icon="🍛"
                label="Large portions"
                description="I tend to eat a lot in one sitting"
                fullWidth
              />
              <OptionButton
                selected={data.eatingHabits === 'often_overeat'}
                onClick={() => selectOption('eatingHabits', 'often_overeat')}
                icon="😅"
                label="Often overeat"
                description="I frequently eat past the point of fullness"
                fullWidth
              />
            </div>
          </StepContainer>
        );

      case 'meal_frequency':
        return (
          <StepContainer
            title="How many meals do you typically eat?"
            subtitle="Including main meals, not snacks"
          >
            <div className="space-y-3">
              <OptionButton
                selected={data.mealFrequency === '1-2'}
                onClick={() => selectOption('mealFrequency', '1-2')}
                icon="1️⃣"
                label="1-2 meals"
                description="I skip meals often"
                fullWidth
              />
              <OptionButton
                selected={data.mealFrequency === '3'}
                onClick={() => selectOption('mealFrequency', '3')}
                icon="3️⃣"
                label="3 meals"
                description="Regular breakfast, lunch, dinner"
                fullWidth
              />
              <OptionButton
                selected={data.mealFrequency === '4+'}
                onClick={() => selectOption('mealFrequency', '4+')}
                icon="🔄"
                label="4+ meals"
                description="Multiple smaller meals throughout the day"
                fullWidth
              />
              <OptionButton
                selected={data.mealFrequency === 'irregular'}
                onClick={() => selectOption('mealFrequency', 'irregular')}
                icon="❓"
                label="Irregular"
                description="No consistent pattern"
                fullWidth
              />
            </div>
          </StepContainer>
        );

      case 'snacking':
        return (
          <StepContainer
            title="How often do you snack?"
            subtitle="Between your main meals"
          >
            <div className="space-y-3">
              <OptionButton
                selected={data.snackingHabit === 'rarely'}
                onClick={() => selectOption('snackingHabit', 'rarely')}
                icon="🚫"
                label="Rarely"
                description="Almost never snack between meals"
                fullWidth
              />
              <OptionButton
                selected={data.snackingHabit === 'sometimes'}
                onClick={() => selectOption('snackingHabit', 'sometimes')}
                icon="🍎"
                label="Sometimes"
                description="1-2 snacks on most days"
                fullWidth
              />
              <OptionButton
                selected={data.snackingHabit === 'frequent'}
                onClick={() => selectOption('snackingHabit', 'frequent')}
                icon="🍪"
                label="Frequently"
                description="Multiple snacks throughout the day"
                fullWidth
              />
              <OptionButton
                selected={data.snackingHabit === 'constant'}
                onClick={() => selectOption('snackingHabit', 'constant')}
                icon="🍿"
                label="Constantly"
                description="I'm always snacking"
                fullWidth
              />
            </div>
          </StepContainer>
        );

      case 'drinks':
        return (
          <StepContainer
            title="What do you usually drink?"
            subtitle="Beverages can add significant calories"
          >
            <div className="space-y-3">
              <OptionButton
                selected={data.drinkHabits === 'water_mostly'}
                onClick={() => selectOption('drinkHabits', 'water_mostly')}
                icon="💧"
                label="Mostly water"
                description="Water, tea, black coffee"
                fullWidth
              />
              <OptionButton
                selected={data.drinkHabits === 'some_calories'}
                onClick={() => selectOption('drinkHabits', 'some_calories')}
                icon="☕"
                label="Some caloric drinks"
                description="Coffee with milk, occasional juice"
                fullWidth
              />
              <OptionButton
                selected={data.drinkHabits === 'sugary_drinks'}
                onClick={() => selectOption('drinkHabits', 'sugary_drinks')}
                icon="🥤"
                label="Sugary drinks regularly"
                description="Soda, energy drinks, sweet coffee"
                fullWidth
              />
              <OptionButton
                selected={data.drinkHabits === 'alcohol_regular'}
                onClick={() => selectOption('drinkHabits', 'alcohol_regular')}
                icon="🍺"
                label="Regular alcohol"
                description="Beer, wine, or cocktails frequently"
                fullWidth
              />
            </div>
          </StepContainer>
        );

      case 'goal':
        return (
          <StepContainer
            title="What's your goal?"
            subtitle="We'll customize your plan based on this"
          >
            <div className="space-y-3">
              <OptionButton
                selected={data.goalType === 'lose'}
                onClick={() => selectOption('goalType', 'lose')}
                icon="📉"
                label="Lose weight"
                description="Create a calorie deficit to lose fat"
                fullWidth
              />
              <OptionButton
                selected={data.goalType === 'maintain'}
                onClick={() => {
                  setData(prev => ({ ...prev, goalType: 'maintain', weeklyGoal: 0 }));
                  analyzeAndRecommend();
                }}
                icon="⚖️"
                label="Maintain weight"
                description="Keep my current weight"
                fullWidth
              />
              <OptionButton
                selected={data.goalType === 'gain'}
                onClick={() => selectOption('goalType', 'gain')}
                icon="📈"
                label="Gain weight"
                description="Build muscle or increase weight"
                fullWidth
              />
            </div>
          </StepContainer>
        );

      case 'pace':
        return (
          <StepContainer
            title={data.goalType === 'lose' ? "How fast do you want to lose weight?" : "How fast do you want to gain weight?"}
            subtitle="Slower is more sustainable and healthier"
          >
            <div className="space-y-3">
              {data.goalType === 'lose' ? (
                <>
                  <OptionButton
                    selected={data.weeklyGoal === 0.25}
                    onClick={() => {
                      setData(prev => ({ ...prev, weeklyGoal: 0.25 }));
                      setTimeout(analyzeAndRecommend, 200);
                    }}
                    icon="🐢"
                    label="Slow & Steady"
                    description="~0.25 kg per week (recommended)"
                    fullWidth
                  />
                  <OptionButton
                    selected={data.weeklyGoal === 0.5}
                    onClick={() => {
                      setData(prev => ({ ...prev, weeklyGoal: 0.5 }));
                      setTimeout(analyzeAndRecommend, 200);
                    }}
                    icon="🚶"
                    label="Moderate"
                    description="~0.5 kg per week"
                    fullWidth
                  />
                  <OptionButton
                    selected={data.weeklyGoal === 0.75}
                    onClick={() => {
                      setData(prev => ({ ...prev, weeklyGoal: 0.75 }));
                      setTimeout(analyzeAndRecommend, 200);
                    }}
                    icon="🏃"
                    label="Aggressive"
                    description="~0.75 kg per week"
                    fullWidth
                  />
                  <OptionButton
                    selected={data.weeklyGoal === 1}
                    onClick={() => {
                      setData(prev => ({ ...prev, weeklyGoal: 1 }));
                      setTimeout(analyzeAndRecommend, 200);
                    }}
                    icon="🚀"
                    label="Maximum"
                    description="~1 kg per week (challenging)"
                    fullWidth
                  />
                </>
              ) : (
                <>
                  <OptionButton
                    selected={data.weeklyGoal === 0.25}
                    onClick={() => {
                      setData(prev => ({ ...prev, weeklyGoal: 0.25 }));
                      setTimeout(analyzeAndRecommend, 200);
                    }}
                    icon="🐢"
                    label="Lean Gain"
                    description="~0.25 kg per week (minimize fat gain)"
                    fullWidth
                  />
                  <OptionButton
                    selected={data.weeklyGoal === 0.5}
                    onClick={() => {
                      setData(prev => ({ ...prev, weeklyGoal: 0.5 }));
                      setTimeout(analyzeAndRecommend, 200);
                    }}
                    icon="💪"
                    label="Moderate Bulk"
                    description="~0.5 kg per week"
                    fullWidth
                  />
                </>
              )}
            </div>
          </StepContainer>
        );

      case 'analyzing':
        return (
          <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
            <div className="w-16 h-16 bg-accent-blue/10 rounded-full flex items-center justify-center mb-6">
              <Sparkles className="w-8 h-8 text-accent-blue animate-pulse" />
            </div>
            <h2 className="text-2xl font-bold text-text-primary mb-2">Analyzing your profile...</h2>
            <p className="text-text-secondary">Using AI to estimate your current intake and create a personalized plan</p>
            <Loader2 className="w-6 h-6 text-accent-blue animate-spin mt-8" />
          </div>
        );

      case 'results':
        if (!analysis) return null;
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-text-primary">Your Personalized Plan</h2>
            </div>

            {/* Current vs Recommended */}
            <Card className="bg-gradient-to-br from-accent-blue/5 to-accent-blue/10 border-accent-blue/20">
              <div className="grid grid-cols-2 gap-4 text-center">
                <div>
                  <p className="text-sm text-text-secondary mb-1">Estimated Current</p>
                  <p className="text-3xl font-bold text-text-primary">
                    {analysis.estimatedCurrentIntake.toLocaleString()}
                  </p>
                  <p className="text-sm text-text-secondary">cal/day</p>
                </div>
                <div>
                  <p className="text-sm text-text-secondary mb-1">Recommended</p>
                  <p className="text-3xl font-bold text-accent-blue">
                    {analysis.recommendedIntake.toLocaleString()}
                  </p>
                  <p className="text-sm text-text-secondary">cal/day</p>
                </div>
              </div>
              {analysis.estimatedCurrentIntake > analysis.recommendedIntake && (
                <div className="mt-4 pt-4 border-t border-accent-blue/20 text-center">
                  <p className="text-sm text-text-secondary">
                    Daily reduction needed: <span className="font-semibold text-accent-blue">
                      {(analysis.estimatedCurrentIntake - analysis.recommendedIntake).toLocaleString()} cal
                    </span>
                  </p>
                </div>
              )}
            </Card>

            {/* AI Explanation */}
            <Card>
              <h3 className="font-semibold text-text-primary mb-2">How we calculated this</h3>
              <p className="text-text-secondary text-sm">{analysis.explanation}</p>
            </Card>

            {/* Tips */}
            <Card>
              <h3 className="font-semibold text-text-primary mb-3">Tips for success</h3>
              <ul className="space-y-2">
                {analysis.tips.map((tip, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm text-text-secondary">
                    <span className="text-accent-blue mt-0.5">•</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </Card>

            {/* Summary */}
            <Card className="bg-secondary-bg">
              <h3 className="font-semibold text-text-primary mb-3">Your Profile Summary</h3>
              <div className="grid grid-cols-2 gap-y-2 text-sm">
                <span className="text-text-secondary">Gender:</span>
                <span className="text-text-primary capitalize">{data.gender}</span>
                <span className="text-text-secondary">Age:</span>
                <span className="text-text-primary">{data.age || data.ageRange}</span>
                <span className="text-text-secondary">Height:</span>
                <span className="text-text-primary">{data.heightCm} cm</span>
                <span className="text-text-secondary">Weight:</span>
                <span className="text-text-primary">{data.weightKg} kg</span>
                <span className="text-text-secondary">Activity:</span>
                <span className="text-text-primary capitalize">{data.activityLevel?.replace('_', ' ')}</span>
                <span className="text-text-secondary">Goal:</span>
                <span className="text-text-primary capitalize">
                  {data.goalType === 'lose' ? `Lose ${data.weeklyGoal} kg/week` :
                   data.goalType === 'gain' ? `Gain ${data.weeklyGoal} kg/week` : 'Maintain weight'}
                </span>
              </div>
            </Card>

            <Button
              size="lg"
              fullWidth
              onClick={handleComplete}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  Creating Profile...
                </>
              ) : (
                "Start Tracking!"
              )}
            </Button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Progress Bar */}
      {currentStep !== 'analyzing' && currentStep !== 'results' && (
        <div className="fixed top-0 left-0 right-0 h-1 bg-gray-100 z-50">
          <div
            className="h-full bg-accent-blue transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Header with back button */}
      {currentStep !== 'analyzing' && currentStep !== 'results' && currentStepIndex > 0 && (
        <div className="fixed top-4 left-4 z-40">
          <button
            onClick={goToPrevStep}
            className="w-10 h-10 rounded-full bg-white shadow-md flex items-center justify-center hover:bg-gray-50 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-text-secondary" />
          </button>
        </div>
      )}

      {/* Content */}
      <div className="px-4 pt-16 pb-8 max-w-md mx-auto">
        {renderStep()}
      </div>
    </div>
  );
}

// Helper Components
interface StepContainerProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}

function StepContainer({ title, subtitle, children }: StepContainerProps) {
  return (
    <div className="animate-fade-in">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-text-primary mb-2">{title}</h2>
        <p className="text-text-secondary">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

interface OptionButtonProps {
  selected: boolean;
  onClick: () => void;
  icon?: string;
  label: string;
  sublabel?: string;
  description?: string;
  fullWidth?: boolean;
  compact?: boolean;
}

function OptionButton({
  selected,
  onClick,
  icon,
  label,
  sublabel,
  description,
  fullWidth,
  compact
}: OptionButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`
        ${fullWidth ? 'w-full' : ''}
        ${compact ? 'p-3' : 'p-4'}
        rounded-2xl border-2 transition-all text-left
        ${selected
          ? 'border-accent-blue bg-accent-blue/5'
          : 'border-border-light hover:border-gray-300 bg-white'
        }
      `}
    >
      <div className={`flex ${fullWidth ? 'items-start gap-3' : 'flex-col items-center text-center'}`}>
        {icon && <span className={`${compact ? 'text-xl' : 'text-2xl'} ${!fullWidth && 'mb-1'}`}>{icon}</span>}
        <div>
          <p className={`font-medium text-text-primary ${compact ? 'text-sm' : ''}`}>{label}</p>
          {sublabel && <p className="text-xs text-text-secondary">{sublabel}</p>}
          {description && <p className="text-sm text-text-secondary mt-0.5">{description}</p>}
        </div>
      </div>
    </button>
  );
}
