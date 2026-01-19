'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useProfile } from '@/hooks/useProfile';
import { calculateDailyTotals, getCalorieStatus } from '@/lib/calories';
import { FoodEntry, MEAL_LABELS, MealType } from '@/lib/types';
import BottomNav from '@/components/ui/BottomNav';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { Sunrise, Sun, Moon, Cookie } from 'lucide-react';
import { ReactNode } from 'react';

const MEAL_ICONS: Record<MealType, ReactNode> = {
  breakfast: <Sunrise className="w-4 h-4 text-amber-500" />,
  lunch: <Sun className="w-4 h-4 text-yellow-500" />,
  dinner: <Moon className="w-4 h-4 text-indigo-500" />,
  snack: <Cookie className="w-4 h-4 text-orange-400" />,
};

// Helper to get local date string (avoids timezone issues)
const getLocalDateString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function History() {
  const { data: session } = useSession();
  const { calorieGoal } = useProfile();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [entriesCache, setEntriesCache] = useState<Record<string, FoodEntry[]>>({});
  const [isLoadingEntries, setIsLoadingEntries] = useState(false);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Fetch entries for the visible month
  const fetchEntriesForMonth = useCallback(async () => {
    if (!session?.user) {
      console.log('Calendar: No session, skipping fetch');
      return;
    }

    setIsLoadingEntries(true);
    try {
      // Fetch all entries (the API returns all entries for the user)
      const res = await fetch('/api/food');
      if (res.ok) {
        const { entries } = await res.json();
        // Group by date (normalize date format to YYYY-MM-DD)
        const grouped: Record<string, FoodEntry[]> = {};
        console.log('Calendar: Raw entries from API:', entries?.length || 0, 'entries');
        (entries || []).forEach((entry: FoodEntry) => {
          // Normalize date to YYYY-MM-DD format (handles both "2025-01-19" and "2025-01-19T00:00:00.000Z")
          const dateKey = entry.date.includes('T') ? entry.date.split('T')[0] : entry.date;
          if (!grouped[dateKey]) {
            grouped[dateKey] = [];
          }
          grouped[dateKey].push(entry);
        });
        console.log('Calendar: Grouped entries by dates:', Object.keys(grouped));
        setEntriesCache(grouped);
      }
    } catch (error) {
      console.error('Error fetching entries:', error);
    } finally {
      setIsLoadingEntries(false);
    }
  }, [session]);

  useEffect(() => {
    fetchEntriesForMonth();
  }, [fetchEntriesForMonth]);

  const getEntriesForDate = useCallback((date: string): FoodEntry[] => {
    return entriesCache[date] || [];
  }, [entriesCache]);

  const daysInMonth = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days: { date: Date; dateString: string; dayOfMonth: number }[] = [];

    // Add padding for first week
    const startPadding = firstDay.getDay();
    for (let i = 0; i < startPadding; i++) {
      const date = new Date(year, month, -startPadding + i + 1);
      days.push({
        date,
        dateString: getLocalDateString(date),
        dayOfMonth: date.getDate(),
      });
    }

    // Add days of month
    for (let i = 1; i <= lastDay.getDate(); i++) {
      const date = new Date(year, month, i);
      days.push({
        date,
        dateString: getLocalDateString(date),
        dayOfMonth: i,
      });
    }

    return days;
  }, [year, month]);

  const getStatusForDate = (dateString: string) => {
    const entries = getEntriesForDate(dateString);
    if (entries.length === 0) return 'no_data';
    const totals = calculateDailyTotals(entries);
    return getCalorieStatus(totals.calories, calorieGoal);
  };

  const statusColors = {
    under: 'bg-accent-green',
    on_target: 'bg-accent-blue',
    over: 'bg-accent-red',
    no_data: 'bg-gray-200',
  };

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const selectedDayEntries = selectedDate ? getEntriesForDate(selectedDate) : [];
  const selectedDayTotals = calculateDailyTotals(selectedDayEntries);

  const entriesByMeal = useMemo(() => {
    const grouped: Record<MealType, FoodEntry[]> = {
      breakfast: [],
      lunch: [],
      dinner: [],
      snack: [],
    };
    selectedDayEntries.forEach(entry => {
      grouped[entry.mealType as MealType].push(entry);
    });
    return grouped;
  }, [selectedDayEntries]);

  const monthName = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <main className="min-h-screen pb-24">
      {/* Header */}
      <header className="bg-white px-4 pt-12 pb-4 sticky top-0 z-40 shadow-sm">
        <h1 className="text-2xl font-bold text-text-primary">History</h1>
      </header>

      <div className="px-4 py-4 space-y-4 page-transition">
        {/* Calendar */}
        <Card>
          {/* Month navigation */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={prevMonth}
              className="p-2 hover:bg-secondary-bg rounded-apple transition-colors"
            >
              <svg className="w-5 h-5 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h2 className="font-semibold text-text-primary">{monthName}</h2>
            <button
              onClick={nextMonth}
              className="p-2 hover:bg-secondary-bg rounded-apple transition-colors"
            >
              <svg className="w-5 h-5 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="text-center text-xs text-text-secondary font-medium py-1">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1">
            {daysInMonth.map(({ date, dateString, dayOfMonth }) => {
              const isCurrentMonth = date.getMonth() === month;
              const isToday = dateString === getLocalDateString(new Date());
              const isSelected = dateString === selectedDate;
              const status = isCurrentMonth ? getStatusForDate(dateString) : 'no_data';

              return (
                <button
                  key={dateString}
                  onClick={() => setSelectedDate(dateString)}
                  className={`aspect-square flex flex-col items-center justify-center rounded-apple text-sm transition-all ${
                    !isCurrentMonth ? 'opacity-30' : ''
                  } ${isSelected ? 'ring-2 ring-accent-blue' : ''} ${
                    isToday ? 'font-bold' : ''
                  }`}
                >
                  <span className={isToday ? 'text-accent-blue' : 'text-text-primary'}>
                    {dayOfMonth}
                  </span>
                  <div className={`w-2 h-2 rounded-full mt-1 ${statusColors[status]}`} />
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex justify-center gap-4 mt-4 pt-4 border-t border-border-light">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-accent-green" />
              <span className="text-xs text-text-secondary">Under</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-accent-blue" />
              <span className="text-xs text-text-secondary">On Target</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-accent-red" />
              <span className="text-xs text-text-secondary">Over</span>
            </div>
          </div>
        </Card>

        {/* Selected day details */}
        {selectedDate && (
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-text-primary">
                {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'short',
                  day: 'numeric',
                })}
              </h3>
              <Button variant="ghost" size="sm" onClick={() => setSelectedDate(null)}>
                Close
              </Button>
            </div>

            {/* Day summary */}
            <div className="grid grid-cols-4 gap-2 mb-4">
              <div className="text-center p-2 bg-secondary-bg rounded-apple">
                <div className="text-lg font-bold text-accent-blue">{selectedDayTotals.calories}</div>
                <div className="text-xs text-text-secondary">kcal</div>
              </div>
              <div className="text-center p-2 bg-secondary-bg rounded-apple">
                <div className="text-lg font-bold text-accent-orange">{selectedDayTotals.protein}g</div>
                <div className="text-xs text-text-secondary">Protein</div>
              </div>
              <div className="text-center p-2 bg-secondary-bg rounded-apple">
                <div className="text-lg font-bold text-accent-green">{selectedDayTotals.carbs}g</div>
                <div className="text-xs text-text-secondary">Carbs</div>
              </div>
              <div className="text-center p-2 bg-secondary-bg rounded-apple">
                <div className="text-lg font-bold text-accent-purple">{selectedDayTotals.fat}g</div>
                <div className="text-xs text-text-secondary">Fat</div>
              </div>
            </div>

            {/* Entries by meal */}
            {selectedDayEntries.length === 0 ? (
              <p className="text-center text-text-secondary py-4">No food logged this day</p>
            ) : (
              <div className="space-y-3">
                {(Object.entries(entriesByMeal) as [MealType, FoodEntry[]][]).map(([mealType, entries]) => {
                  if (entries.length === 0) return null;
                  return (
                    <div key={mealType}>
                      <div className="flex items-center gap-2 mb-2">
                        <span>{MEAL_ICONS[mealType]}</span>
                        <span className="text-sm font-medium text-text-secondary">
                          {MEAL_LABELS[mealType]}
                        </span>
                      </div>
                      {entries.map(entry => (
                        <div
                          key={entry.id}
                          className="flex justify-between items-center py-2 border-b border-border-light last:border-0"
                        >
                          <span className="text-text-primary">{entry.name}</span>
                          <span className="text-sm text-text-secondary">{entry.calories} kcal</span>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        )}
      </div>

      <BottomNav />
    </main>
  );
}
