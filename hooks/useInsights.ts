'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { WeightLog } from '@/lib/types';
import { AdherenceStatus, DayOfWeekStats, StreakInfo } from '@/lib/calories';

export interface WeightTrend {
  ma7: { date: string; ma: number }[];
  ma30: { date: string; ma: number }[];
  totalChange: number;
  periodChange: number;
}

export interface CalorieDaySummary {
  date: string;
  calories: number;
  goal: number;
  status: AdherenceStatus;
}

export interface AdherenceStats {
  daysOnTarget: number;
  daysUnder: number;
  daysOver: number;
  avgDeficit: number;
}

export interface InsightsData {
  weightData: {
    logs: WeightLog[];
    trends: WeightTrend;
  };
  calorieData: {
    dailySummaries: CalorieDaySummary[];
    adherenceStats: AdherenceStats;
    goal: number;
  };
  streaks: StreakInfo;
  dayOfWeekAnalysis: DayOfWeekStats[];
  period: number;
}

export function useInsights(period: number = 30) {
  const { data: session } = useSession();
  const [data, setData] = useState<InsightsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadInsights = useCallback(async () => {
    if (!session?.user) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log('Insights: Fetching with period', period);
      const res = await fetch(`/api/insights?period=${period}`);
      if (!res.ok) {
        const errorData = await res.json();
        console.error('Insights API error:', res.status, errorData);
        throw new Error(errorData.details || errorData.error || 'Failed to fetch insights');
      }
      const insights = await res.json();
      console.log('Insights: Loaded successfully');
      setData(insights);
    } catch (err) {
      console.error('Error loading insights:', err);
      setError(err instanceof Error ? err.message : 'Failed to load insights');
    } finally {
      setIsLoading(false);
    }
  }, [session, period]);

  useEffect(() => {
    loadInsights();
  }, [loadInsights]);

  return {
    data,
    isLoading,
    error,
    refresh: loadInsights,
  };
}
