'use client';

import { useEffect, useState } from 'react';
import ProgressRing from '@/components/ui/ProgressRing';
import { calculatePercentage, formatNumber } from '@/lib/calories';
import { Flame } from 'lucide-react';

interface SmartGoal {
  target: number;
  deficit: number;
  baseline: number;
  baselineSource: 'apple_health_today' | 'calibrated' | 'formula';
  stravaKcal: number;
  tdeeToday: number;
}

interface Props {
  consumed: number;
}

// Single source of truth for today's calorie picture.
//
//   Calories eaten · usual burn · + today's runs · target · deficit-so-far
//
// Pulls from /api/insights/smart-goal so the math is always:
//   target = baseline (calibrated) + Strava today − chosen deficit
// and there's no second number from a textbook formula floating around.
export default function CalorieSummary({ consumed }: Props) {
  const [goal, setGoal] = useState<SmartGoal | null>(null);

  useEffect(() => {
    fetch('/api/insights/smart-goal')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setGoal(d))
      .catch(() => {});
  }, []);

  // Skeleton while loading — keep shape so the page doesn't jump.
  if (!goal) {
    return (
      <div className="flex flex-col items-center py-6">
        <ProgressRing progress={0} size={180} strokeWidth={12} color="#e5e7eb">
          <div className="text-center">
            <div className="text-4xl font-bold text-text-primary">{formatNumber(consumed)}</div>
            <div className="text-sm text-text-secondary">eaten</div>
          </div>
        </ProgressRing>
      </div>
    );
  }

  const percentage = calculatePercentage(consumed, goal.target);
  const delta = consumed - goal.target;     // +ve = over target, -ve = under
  const isOver = delta > 0;
  const deficitRealized = goal.tdeeToday - consumed; // burned − eaten today

  const ringColor = isOver
    ? '#ff3b30' // red
    : percentage >= 90
      ? '#ff9500' // orange
      : '#007aff'; // blue

  return (
    <div className="flex flex-col items-center py-6">
      <ProgressRing progress={percentage} size={180} strokeWidth={12} color={ringColor}>
        <div className="text-center">
          <div className="text-4xl font-bold text-text-primary">{formatNumber(consumed)}</div>
          <div className="text-sm text-text-secondary">of {formatNumber(goal.target)} kcal</div>
        </div>
      </ProgressRing>

      <div className="mt-4 text-center space-y-2">
        {isOver ? (
          <p className="text-accent-red font-medium">
            {formatNumber(delta)} kcal over today&apos;s target
          </p>
        ) : (
          <p className="text-text-secondary">
            <span className="text-accent-blue font-semibold">{formatNumber(-delta)}</span> kcal left
          </p>
        )}

        {/* The simple breakdown the user actually thinks in */}
        <div className="flex items-center justify-center gap-2 text-xs text-text-secondary flex-wrap">
          <span>
            <b className="text-text-primary">{formatNumber(goal.baseline)}</b> usual burn
          </span>
          {goal.stravaKcal > 0 && (
            <>
              <span>+</span>
              <span className="flex items-center gap-0.5 text-accent-orange font-medium">
                <Flame className="w-3 h-3" />
                {formatNumber(goal.stravaKcal)} run
              </span>
            </>
          )}
          <span>−</span>
          <span>{formatNumber(Math.abs(goal.deficit))} deficit</span>
        </div>

        {/* Realized deficit: how much you've actually under-eaten today vs your real burn */}
        {goal.tdeeToday > 0 && (
          <p className={`text-xs ${deficitRealized >= 0 ? 'text-green-600' : 'text-accent-red'}`}>
            {deficitRealized >= 0
              ? `Today's deficit so far: −${formatNumber(deficitRealized)} kcal`
              : `Currently +${formatNumber(-deficitRealized)} kcal over your burn`}
          </p>
        )}
      </div>
    </div>
  );
}
