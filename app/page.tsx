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
import WeeklyDeficitChart from '@/components/dashboard/WeeklyDeficitChart';
import EditFoodModal from '@/components/food/EditFoodModal';
import ClarifySheet from '@/components/food/ClarifySheet';
import BurnedCaloriesTile from '@/components/dashboard/BurnedCaloriesTile';
import CalibrationCard from '@/components/dashboard/CalibrationCard';
import AlternativesCard from '@/components/food/AlternativesCard';

export default function Dashboard() {
  const router = useRouter();
  const { status } = useSession();
  const { profile, isLoading: profileLoading, isOnboarded, isAuthenticated, calorieGoal, macroTargets } = useProfile();
  const { entries, totals, getEntriesByMeal, remove, update, answerClarification, isLoading: entriesLoading } = useFoodEntries();
  const [editingEntry, setEditingEntry] = useState<FoodEntry | null>(null);
  const [clarifyingEntry, setClarifyingEntry] = useState<FoodEntry | null>(null);
  // Active calories now come from Apple Health (auto-synced via the iOS Shortcut)
  // instead of manual entry. 0 if no Health data has been ingested yet.
  const [activeCaloriesBurned, setActiveCaloriesBurned] = useState(0);

  useEffect(() => {
    fetch('/api/health/status')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const t = data?.today;
        if (!t) return;
        // Prefer the explicit active number; fall back to total - bmr.
        const active = t.activeKcal ?? (t.totalKcal != null && t.bmrKcal != null ? t.totalKcal - t.bmrKcal : 0);
        setActiveCaloriesBurned(Math.max(0, active ?? 0));
      })
      .catch(() => {});
  }, []);

  // Dynamic-approach users get their active burn added to today's eating budget.
  const adjustedCalorieGoal = calorieGoal + activeCaloriesBurned;

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

        {/* Burned calories from Apple Health (hidden until first ingest) */}
        <BurnedCaloriesTile consumedKcal={totals.calories} />

        {/* Calibration insight: expected vs actual deficit (hidden until ~2 weeks of data) */}
        <CalibrationCard />

        {/* Weekly Deficit Chart */}
        <WeeklyDeficitChart baseCalorieGoal={calorieGoal} />

        {/* Leaner alternatives based on today's heavier items */}
        <AlternativesCard />

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
