'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useProfile } from '@/hooks/useProfile';
import { UserProfile } from '@/lib/types';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import ButtonOnboarding from '@/components/onboarding/ButtonOnboarding';
import ClassicOnboardingForm from '@/components/onboarding/ClassicOnboardingForm';
import { Sparkles, ClipboardList, ArrowLeft } from 'lucide-react';

type OnboardingMode = 'selection' | 'quick' | 'classic';

export default function Onboarding() {
  const router = useRouter();
  const { status } = useSession();
  const { createProfile, isOnboarded, isLoading: profileLoading } = useProfile();

  const [mode, setMode] = useState<OnboardingMode>('selection');
  const [showWelcome, setShowWelcome] = useState(true);
  const [apiKey, setApiKey] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  useEffect(() => {
    if (!profileLoading && isOnboarded) {
      router.push('/');
    }
  }, [profileLoading, isOnboarded, router]);

  const handleQuickComplete = async (profileData: Omit<UserProfile, 'id' | 'createdAt'>) => {
    setIsSubmitting(true);
    const result = await createProfile(profileData);

    if (result) {
      router.push('/');
    } else {
      setIsSubmitting(false);
    }
  };

  const handleClassicComplete = async (profileData: Omit<UserProfile, 'id' | 'createdAt'>) => {
    setIsSubmitting(true);
    const result = await createProfile(profileData);

    if (result) {
      router.push('/');
    } else {
      setIsSubmitting(false);
    }
  };

  if (status === 'loading' || profileLoading) {
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
    <main className="min-h-screen bg-white">
      {/* Welcome Screen */}
      {showWelcome && mode === 'selection' && (
        <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12 page-transition">
          <div className="max-w-md w-full text-center space-y-8">
            <div className="text-6xl mb-4">🍔📸</div>
            <h1 className="text-3xl font-bold text-text-primary">
              Welcome to<br />SnackOverflow
            </h1>
            <p className="text-text-secondary text-lg">
              AI-powered calorie tracking made simple. Just snap a photo of your food and let AI do the rest.
            </p>
            <Button size="lg" fullWidth onClick={() => setShowWelcome(false)}>
              Get Started
            </Button>
          </div>
        </div>
      )}

      {/* Mode Selection */}
      {!showWelcome && mode === 'selection' && (
        <div className="min-h-screen px-4 py-12 page-transition">
          <div className="max-w-md mx-auto space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-text-primary">Let's Set Up Your Profile</h2>
              <p className="text-text-secondary mt-2">Choose how you'd like to get started</p>
            </div>

            {/* Quick Setup option - NEW BUTTON-BASED FLOW */}
            <Card className="border-2 border-accent-blue/20 hover:border-accent-blue transition-all">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-accent-blue/10 rounded-full flex items-center justify-center">
                    <Sparkles className="w-6 h-6 text-accent-blue" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-text-primary">Quick Setup</h3>
                    <p className="text-sm text-text-secondary">
                      Answer a few quick questions
                    </p>
                  </div>
                </div>

                <p className="text-sm text-text-secondary">
                  Simple button-based questions. AI will estimate your current calorie intake and recommend a personalized plan.
                </p>

                <div className="bg-secondary-bg rounded-apple p-3">
                  <p className="text-sm text-text-secondary mb-3">
                    Optional: Enter your OpenAI API key for enhanced AI features:
                  </p>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="sk-... (optional)"
                    className="w-full px-4 py-3 rounded-xl border border-border-light focus:border-accent-blue focus:outline-none text-sm"
                  />
                </div>

                <Button
                  fullWidth
                  onClick={() => setMode('quick')}
                >
                  Start Quick Setup
                </Button>
              </div>
            </Card>

            {/* Classic Form option */}
            <Card className="border-2 border-border-light hover:border-gray-300 transition-all">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-secondary-bg rounded-full flex items-center justify-center">
                    <ClipboardList className="w-6 h-6 text-text-secondary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-text-primary">Classic Form</h3>
                    <p className="text-sm text-text-secondary">
                      Fill out a detailed form
                    </p>
                  </div>
                </div>

                <p className="text-sm text-text-secondary">
                  Manual input for all settings. Best if you already know your calorie targets and preferences.
                </p>

                <Button
                  variant="secondary"
                  fullWidth
                  onClick={() => setMode('classic')}
                >
                  Use Classic Form
                </Button>
              </div>
            </Card>

            <p className="text-xs text-text-secondary text-center">
              Your data is stored securely and only used for calorie tracking.
            </p>
          </div>
        </div>
      )}

      {/* Quick Setup Mode - New Button-Based Flow */}
      {mode === 'quick' && (
        <ButtonOnboarding
          onComplete={handleQuickComplete}
          isSubmitting={isSubmitting}
          apiKey={apiKey || undefined}
        />
      )}

      {/* Classic Form Mode */}
      {mode === 'classic' && (
        <div className="min-h-screen px-4 py-12 page-transition">
          <div className="max-w-md mx-auto">
            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
              <button
                onClick={() => setMode('selection')}
                className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-secondary-bg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-text-secondary" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-text-primary">Profile Setup</h1>
                <p className="text-sm text-text-secondary">Classic form</p>
              </div>
            </div>

            <ClassicOnboardingForm
              onComplete={handleClassicComplete}
              isSubmitting={isSubmitting}
            />
          </div>
        </div>
      )}
    </main>
  );
}
