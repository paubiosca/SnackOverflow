'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useProfile } from '@/hooks/useProfile';
import { calculateDailyTotals, calculateDeficit } from '@/lib/calories';
import { FoodEntry, MEAL_LABELS, MealType } from '@/lib/types';
import BottomNav from '@/components/ui/BottomNav';
import Card from '@/components/ui/Card';
import DeficitBarStrip, { DayPoint } from '@/components/history/DeficitBarStrip';
import WeekStats from '@/components/history/WeekStats';
import { Skeleton, SkeletonLine } from '@/components/ui/Skeleton';
import { Sunrise, Sun, Moon, Cookie, Flame, Target, Scale, X } from 'lucide-react';

type Range = 7 | 30;

const MEAL_ICONS: Record<MealType, React.ReactNode> = {
  breakfast: <Sunrise className="w-4 h-4 text-amber-500" />,
  lunch: <Sun className="w-4 h-4 text-yellow-500" />,
  dinner: <Moon className="w-4 h-4 text-indigo-500" />,
  snack: <Cookie className="w-4 h-4 text-orange-400" />,
};

const toLocalDate = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const buildWindow = (todayStr: string, days: number): string[] => {
  const out: string[] = [];
  const today = new Date(todayStr + 'T12:00:00');
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    out.push(toLocalDate(d));
  }
  return out;
};

interface ActivityRow {
  date: string;
  activeKcal: number | null;
  bmrKcal: number | null;
  totalKcal: number | null;
}

