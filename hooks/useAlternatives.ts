'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { AlternativeSuggestion } from '@/lib/types';

export function useAlternatives(date?: string) {
  const { data: session } = useSession();
  const [suggestions, setSuggestions] = useState<AlternativeSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAlts = useCallback(async () => {
    if (!session?.user) return;
    setIsLoading(true);
    try {
      const url = date ? `/api/food/alternatives?date=${encodeURIComponent(date)}` : '/api/food/alternatives';
      const res = await fetch(url);
      if (!res.ok) {
        setSuggestions([]);
        return;
      }
      const data = await res.json();
      setSuggestions(data.suggestions || []);
    } catch {
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  }, [session, date]);

  useEffect(() => {
    fetchAlts();
  }, [fetchAlts]);

  return { suggestions, isLoading, refresh: fetchAlts };
}
