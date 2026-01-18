'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useProfile } from '@/hooks/useProfile';
import { Gender, ActivityLevel, GoalType, ACTIVITY_LABELS, UserProfile } from '@/lib/types';
import { calculateDailyCalorieGoal } from '@/lib/calories';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Card from '@/components/ui/Card';

type Step = 'welcome' | 'profile' | 'activity' | 'goal' | 'apikey';

export default function Onboarding() {
  const router = useRouter();
  const { status } = useSession();
  const { createProfile, isOnboarded, isLoading } = useProfile();
  const [step, setStep] = useState<Step>('welcome');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<Gender>('male');
  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>('moderate');
  const [goalType, setGoalType] = useState<GoalType>('deficit_fixed');
  const [goalValue, setGoalValue] = useState<number | null>(-500);
  const [openaiApiKey, setOpenaiApiKey] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  useEffect(() => {
    if (!isLoading && isOnboarded) {
      router.push('/');
    }
  }, [isLoading, isOnboarded, router]);

  const handleGoalTypeChange = (type: GoalType) => {
    setGoalType(type);
    setGoalValue(type === 'deficit_fixed' ? -500 : 0.5);
  };

  const handleComplete = async () => {
    setIsSubmitting(true);

    const profileData: Omit<UserProfile, 'id' | 'createdAt'> = {
      name,
      age: parseInt(age),
      gender,
      heightCm: parseFloat(heightCm),
      weightKg: parseFloat(weightKg),
      activityLevel,
      goalType,
      goalValue,
      dailyWaterGoalMl: 2000,
      openaiApiKey: openaiApiKey || undefined,
    };

    const result = await createProfile(profileData);

    if (result) {
      router.push('/');
    } else {
      setIsSubmitting(false);
    }
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
      activityLevel,
      goalType,
      goalValue,
      dailyWaterGoalMl: 2000,
      createdAt: '',
    };
    return calculateDailyCalorieGoal(tempProfile);
  };

  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-accent-blue border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-text-secondary">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-white px-4 py-12 page-transition">
      <div className="max-w-md mx-auto">
        {/* Welcome */}
        {step === 'welcome' && (
          <div className="text-center space-y-8">
            <div className="text-6xl mb-4">🍔📸</div>
            <h1 className="text-3xl font-bold text-text-primary">
              Welcome to<br />SnackOverflow
            </h1>
            <p className="text-text-secondary text-lg">
              AI-powered calorie tracking made simple. Just snap a photo of your food and let AI do the rest.
            </p>
            <Button size="lg" fullWidth onClick={() => setStep('profile')}>
              Get Started
            </Button>
          </div>
        )}

        {/* Profile Setup */}
        {step === 'profile' && (
          <div className="space-y-6">
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
                    {g === 'male' ? '👨 Male' : '👩 Female'}
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
              onClick={() => setStep('activity')}
              disabled={!name || !age || !heightCm || !weightKg}
            >
              Continue
            </Button>
          </div>
        )}

        {/* Activity Level */}
        {step === 'activity' && (
          <div className="space-y-6">
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
              <Button variant="secondary" onClick={() => setStep('profile')}>
                Back
              </Button>
              <Button size="lg" fullWidth onClick={() => setStep('goal')}>
                Continue
              </Button>
            </div>
          </div>
        )}

        {/* Goal Setting */}
        {step === 'goal' && (
          <div className="space-y-6">
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
                  <div className="text-sm text-text-secondary">Your daily calorie goal</div>
                  <div className="text-3xl font-bold text-accent-blue">{previewCalories()} kcal</div>
                </div>
              </Card>
            )}

            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => setStep('activity')}>
                Back
              </Button>
              <Button size="lg" fullWidth onClick={() => setStep('apikey')}>
                Continue
              </Button>
            </div>
          </div>
        )}

        {/* API Key */}
        {step === 'apikey' && (
          <div className="space-y-6">
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
          </div>
        )}
      </div>
    </main>
  );
}
