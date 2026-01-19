'use client';

import Card from '@/components/ui/Card';
import { AdherenceStats } from '@/hooks/useInsights';

interface CalorieAdherenceCardProps {
  stats: AdherenceStats;
  goal: number;
}

export default function CalorieAdherenceCard({ stats, goal }: CalorieAdherenceCardProps) {
  const totalDays = stats.daysOnTarget + stats.daysUnder + stats.daysOver;

  if (totalDays === 0) {
    return (
      <Card>
        <h3 className="font-semibold text-text-primary mb-4">Calorie Adherence</h3>
        <div className="h-32 flex items-center justify-center text-text-secondary">
          No calorie data for this period
        </div>
      </Card>
    );
  }

  const percentages = {
    under: Math.round((stats.daysUnder / totalDays) * 100),
    onTarget: Math.round((stats.daysOnTarget / totalDays) * 100),
    over: Math.round((stats.daysOver / totalDays) * 100),
  };

  // Donut chart calculations
  const size = 120;
  const strokeWidth = 20;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const segments = [
    { color: '#22c55e', percent: percentages.under, label: 'Under', days: stats.daysUnder },
    { color: '#3b82f6', percent: percentages.onTarget, label: 'On Target', days: stats.daysOnTarget },
    { color: '#ef4444', percent: percentages.over, label: 'Over', days: stats.daysOver },
  ];

  let currentOffset = 0;

  return (
    <Card>
      <h3 className="font-semibold text-text-primary mb-4">Calorie Adherence</h3>

      <div className="flex items-center justify-between">
        {/* Donut chart */}
        <div className="relative">
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            {/* Background circle */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="#e5e7eb"
              strokeWidth={strokeWidth}
            />

            {/* Segments */}
            {segments.map((segment, i) => {
              if (segment.percent === 0) return null;
              const dashLength = (segment.percent / 100) * circumference;
              const offset = currentOffset;
              currentOffset += dashLength;

              return (
                <circle
                  key={i}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  stroke={segment.color}
                  strokeWidth={strokeWidth}
                  strokeDasharray={`${dashLength} ${circumference - dashLength}`}
                  strokeDashoffset={-offset}
                  transform={`rotate(-90 ${size / 2} ${size / 2})`}
                  strokeLinecap="round"
                />
              );
            })}
          </svg>

          {/* Center text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-lg font-bold text-text-primary">{totalDays}</span>
            <span className="text-xs text-text-secondary">days</span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex-1 ml-6 space-y-2">
          {segments.map((segment, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: segment.color }}
                />
                <span className="text-sm text-text-secondary">{segment.label}</span>
              </div>
              <div className="text-right">
                <span className="text-sm font-medium text-text-primary">{segment.days}</span>
                <span className="text-xs text-text-secondary ml-1">({segment.percent}%)</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Average deficit */}
      <div className="mt-4 pt-4 border-t border-border-light">
        <div className="flex justify-between items-center">
          <span className="text-sm text-text-secondary">Avg. Daily Deficit</span>
          <span className={`font-semibold ${stats.avgDeficit > 0 ? 'text-accent-green' : 'text-accent-red'}`}>
            {stats.avgDeficit > 0 ? '+' : ''}{stats.avgDeficit} kcal
          </span>
        </div>
        <div className="flex justify-between items-center mt-1">
          <span className="text-sm text-text-secondary">Daily Goal</span>
          <span className="font-medium text-text-primary">{goal} kcal</span>
        </div>
      </div>
    </Card>
  );
}
