'use client';

import ProgressRing from '@/components/ui/ProgressRing';
import { calculatePercentage, formatNumber } from '@/lib/calories';
import { Flame } from 'lucide-react';

interface CalorieSummaryProps {
  consumed: number;
  goal: number;
  baseGoal?: number;
  activeBonus?: number;
}

export default function CalorieSummary({ consumed, goal, baseGoal, activeBonus = 0 }: CalorieSummaryProps) {
  const percentage = calculatePercentage(consumed, goal);
  const remaining = Math.max(0, goal - consumed);
  const isOver = consumed > goal;

  const getColor = () => {
    if (isOver) return '#ff3b30'; // red
    if (percentage >= 90) return '#ff9500'; // orange
    return '#007aff'; // blue
  };

  return (
    <div className="flex flex-col items-center py-6">
      <ProgressRing
        progress={percentage}
        size={180}
        strokeWidth={12}
        color={getColor()}
      >
        <div className="text-center">
          <div className="text-4xl font-bold text-text-primary">
            {formatNumber(consumed)}
          </div>
          <div className="text-sm text-text-secondary">
            of {formatNumber(goal)} kcal
          </div>
        </div>
      </ProgressRing>

      <div className="mt-4 text-center space-y-1">
        {isOver ? (
          <p className="text-accent-red font-medium">
            {formatNumber(consumed - goal)} kcal over goal
          </p>
        ) : (
          <p className="text-text-secondary">
            <span className="text-accent-blue font-semibold">{formatNumber(remaining)}</span> kcal remaining
          </p>
        )}

        {/* Show active bonus breakdown */}
        {activeBonus > 0 && baseGoal && (
          <div className="flex items-center justify-center gap-1 text-xs text-text-secondary">
            <span>{formatNumber(baseGoal)} base</span>
            <span>+</span>
            <span className="flex items-center gap-0.5 text-accent-orange font-medium">
              <Flame className="w-3 h-3" />
              {formatNumber(activeBonus)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
