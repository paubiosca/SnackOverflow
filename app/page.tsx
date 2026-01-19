'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useProfile } from '@/hooks/useProfile';
import { useFoodEntries } from '@/hooks/useFoodEntries';
import { MealType, FoodEntry } from '@/lib/types';
import { getActiveCaloriesForDate } from '@/lib/storage';
import Card from '@/components/ui/Card';
import BottomNav from '@/components/ui/BottomNav';
import CalorieSummary from '@/components/dashboard/CalorieSummary';
import MacroBreakdown from '@/components/dashboard/MacroBreakdown';
import MealBreakdown from '@/components/dashboard/MealBreakdown';
import MealSection from '@/components/dashboard/MealSection';
import WaterTracker from '@/components/dashboard/WaterTracker';
import WeightTracker from '@/components/dashboard/WeightTracker';
import ActiveCaloriesTracker from '@/components/dashboard/ActiveCaloriesTracker';
import WeeklyDeficitChart from '@/components/dashboard/WeeklyDeficitChart';
import EditFoodModal from '@/components/food/EditFoodModal';

// Helper to get local date string
const getLocalDateString = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function Dashboard() {
  const router = useRouter();
  const { status } = useSession();
  const { profile, isLoading: profileLoading, isOnboarded, isAuthenticated, calorieGoal, macroTargets } = useProfile();
  const { entries, totals, getEntriesByMeal, remove, update, isLoading: entriesLoading } = useFoodEntries();
  const [editingEntry, setEditingEntry] = useState<FoodEntry | null>(null);
  const [activeCaloriesBurned, setActiveCaloriesBurned] = useState(0);

  // Load active calories on mount
  useEffect(() => {
    const today = getLocalDateString();
    setActiveCaloriesBurned(getActiveCaloriesForDate(today));
  }, []);

  // Adjusted calorie goal = base goal + active calories burned
  const adjustedCalorieGoal = calorieGoal + activeCaloriesBurned;

  const handleActiveCaloriesChange = useCallback((calories: number) => {
    setActiveCaloriesBurned(calories);
  }, []);

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

  if (status === 'loading' || profileLoading || entriesLoading || !isOnboarded) {
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
          <CalorieSummary
            consumed={totals.calories}
            goal={adjustedCalorieGoal}
            baseGoal={calorieGoal}
            activeBonus={activeCaloriesBurned}
          />
          <MacroBreakdown
            protein={{ current: totals.protein, goal: macroTargets.protein }}
            carbs={{ current: totals.carbs, goal: macroTargets.carbs }}
            fat={{ current: totals.fat, goal: macroTargets.fat }}
          />
          <MealBreakdown entries={entries} />
        </Card>

        {/* Weekly Deficit Chart */}
        <WeeklyDeficitChart baseCalorieGoal={calorieGoal} />

        {/* Water Tracker */}
        <WaterTracker goalMl={profile?.dailyWaterGoalMl || 2000} />

        {/* Weight Tracker */}
        <WeightTracker startingWeight={profile?.weightKg || 70} />

        {/* Active Calories Tracker */}
        <ActiveCaloriesTracker
          goal={profile?.activeCalorieGoal || 450}
          onActiveCaloriesChange={handleActiveCaloriesChange}
        />

        {/* Meal Sections */}
        {mealTypes.map((mealType) => (
          <MealSection
            key={mealType}
            mealType={mealType}
            entries={getEntriesByMeal(mealType)}
            onDelete={remove}
            onEdit={setEditingEntry}
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

      <BottomNav />
    </main>
  );
}
