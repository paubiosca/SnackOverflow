'use client';

import { useWaterLog } from '@/hooks/useWaterLog';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';

interface WaterTrackerProps {
  goalMl: number;
}

export default function WaterTracker({ goalMl }: WaterTrackerProps) {
  const { total, add } = useWaterLog();

  const percentage = Math.min(100, Math.round((total / goalMl) * 100));
  const glasses = Math.floor(total / 250); // 250ml per glass

  const quickAddOptions = [250, 500];

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">💧</span>
          <span className="font-semibold text-text-primary">Water</span>
        </div>
        <span className="text-sm text-text-secondary">
          {total} / {goalMl} ml
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-3 bg-gray-200 rounded-full overflow-hidden mb-3">
        <div
          className="h-full bg-accent-blue rounded-full transition-all duration-500"
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Glass icons */}
      <div className="flex items-center gap-1 mb-3">
        {[...Array(8)].map((_, i) => (
          <span
            key={i}
            className={`text-lg transition-opacity ${i < glasses ? 'opacity-100' : 'opacity-20'}`}
          >
            🥤
          </span>
        ))}
      </div>

      {/* Quick add buttons */}
      <div className="flex gap-2">
        {quickAddOptions.map((amount) => (
          <Button
            key={amount}
            variant="secondary"
            size="sm"
            onClick={() => add(amount)}
            className="flex-1"
          >
            +{amount}ml
          </Button>
        ))}
      </div>
    </Card>
  );
}
