export type Gender = 'male' | 'female';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
export type GoalType = 'deficit_fixed' | 'weight_loss_rate';
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export type ActivityApproach = 'static' | 'dynamic';

export interface UserProfile {
  id: string;
  name: string;
  age: number;
  gender: Gender;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  activityApproach: ActivityApproach; // 'static' = fixed multiplier, 'dynamic' = sedentary base + active calories
  goalType: GoalType;
  goalValue: number | null; // negative calories for deficit_fixed, kg/week for weight_loss_rate
  dailyWaterGoalMl: number;
  activeCalorieGoal: number; // Daily active calorie goal (e.g., 450 from Apple Watch)
  createdAt: string;
  openaiApiKey?: string; // OpenAI API key (stored in database)
}

export interface FoodEntry {
  id: string;
  name: string;
  mealType: MealType;
  date: string; // ISO date string (YYYY-MM-DD)
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
  createdAt?: string; // ISO timestamp for grouping
}

export interface WaterLog {
  id: string;
  date: string;
  amountMl: number;
}

export interface WeightLog {
  id: string;
  date: string;
  weightKg: number;
}

export interface ActiveCalorieLog {
  id: string;
  date: string;
  calories: number;
  source?: string; // 'apple_watch', 'manual', etc.
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

// Recipe & Ingredient Types
export type IngredientCategory = 'protein' | 'vegetable' | 'fruit' | 'grain' | 'dairy' | 'fat' | 'seasoning' | 'other';

export interface Ingredient {
  id: string;
  name: string;
  amount: string;
  category: IngredientCategory;
}

export interface RecipeNutrition {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  servings: number;
}

export interface Recipe {
  id: string;
  name: string;
  description: string;
  prepTime: string;
  difficulty: 'easy' | 'medium' | 'hard';
  ingredientsUsed: string[];
  instructions: string[];
  nutrition: RecipeNutrition;
  tags?: string[];
}

export interface MacroBudget {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export const INGREDIENT_CATEGORY_LABELS: Record<IngredientCategory, string> = {
  protein: 'Protein',
  vegetable: 'Vegetables',
  fruit: 'Fruit',
  grain: 'Grains',
  dairy: 'Dairy',
  fat: 'Fats & Oils',
  seasoning: 'Seasonings',
  other: 'Other',
};

// Onboarding Chat Types
export type OnboardingTopic =
  | 'greeting'
  | 'name'
  | 'demographics'
  | 'body_metrics'
  | 'activity_approach'
  | 'activity_level'
  | 'active_calorie_goal'
  | 'goal_setting'
  | 'summary'
  | 'complete';

export interface QuickReply {
  label: string;
  value: string;
  description?: string;
}

export interface OnboardingMessage {
  id: string;
  role: 'assistant' | 'user';
  content: string;
  quickReplies?: QuickReply[];
  timestamp: Date;
}

export interface ExtractedProfileData {
  name?: string;
  age?: number;
  gender?: Gender;
  heightCm?: number;
  weightKg?: number;
  activityApproach?: ActivityApproach;
  activityLevel?: ActivityLevel;
  activeCalorieGoal?: number;
  goalType?: GoalType;
  goalValue?: number;
}

export interface OnboardingCalculations {
  bmr?: number;
  tdee?: number;
  recommendedCalories?: number;
  baseSedentaryCalories?: number;
}

export interface OnboardingProgress {
  currentTopic: OnboardingTopic;
  extractedData: ExtractedProfileData;
  calculations: OnboardingCalculations;
  isComplete: boolean;
}

export const ACTIVITY_APPROACH_LABELS: Record<ActivityApproach, { name: string; description: string }> = {
  static: {
    name: 'Static',
    description: 'Fixed daily goal based on your typical activity level',
  },
  dynamic: {
    name: 'Dynamic',
    description: 'Sedentary base + add active calories from exercise daily',
  },
};
