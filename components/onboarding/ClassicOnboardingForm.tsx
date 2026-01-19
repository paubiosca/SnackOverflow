'use client';

import { useState } from 'react';
import {
  Gender,
  ActivityLevel,
  ActivityApproach,
  GoalType,
  ACTIVITY_LABELS,
  ACTIVITY_APPROACH_LABELS,
  UserProfile,
} from '@/lib/types';
import { calculateBaseCalorieGoal, calculateBMR, calculateTDEE } from '@/lib/calories';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Card from '@/components/ui/Card';

type Step = 'profile' | 'activity_approach' | 'activity_level' | 'active_calorie_goal' | 'goal' | 'apikey';

interface ClassicOnboardingFormProps {
  onComplete: (profileData: Omit<UserProfile, 'id' | 'createdAt'>) => Promise<void>;
  isSubmitting: boolean;
}

export default function ClassicOnboardingForm({ onComplete, isSubmitting }: ClassicOnboardingFormProps) {
  const [step, setStep] = useState<Step>('profile');

  // Form state
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<Gender>('male');
  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [activityApproach, setActivityApproach] = useState<ActivityApproach>('static');
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>('moderate');
  const [activeCalorieGoal, setActiveCalorieGoal] = useState(450);
  const [goalType, setGoalType] = useState<GoalType>('deficit_fixed');
  const [goalValue, setGoalValue] = useState<number | null>(-500);
  const [openaiApiKey, setOpenaiApiKey] = useState('');

  const handleGoalTypeChange = (type: GoalType) => {
    setGoalType(type);
    setGoalValue(type === 'deficit_fixed' ? -500 : 0.5);
  };

  const handleActivityApproachSelect = (approach: ActivityApproach) => {
    setActivityApproach(approach);
    if (approach === 'static') {
      setStep('activity_level');
    } else {
      setStep('active_calorie_goal');
    }
  };

  const handleComplete = async () => {
    const profileData: Omit<UserProfile, 'id' | 'createdAt'> = {
      name,
      age: parseInt(age),
      gender,
      heightCm: parseFloat(heightCm),
      weightKg: parseFloat(weightKg),
      activityApproach,
      activityLevel: activityApproach === 'static' ? activityLevel : 'sedentary',
      goalType,
      goalValue,
      dailyWaterGoalMl: 2000,
      activeCalorieGoal: activityApproach === 'dynamic' ? activeCalorieGoal : 450,
      openaiApiKey: openaiApiKey || undefined,
    };

    await onComplete(profileData);
  };

  const previewCalories = () => {
    if (!age || !heightCm || !weightKg || goalValue === null) return null;
    const tempProfile: UserProfile = {
      id: '',
      name: '',
      age: parseInt(age),
      gender,
      heightCm: parseFloat(heightCm),
      weightKg: parseFloat(weightKg),
      activityApproach,
      activityLevel: activityApproach === 'static' ? activityLevel : 'sedentary',
      goalType,
      goalValue,
      dailyWaterGoalMl: 2000,
      activeCalorieGoal,
      createdAt: '',
    };
    return calculateBaseCalorieGoal(tempProfile);
  };

  const getBMR = () => {
    if (!age || !heightCm || !weightKg) return null;
    return Math.round(calculateBMR(parseFloat(weightKg), parseFloat(heightCm), parseInt(age), gender));
  };

  const getTDEE = () => {
    if (!age || !heightCm || !weightKg) return null;
    return calculateTDEE(parseFloat(weightKg), parseFloat(heightCm), parseInt(age), gender, 'sedentary');
  };

  return (
    <div className="space-y-6">
      {/* Profile Setup */}
      {step === 'profile' && (
        <>
          <div>
            <h2 className="text-2xl font-bold text-text-primary">About You</h2>
            <p className="text-text-secondary">We need some info to calculate your goals</p>
          </div>

          <Input
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
          />

          <Input
            label="Age"
            type="number"
            value={age}
            onChange={(e) => setAge(e.target.value)}
            placeholder="25"
          />

          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">Gender</label>
            <div className="flex gap-3">
              {(['male', 'female'] as Gender[]).map((g) => (
                <button
                  key={g}
                  onClick={() => setGender(g)}
                  className={`flex-1 py-3 px-4 rounded-apple border-2 transition-all ${
                    gender === g
                      ? 'border-accent-blue bg-blue-50 text-accent-blue'
                      : 'border-border-light text-text-secondary'
                  }`}
                >
                  {g === 'male' ? 'Male' : 'Female'}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Height (cm)"
              type="number"
              value={heightCm}
              onChange={(e) => setHeightCm(e.target.value)}
              placeholder="175"
            />
            <Input
              label="Weight (kg)"
              type="number"
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
              placeholder="70"
            />
          </div>

          <Button
            size="lg"
            fullWidth
            onClick={() => setStep('activity_approach')}
            disabled={!name || !age || !heightCm || !weightKg}
          >
            Continue
          </Button>
        </>
      )}

      {/* Activity Approach Selection */}
      {step === 'activity_approach' && (
        <>
          <div>
            <h2 className="text-2xl font-bold text-text-primary">Activity Tracking</h2>
            <p className="text-text-secondary">How should we handle your daily activity?</p>
          </div>

          {getBMR() && (
            <Card className="bg-secondary-bg">
              <div className="text-center text-sm">
                <span className="text-text-secondary">Your body burns </span>
                <span className="font-bold text-text-primary">{getBMR()} kcal</span>
                <span className="text-text-secondary"> at rest (BMR)</span>
              </div>
            </Card>
          )}

          <div className="space-y-3">
            <button
              onClick={() => handleActivityApproachSelect('static')}
              className="w-full text-left p-4 rounded-apple-lg border-2 border-border-light hover:border-accent-blue transition-all"
            >
              <div className="flex items-start gap-3">
                <div className="text-2xl">📊</div>
                <div>
                  <div className="font-semibold text-text-primary">
                    {ACTIVITY_APPROACH_LABELS.static.name}
                  </div>
                  <div className="text-sm text-text-secondary mt-1">
                    {ACTIVITY_APPROACH_LABELS.static.description}
                  </div>
                  <div className="text-xs text-accent-blue mt-2">
                    Best for: Consistent routine, don&apos;t want to track exercise
                  </div>
                </div>
              </div>
            </button>

            <button
              onClick={() => handleActivityApproachSelect('dynamic')}
              className="w-full text-left p-4 rounded-apple-lg border-2 border-border-light hover:border-accent-blue transition-all"
            >
              <div className="flex items-start gap-3">
                <div className="text-2xl">⌚</div>
                <div>
                  <div className="font-semibold text-text-primary">
                    {ACTIVITY_APPROACH_LABELS.dynamic.name}
                  </div>
                  <div className="text-sm text-text-secondary mt-1">
                    {ACTIVITY_APPROACH_LABELS.dynamic.description}
                  </div>
                  <div className="text-xs text-accent-blue mt-2">
                    Best for: Variable exercise, want workouts to &quot;earn&quot; extra food
                  </div>
                </div>
              </div>
            </button>
          </div>

          <Button variant="secondary" onClick={() => setStep('profile')}>
            Back
          </Button>
        </>
      )}

      {/* Activity Level (for Static approach) */}
      {step === 'activity_level' && (
        <>
          <div>
            <h2 className="text-2xl font-bold text-text-primary">Activity Level</h2>
            <p className="text-text-secondary">How active are you on a typical week?</p>
          </div>

          <div className="space-y-3">
            {(Object.entries(ACTIVITY_LABELS) as [ActivityLevel, string][]).map(([level, label]) => (
              <button
                key={level}
                onClick={() => setActivityLevel(level)}
                className={`w-full text-left p-4 rounded-apple-lg border-2 transition-all ${
                  activityLevel === level
                    ? 'border-accent-blue bg-blue-50'
                    : 'border-border-light hover:border-gray-300'
                }`}
              >
                <span className={activityLevel === level ? 'text-accent-blue font-medium' : 'text-text-primary'}>
                  {label}
                </span>
              </button>
            ))}
          </div>

          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setStep('activity_approach')}>
              Back
            </Button>
            <Button size="lg" fullWidth onClick={() => setStep('goal')}>
              Continue
            </Button>
          </div>
        </>
      )}

      {/* Active Calorie Goal (for Dynamic approach) */}
      {step === 'active_calorie_goal' && (
        <>
          <div>
            <h2 className="text-2xl font-bold text-text-primary">Active Calorie Goal</h2>
            <p className="text-text-secondary">
              Set your daily active calorie target (from Apple Watch or similar)
            </p>
          </div>

          {getTDEE() && (
            <Card className="bg-accent-blue/5 border border-accent-blue/20">
              <div className="text-center">
                <div className="text-sm text-text-secondary">Your sedentary base</div>
                <div className="text-2xl font-bold text-accent-blue">{getTDEE()} kcal</div>
                <div className="text-sm text-text-secondary mt-2">
                  Active calories will add to this daily
                </div>
              </div>
            </Card>
          )}

          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">Daily Active Calorie Goal</label>
            <div className="flex gap-2 flex-wrap">
              {[300, 450, 600, 750].map((val) => (
                <button
                  key={val}
                  onClick={() => setActiveCalorieGoal(val)}
                  className={`px-4 py-2 rounded-apple border-2 transition-all ${
                    activeCalorieGoal === val
                      ? 'border-accent-orange bg-orange-50 text-accent-orange'
                      : 'border-border-light text-text-secondary'
                  }`}
                >
                  {val} kcal
                </button>
              ))}
            </div>
            <p className="text-sm text-text-secondary mt-2">
              Example: Base {getTDEE() || '-'} + {activeCalorieGoal} active = {(getTDEE() || 0) + activeCalorieGoal} kcal eating budget
            </p>
          </div>

          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setStep('activity_approach')}>
              Back
            </Button>
            <Button size="lg" fullWidth onClick={() => setStep('goal')}>
              Continue
            </Button>
          </div>
        </>
      )}

      {/* Goal Setting */}
      {step === 'goal' && (
        <>
          <div>
            <h2 className="text-2xl font-bold text-text-primary">Your Goal</h2>
            <p className="text-text-secondary">Choose your calorie deficit approach</p>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => handleGoalTypeChange('deficit_fixed')}
              className={`w-full text-left p-4 rounded-apple-lg border-2 transition-all ${
                goalType === 'deficit_fixed'
                  ? 'border-accent-blue bg-blue-50'
                  : 'border-border-light'
              }`}
            >
              <div className="font-medium text-text-primary">Fixed Deficit</div>
              <div className="text-sm text-text-secondary">Set a specific daily calorie reduction</div>
            </button>

            <button
              onClick={() => handleGoalTypeChange('weight_loss_rate')}
              className={`w-full text-left p-4 rounded-apple-lg border-2 transition-all ${
                goalType === 'weight_loss_rate'
                  ? 'border-accent-blue bg-blue-50'
                  : 'border-border-light'
              }`}
            >
              <div className="font-medium text-text-primary">Weight Loss Rate</div>
              <div className="text-sm text-text-secondary">Target kg to lose per week</div>
            </button>
          </div>

          {goalType === 'deficit_fixed' && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-text-primary">Daily Deficit</label>
              <div className="flex gap-2 flex-wrap">
                {[-250, -500, -750, -1000].map((val) => (
                  <button
                    key={val}
                    onClick={() => setGoalValue(val)}
                    className={`px-4 py-2 rounded-apple border-2 transition-all ${
                      goalValue === val
                        ? 'border-accent-blue bg-blue-50 text-accent-blue'
                        : 'border-border-light text-text-secondary'
                    }`}
                  >
                    {val} kcal
                  </button>
                ))}
              </div>
            </div>
          )}

          {goalType === 'weight_loss_rate' && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-text-primary">Weekly Target</label>
              <div className="flex gap-2 flex-wrap">
                {[0.25, 0.5, 0.75, 1.0].map((val) => (
                  <button
                    key={val}
                    onClick={() => setGoalValue(val)}
                    className={`px-4 py-2 rounded-apple border-2 transition-all ${
                      goalValue === val
                        ? 'border-accent-blue bg-blue-50 text-accent-blue'
                        : 'border-border-light text-text-secondary'
                    }`}
                  >
                    {val} kg/week
                  </button>
                ))}
              </div>
            </div>
          )}

          {previewCalories() && (
            <Card className="bg-accent-blue/5 border border-accent-blue/20">
              <div className="text-center">
                <div className="text-sm text-text-secondary">
                  {activityApproach === 'dynamic' ? 'Base daily goal (sedentary)' : 'Your daily calorie goal'}
                </div>
                <div className="text-3xl font-bold text-accent-blue">{previewCalories()} kcal</div>
                {activityApproach === 'dynamic' && (
                  <div className="text-sm text-text-secondary mt-1">
                    + active calories from exercise
                  </div>
                )}
              </div>
            </Card>
          )}

          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={() => setStep(activityApproach === 'static' ? 'activity_level' : 'active_calorie_goal')}
            >
              Back
            </Button>
            <Button size="lg" fullWidth onClick={() => setStep('apikey')}>
              Continue
            </Button>
          </div>
        </>
      )}

      {/* API Key */}
      {step === 'apikey' && (
        <>
          <div>
            <h2 className="text-2xl font-bold text-text-primary">AI Setup</h2>
            <p className="text-text-secondary">
              Enter your OpenAI API key to enable AI-powered food recognition
            </p>
          </div>

          <Card className="bg-amber-50 border border-amber-200">
            <div className="flex gap-3">
              <span className="text-2xl">💡</span>
              <div className="text-sm text-amber-800">
                <p className="font-medium">How to get an API key:</p>
                <ol className="list-decimal list-inside mt-1 space-y-1">
                  <li>Go to platform.openai.com</li>
                  <li>Sign up or log in</li>
                  <li>Navigate to API Keys</li>
                  <li>Create a new key</li>
                </ol>
              </div>
            </div>
          </Card>

          <Input
            label="OpenAI API Key"
            type="password"
            value={openaiApiKey}
            onChange={(e) => setOpenaiApiKey(e.target.value)}
            placeholder="sk-..."
            helperText="Your key is stored securely in the database"
          />

          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setStep('goal')}>
              Back
            </Button>
            <Button size="lg" fullWidth onClick={handleComplete} disabled={isSubmitting}>
              {isSubmitting ? 'Setting up...' : openaiApiKey ? 'Complete Setup' : 'Skip for Now'}
            </Button>
          </div>

          <p className="text-xs text-text-secondary text-center">
            You can add your API key later in Settings. Without it, you can still log food manually.
          </p>
        </>
      )}
    </div>
  );
}
