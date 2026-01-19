import { sql } from '@vercel/postgres';
import { FoodEntry, WaterLog, WeightLog, UserProfile, MealType } from '../types';

// Profile operations
export async function getProfile(userId: string): Promise<UserProfile | null> {
  const result = await sql`
    SELECT
      id, user_id, name, age, gender,
      height_cm as "heightCm",
      weight_kg as "weightKg",
      activity_level as "activityLevel",
      goal_type as "goalType",
      goal_value as "goalValue",
      daily_water_goal_ml as "dailyWaterGoalMl",
      COALESCE(active_calorie_goal, 450) as "activeCalorieGoal",
      openai_api_key as "openaiApiKey",
      created_at as "createdAt"
    FROM profiles
    WHERE user_id = ${userId}
  `;

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    id: row.id,
    name: row.name,
    age: Number(row.age),
    gender: row.gender,
    heightCm: Number(row.heightCm),
    weightKg: Number(row.weightKg),
    activityLevel: row.activityLevel,
    goalType: row.goalType,
    goalValue: Number(row.goalValue),
    dailyWaterGoalMl: Number(row.dailyWaterGoalMl),
    activeCalorieGoal: Number(row.activeCalorieGoal),
    openaiApiKey: row.openaiApiKey,
    createdAt: row.createdAt,
  };
}

export async function createProfile(userId: string, profile: Omit<UserProfile, 'id' | 'createdAt'>): Promise<UserProfile> {
  const result = await sql`
    INSERT INTO profiles (
      user_id, name, age, gender, height_cm, weight_kg,
      activity_level, goal_type, goal_value, daily_water_goal_ml, active_calorie_goal, openai_api_key
    ) VALUES (
      ${userId}, ${profile.name}, ${profile.age}, ${profile.gender},
      ${profile.heightCm}, ${profile.weightKg}, ${profile.activityLevel},
      ${profile.goalType}, ${profile.goalValue}, ${profile.dailyWaterGoalMl},
      ${profile.activeCalorieGoal || 450}, ${profile.openaiApiKey || null}
    )
    RETURNING
      id, name, age, gender,
      height_cm as "heightCm", weight_kg as "weightKg",
      activity_level as "activityLevel", goal_type as "goalType",
      goal_value as "goalValue", daily_water_goal_ml as "dailyWaterGoalMl",
      COALESCE(active_calorie_goal, 450) as "activeCalorieGoal",
      openai_api_key as "openaiApiKey", created_at as "createdAt"
  `;

  const row = result.rows[0];
  return {
    id: row.id,
    name: row.name,
    age: Number(row.age),
    gender: row.gender,
    heightCm: Number(row.heightCm),
    weightKg: Number(row.weightKg),
    activityLevel: row.activityLevel,
    goalType: row.goalType,
    goalValue: Number(row.goalValue),
    dailyWaterGoalMl: Number(row.dailyWaterGoalMl),
    activeCalorieGoal: Number(row.activeCalorieGoal),
    openaiApiKey: row.openaiApiKey,
    createdAt: row.createdAt,
  };
}

