'use client';

interface PeriodSelectorProps {
  period: number;
  onChange: (period: number) => void;
}

export default function PeriodSelector({ period, onChange }: PeriodSelectorProps) {
  const periods = [
    { value: 30, label: '30 Days' },
    { value: 90, label: '90 Days' },
  ];

  return (
    <div className="flex gap-2 bg-secondary-bg rounded-apple p-1">
      {periods.map(({ value, label }) => (
        <button
          key={value}
          onClick={() => onChange(value)}
          className={`flex-1 py-2 px-4 rounded-apple text-sm font-medium transition-all ${
            period === value
              ? 'bg-white text-accent-blue shadow-sm'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
