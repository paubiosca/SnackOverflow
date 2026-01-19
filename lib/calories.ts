import { ActivityLevel, Gender, GoalType, UserProfile, FoodEntry, ActivityApproach } from './types';

// Activity level multipliers for TDEE calculation
const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

// Calories per kg of body weight (for weight loss rate calculation)
const CALORIES_PER_KG = 7700;

/**
 * Calculate Basal Metabolic Rate using Mifflin-St Jeor equation
 */
export function calculateBMR(
  weightKg: number,
  heightCm: number,
  age: number,
  gender: Gender
): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return gender === 'male' ? base + 5 : base - 161;
}

/**
 * Calculate Total Daily Energy Expenditure
 */
export function calculateTDEE(
  weightKg: number,
  heightCm: number,
  age: number,
  gender: Gender,
  activityLevel: ActivityLevel
): number {
  const bmr = calculateBMR(weightKg, heightCm, age, gender);
  return Math.round(bmr * ACTIVITY_MULTIPLIERS[activityLevel]);
}

/**
 * Calculate daily calorie deficit based on goal type
 */
export function calculateDeficit(goalType: GoalType, goalValue: number): number {
  if (goalType === 'deficit_fixed') {
    // goalValue is already the daily deficit (negative number)
    return goalValue;
  } else {
    // goalValue is kg/week to lose
    // Convert to daily deficit: (kg/week × 7700 cal/kg) / 7 days
    return Math.round((-goalValue * CALORIES_PER_KG) / 7);
  }
}

/**
 * Calculate daily calorie goal for a user (legacy - uses static approach)
 */
export function calculateDailyCalorieGoal(profile: UserProfile): number {
  const tdee = calculateTDEE(
    profile.weightKg,
    profile.heightCm,
    profile.age,
    profile.gender,
    profile.activityLevel
  );
  const deficit = calculateDeficit(profile.goalType, profile.goalValue ?? 0);

  // Ensure minimum of 1200 calories for safety
  return Math.max(1200, tdee + deficit);
}

/**
 * Calculate base calorie goal based on activity approach
 * - Static: Uses activity multiplier baked into daily goal
 * - Dynamic: Uses sedentary base (active calories added separately from daily tracking)
 */
export function calculateBaseCalorieGoal(profile: UserProfile): number {
  const approach = profile.activityApproach || 'static';

  if (approach === 'dynamic') {
    // Dynamic: Use sedentary TDEE as base (active calories added daily from watch)
    const sedentaryTdee = calculateTDEE(
      profile.weightKg,
      profile.heightCm,
      profile.age,
      profile.gender,
      'sedentary'
    );
    const deficit = calculateDeficit(profile.goalType, profile.goalValue ?? 0);
    return Math.max(1200, sedentaryTdee + deficit);
  } else {
    // Static: Use full TDEE with activity multiplier
    return calculateDailyCalorieGoal(profile);
  }
}

/**
 * Calculate adjusted calorie goal including active calories (for dynamic users)
 * @param profile User profile
 * @param activeCaloriesToday Active calories burned today (from Apple Watch etc.)
 */
export function calculateAdjustedCalorieGoal(
  profile: UserProfile,
  activeCaloriesToday: number = 0
): number {
  const baseGoal = calculateBaseCalorieGoal(profile);
  const approach = profile.activityApproach || 'static';

  if (approach === 'dynamic') {
    // Add active calories to the sedentary base
    return baseGoal + activeCaloriesToday;
  }

  // Static users don't get active calories added (already factored in)
  return baseGoal;
}

/**
 * Get calorie calculation breakdown for display
 */
export function getCalorieBreakdown(profile: UserProfile, activeCaloriesToday: number = 0): {
  bmr: number;
  tdee: number;
  baseSedentaryCalories: number;
  deficit: number;
  baseGoal: number;
  activeCalories: number;
  adjustedGoal: number;
  approach: ActivityApproach;
} {
  const bmr = calculateBMR(profile.weightKg, profile.heightCm, profile.age, profile.gender);
  const tdee = calculateTDEE(profile.weightKg, profile.heightCm, profile.age, profile.gender, profile.activityLevel);
  const baseSedentaryCalories = calculateTDEE(profile.weightKg, profile.heightCm, profile.age, profile.gender, 'sedentary');
  const deficit = calculateDeficit(profile.goalType, profile.goalValue ?? 0);
  const approach = profile.activityApproach || 'static';

  const baseGoal = calculateBaseCalorieGoal(profile);
  const adjustedGoal = calculateAdjustedCalorieGoal(profile, activeCaloriesToday);

  return {
    bmr: Math.round(bmr),
    tdee,
    baseSedentaryCalories,
    deficit,
    baseGoal,
    activeCalories: approach === 'dynamic' ? activeCaloriesToday : 0,
    adjustedGoal,
    approach,
  };
}

/**
 * Calculate macro targets based on calorie goal
 * Default split: 30% protein, 40% carbs, 30% fat
 */
export function calculateMacroTargets(calorieGoal: number): {
  protein: number;
  carbs: number;
  fat: number;
} {
  return {
    protein: Math.round((calorieGoal * 0.3) / 4), // 4 cal per gram
    carbs: Math.round((calorieGoal * 0.4) / 4),   // 4 cal per gram
    fat: Math.round((calorieGoal * 0.3) / 9),     // 9 cal per gram
  };
}

/**
 * Calculate totals from food entries
 */
