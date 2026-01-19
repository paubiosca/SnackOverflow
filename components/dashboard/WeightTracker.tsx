'use client';

import { useState, useEffect, useMemo } from 'react';
import { getWeightLogs, addWeightLog } from '@/lib/storage';
import { WeightLog } from '@/lib/types';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import { Scale, TrendingDown, TrendingUp, Minus, ChevronDown, ChevronUp } from 'lucide-react';

interface WeightTrackerProps {
  startingWeight: number; // From profile
}

const getLocalDateString = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Calculate moving average for the last N days
const calculateMovingAverage = (logs: WeightLog[], days: number): number | null => {
  if (logs.length === 0) return null;

  const sortedLogs = [...logs].sort((a, b) =>
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const recentLogs = sortedLogs.slice(0, days);
  if (recentLogs.length === 0) return null;

  const sum = recentLogs.reduce((acc, log) => acc + log.weightKg, 0);
  return sum / recentLogs.length;
};

export default function WeightTracker({ startingWeight }: WeightTrackerProps) {
  const [logs, setLogs] = useState<WeightLog[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [weightInput, setWeightInput] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);

  const today = getLocalDateString();

  useEffect(() => {
    const weightLogs = getWeightLogs();
    setLogs(weightLogs);

    // Check if we have today's weight
    const hasToday = weightLogs.some(log => log.date === today);
    if (!hasToday) {
      setShowPrompt(true);
    }
  }, [today]);

  const todayLog = logs.find(log => log.date === today);
  const latestWeight = logs.length > 0
    ? [...logs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0].weightKg
    : startingWeight;

  const stats = useMemo(() => {
    if (logs.length === 0) return null;

    const sortedLogs = [...logs].sort((a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const firstLog = sortedLogs[0];
    const lastLog = sortedLogs[sortedLogs.length - 1];

    // Calculate change since start
    const totalChange = lastLog.weightKg - firstLog.weightKg;

    // Calculate this month's change
    const thisMonth = new Date().toISOString().slice(0, 7);
    const thisMonthLogs = sortedLogs.filter(log => log.date.startsWith(thisMonth));
    const monthChange = thisMonthLogs.length > 1
      ? thisMonthLogs[thisMonthLogs.length - 1].weightKg - thisMonthLogs[0].weightKg
      : 0;

    // Moving averages
    const ma7 = calculateMovingAverage(logs, 7);
    const ma30 = calculateMovingAverage(logs, 30);

    // First week average vs last week average (for trend)
    const firstWeek = sortedLogs.slice(0, Math.min(7, sortedLogs.length));
    const lastWeek = sortedLogs.slice(-Math.min(7, sortedLogs.length));
    const firstWeekAvg = firstWeek.reduce((s, l) => s + l.weightKg, 0) / firstWeek.length;
    const lastWeekAvg = lastWeek.reduce((s, l) => s + l.weightKg, 0) / lastWeek.length;
    const weeklyTrend = lastWeekAvg - firstWeekAvg;

    return {
      totalChange,
      monthChange,
      ma7,
      ma30,
      weeklyTrend,
      daysTracked: logs.length,
      firstDate: firstLog.date,
    };
  }, [logs]);

  const handleLogWeight = () => {
    const weight = parseFloat(weightInput);
    if (isNaN(weight) || weight <= 0) return;

    const newLog: WeightLog = {
      id: Date.now().toString(),
      date: today,
      weightKg: weight,
    };

    addWeightLog(newLog);
    setLogs(getWeightLogs());
    setShowModal(false);
    setShowPrompt(false);
    setWeightInput('');
  };

  const getTrendIcon = (change: number) => {
    if (change < -0.1) return <TrendingDown className="w-4 h-4 text-accent-green" />;
    if (change > 0.1) return <TrendingUp className="w-4 h-4 text-accent-red" />;
    return <Minus className="w-4 h-4 text-text-secondary" />;
  };

  const formatChange = (change: number) => {
    const sign = change > 0 ? '+' : '';
    return `${sign}${change.toFixed(1)} kg`;
  };

  return (
    <>
      <Card>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-accent-purple/10 rounded-full flex items-center justify-center">
              <Scale className="w-5 h-5 text-accent-purple" />
            </div>
            <div>
              <div className="text-sm text-text-secondary">Current Weight</div>
              <div className="text-xl font-bold text-text-primary">
                {todayLog ? todayLog.weightKg.toFixed(1) : latestWeight.toFixed(1)} kg
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!todayLog && showPrompt && (
              <Button size="sm" onClick={() => setShowModal(true)}>
                Log Today
              </Button>
            )}
            {todayLog && (
              <span className="text-xs text-accent-green bg-accent-green/10 px-2 py-1 rounded-full">
                Logged
              </span>
            )}
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-2 hover:bg-secondary-bg rounded-apple transition-colors"
            >
              {expanded ? (
                <ChevronUp className="w-5 h-5 text-text-secondary" />
              ) : (
                <ChevronDown className="w-5 h-5 text-text-secondary" />
              )}
            </button>
          </div>
        </div>

        {/* Expanded stats */}
        {expanded && stats && (
          <div className="mt-4 pt-4 border-t border-border-light space-y-3">
            {/* Quick stats row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-secondary-bg rounded-apple">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-text-secondary">This Month</span>
                  {getTrendIcon(stats.monthChange)}
                </div>
                <span className={`text-sm font-semibold ${
                  stats.monthChange < 0 ? 'text-accent-green' :
                  stats.monthChange > 0 ? 'text-accent-red' : 'text-text-primary'
                }`}>
                  {formatChange(stats.monthChange)}
                </span>
              </div>
              <div className="p-3 bg-secondary-bg rounded-apple">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-text-secondary">Total Change</span>
                  {getTrendIcon(stats.totalChange)}
                </div>
                <span className={`text-sm font-semibold ${
                  stats.totalChange < 0 ? 'text-accent-green' :
                  stats.totalChange > 0 ? 'text-accent-red' : 'text-text-primary'
                }`}>
                  {formatChange(stats.totalChange)}
                </span>
              </div>
            </div>

            {/* Moving averages */}
            <div className="space-y-2">
              <div className="text-xs text-text-secondary">Moving Averages</div>
              <div className="flex justify-between items-center py-2 border-b border-border-light">
                <span className="text-sm text-text-secondary">7-day average</span>
                <span className="text-sm font-medium text-text-primary">
                  {stats.ma7 ? `${stats.ma7.toFixed(1)} kg` : '-'}
                </span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-sm text-text-secondary">30-day average</span>
                <span className="text-sm font-medium text-text-primary">
                  {stats.ma30 ? `${stats.ma30.toFixed(1)} kg` : '-'}
                </span>
              </div>
            </div>

            {/* Tracking info */}
            <div className="text-xs text-text-secondary text-center pt-2">
              Tracking for {stats.daysTracked} days since {new Date(stats.firstDate).toLocaleDateString()}
            </div>
          </div>
        )}

        {/* Prompt to log if not logged today */}
        {!todayLog && !showPrompt && (
          <button
            onClick={() => setShowModal(true)}
            className="w-full mt-3 py-2 text-sm text-accent-purple hover:bg-accent-purple/5 rounded-apple transition-colors"
          >
            + Log today&apos;s weight
          </button>
        )}
      </Card>

      {/* Weight entry modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Log Weight"
      >
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">
            Enter your weight for today
          </p>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              step="0.1"
              placeholder={latestWeight.toFixed(1)}
              value={weightInput}
              onChange={(e) => setWeightInput(e.target.value)}
              autoFocus
            />
            <span className="text-text-secondary">kg</span>
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleLogWeight} fullWidth disabled={!weightInput}>
              Save
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
