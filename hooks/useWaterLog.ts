'use client';

import { useState, useEffect, useCallback } from 'react';
import { WaterLog } from '@/lib/types';
import {
  getWaterLogsForDate,
  addWaterLog,
  deleteWaterLog,
  getTotalWaterForDate,
} from '@/lib/storage';

export function useWaterLog(date?: string) {
  const [logs, setLogs] = useState<WaterLog[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const targetDate = date || new Date().toISOString().split('T')[0];

  const loadLogs = useCallback(() => {
    const loaded = getWaterLogsForDate(targetDate);
    setLogs(loaded);
    setTotal(getTotalWaterForDate(targetDate));
    setIsLoading(false);
  }, [targetDate]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const add = useCallback((amountMl: number) => {
    const newLog: WaterLog = {
      id: crypto.randomUUID(),
      date: targetDate,
      timestamp: new Date().toISOString(),
      amountMl,
    };
    addWaterLog(newLog);
    loadLogs();
    return newLog;
  }, [targetDate, loadLogs]);

  const remove = useCallback((id: string) => {
    deleteWaterLog(id);
    loadLogs();
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
