'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { useProfile } from '@/hooks/useProfile';
import BottomNav from '@/components/ui/BottomNav';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import { User, Flame, BarChart3, ChevronRight, Activity, Watch, RefreshCw } from 'lucide-react';
import { ActivityApproach, ActivityLevel, ACTIVITY_LABELS, ACTIVITY_APPROACH_LABELS } from '@/lib/types';

export default function Profile() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { profile, updateProfile, calorieGoal, macroTargets, isLoading } = useProfile();
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [showSignOutModal, setShowSignOutModal] = useState(false);
  const [showActivityApproachModal, setShowActivityApproachModal] = useState(false);
  const [showRedoOnboardingModal, setShowRedoOnboardingModal] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  useEffect(() => {
    if (profile?.openaiApiKey) {
      setApiKeyInput(profile.openaiApiKey);
    }
  }, [profile]);

  if (status === 'loading' || isLoading || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-accent-blue border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-text-secondary">Loading...</p>
        </div>
      </div>
    );
  }

  const handleSaveApiKey = async () => {
    await updateProfile({ openaiApiKey: apiKeyInput || undefined });
    setShowApiKeyModal(false);
  };

  const handleSignOut = async () => {
    await signOut({ callbackUrl: '/login' });
  };

  const handleRedoOnboarding = async () => {
    try {
      // Delete the profile to reset onboarding status
      await fetch('/api/profile', { method: 'DELETE' });
      // Redirect to onboarding
      router.push('/onboarding');
    } catch (error) {
      console.error('Error resetting profile:', error);
    }
  };

  const handleActivityApproachChange = async (approach: ActivityApproach) => {
    if (approach === 'dynamic') {
      // When switching to dynamic, set activity level to sedentary (base calculation)
      await updateProfile({ activityApproach: approach, activityLevel: 'sedentary' });
    } else {
      // When switching to static, keep current activity level or default to moderate
      await updateProfile({ activityApproach: approach });
    }
    setShowActivityApproachModal(false);
  };

  const handleActivityLevelChange = async (level: ActivityLevel) => {
    await updateProfile({ activityLevel: level });
  };

  return (
    <main className="min-h-screen pb-24">
      {/* Header */}
      <header className="bg-white px-4 pt-12 pb-4 sticky top-0 z-40 shadow-sm">
        <h1 className="text-2xl font-bold text-text-primary">Profile</h1>
      </header>

      <div className="px-4 py-4 space-y-4 page-transition">
        {/* User info */}
        <Card>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 bg-accent-blue/10 rounded-full flex items-center justify-center overflow-hidden">
              {session?.user?.image ? (
                <img src={session.user.image} alt="" className="w-full h-full object-cover" />
              ) : (
                <User className="w-8 h-8 text-accent-blue" />
              )}
            </div>
            <div>
              <h2 className="text-xl font-semibold text-text-primary">{profile.name}</h2>
              <p className="text-sm text-text-secondary">{session?.user?.email}</p>
              <p className="text-text-secondary">
                {profile.age} years • {profile.heightCm}cm • {profile.weightKg}kg
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-secondary-bg rounded-apple">
              <div className="text-xs text-text-secondary mb-1">Activity</div>
              <div className="text-sm font-medium text-text-primary capitalize">
                {profile.activityLevel.replace('_', ' ')}
              </div>
            </div>
            <div className="p-3 bg-secondary-bg rounded-apple">
              <div className="text-xs text-text-secondary mb-1">Goal</div>
              <div className="text-sm font-medium text-text-primary">
                {profile.goalType === 'deficit_fixed'
                  ? `${profile.goalValue} kcal/day`
                  : `${profile.goalValue} kg/week`}
              </div>
            </div>
          </div>
        </Card>

        {/* Daily targets */}
        <Card>
          <h3 className="font-semibold text-text-primary mb-3">Daily Targets</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-text-secondary">Calories</span>
              <span className="font-semibold text-accent-blue">{calorieGoal} kcal</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-text-secondary">Protein</span>
              <span className="font-medium text-accent-orange">{macroTargets.protein}g</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-text-secondary">Carbs</span>
              <span className="font-medium text-accent-green">{macroTargets.carbs}g</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-text-secondary">Fat</span>
              <span className="font-medium text-accent-purple">{macroTargets.fat}g</span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-border-light">
              <span className="text-text-secondary">Water</span>
              <span className="font-medium text-text-primary">{profile.dailyWaterGoalMl}ml</span>
            </div>
          </div>
        </Card>

        {/* Progress Insights */}
        <Card>
          <button
            onClick={() => router.push('/insights')}
            className="w-full flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-accent-purple/10 rounded-full flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-accent-purple" />
              </div>
              <div className="text-left">
                <h3 className="font-semibold text-text-primary">Progress Insights</h3>
                <p className="text-sm text-text-secondary">
                  View trends, streaks & patterns
                </p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-text-secondary" />
          </button>
        </Card>

        {/* Activity Approach */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                profile.activityApproach === 'dynamic'
                  ? 'bg-accent-orange/10'
                  : 'bg-accent-blue/10'
              }`}>
                {profile.activityApproach === 'dynamic' ? (
                  <Watch className="w-5 h-5 text-accent-orange" />
                ) : (
                  <Activity className="w-5 h-5 text-accent-blue" />
                )}
              </div>
              <div>
                <h3 className="font-semibold text-text-primary">Activity Approach</h3>
                <p className="text-sm text-text-secondary">
                  {ACTIVITY_APPROACH_LABELS[profile.activityApproach || 'static'].name}
                </p>
              </div>
            </div>
            <Button variant="secondary" size="sm" onClick={() => setShowActivityApproachModal(true)}>
              Change
            </Button>
          </div>

          <div className={`p-3 rounded-apple ${
            profile.activityApproach === 'dynamic'
              ? 'bg-accent-orange/5 border border-accent-orange/20'
              : 'bg-accent-blue/5 border border-accent-blue/20'
          }`}>
            <p className="text-sm text-text-secondary">
              {profile.activityApproach === 'dynamic' ? (
                <>
                  <span className="font-medium text-text-primary">Dynamic mode:</span> Your base goal is calculated at sedentary level. Active calories from your Apple Watch add to your daily eating budget.
                </>
              ) : (
                <>
                  <span className="font-medium text-text-primary">Static mode:</span> Your activity level ({profile.activityLevel?.replace('_', ' ')}) is factored into a fixed daily goal.
                </>
              )}
            </p>
          </div>

          {profile.activityApproach === 'static' && (
            <div className="mt-4">
              <label className="block text-sm text-text-secondary mb-2">Activity Level</label>
              <div className="space-y-2">
                {(Object.entries(ACTIVITY_LABELS) as [ActivityLevel, string][]).map(([level, label]) => (
                  <button
                    key={level}
                    onClick={() => handleActivityLevelChange(level)}
                    className={`w-full text-left p-3 rounded-apple border-2 transition-all text-sm ${
                      profile.activityLevel === level
                        ? 'border-accent-blue bg-blue-50'
                        : 'border-border-light hover:border-gray-300'
                    }`}
                  >
                    <span className={profile.activityLevel === level ? 'text-accent-blue font-medium' : 'text-text-primary'}>
                      {label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </Card>

        {/* API Key */}
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-text-primary">OpenAI API Key</h3>
              <p className="text-sm text-text-secondary">
                {profile.openaiApiKey ? 'Configured' : 'Not configured'}
              </p>
            </div>
            <Button variant="secondary" size="sm" onClick={() => setShowApiKeyModal(true)}>
              {profile.openaiApiKey ? 'Update' : 'Add'}
            </Button>
          </div>
        </Card>

        {/* Edit settings */}
        <Card>
          <h3 className="font-semibold text-text-primary mb-3">Quick Settings</h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm text-text-secondary mb-2">Weight (kg)</label>
              <Input
                type="number"
                value={profile.weightKg}
                onChange={(e) => updateProfile({ weightKg: parseFloat(e.target.value) || profile.weightKg })}
              />
            </div>

            <div>
              <label className="block text-sm text-text-secondary mb-2">Daily Water Goal (ml)</label>
              <div className="flex gap-2">
                {[1500, 2000, 2500, 3000].map((ml) => (
                  <button
                    key={ml}
                    onClick={() => updateProfile({ dailyWaterGoalMl: ml })}
                    className={`flex-1 py-2 rounded-apple border-2 text-sm transition-all ${
                      profile.dailyWaterGoalMl === ml
                        ? 'border-accent-blue bg-blue-50 text-accent-blue'
                        : 'border-border-light text-text-secondary'
                    }`}
                  >
                    {ml}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm text-text-secondary mb-2">
                <Flame className="w-4 h-4 text-accent-orange" />
                Active Calorie Goal (from Apple Watch)
              </label>
              <div className="flex gap-2">
                {[300, 450, 600, 750].map((kcal) => (
                  <button
                    key={kcal}
                    onClick={() => updateProfile({ activeCalorieGoal: kcal })}
                    className={`flex-1 py-2 rounded-apple border-2 text-sm transition-all ${
                      profile.activeCalorieGoal === kcal
                        ? 'border-accent-orange bg-orange-50 text-accent-orange'
                        : 'border-border-light text-text-secondary'
                    }`}
                  >
                    {kcal}
                  </button>
                ))}
              </div>
              <p className="text-xs text-text-secondary mt-2">
                Active calories add to your daily budget when you exercise
              </p>
            </div>
          </div>
        </Card>

        {/* Account */}
        <Card>
          <h3 className="font-semibold text-text-primary mb-3">Account</h3>
          <div className="space-y-3">
            <Button
              variant="secondary"
              fullWidth
              onClick={() => setShowRedoOnboardingModal(true)}
              className="flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Redo Onboarding
            </Button>
            <Button variant="danger" fullWidth onClick={() => setShowSignOutModal(true)}>
              Sign Out
            </Button>
          </div>
        </Card>

        {/* App info */}
        <div className="text-center text-sm text-text-secondary py-4">
          <p>SnackOverflow v1.0.0</p>
          <p>Made with love and AI</p>
        </div>
      </div>

      {/* API Key Modal */}
      <Modal
        isOpen={showApiKeyModal}
        onClose={() => setShowApiKeyModal(false)}
        title="OpenAI API Key"
      >
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">
            Your API key is stored securely in the database and used to analyze food photos.
          </p>
          <Input
            type="password"
            value={apiKeyInput}
            onChange={(e) => setApiKeyInput(e.target.value)}
            placeholder="sk-..."
          />
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setShowApiKeyModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveApiKey} fullWidth>
              Save
            </Button>
          </div>
        </div>
      </Modal>

      {/* Sign Out Modal */}
      <Modal
        isOpen={showSignOutModal}
        onClose={() => setShowSignOutModal(false)}
        title="Sign Out?"
      >
        <div className="space-y-4">
          <p className="text-text-secondary">
            Are you sure you want to sign out? Your data will be saved and available when you sign back in.
          </p>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setShowSignOutModal(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleSignOut} fullWidth>
              Sign Out
            </Button>
          </div>
        </div>
      </Modal>

      {/* Redo Onboarding Modal */}
      <Modal
        isOpen={showRedoOnboardingModal}
        onClose={() => setShowRedoOnboardingModal(false)}
        title="Redo Onboarding?"
      >
        <div className="space-y-4">
          <p className="text-text-secondary">
            This will reset your profile and take you through the Quick Setup again. Your food logs and history will be kept.
          </p>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setShowRedoOnboardingModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleRedoOnboarding} fullWidth>
              Start Over
            </Button>
          </div>
        </div>
      </Modal>

      {/* Activity Approach Modal */}
      <Modal
        isOpen={showActivityApproachModal}
        onClose={() => setShowActivityApproachModal(false)}
        title="Change Activity Approach"
      >
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">
            Choose how you want to track your daily activity:
          </p>

          <button
            onClick={() => handleActivityApproachChange('static')}
            className={`w-full text-left p-4 rounded-apple-lg border-2 transition-all ${
              profile.activityApproach === 'static'
                ? 'border-accent-blue bg-blue-50'
                : 'border-border-light hover:border-gray-300'
            }`}
          >
            <div className="flex items-start gap-3">
              <Activity className="w-5 h-5 text-accent-blue mt-0.5" />
              <div>
                <div className="font-semibold text-text-primary">
                  {ACTIVITY_APPROACH_LABELS.static.name}
                </div>
                <div className="text-sm text-text-secondary mt-1">
                  {ACTIVITY_APPROACH_LABELS.static.description}
                </div>
                <div className="text-xs text-accent-blue mt-2">
                  Best for: Consistent routine, same goal every day
                </div>
              </div>
            </div>
          </button>

          <button
            onClick={() => handleActivityApproachChange('dynamic')}
            className={`w-full text-left p-4 rounded-apple-lg border-2 transition-all ${
              profile.activityApproach === 'dynamic'
                ? 'border-accent-orange bg-orange-50'
                : 'border-border-light hover:border-gray-300'
            }`}
          >
            <div className="flex items-start gap-3">
              <Watch className="w-5 h-5 text-accent-orange mt-0.5" />
              <div>
                <div className="font-semibold text-text-primary">
                  {ACTIVITY_APPROACH_LABELS.dynamic.name}
                </div>
                <div className="text-sm text-text-secondary mt-1">
                  {ACTIVITY_APPROACH_LABELS.dynamic.description}
                </div>
                <div className="text-xs text-accent-orange mt-2">
                  Best for: Variable exercise, Apple Watch users
                </div>
              </div>
            </div>
          </button>

          <Button variant="secondary" fullWidth onClick={() => setShowActivityApproachModal(false)}>
            Cancel
          </Button>
        </div>
      </Modal>

      <BottomNav />
    </main>
  );
}
