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
  // Calibrated baseline TDEE in kcal/day. Set once from a real-data source
  // (e.g. Apple Health 90-day average excluding tracked workouts). When set,
  // overrides the formula-based goal calculation.
  tdeeBaselineKcal?: number;
  createdAt: string;
  openaiApiKey?: string; // OpenAI API key (stored in database)
}

export type FoodEntryStatus = 'pending' | 'needs_clarification' | 'resolved' | 'failed';

export type FoodEntrySource = 'manual' | 'analyze-text' | 'analyze-photo' | 'pantry' | 'recent' | 'receipt';

export interface ClarifyingSuggestion {
  label: string;
  value: string;
}

export interface FoodAnalysisComponent {
  name: string;
  brand?: string | null;
  portionDisplay: string;
  portionGrams?: number | null;
  nutrition: { calories: number; protein: number; carbs: number; fat: number };
  confidence: number;
}

// Persisted breakdown so users can tap a logged meal and see the AI's reasoning.
export interface FoodAnalysisBreakdown {
  dishName: string;
  rationale?: string; // 1-3 sentence plain-text explanation
  components: FoodAnalysisComponent[];
  totals: { calories: number; protein: number; carbs: number; fat: number };
  confidence: number;
}

export interface FoodEntry {
  id: string;
  name: string;
  mealType: MealType;
  date: string; // ISO date string (YYYY-MM-DD) — kept for grouping/back-compat
  consumedAt?: string; // ISO timestamp — exact moment eaten, used for "around this time yesterday"
  // Nutrition: 0 while status === 'pending' (no LLM result yet); real values once resolved.
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  sugar?: number;
  // Provenance + lifecycle. Optional so legacy callsites that build FoodEntry objects
  // (treated as 'resolved' / 'manual' by default) still type-check during the rollout.
  status?: FoodEntryStatus;
  source?: FoodEntrySource;
  isManualEntry: boolean;
  aiConfidence?: number;
  aiEstimatedCalories?: number; // pre-clarification estimate, kept for correction tracking
  aiEstimatedProtein?: number;
  aiEstimatedCarbs?: number;
  aiEstimatedFat?: number;
  clarifyingQuestion?: string;
  clarifyingSuggestions?: ClarifyingSuggestion[];
  clarifyingAnswer?: string;
  pantryItemId?: string;
  photoUrl?: string;          // primary/cover photo
  photoUrls?: string[];       // additional photos (excluding `photoUrl`)
  notes?: string;
  analysis?: FoodAnalysisBreakdown; // populated once the worker resolves the entry
  // Worker inputs (immutable; the LLM reads these to compute the analysis).
  inputDescription?: string;
  additionalContext?: string;
  createdAt?: string;
}

export interface PantryItem {
  id: string;
  rawText?: string;
  normalizedName: string;
  qtyTotal: number;
  qtyRemaining: number;
  unit: string;
  estCaloriesPerUnit?: number;
  estProteinPerUnit?: number;
  estCarbsPerUnit?: number;
  estFatPerUnit?: number;
  store?: string;
  source: 'receipt' | 'manual';
  status: 'active' | 'depleted' | 'expired' | 'discarded';
  purchasedAt?: string;
}

export interface FoodSuggestion {
  source: 'recent' | 'time-of-day' | 'frequent' | 'pantry';
  name: string;
  mealType: MealType;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  // For pantry chips
  pantryItemId?: string;
  qtyRemaining?: number;
  // Per-unit basis: 'g' = calories field is per 100g; 'item' = per pack/unit;
  // 'ml' = per 100ml. Drives portion math in the chip handler.
  unit?: 'g' | 'item' | 'ml';
  // Total grams in the pack, when known. Lets the portion sheet resolve "half"
  // to a real gram count and scale calories accordingly.
  packGrams?: number;
  // For "ate this Y times" / "last on" hints
  occurrences?: number;
  lastEatenAt?: string;
}

export interface FoodAlternative {
  name: string;
  calories: number;
  savedKcal: number;
  source: 'history' | 'ai';
  occurrences?: number;
  lastEatenAt?: string;
}

export interface AlternativeSuggestion {
  originalEntryId: string;
  originalName: string;
  originalCalories: number;
  alternatives: FoodAlternative[];
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
