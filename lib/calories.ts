import { ActivityLevel, Gender, GoalType, UserProfile, FoodEntry } from './types';

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
 * Calculate daily calorie goal for a user
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