export function calculateDailyTotals(entries: FoodEntry[]): {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
} {
  return entries.reduce(
    (totals, entry) => ({
      calories: totals.calories + entry.calories,
      protein: totals.protein + entry.protein,
      carbs: totals.carbs + entry.carbs,
      fat: totals.fat + entry.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );
}

/**
 * Get calorie status for a day (for calendar coloring)
 */
export function getCalorieStatus(
  consumed: number,
  goal: number
): 'under' | 'on_target' | 'over' | 'no_data' {
  if (consumed === 0) return 'no_data';

  const difference = consumed - goal;
  const tolerance = 100; // Within 100 cal is considered on target

  if (difference < -tolerance) return 'under';
  if (difference > tolerance) return 'over';
  return 'on_target';
}

/**
 * Format number with commas
 */
export function formatNumber(num: number): string {
  return num.toLocaleString();
}

/**
 * Calculate percentage (capped at 100 for display)
 */
export function calculatePercentage(current: number, goal: number): number {
  if (goal === 0) return 0;
  return Math.min(100, Math.round((current / goal) * 100));
}

/**
 * Calculate streaks from a set of dates with entries and calorie data
 */
export interface DailySummary {
  date: string;
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
}

export interface StreakInfo {
  currentLogging: number;
  longestLogging: number;
  currentOnTarget: number;
  longestOnTarget: number;
}

export function calculateStreaks(
  datesWithEntries: string[],
  dailySummaries: DailySummary[],
  calorieGoal: number
): StreakInfo {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dateSet = new Set(datesWithEntries);
  const summaryMap = new Map(dailySummaries.map(s => [s.date, s]));

  // Calculate logging streaks
  let currentLogging = 0;
  let longestLogging = 0;
  let tempLoggingStreak = 0;

  // Calculate on-target streaks (within ±100 calories of goal)
  let currentOnTarget = 0;
  let longestOnTarget = 0;
  let tempOnTargetStreak = 0;

  // Go backwards from today to calculate current streaks
  const checkDate = new Date(today);
  let foundCurrentLogging = false;
  let foundCurrentOnTarget = false;

  for (let i = 0; i < 365; i++) {
    const dateStr = checkDate.toISOString().split('T')[0];
    const hasEntry = dateSet.has(dateStr);
    const summary = summaryMap.get(dateStr);
    const isOnTarget = summary
      ? Math.abs(summary.totalCalories - calorieGoal) <= 100
      : false;

    if (hasEntry) {
      if (!foundCurrentLogging) {
        currentLogging++;
      }
      tempLoggingStreak++;
      longestLogging = Math.max(longestLogging, tempLoggingStreak);
    } else {
      foundCurrentLogging = true;
      tempLoggingStreak = 0;
    }

    if (hasEntry && isOnTarget) {
      if (!foundCurrentOnTarget) {
        currentOnTarget++;
      }
      tempOnTargetStreak++;
      longestOnTarget = Math.max(longestOnTarget, tempOnTargetStreak);
    } else {
      if (hasEntry) {
        foundCurrentOnTarget = true;
      }
      tempOnTargetStreak = 0;
    }

    checkDate.setDate(checkDate.getDate() - 1);
  }

  return {
    currentLogging,
    longestLogging,
    currentOnTarget,
    longestOnTarget,
  };
}

/**
 * Calculate 7-day moving average for weight data
 */
export function calculateMovingAverage(
  weights: { date: string; weightKg: number }[],
  window: number = 7
): { date: string; ma: number }[] {
  if (weights.length < window) return [];

  const result: { date: string; ma: number }[] = [];

  for (let i = window - 1; i < weights.length; i++) {
    const windowData = weights.slice(i - window + 1, i + 1);
    const avg = windowData.reduce((sum, w) => sum + w.weightKg, 0) / window;
    result.push({
      date: weights[i].date,
      ma: Math.round(avg * 10) / 10,
    });
  }

  return result;
}

/**
 * Get adherence status for a day
 */
export type AdherenceStatus = 'under' | 'on_target' | 'over';

export function getAdherenceStatus(consumed: number, goal: number): AdherenceStatus {
  const difference = consumed - goal;
  const tolerance = 100;

  if (difference < -tolerance) return 'under';
  if (difference > tolerance) return 'over';
  return 'on_target';
}

/**
 * Calculate day of week analysis
 */
export interface DayOfWeekStats {
  day: number; // 0 = Sunday, 6 = Saturday
  dayName: string;
  avgCalories: number;
  adherenceRate: number;
  totalDays: number;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function calculateDayOfWeekAnalysis(
  dailySummaries: DailySummary[],
  calorieGoal: number
): DayOfWeekStats[] {
  const dayData: Map<number, { calories: number[]; onTarget: number }> = new Map();

  // Initialize for all days
  for (let i = 0; i < 7; i++) {
    dayData.set(i, { calories: [], onTarget: 0 });
  }

  dailySummaries.forEach(summary => {
    const date = new Date(summary.date + 'T12:00:00'); // Noon to avoid timezone issues
    const day = date.getDay();
    const data = dayData.get(day)!;

    data.calories.push(summary.totalCalories);
    if (Math.abs(summary.totalCalories - calorieGoal) <= 100) {
      data.onTarget++;
    }
  });

  return Array.from(dayData.entries()).map(([day, data]) => ({
    day,
    dayName: DAY_NAMES[day],
    avgCalories: data.calories.length > 0
      ? Math.round(data.calories.reduce((a, b) => a + b, 0) / data.calories.length)
      : 0,
    adherenceRate: data.calories.length > 0
      ? Math.round((data.onTarget / data.calories.length) * 100)
      : 0,
    totalDays: data.calories.length,
  }));
}
