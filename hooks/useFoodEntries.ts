'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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

  // Poll while any row is pending. Refresh single rows every 1.5s, fall back
  // to a full reload after each transition so the UI stays consistent.
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    const pendingIds = entries.filter((e) => e.status === 'pending').map((e) => e.id);
    if (pendingIds.length === 0) {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      return;
    }
    if (pollingRef.current) return; // already polling

    pollingRef.current = setInterval(async () => {
      try {
        const results = await Promise.all(
          pendingIds.map((id) => fetch(`/api/food/${id}`).then((r) => (r.ok ? r.json() : null)))
        );
        let anyChanged = false;
        setEntries((prev) => {
          const next = prev.map((entry) => {
            const updated = results.find((r) => r?.entry?.id === entry.id)?.entry;
            if (updated && updated.status !== entry.status) anyChanged = true;
            return updated ?? entry;
          });
          return anyChanged ? next : prev;
        });
      } catch (e) {
        console.error('[useFoodEntries] poll error', e);
      }
    }, 1500);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [entries]);

  // Synchronous (manual) add — caller already has nutrition values.
  const add = useCallback(async (entry: Omit<FoodEntry, 'id' | 'date'> & { date?: string }) => {
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

  // Async log: creates a pending row, returns immediately, then fires the worker.
  // The poll loop above resolves the row in place. Callers can navigate away
  // immediately and the day's list will update on its own.
  const logAsync = useCallback(async (input: {
    description?: string;
    photoDataUrl?: string;
    photoDataUrls?: string[];
    mealType: MealType;
    date?: string;
    additionalContext?: string;
  }) => {
    try {
      const res = await fetch('/api/food/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...input,
          date: input.date || targetDate,
        }),
      });
      if (!res.ok) return null;
      const { entry: pendingEntry } = await res.json();

      // Optimistically render the pending card without waiting for the next reload.
      setEntries((prev) =>
        prev.find((e) => e.id === pendingEntry.id) ? prev : [pendingEntry, ...prev]
      );

      // Fire-and-forget worker dispatch. The browser keeps the request alive even
      // if the user navigates; failures are surfaced via the row's `failed` status.
      fetch(`/api/food/${pendingEntry.id}/process`, { method: 'POST' }).catch((err) =>
        console.error('[useFoodEntries] worker dispatch failed', err)
      );

      return pendingEntry as FoodEntry;
    } catch (error) {
      console.error('Error logging food async:', error);
      return null;
    }
  }, [targetDate]);

  // Append a free-text refinement (e.g. "only ate half this box"), flip the
  // row back to pending, and re-trigger the worker. The photo and original
  // description are preserved server-side, so the AI re-analyzes the same
  // image with the extra hints layered on top.
  const refine = useCallback(async (id: string, additionalContext: string) => {
    try {
      const res = await fetch(`/api/food/${id}/refine`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ additionalContext }),
      });
      if (!res.ok) return null;
      const { entry: updated } = await res.json();
      setEntries((prev) => prev.map((e) => (e.id === id ? updated : e)));
      fetch(`/api/food/${id}/process`, { method: 'POST' }).catch((err) =>
        console.error('[useFoodEntries] worker dispatch failed', err)
      );
      return updated as FoodEntry;
    } catch (e) {
      console.error('Error refining entry:', e);
      return null;
    }
  }, []);

  // Submit an answer to a clarifying question. Moves the row back to pending
  // and triggers the worker to re-analyze.
  const answerClarification = useCallback(async (id: string, answer: string) => {
    try {
      const res = await fetch(`/api/food/${id}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answer }),
      });
      if (!res.ok) return null;
      const { entry: updated } = await res.json();
      setEntries((prev) => prev.map((e) => (e.id === id ? updated : e)));
      fetch(`/api/food/${id}/process`, { method: 'POST' }).catch((err) =>
        console.error('[useFoodEntries] worker dispatch failed', err)
      );
      return updated as FoodEntry;
    } catch (e) {
      console.error('Error answering clarification:', e);
      return null;
    }
  }, []);

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
    logAsync,
    answerClarification,
    refine,
    update,
    remove,
    getEntriesByMeal,
    totals,
    refresh: loadEntries,
  };
}
