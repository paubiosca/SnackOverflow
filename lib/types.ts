export type Gender = 'male' | 'female';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
export type GoalType = 'deficit_fixed' | 'weight_loss_rate';
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface UserProfile {
  id: string;
  name: string;
  age: number;
  gender: Gender;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  goalType: GoalType;
  goalValue: number; // negative calories for deficit_fixed, kg/week for weight_loss_rate
  dailyWaterGoalMl: number;
  createdAt: string;
  apiKey?: string; // OpenAI API key (stored locally)
}

export interface FoodEntry {
  id: string;
  name: string;
  mealType: MealType;
  date: string; // ISO date string (YYYY-MM-DD)
  timestamp: string; // Full ISO timestamp
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  sugar?: number;
  isManualEntry: boolean;
  aiConfidence?: number;
  photoUrl?: string; // base64 data URL
  notes?: string;
}

export interface WaterLog {
  id: string;
  date: string;
  timestamp: string;
  amountMl: number;
}

export interface WeightLog {
  id: string;
  date: string;
  weightKg: number;
}

export interface NutritionInfo {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  sugar?: number;
}

export interface ClarifyingQuestion {
  id: string;
  question: string;
  options: { label: string; value: string }[];
  impact: string; // e.g., "Could change calories by ~150"
}

export interface AIFoodAnalysis {
  foodName: string;
  nutrition: NutritionInfo;
  confidence: number; // 0-100
  clarifyingQuestions?: ClarifyingQuestion[];
  needsClarification: boolean;
}

export interface DailyNutritionSummary {
  date: string;
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  goalCalories: number;
  entries: FoodEntry[];
}

export const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: 'Sedentary (little or no exercise)',
  light: 'Light (exercise 1-3 days/week)',
  moderate: 'Moderate (exercise 3-5 days/week)',
  active: 'Active (exercise 6-7 days/week)',
  very_active: 'Very Active (intense exercise daily)',
};

export const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
};

export const MEAL_ICONS: Record<MealType, string> = {
  breakfast: '🌅',
  lunch: '☀️',
  dinner: '🌙',
  snack: '🍿',
};