export async function updateProfile(userId: string, updates: Partial<UserProfile>): Promise<UserProfile | null> {
  const result = await sql`
    UPDATE profiles SET
      name = COALESCE(${updates.name ?? null}, name),
      age = COALESCE(${updates.age ?? null}, age),
      gender = COALESCE(${updates.gender ?? null}, gender),
      height_cm = COALESCE(${updates.heightCm ?? null}, height_cm),
      weight_kg = COALESCE(${updates.weightKg ?? null}, weight_kg),
      activity_level = COALESCE(${updates.activityLevel ?? null}, activity_level),
      goal_type = COALESCE(${updates.goalType ?? null}, goal_type),
      goal_value = COALESCE(${updates.goalValue ?? null}, goal_value),
      daily_water_goal_ml = COALESCE(${updates.dailyWaterGoalMl ?? null}, daily_water_goal_ml),
      active_calorie_goal = COALESCE(${updates.activeCalorieGoal ?? null}, active_calorie_goal),
      openai_api_key = COALESCE(${updates.openaiApiKey ?? null}, openai_api_key),
      updated_at = NOW()
    WHERE user_id = ${userId}
    RETURNING
      id, name, age, gender,
      height_cm as "heightCm", weight_kg as "weightKg",
      activity_level as "activityLevel", goal_type as "goalType",
      goal_value as "goalValue", daily_water_goal_ml as "dailyWaterGoalMl",
      COALESCE(active_calorie_goal, 450) as "activeCalorieGoal",
      openai_api_key as "openaiApiKey", created_at as "createdAt"
  `;

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    id: row.id,
    name: row.name,
    age: Number(row.age),
    gender: row.gender,
    heightCm: Number(row.heightCm),
    weightKg: Number(row.weightKg),
    activityLevel: row.activityLevel,
    goalType: row.goalType,
    goalValue: Number(row.goalValue),
    dailyWaterGoalMl: Number(row.dailyWaterGoalMl),
    activeCalorieGoal: Number(row.activeCalorieGoal),
    openaiApiKey: row.openaiApiKey,
    createdAt: row.createdAt,
  };
}

// Food entry operations
export async function getFoodEntries(userId: string, date?: string): Promise<FoodEntry[]> {
  const result = date
    ? await sql`
        SELECT
          id, name, meal_type as "mealType", date, calories, protein, carbs, fat,
          is_manual_entry as "isManualEntry", ai_confidence as "aiConfidence",
          photo_url as "photoUrl"
        FROM food_entries
        WHERE user_id = ${userId} AND date = ${date}
        ORDER BY created_at DESC
      `
    : await sql`
        SELECT
          id, name, meal_type as "mealType", date, calories, protein, carbs, fat,
          is_manual_entry as "isManualEntry", ai_confidence as "aiConfidence",
          photo_url as "photoUrl"
        FROM food_entries
        WHERE user_id = ${userId}
        ORDER BY date DESC, created_at DESC
      `;

  return result.rows.map(row => ({
    id: row.id,
    name: row.name,
    mealType: row.mealType as MealType,
    date: row.date,
    calories: Number(row.calories),
    protein: Number(row.protein),
    carbs: Number(row.carbs),
    fat: Number(row.fat),
    isManualEntry: row.isManualEntry,
    aiConfidence: row.aiConfidence ? Number(row.aiConfidence) : undefined,
    photoUrl: row.photoUrl || undefined,
  }));
}

export async function addFoodEntry(userId: string, entry: Omit<FoodEntry, 'id'>): Promise<FoodEntry> {
  const result = await sql`
    INSERT INTO food_entries (
      user_id, name, meal_type, date, calories, protein, carbs, fat,
      is_manual_entry, ai_confidence, photo_url
    ) VALUES (
      ${userId}, ${entry.name}, ${entry.mealType}, ${entry.date},
      ${entry.calories}, ${entry.protein}, ${entry.carbs}, ${entry.fat},
      ${entry.isManualEntry}, ${entry.aiConfidence ?? null}, ${entry.photoUrl ?? null}
    )
    RETURNING
      id, name, meal_type as "mealType", date, calories, protein, carbs, fat,
      is_manual_entry as "isManualEntry", ai_confidence as "aiConfidence",
      photo_url as "photoUrl"
  `;

  const row = result.rows[0];
  return {
    id: row.id,
    name: row.name,
    mealType: row.mealType as MealType,
    date: row.date,
    calories: Number(row.calories),
    protein: Number(row.protein),
    carbs: Number(row.carbs),
    fat: Number(row.fat),
    isManualEntry: row.isManualEntry,
    aiConfidence: row.aiConfidence ? Number(row.aiConfidence) : undefined,
    photoUrl: row.photoUrl || undefined,
  };
}

