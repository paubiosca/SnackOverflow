'use client';

import { useMemo } from 'react';
import { getFoodEntriesForDate, getActiveCaloriesForDate } from '@/lib/storage';
import { calculateDailyTotals } from '@/lib/calories';
import Card from '@/components/ui/Card';
import { TrendingDown, TrendingUp, Award, Zap, Target } from 'lucide-react';

interface WeeklyDeficitChartProps {
  baseCalorieGoal: number;
}

// Helper to get local date string
const getLocalDateString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Get past N days dates
const getPastDays = (n: number): string[] => {
  const dates: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    dates.push(getLocalDateString(date));
  }
  return dates;
};

export default function WeeklyDeficitChart({ baseCalorieGoal }: WeeklyDeficitChartProps) {
  const weekData = useMemo(() => {
    const dates = getPastDays(7);

    return dates.map((date) => {
      const entries = getFoodEntriesForDate(date);
      const activeCalories = getActiveCaloriesForDate(date);
      const totals = calculateDailyTotals(entries);
      const adjustedGoal = baseCalorieGoal + activeCalories;
      const deficit = adjustedGoal - totals.calories;

      const dayDate = new Date(date + 'T12:00:00');
      const dayName = dayDate.toLocaleDateString('en-US', { weekday: 'short' });

      return {
        date,
        dayName,
        consumed: totals.calories,
        goal: adjustedGoal,
        activeCalories,
        deficit,
        hasData: entries.length > 0,
      };
    });
  }, [baseCalorieGoal]);

  const stats = useMemo(() => {
    const daysWithData = weekData.filter((d) => d.hasData);
    if (daysWithData.length === 0) {
      return { avgDeficit: 0, totalDeficit: 0, projectedWeightLoss: 0, daysTracked: 0 };
    }

    const totalDeficit = daysWithData.reduce((sum, d) => sum + d.deficit, 0);
    const avgDeficit = Math.round(totalDeficit / daysWithData.length);

    // 7700 kcal = ~1 kg of fat
    const projectedWeeklyLoss = (avgDeficit * 7) / 7700;

    return {
      avgDeficit,
      totalDeficit,
      projectedWeightLoss: projectedWeeklyLoss,
      daysTracked: daysWithData.length,
    };
  }, [weekData]);

  // Find max absolute deficit for scaling
  const maxAbsDeficit = Math.max(
    ...weekData.map((d) => Math.abs(d.deficit)),
    100 // minimum scale
  );

  const getMotivationalMessage = () => {
    if (stats.daysTracked === 0) {
      return { icon: Target, text: 'Start logging to see your progress!', color: 'text-text-secondary' };
    }
    if (stats.avgDeficit >= 500) {
      return { icon: Award, text: 'Amazing progress! Keep it up!', color: 'text-accent-green' };
    }
    if (stats.avgDeficit >= 250) {
      return { icon: Zap, text: 'Great consistency this week!', color: 'text-accent-blue' };
    }
    if (stats.avgDeficit > 0) {
      return { icon: TrendingDown, text: 'You\'re making progress!', color: 'text-accent-green' };
    }
    return { icon: TrendingUp, text: 'Let\'s get back on track!', color: 'text-accent-orange' };
  };

  const motivation = getMotivationalMessage();
  const MotivationIcon = motivation.icon;

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-text-primary">Weekly Progress</h3>
        <div className={`flex items-center gap-1 text-sm ${motivation.color}`}>
          <MotivationIcon className="w-4 h-4" />
          <span className="font-medium">{motivation.text}</span>
        </div>
      </div>

      {/* Bar chart */}
      <div className="flex items-end justify-between gap-1 h-24 mb-3">
        {weekData.map((day) => {
          const isDeficit = day.deficit > 0;
          const barHeight = day.hasData
            ? Math.max(10, (Math.abs(day.deficit) / maxAbsDeficit) * 100)
            : 10;

          return (
            <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
              {/* Bar */}
              <div className="w-full flex flex-col items-center justify-end h-full">
                {day.hasData ? (
                  <div
                    className={`w-full rounded-t transition-all ${
                      isDeficit ? 'bg-accent-green' : 'bg-accent-red'
                    }`}
                    style={{ height: `${barHeight}%` }}
                  />
                ) : (
                  <div className="w-full h-2 bg-gray-200 rounded" />
                )}
              </div>
              {/* Day label */}
              <span className="text-xs text-text-secondary">{day.dayName}</span>
            </div>
          );
        })}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 pt-3 border-t border-border-light">
        <div className="text-center">
          <div className={`text-lg font-bold ${stats.avgDeficit >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
            {stats.avgDeficit >= 0 ? '-' : '+'}{Math.abs(stats.avgDeficit)}
          </div>
          <div className="text-xs text-text-secondary">Avg deficit/day</div>
        </div>
        <div className="text-center">
          <div className={`text-lg font-bold ${stats.totalDeficit >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
            {stats.totalDeficit >= 0 ? '-' : '+'}{Math.abs(stats.totalDeficit).toLocaleString()}
          </div>
          <div className="text-xs text-text-secondary">Total this week</div>
        </div>
        <div className="text-center">
          <div className={`text-lg font-bold ${stats.projectedWeightLoss >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
            {stats.projectedWeightLoss >= 0 ? '-' : '+'}{Math.abs(stats.projectedWeightLoss).toFixed(2)}
          </div>
          <div className="text-xs text-text-secondary">kg/week pace</div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex justify-center gap-4 mt-3 pt-3 border-t border-border-light">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-accent-green" />
          <span className="text-xs text-text-secondary">Under goal</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-accent-red" />
          <span className="text-xs text-text-secondary">Over goal</span>
        </div>
      </div>
    </Card>
  );
}
