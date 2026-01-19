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
import { User, Flame } from 'lucide-react';

export default function Profile() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { profile, updateProfile, calorieGoal, macroTargets, isLoading } = useProfile();
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [showSignOutModal, setShowSignOutModal] = useState(false);
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
          <Button variant="secondary" fullWidth onClick={() => setShowSignOutModal(true)}>
            Sign Out
          </Button>
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

      <BottomNav />
    </main>
  );
}
