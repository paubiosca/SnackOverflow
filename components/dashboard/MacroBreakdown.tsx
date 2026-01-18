'use client';

interface MacroBarProps {
  label: string;
  current: number;
  goal: number;
  color: string;
  unit?: string;
}

function MacroBar({ label, current, goal, color, unit = 'g' }: MacroBarProps) {
  const percentage = Math.min(100, Math.round((current / goal) * 100));

  return (
    <div className="flex-1">
      <div className="flex justify-between items-baseline mb-1">
        <span className="text-sm font-medium text-text-primary">{label}</span>
        <span className="text-xs text-text-secondary">
          {current}{unit} / {goal}{unit}
        </span>
      </div>
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{
            width: `${percentage}%`,
            backgroundColor: color,
          }}
        />
      </div>
    </div>
  );
}

interface MacroBreakdownProps {
  protein: { current: number; goal: number };
  carbs: { current: number; goal: number };
  fat: { current: number; goal: number };
}

export default function MacroBreakdown({ protein, carbs, fat }: MacroBreakdownProps) {
  return (
    <div className="flex gap-4">
      <MacroBar
        label="Protein"
        current={protein.current}
        goal={protein.goal}
        color="#ff9500"
      />
      <MacroBar
        label="Carbs"
        current={carbs.current}
        goal={carbs.goal}
        color="#34c759"
      />
      <MacroBar
        label="Fat"
        current={fat.current}
        goal={fat.goal}
        color="#af52de"
      />
    </div>
  );
}