export default function History() {
  const { data: session } = useSession();
  const { profile, calorieGoal } = useProfile();
  const [range, setRange] = useState<Range>(30);
  const [entriesByDate, setEntriesByDate] = useState<Record<string, FoodEntry[]>>({});
  const [activityByDate, setActivityByDate] = useState<Record<string, ActivityRow>>({});
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // Hydration guard — see app/page.tsx note. Server returns a stable shell;
  // todayStr / new Date() only run after mount on the client.
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const todayStr = useMemo(() => toLocalDate(new Date()), []);
  const window = useMemo(() => buildWindow(todayStr, range), [todayStr, range]);

  const targetDeficit = useMemo(() => {
    if (!profile) return 500;
    const raw = Math.abs(calculateDeficit(profile.goalType, profile.goalValue ?? 0));
    return raw > 0 ? Math.min(1000, raw) : 500;
  }, [profile]);

  useEffect(() => {
    if (!session?.user) return;
    let cancelled = false;
    setIsLoading(true);
    const start = window[0];
    const end = window[window.length - 1];
    Promise.all([
      fetch('/api/food').then((r) => (r.ok ? r.json() : { entries: [] })),
      fetch(`/api/health/activity?start=${start}&end=${end}`).then((r) => (r.ok ? r.json() : { days: [] })),
    ])
      .then(([food, activity]: [{ entries: FoodEntry[] }, { days: ActivityRow[] }]) => {
        if (cancelled) return;
        const grouped: Record<string, FoodEntry[]> = {};
        (food.entries || []).forEach((e) => {
          const key = e.date.includes('T') ? e.date.split('T')[0] : e.date;
          (grouped[key] ||= []).push(e);
        });
        const acts: Record<string, ActivityRow> = {};
        (activity.days || []).forEach((a) => {
          const key = typeof a.date === 'string' && a.date.includes('T') ? a.date.split('T')[0] : (a.date as string);
          acts[key] = a;
        });
        setEntriesByDate(grouped);
        setActivityByDate(acts);
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));
    return () => { cancelled = true; };
  }, [session, window]);

  const days: DayPoint[] = useMemo(() => {
    return window.map((date) => {
      const entries = entriesByDate[date] || [];
      const totals = calculateDailyTotals(entries);
      const burned = activityByDate[date]?.activeKcal ?? 0;
      // Each day's eating goal = base goal + active calories burned that day.
      // Burn raises the budget you can eat without breaking your planned deficit.
      return {
        date,
        consumed: totals.calories,
        goal: calorieGoal + (burned ?? 0),
        hasData: entries.length > 0,
      };
    });
  }, [window, entriesByDate, activityByDate, calorieGoal]);

  const last7 = useMemo(() => days.slice(-Math.min(7, days.length)), [days]);

  const selectedEntries = selectedDate ? entriesByDate[selectedDate] || [] : [];
  const selectedTotals = calculateDailyTotals(selectedEntries);
  const selectedActivity = selectedDate ? activityByDate[selectedDate] : null;
  const selectedBurned = selectedActivity?.activeKcal ?? 0;
  const selectedAdjustedGoal = calorieGoal + selectedBurned;
  const selectedDelta = selectedAdjustedGoal - selectedTotals.calories;

  const selectedByMeal = useMemo(() => {
    const grouped: Record<MealType, FoodEntry[]> = { breakfast: [], lunch: [], dinner: [], snack: [] };
    selectedEntries.forEach((e) => grouped[e.mealType as MealType]?.push(e));
    return grouped;
  }, [selectedEntries]);

  return (
    <main className="min-h-screen pb-28">
      <header
        className="bg-white px-4 pb-3 sticky top-0 z-40 shadow-sm"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}
      >
        <h1 className="text-2xl font-bold text-text-primary">History</h1>
      </header>

      <div className="px-4 py-4 space-y-4 page-transition">
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-text-primary">
              {range === 7 ? 'Last 7 days' : 'Last 30 days'}
            </h2>
            <RangeToggle value={range} onChange={(r) => { setRange(r); setSelectedDate(null); }} />
          </div>

          {isLoading || !mounted ? (
            <BarStripSkeleton count={range} />
          ) : (
            <DeficitBarStrip
              days={days}
              targetDeficit={targetDeficit}
              selectedDate={selectedDate}
              onSelect={(d) => setSelectedDate(d === selectedDate ? null : d)}
            />
          )}

          {selectedDate && (
            <div className="mt-4 pt-4 border-t border-border-light animate-fade-in">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="text-xs text-text-secondary">
                    {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long' })}
                  </div>
                  <div className="font-semibold text-text-primary">
                    {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedDate(null)}
                  className="p-1.5 -mr-1 -mt-1 rounded-full hover:bg-secondary-bg"
                  aria-label="Close detail"
                >
                  <X className="w-4 h-4 text-text-secondary" />
                </button>
              </div>

              {/* Net deficit summary — the headline for the day. */}
              <div className={`rounded-apple px-3 py-3 mb-3 ${
                selectedDelta >= 0 ? 'bg-green-50' : 'bg-red-50'
              }`}>
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-text-secondary">Net deficit</span>
                  <span className={`text-2xl font-bold ${
                    selectedDelta >= 0 ? 'text-accent-green' : 'text-accent-red'
                  }`}>
                    {selectedDelta >= 0 ? '−' : '+'}{Math.abs(selectedDelta)} kcal
                  </span>
                </div>
              </div>

              {/* Eaten vs goal breakdown, with active burn called out. */}
              <div className="grid grid-cols-3 gap-2 mb-3">
                <Stat
                  icon={<Target className="w-3.5 h-3.5 text-accent-blue" />}
                  label="Goal"
                  value={selectedAdjustedGoal}
                  sub={selectedBurned > 0 ? `${calorieGoal} + ${selectedBurned}` : undefined}
                  tone="text-accent-blue"
                />
                <Stat
                  icon={<Scale className="w-3.5 h-3.5 text-text-primary" />}
                  label="Eaten"
                  value={selectedTotals.calories}
                  tone="text-text-primary"
                />
                <Stat
                  icon={<Flame className="w-3.5 h-3.5 text-accent-orange" />}
                  label="Burned"
                  value={selectedBurned}
                  sub={selectedBurned === 0 ? 'no data' : undefined}
                  tone="text-accent-orange"
                />
              </div>

              {/* Macros */}
              <div className="grid grid-cols-3 gap-2 mb-3">
                <Tile value={`${selectedTotals.protein}g`} label="Protein" tone="text-accent-orange" />
                <Tile value={`${selectedTotals.carbs}g`} label="Carbs" tone="text-accent-green" />
                <Tile value={`${selectedTotals.fat}g`} label="Fat" tone="text-accent-purple" />
              </div>

              {selectedEntries.length === 0 ? (
                <p className="text-center text-text-secondary py-2 text-sm">No food logged this day</p>
              ) : (
                <div className="space-y-2.5">
                  {(Object.entries(selectedByMeal) as [MealType, FoodEntry[]][]).map(([mealType, list]) => {
                    if (list.length === 0) return null;
                    return (
                      <div key={mealType}>
                        <div className="flex items-center gap-2 mb-1">
                          {MEAL_ICONS[mealType]}
                          <span className="text-xs font-medium text-text-secondary uppercase tracking-wide">
                            {MEAL_LABELS[mealType]}
                          </span>
                        </div>
                        {list.map((entry) => (
                          <div
                            key={entry.id}
                            className="flex justify-between items-center py-1.5 border-b border-border-light last:border-0"
                          >
                            <span className="text-text-primary text-[14px] pr-2 truncate">{entry.name}</span>
                            <span className="text-xs text-text-secondary shrink-0">{entry.calories} kcal</span>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </Card>

        <Card>
          <h2 className="font-semibold text-text-primary mb-3">This week</h2>
          <WeekStats days={last7} targetDeficit={targetDeficit} />
        </Card>
      </div>

      <BottomNav />
    </main>
  );
}

function BarStripSkeleton({ count }: { count: number }) {
  // Match DeficitBarStrip's silhouette: midline + bars of varying heights so
  // the user sees the chart shape forming before the data lands.
  const barWidth = count <= 7 ? 28 : count <= 14 ? 16 : 9;
  const gap = count <= 7 ? 8 : count <= 14 ? 4 : 3;
  const HALF = 90;
  const GUTTER = 36;
  // Deterministic pseudo-random based on index so SSR and client render identical
  // markup (avoids hydration mismatch). Looks varied enough to feel natural.
  const heights = Array.from({ length: count }, (_, i) => {
    const seed = Math.sin(i * 12.9898) * 43758.5453;
    const frac = seed - Math.floor(seed);
    return 8 + Math.floor(frac * (HALF - 14));
  });
  const aboves = Array.from({ length: count }, (_, i) => {
    const seed = Math.sin(i * 78.233) * 43758.5453;
    const frac = seed - Math.floor(seed);
    return frac > 0.25;
  });
  return (
    <div className="select-none">
      <div className="relative" style={{ height: HALF * 2, paddingRight: GUTTER }}>
        <div
          className="absolute left-0 border-t border-dashed border-gray-200 pointer-events-none"
          style={{ top: HALF, right: GUTTER }}
        />
        <div className="absolute inset-0 flex justify-center" style={{ paddingRight: GUTTER, gap: `${gap}px` }}>
          {heights.map((h, i) => (
            <div key={i} className="flex flex-col items-stretch" style={{ height: HALF * 2, width: barWidth }}>
              <div className="flex items-end justify-center" style={{ height: HALF }}>
                {aboves[i] && <Skeleton className="w-full rounded-t-sm" style={{ height: h }} />}
              </div>
              <div className="flex items-start justify-center" style={{ height: HALF }}>
                {!aboves[i] && <Skeleton className="w-full rounded-b-sm" style={{ height: h }} />}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between mt-3">
        <SkeletonLine className="w-12 h-2.5" />
        <SkeletonLine className="w-32 h-2.5" />
        <SkeletonLine className="w-10 h-2.5" />
      </div>
    </div>
  );
}

function RangeToggle({ value, onChange }: { value: Range; onChange: (r: Range) => void }) {
  return (
    <div className="segmented-control flex">
      {([7, 30] as Range[]).map((r) => (
        <button
          key={r}
          onClick={() => onChange(r)}
          className={`segmented-control-item px-3 py-1 text-xs font-medium ${
            value === r ? 'active text-text-primary' : 'text-text-secondary'
          }`}
        >
          {r}d
        </button>
      ))}
    </div>
  );
}

function Stat({ icon, label, value, sub, tone }: {
  icon: React.ReactNode;
  label: string;
  value: number;
  sub?: string;
  tone: string;
}) {
  return (
    <div className="bg-secondary-bg rounded-apple px-2 py-2">
      <div className="flex items-center gap-1 text-[10px] text-text-secondary uppercase tracking-wide">
        {icon}
        {label}
      </div>
      <div className={`text-lg font-bold leading-tight ${tone}`}>{value}</div>
      {sub && <div className="text-[10px] text-text-secondary truncate">{sub}</div>}
    </div>
  );
}

function Tile({ value, label, tone }: { value: string | number; label: string; tone: string }) {
  return (
    <div className="text-center p-2 bg-secondary-bg rounded-apple">
      <div className={`text-sm font-bold ${tone}`}>{value}</div>
      <div className="text-[10px] text-text-secondary">{label}</div>
    </div>
  );
}
