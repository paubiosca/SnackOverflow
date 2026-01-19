'use client';

interface MacroBarProps {
  label: string;
  current: number;
  goal: number;
  color: string;
  bgColor: string;
  unit?: string;
}

function MacroBar({ label, current, goal, color, bgColor, unit = 'g' }: MacroBarProps) {
  const percentage = Math.min(100, Math.round((current / goal) * 100));
  const isOver = current > goal;

  return (
    <div className="flex items-center gap-3">
      <div className="w-16 text-sm font-medium text-text-primary">{label}</div>
      <div className="flex-1">
        <div className="h-2.5 rounded-full overflow-hidden" style={{ backgroundColor: bgColor }}>
          <div
            className="h-full rounded-full transition-all duration-500 ease-out"
            style={{
              width: `${percentage}%`,
              backgroundColor: color,
            }}
          />
        </div>
      </div>
      <div className="w-20 text-right">
        <span className={`text-sm font-semibold ${isOver ? 'text-accent-red' : 'text-text-primary'}`}>
          {current}
        </span>
        <span className="text-xs text-text-secondary">/{goal}{unit}</span>
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
    <div className="space-y-3 mt-4">
      <MacroBar
        label="Protein"
        current={protein.current}
        goal={protein.goal}
        color="#ff9500"
        bgColor="#fff3e0"
      />
      <MacroBar
        label="Carbs"
        current={carbs.current}
        goal={carbs.goal}
        color="#34c759"
        bgColor="#e8f5e9"
      />
      <MacroBar
        label="Fat"
        current={fat.current}
        goal={fat.goal}
        color="#af52de"
        bgColor="#f3e5f5"
      />
    </div>
  );
}
