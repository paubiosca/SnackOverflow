'use client';

import Card from '@/components/ui/Card';
import { StreakInfo } from '@/lib/calories';
import { Flame, Target, Trophy } from 'lucide-react';

interface StreaksCardProps {
  streaks: StreakInfo;
}

export default function StreaksCard({ streaks }: StreaksCardProps) {
  return (
    <Card>
      <h3 className="font-semibold text-text-primary mb-4">Streaks</h3>

      <div className="grid grid-cols-2 gap-4">
        {/* Logging Streak */}
        <div className="p-4 bg-orange-50 rounded-apple">
          <div className="flex items-center gap-2 mb-2">
            <Flame className="w-5 h-5 text-accent-orange" />
            <span className="text-sm font-medium text-text-primary">Logging</span>
          </div>
          <div className="space-y-2">
            <div>
              <div className="text-2xl font-bold text-accent-orange">
                {streaks.currentLogging}
              </div>
              <div className="text-xs text-text-secondary">Current streak</div>
            </div>
            <div className="flex items-center gap-1 pt-2 border-t border-orange-200">
              <Trophy className="w-3 h-3 text-yellow-500" />
              <span className="text-xs text-text-secondary">Best: {streaks.longestLogging} days</span>
            </div>
          </div>
        </div>

        {/* On Target Streak */}
        <div className="p-4 bg-green-50 rounded-apple">
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-5 h-5 text-accent-green" />
            <span className="text-sm font-medium text-text-primary">On Target</span>
          </div>
          <div className="space-y-2">
            <div>
              <div className="text-2xl font-bold text-accent-green">
                {streaks.currentOnTarget}
              </div>
              <div className="text-xs text-text-secondary">Current streak</div>
            </div>
            <div className="flex items-center gap-1 pt-2 border-t border-green-200">
              <Trophy className="w-3 h-3 text-yellow-500" />
              <span className="text-xs text-text-secondary">Best: {streaks.longestOnTarget} days</span>
            </div>
          </div>
        </div>
      </div>

      <p className="text-xs text-text-secondary mt-4">
        On target = within 100 calories of your daily goal
      </p>
    </Card>
  );
}
