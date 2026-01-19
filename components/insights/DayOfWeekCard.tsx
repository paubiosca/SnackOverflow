'use client';

import Card from '@/components/ui/Card';
import { DayOfWeekStats } from '@/lib/calories';

interface DayOfWeekCardProps {
  analysis: DayOfWeekStats[];
  calorieGoal: number;
}

export default function DayOfWeekCard({ analysis, calorieGoal }: DayOfWeekCardProps) {
  // Find best and worst days
  const validDays = analysis.filter(d => d.totalDays > 0);

  if (validDays.length === 0) {
    return (
      <Card>
        <h3 className="font-semibold text-text-primary mb-4">Day of Week Patterns</h3>
        <div className="h-32 flex items-center justify-center text-text-secondary">
          Not enough data to show patterns
        </div>
      </Card>
    );
  }

  const bestDay = validDays.reduce((best, current) =>
    current.adherenceRate > best.adherenceRate ? current : best
  );
  const worstDay = validDays.reduce((worst, current) =>
    current.adherenceRate < worst.adherenceRate ? current : worst
  );

  // Max calories for bar scaling
  const maxCalories = Math.max(...validDays.map(d => d.avgCalories), calorieGoal);

  // Get color based on adherence rate
  const getBarColor = (adherenceRate: number) => {
    if (adherenceRate >= 70) return 'bg-accent-green';
    if (adherenceRate >= 40) return 'bg-accent-blue';
    return 'bg-accent-red';
  };

  // Short day names for display
  const shortDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <Card>
      <h3 className="font-semibold text-text-primary mb-4">Day of Week Patterns</h3>

      {/* Bar chart */}
      <div className="space-y-3">
        {analysis.map((dayStats) => {
          const barWidth = dayStats.avgCalories > 0
            ? (dayStats.avgCalories / maxCalories) * 100
            : 0;
          const isBest = dayStats.day === bestDay.day && dayStats.totalDays > 0;
          const isWorst = dayStats.day === worstDay.day && dayStats.totalDays > 0 && worstDay.adherenceRate < bestDay.adherenceRate;

          return (
            <div key={dayStats.day} className="flex items-center gap-2">
              <div className={`w-10 text-xs font-medium ${
                isBest ? 'text-accent-green' : isWorst ? 'text-accent-red' : 'text-text-secondary'
              }`}>
                {shortDays[dayStats.day]}
              </div>
              <div className="flex-1 h-6 bg-secondary-bg rounded-full overflow-hidden relative">
                {/* Goal line */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-text-secondary opacity-30"
                  style={{ left: `${(calorieGoal / maxCalories) * 100}%` }}
                />
                {/* Bar */}
                {dayStats.totalDays > 0 && (
                  <div
                    className={`h-full rounded-full transition-all ${getBarColor(dayStats.adherenceRate)}`}
                    style={{ width: `${barWidth}%`, opacity: 0.7 + (dayStats.adherenceRate / 100) * 0.3 }}
                  />
                )}
              </div>
              <div className="w-16 text-right">
                {dayStats.totalDays > 0 ? (
                  <span className="text-xs text-text-secondary">
                    {dayStats.avgCalories} kcal
                  </span>
                ) : (
                  <span className="text-xs text-text-secondary">-</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex justify-center gap-4 mt-4 pt-4 border-t border-border-light text-xs text-text-secondary">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-accent-green" />
          <span>70%+ on target</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-accent-blue" />
          <span>40-70%</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-accent-red" />
          <span>&lt;40%</span>
        </div>
      </div>

      {/* Insights */}
      {validDays.length >= 3 && (
        <div className="mt-4 p-3 bg-secondary-bg rounded-apple">
          <p className="text-sm text-text-secondary">
            <span className="font-medium text-accent-green">{bestDay.dayName}</span> is your best day
            ({bestDay.adherenceRate}% on target).
            {worstDay.day !== bestDay.day && (
              <>
                {' '}Watch out for <span className="font-medium text-accent-red">{worstDay.dayName}s</span>
                {' '}({worstDay.adherenceRate}% on target).
              </>
            )}
          </p>
        </div>
      )}
    </Card>
  );
}
