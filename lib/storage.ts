import { UserProfile, FoodEntry, WaterLog, WeightLog } from './types';

const STORAGE_KEYS = {
  PROFILE: 'snackoverflow-profile',
  FOOD_ENTRIES: 'snackoverflow-food',
  WATER_LOGS: 'snackoverflow-water',
  WEIGHT_LOGS: 'snackoverflow-weight',
} as const;

// Helper to check if we're in browser
const isBrowser = typeof window !== 'undefined';

// Profile
export function getProfile(): UserProfile | null {
  if (!isBrowser) return null;
  const data = localStorage.getItem(STORAGE_KEYS.PROFILE);
  return data ? JSON.parse(data) : null;
}

export function saveProfile(profile: UserProfile): void {
  if (!isBrowser) return;
  localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(profile));
}

export function hasCompletedOnboarding(): boolean {
  return getProfile() !== null;
}

// Food Entries
export function getFoodEntries(): FoodEntry[] {
  if (!isBrowser) return [];
  const data = localStorage.getItem(STORAGE_KEYS.FOOD_ENTRIES);
  return data ? JSON.parse(data) : [];
}

export function saveFoodEntries(entries: FoodEntry[]): void {
  if (!isBrowser) return;
  localStorage.setItem(STORAGE_KEYS.FOOD_ENTRIES, JSON.stringify(entries));
}

export function addFoodEntry(entry: FoodEntry): void {
  const entries = getFoodEntries();
  entries.push(entry);
  saveFoodEntries(entries);
}

export function updateFoodEntry(id: string, updates: Partial<FoodEntry>): void {
  const entries = getFoodEntries();
  const index = entries.findIndex(e => e.id === id);
  if (index !== -1) {
    entries[index] = { ...entries[index], ...updates };
    saveFoodEntries(entries);
  }
}

export function deleteFoodEntry(id: string): void {
  const entries = getFoodEntries();
  saveFoodEntries(entries.filter(e => e.id !== id));
}

export function getFoodEntriesForDate(date: string): FoodEntry[] {
  return getFoodEntries().filter(e => e.date === date);
}

// Water Logs
export function getWaterLogs(): WaterLog[] {
  if (!isBrowser) return [];
  const data = localStorage.getItem(STORAGE_KEYS.WATER_LOGS);
  return data ? JSON.parse(data) : [];
}

export function saveWaterLogs(logs: WaterLog[]): void {
  if (!isBrowser) return;
  localStorage.setItem(STORAGE_KEYS.WATER_LOGS, JSON.stringify(logs));
}

export function addWaterLog(log: WaterLog): void {
  const logs = getWaterLogs();
  logs.push(log);
  saveWaterLogs(logs);
}

export function deleteWaterLog(id: string): void {
  const logs = getWaterLogs();
  saveWaterLogs(logs.filter(l => l.id !== id));
}

export function getWaterLogsForDate(date: string): WaterLog[] {
  return getWaterLogs().filter(l => l.date === date);
}

export function getTotalWaterForDate(date: string): number {
  return getWaterLogsForDate(date).reduce((sum, log) => sum + log.amountMl, 0);
}

// Weight Logs
export function getWeightLogs(): WeightLog[] {
  if (!isBrowser) return [];
  const data = localStorage.getItem(STORAGE_KEYS.WEIGHT_LOGS);
  return data ? JSON.parse(data) : [];
}

export function saveWeightLogs(logs: WeightLog[]): void {
  if (!isBrowser) return;
  localStorage.setItem(STORAGE_KEYS.WEIGHT_LOGS, JSON.stringify(logs));
}

export function addWeightLog(log: WeightLog): void {
  const logs = getWeightLogs();
  // Remove existing log for same date if any
  const filtered = logs.filter(l => l.date !== log.date);
  filtered.push(log);
  // Sort by date descending
  filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  saveWeightLogs(filtered);
}

export function getLatestWeight(): number | null {
  const logs = getWeightLogs();
  return logs.length > 0 ? logs[0].weightKg : null;
}

// Clear all data
export function clearAllData(): void {
  if (!isBrowser) return;
  Object.values(STORAGE_KEYS).forEach(key => {
    localStorage.removeItem(key);
  });
}