export async function updateFoodEntry(userId: string, id: string, updates: Partial<FoodEntry>): Promise<FoodEntry | null> {
  const result = await sql`
    UPDATE food_entries SET
      name = COALESCE(${updates.name ?? null}, name),
      meal_type = COALESCE(${updates.mealType ?? null}, meal_type),
      date = COALESCE(${updates.date ?? null}, date),
      calories = COALESCE(${updates.calories ?? null}, calories),
      protein = COALESCE(${updates.protein ?? null}, protein),
      carbs = COALESCE(${updates.carbs ?? null}, carbs),
      fat = COALESCE(${updates.fat ?? null}, fat),
      updated_at = NOW()
    WHERE id = ${id} AND user_id = ${userId}
    RETURNING
      id, name, meal_type as "mealType", date, calories, protein, carbs, fat,
      is_manual_entry as "isManualEntry", ai_confidence as "aiConfidence",
      photo_url as "photoUrl"
  `;

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    id: row.id,
    name: row.name,
    mealType: row.mealType as MealType,
    date: row.date,
    calories: Number(row.calories),
    protein: Number(row.protein),
    carbs: Number(row.carbs),
    fat: Number(row.fat),
    isManualEntry: row.isManualEntry,
    aiConfidence: row.aiConfidence ? Number(row.aiConfidence) : undefined,
    photoUrl: row.photoUrl || undefined,
  };
}

export async function deleteFoodEntry(userId: string, id: string): Promise<boolean> {
  const result = await sql`
    DELETE FROM food_entries WHERE id = ${id} AND user_id = ${userId}
  `;
  return (result.rowCount ?? 0) > 0;
}

// Water log operations
export async function getWaterLogs(userId: string, date: string): Promise<WaterLog[]> {
  const result = await sql`
    SELECT id, date, amount_ml as "amountMl", logged_at as "loggedAt"
    FROM water_logs
    WHERE user_id = ${userId} AND date = ${date}
    ORDER BY logged_at DESC
  `;

  return result.rows.map(row => ({
    id: row.id,
    date: row.date,
    amountMl: Number(row.amountMl),
  }));
}

export async function addWaterLog(userId: string, log: Omit<WaterLog, 'id'>): Promise<WaterLog> {
  const result = await sql`
    INSERT INTO water_logs (user_id, date, amount_ml)
    VALUES (${userId}, ${log.date}, ${log.amountMl})
    RETURNING id, date, amount_ml as "amountMl"
  `;

  const row = result.rows[0];
  return {
    id: row.id,
    date: row.date,
    amountMl: Number(row.amountMl),
  };
}

export async function deleteWaterLog(userId: string, id: string): Promise<boolean> {
  const result = await sql`
    DELETE FROM water_logs WHERE id = ${id} AND user_id = ${userId}
  `;
  return (result.rowCount ?? 0) > 0;
}

// Weight log operations
export async function getWeightLogs(userId: string): Promise<WeightLog[]> {
  const result = await sql`
    SELECT id, date, weight_kg as "weightKg"
    FROM weight_logs
    WHERE user_id = ${userId}
    ORDER BY date DESC
  `;

  return result.rows.map(row => ({
    id: row.id,
    date: row.date,
    weightKg: Number(row.weightKg),
  }));
}

export async function addWeightLog(userId: string, log: Omit<WeightLog, 'id'>): Promise<WeightLog> {
  const result = await sql`
    INSERT INTO weight_logs (user_id, date, weight_kg)
    VALUES (${userId}, ${log.date}, ${log.weightKg})
    RETURNING id, date, weight_kg as "weightKg"
  `;

  const row = result.rows[0];
  return {
    id: row.id,
    date: row.date,
    weightKg: Number(row.weightKg),
  };
}

// User operations (for auth)
export async function getUserByEmail(email: string) {
  const result = await sql`
    SELECT id, email, password_hash, name, image
    FROM users WHERE email = ${email}
  `;
  return result.rows[0] || null;
}

export async function createUser(email: string, passwordHash: string | null, name?: string) {
  const result = await sql`
    INSERT INTO users (email, password_hash, name)
    VALUES (${email}, ${passwordHash}, ${name || null})
    RETURNING id, email, name, image, created_at
  `;
  return result.rows[0];
}
