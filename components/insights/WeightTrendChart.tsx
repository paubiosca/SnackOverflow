'use client';

import Card from '@/components/ui/Card';
import { WeightLog } from '@/lib/types';
import { TrendingDown, TrendingUp, Minus } from 'lucide-react';

interface WeightTrendChartProps {
  logs: WeightLog[];
  ma7: { date: string; ma: number }[];
  periodChange: number;
  period: number;
}

export default function WeightTrendChart({
  logs,
  ma7,
  periodChange,
  period,
}: WeightTrendChartProps) {
  if (logs.length === 0) {
    return (
      <Card>
        <h3 className="font-semibold text-text-primary mb-4">Weight Trend</h3>
        <div className="h-48 flex items-center justify-center text-text-secondary">
          No weight data for this period
        </div>
      </Card>
    );
  }

  // Calculate chart dimensions
  const width = 320;
  const height = 180;
  const padding = { top: 20, right: 20, bottom: 30, left: 40 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Find min/max values
  const allWeights = logs.map(l => l.weightKg);
  const minWeight = Math.floor(Math.min(...allWeights) - 1);
  const maxWeight = Math.ceil(Math.max(...allWeights) + 1);
  const weightRange = maxWeight - minWeight || 1;

  // Scale functions
  const xScale = (index: number) => padding.left + (index / Math.max(logs.length - 1, 1)) * chartWidth;
  const yScale = (weight: number) => padding.top + ((maxWeight - weight) / weightRange) * chartHeight;

  // Generate path for weight line
  const weightPath = logs
    .map((log, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i)} ${yScale(log.weightKg)}`)
    .join(' ');

  // Generate path for MA7 line (match dates with main data)
  const ma7Path = ma7.length > 1
    ? ma7
        .map((point, i) => {
          const logIndex = logs.findIndex(l => l.date === point.date);
          if (logIndex === -1) return null;
          return `${i === 0 ? 'M' : 'L'} ${xScale(logIndex)} ${yScale(point.ma)}`;
        })
        .filter(Boolean)
        .join(' ')
    : '';

  // Y-axis labels
  const yLabels = Array.from({ length: 5 }, (_, i) => {
    const weight = maxWeight - (i * weightRange) / 4;
    return { value: Math.round(weight * 10) / 10, y: yScale(weight) };
  });

  // Trend icon and color
  const getTrendDisplay = () => {
    if (periodChange < -0.5) {
      return { icon: TrendingDown, color: 'text-accent-green', label: 'Down' };
    }
    if (periodChange > 0.5) {
      return { icon: TrendingUp, color: 'text-accent-red', label: 'Up' };
    }
    return { icon: Minus, color: 'text-text-secondary', label: 'Stable' };
  };

  const trend = getTrendDisplay();
  const TrendIcon = trend.icon;

  return (
    <Card>
      <div className="flex justify-between items-start mb-4">
        <h3 className="font-semibold text-text-primary">Weight Trend</h3>
        <div className={`flex items-center gap-1 ${trend.color}`}>
          <TrendIcon className="w-4 h-4" />
          <span className="text-sm font-medium">
            {periodChange > 0 ? '+' : ''}{periodChange} kg
          </span>
        </div>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
        {/* Y-axis labels */}
        {yLabels.map(({ value, y }) => (
          <g key={value}>
            <line
              x1={padding.left}
              y1={y}
              x2={width - padding.right}
              y2={y}
              stroke="#e5e7eb"
              strokeWidth="1"
            />
            <text
              x={padding.left - 8}
              y={y + 4}
              textAnchor="end"
              className="text-[10px] fill-text-secondary"
            >
              {value}
            </text>
          </g>
        ))}

        {/* MA7 line (dashed) */}
        {ma7Path && (
          <path
            d={ma7Path}
            fill="none"
            stroke="#22c55e"
            strokeWidth="2"
            strokeDasharray="4 4"
            opacity="0.7"
          />
        )}

        {/* Weight line */}
        <path
          d={weightPath}
          fill="none"
          stroke="#3b82f6"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Data points */}
        {logs.map((log, i) => (
          <circle
            key={log.id}
            cx={xScale(i)}
            cy={yScale(log.weightKg)}
            r="4"
            fill="#3b82f6"
          />
        ))}
      </svg>

      {/* Legend */}
      <div className="flex gap-4 mt-2 text-xs text-text-secondary">
        <div className="flex items-center gap-1">
          <div className="w-4 h-0.5 bg-accent-blue rounded" />
          <span>Weight</span>
        </div>
        {ma7.length > 0 && (
          <div className="flex items-center gap-1">
            <div className="w-4 h-0.5 bg-accent-green rounded opacity-70" style={{ borderStyle: 'dashed' }} />
            <span>7-day avg</span>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-border-light">
        <div>
          <div className="text-xs text-text-secondary">Current</div>
          <div className="font-semibold text-text-primary">
            {logs[logs.length - 1]?.weightKg || '-'} kg
          </div>
        </div>
        <div>
          <div className="text-xs text-text-secondary">{period}-day change</div>
          <div className={`font-semibold ${trend.color}`}>
            {periodChange > 0 ? '+' : ''}{periodChange} kg
          </div>
        </div>
      </div>
    </Card>
  );
}
