'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { WaterLog } from '@/lib/types';

export function useWaterLog(date?: string) {
  const { data: session } = useSession();
  const [logs, setLogs] = useState<WaterLog[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const targetDate = date || new Date().toISOString().split('T')[0];

  const loadLogs = useCallback(async () => {
    if (!session?.user) {
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/water?date=${targetDate}`);
      if (res.ok) {
        const { logs: loadedLogs } = await res.json();
        setLogs(loadedLogs || []);
        const totalMl = (loadedLogs || []).reduce(
          (sum: number, log: WaterLog) => sum + log.amountMl,
          0
        );
        setTotal(totalMl);
      }
    } catch (error) {
      console.error('Error loading water logs:', error);
    } finally {
      setIsLoading(false);
    }
  }, [session, targetDate]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const add = useCallback(async (amountMl: number) => {
    try {
      const res = await fetch('/api/water', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: targetDate,
          amountMl,
        }),
      });

      if (res.ok) {
        const { log: newLog } = await res.json();
        await loadLogs();
        return newLog;
      }
    } catch (error) {
      console.error('Error adding water log:', error);
    }
    return null;
  }, [targetDate, loadLogs]);

  const remove = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/water?id=${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        await loadLogs();
      }
    } catch (error) {
      console.error('Error deleting water log:', error);
    }
  }, [loadLogs]);

  return {
    logs,
    total,
    isLoading,
    add,
    remove,
    refresh: loadLogs,
  };
}
