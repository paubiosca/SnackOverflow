'use client';

import { useState, useEffect, useCallback } from 'react';
import { FoodEntry, MealType } from '@/lib/types';
import {
  getFoodEntries,
  addFoodEntry,
  updateFoodEntry,
  deleteFoodEntry,
  getFoodEntriesForDate,
} from '@/lib/storage';
import { calculateDailyTotals } from '@/lib/calories';

export function useFoodEntries(date?: string) {
  const [entries, setEntries] = useState<FoodEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const targetDate = date || new Date().toISOString().split('T')[0];

  const loadEntries = useCallback(() => {
    const loaded = date ? getFoodEntriesForDate(targetDate) : getFoodEntries();
    setEntries(loaded);
    setIsLoading(false);
  }, [date, targetDate]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  const add = useCallback((entry: Omit<FoodEntry, 'id' | 'date' | 'timestamp'>) => {
    const newEntry: FoodEntry = {
      ...entry,
      id: crypto.randomUUID(),
      date: targetDate,
      timestamp: new Date().toISOString(),
    };
    addFoodEntry(newEntry);
    loadEntries();
    return newEntry;
  }, [targetDate, loadEntries]);

  const update = useCallback((id: string, updates: Partial<FoodEntry>) => {
    updateFoodEntry(id, updates);
    loadEntries();
  }, [loadEntries]);

  const remove = useCallback((id: string) => {
    deleteFoodEntry(id);
    loadEntries();
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
