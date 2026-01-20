'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useInsights } from '@/hooks/useInsights';
import BottomNav from '@/components/ui/BottomNav';
import PeriodSelector from '@/components/insights/PeriodSelector';
import WeightTrendChart from '@/components/insights/WeightTrendChart';
import CalorieAdherenceCard from '@/components/insights/CalorieAdherenceCard';
import StreaksCard from '@/components/insights/StreaksCard';
import DayOfWeekCard from '@/components/insights/DayOfWeekCard';
import { ArrowLeft, TrendingUp } from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';

export default function InsightsPage() {
  const router = useRouter();
  const { status } = useSession();
  const [period, setPeriod] = useState(30);
  const { data, isLoading, error } = useInsights(period);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-accent-blue border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-text-secondary">Loading insights...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen pb-24">
        <header className="bg-white px-4 pt-12 pb-4 sticky top-0 z-40 shadow-sm">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="p-2 -ml-2 hover:bg-secondary-bg rounded-full transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-text-primary" />
            </button>
            <h1 className="text-2xl font-bold text-text-primary">Progress Insights</h1>
          </div>
        </header>
        <div className="px-4 py-8 text-center">
          <p className="text-accent-red mb-4">{error}</p>
          <button
            onClick={() => router.push('/profile')}
            className="text-accent-blue hover:underline"
          >
            Go to Profile
          </button>
        </div>
        <BottomNav />
      </main>
    );
  }

  return (
    <main className="min-h-screen pb-24">
      {/* Header */}
      <header className="bg-white px-4 pt-12 pb-4 sticky top-0 z-40 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => router.back()}
            className="p-2 -ml-2 hover:bg-secondary-bg rounded-full transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-text-primary" />
          </button>
          <h1 className="text-2xl font-bold text-text-primary">Progress Insights</h1>
        </div>
        <PeriodSelector period={period} onChange={setPeriod} />
      </header>

      <div className="px-4 py-4 space-y-4 page-transition">
        {data && data.calorieData && (
          <>
            {/* Check if user has logged any food */}
            {data.calorieData.dailySummaries?.length === 0 ? (
              <Card className="text-center py-8">
                <div className="w-16 h-16 bg-accent-purple/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <TrendingUp className="w-8 h-8 text-accent-purple" />
                </div>
                <h3 className="text-lg font-semibold text-text-primary mb-2">
                  No Data Yet
                </h3>
                <p className="text-text-secondary mb-4 max-w-xs mx-auto">
                  Start logging your meals to see your progress insights, streaks, and patterns here.
                </p>
                <Button onClick={() => router.push('/add-food')}>
                  Log Your First Meal
                </Button>
              </Card>
            ) : (
              <>
                {/* Streaks */}
                <StreaksCard streaks={data.streaks} />

                {/* Weight Trend */}
                <WeightTrendChart
                  logs={data.weightData.logs}
                  ma7={data.weightData.trends.ma7}
                  periodChange={data.weightData.trends.periodChange}
                  period={period}
                />

                {/* Calorie Adherence */}
                <CalorieAdherenceCard
                  stats={data.calorieData.adherenceStats}
                  goal={data.calorieData.goal}
                />

                {/* Day of Week Analysis */}
                <DayOfWeekCard
                  analysis={data.dayOfWeekAnalysis}
                  calorieGoal={data.calorieData.goal}
                />
              </>
            )}
          </>
        )}
      </div>

      <BottomNav />
    </main>
  );
}
