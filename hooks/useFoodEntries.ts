'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { FoodEntry, MealType } from '@/lib/types';
import { calculateDailyTotals } from '@/lib/calories';

export function useFoodEntries(date?: string) {
  const { data: session } = useSession();
  const [entries, setEntries] = useState<FoodEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const targetDate = date || new Date().toISOString().split('T')[0];

  const loadEntries = useCallback(async () => {
    if (!session?.user) {
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/food?date=${targetDate}`);
      if (res.ok) {
        const { entries: loadedEntries } = await res.json();
        setEntries(loadedEntries || []);
      }
    } catch (error) {
      console.error('Error loading food entries:', error);
    } finally {
      setIsLoading(false);
    }
  }, [session, targetDate]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  const add = useCallback(async (entry: Omit<FoodEntry, 'id'>) => {
    try {
      const res = await fetch('/api/food', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...entry,
          date: entry.date || targetDate,
        }),
      });

      if (res.ok) {
        const { entry: newEntry } = await res.json();
        await loadEntries();
        return newEntry;
      }
    } catch (error) {
      console.error('Error adding food entry:', error);
    }
    return null;
  }, [targetDate, loadEntries]);

  const update = useCallback(async (id: string, updates: Partial<FoodEntry>) => {
    try {
      const res = await fetch('/api/food', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...updates }),
      });

      if (res.ok) {
        await loadEntries();
      }
    } catch (error) {
      console.error('Error updating food entry:', error);
    }
  }, [loadEntries]);

  const remove = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/food?id=${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        await loadEntries();
      }
    } catch (error) {
      console.error('Error deleting food entry:', error);
    }
  }, [loadEntries]);

  const getEntriesByMeal = useCallback((mealType: MealType) => {
    return entries.filter(e => e.mealType === mealType);
  }, [entries]);

  const totals = calculateDailyTotals(entries);

  return {
    entries,
    isLoading,
    add,
    update,
    remove,
    getEntriesByMeal,
    totals,
    refresh: loadEntries,
  };
}
