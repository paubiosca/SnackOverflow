'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useProfile } from '@/hooks/useProfile';
import { useFoodEntries } from '@/hooks/useFoodEntries';
import { MealType } from '@/lib/types';
import Card from '@/components/ui/Card';
import BottomNav from '@/components/ui/BottomNav';
import CalorieSummary from '@/components/dashboard/CalorieSummary';
import MacroBreakdown from '@/components/dashboard/MacroBreakdown';
import MealSection from '@/components/dashboard/MealSection';
import WaterTracker from '@/components/dashboard/WaterTracker';

export default function Dashboard() {
  const router = useRouter();
  const { profile, isLoading: profileLoading, isOnboarded, calorieGoal, macroTargets } = useProfile();
  const { entries, totals, getEntriesByMeal, remove, isLoading: entriesLoading } = useFoodEntries();

  useEffect(() => {
    if (!profileLoading && !isOnboarded) {
      router.push('/onboarding');
    }
  }, [profileLoading, isOnboarded, router]);

  if (profileLoading || entriesLoading || !isOnboarded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-accent-blue border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-text-secondary">Loading...</p>
        </div>
      </div>
    );
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
      <header className="bg-white px-4 pt-12 pb-4 sticky top-0 z-40 shadow-sm">
        <h1 className="text-2xl font-bold text-text-primary">Today</h1>
        <p className="text-text-secondary">{today}</p>
      </header>

      <div className="px-4 py-4 space-y-4 page-transition">
        {/* Calorie Summary */}
        <Card>
          <CalorieSummary consumed={totals.calories} goal={calorieGoal} />
          <MacroBreakdown
            protein={{ current: totals.protein, goal: macroTargets.protein }}
            carbs={{ current: totals.carbs, goal: macroTargets.carbs }}
            fat={{ current: totals.fat, goal: macroTargets.fat }}
          />
        </Card>

        {/* Water Tracker */}
        <WaterTracker goalMl={profile?.dailyWaterGoalMl || 2000} />

        {/* Meal Sections */}
        {mealTypes.map((mealType) => (
          <MealSection
            key={mealType}
            mealType={mealType}
            entries={getEntriesByMeal(mealType)}
            onDelete={remove}
          />
        ))}
      </div>

      <BottomNav />
    </main>
  );
}
