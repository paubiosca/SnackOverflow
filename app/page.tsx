'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useProfile } from '@/hooks/useProfile';
import { useFoodEntries } from '@/hooks/useFoodEntries';
import { MealType, FoodEntry } from '@/lib/types';
import Card from '@/components/ui/Card';
import BottomNav from '@/components/ui/BottomNav';
import CalorieSummary from '@/components/dashboard/CalorieSummary';
import MacroBreakdown from '@/components/dashboard/MacroBreakdown';
import MealBreakdown from '@/components/dashboard/MealBreakdown';
import MealSection from '@/components/dashboard/MealSection';
import WaterTracker from '@/components/dashboard/WaterTracker';
import WeightTracker from '@/components/dashboard/WeightTracker';
import EditFoodModal from '@/components/food/EditFoodModal';
import ClarifySheet from '@/components/food/ClarifySheet';
import DashboardSkeleton from '@/components/dashboard/DashboardSkeleton';
import CalibrationCard from '@/components/dashboard/CalibrationCard';

export default function Dashboard() {
  const router = useRouter();
  const { status } = useSession();
  const { profile, isLoading: profileLoading, isOnboarded, isAuthenticated, calorieGoal, macroTargets } = useProfile();
  const { entries, totals, getEntriesByMeal, remove, update, answerClarification, isLoading: entriesLoading } = useFoodEntries();
  const [editingEntry, setEditingEntry] = useState<FoodEntry | null>(null);
  const [clarifyingEntry, setClarifyingEntry] = useState<FoodEntry | null>(null);
  // Hydration guard. Server and first client render BOTH return the skeleton;
  // we only switch to real content after mount.
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (status === 'loading') return;

    if (status === 'unauthenticated') {
      router.push('/login');
      return;
    }

    if (!profileLoading && isAuthenticated && !isOnboarded) {
      router.push('/onboarding');
    }
  }, [status, profileLoading, isOnboarded, isAuthenticated, router]);

  if (!mounted || status === 'loading' || profileLoading || entriesLoading || !isOnboarded) {
    return <DashboardSkeleton />;
  }

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const mealTypes: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

  return (
    <main className="min-h-screen pb-24">
      {/* Header */}
      <header
        className="bg-white px-4 pb-4 sticky top-0 z-40 shadow-sm"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}
      >
        <h1 className="text-2xl font-bold text-text-primary">Today</h1>
        <p className="text-text-secondary">{today}</p>
      </header>

      <div className="px-4 py-4 space-y-4 page-transition">
        {/* Single source of truth: eaten · usual burn · + today's run · target · deficit */}
        <Card>
          <CalorieSummary consumed={totals.calories} />
          <MacroBreakdown
            protein={{ current: totals.protein, goal: macroTargets.protein }}
            carbs={{ current: totals.carbs, goal: macroTargets.carbs }}
            fat={{ current: totals.fat, goal: macroTargets.fat }}
          />
          <MealBreakdown entries={entries} />
        </Card>

        {/* Calibration insight: predicted vs actual weight delta (hidden until ~2 weeks of data) */}
        <CalibrationCard />

        {/* Water Tracker */}
        <WaterTracker goalMl={profile?.dailyWaterGoalMl || 2000} />

        {/* Weight Tracker */}
        <WeightTracker startingWeight={profile?.weightKg || 70} />

        {/* Meal Sections */}
        {mealTypes.map((mealType) => (
          <MealSection
            key={mealType}
            mealType={mealType}
            entries={getEntriesByMeal(mealType)}
            onDelete={remove}
            onEdit={setEditingEntry}
            onClarify={setClarifyingEntry}
            onUpdate={update}
          />
        ))}
      </div>

      {/* Edit Food Modal */}
      <EditFoodModal
        entry={editingEntry}
        isOpen={!!editingEntry}
        onClose={() => setEditingEntry(null)}
        onSave={update}
        onDelete={remove}
      />

      {clarifyingEntry && (
        <ClarifySheet
          entry={clarifyingEntry}
          onAnswer={(ans) => answerClarification(clarifyingEntry.id, ans)}
          onClose={() => setClarifyingEntry(null)}
        />
      )}

      <BottomNav />
    </main>
  );
}
