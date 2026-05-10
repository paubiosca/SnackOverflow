import { sql } from '@vercel/postgres';
import { FoodEntry, FoodEntryStatus, FoodEntrySource, FoodSuggestion, PantryItem, WaterLog, WeightLog, UserProfile, MealType, ActivityApproach, ClarifyingSuggestion } from '../types';

// Shared SELECT projection for food_entries — keeps reads consistent across queries.
const FOOD_ENTRY_COLUMNS = `
  id, name, meal_type as "mealType", date,
  consumed_at as "consumedAt",
  calories, protein, carbs, fat,
  is_manual_entry as "isManualEntry",
  ai_confidence as "aiConfidence",
  ai_estimated_calories as "aiEstimatedCalories",
  ai_estimated_protein as "aiEstimatedProtein",
  ai_estimated_carbs as "aiEstimatedCarbs",
  ai_estimated_fat as "aiEstimatedFat",
  status, source,
  clarifying_question as "clarifyingQuestion",
  clarifying_suggestions as "clarifyingSuggestions",
  clarifying_answer as "clarifyingAnswer",
  pantry_item_id as "pantryItemId",
  photo_url as "photoUrl",
  input_description as "inputDescription",
  additional_context as "additionalContext",
  created_at as "createdAt"
`;

function rowToFoodEntry(row: any): FoodEntry {
  const numOr0 = (v: any): number => (v === null || v === undefined ? 0 : Number(v));
  const numOrUndef = (v: any): number | undefined => (v === null || v === undefined ? undefined : Number(v));
  return {
    id: row.id,
    name: row.name,
    mealType: row.mealType as MealType,
    date: row.date,
    consumedAt: row.consumedAt ? new Date(row.consumedAt).toISOString() : undefined,
    calories: numOr0(row.calories),
    protein: numOr0(row.protein),
    carbs: numOr0(row.carbs),
    fat: numOr0(row.fat),
    status: (row.status ?? 'resolved') as FoodEntryStatus,
    source: (row.source ?? 'manual') as FoodEntrySource,
    isManualEntry: row.isManualEntry,
    aiConfidence: numOrUndef(row.aiConfidence),
    aiEstimatedCalories: numOrUndef(row.aiEstimatedCalories),
    aiEstimatedProtein: numOrUndef(row.aiEstimatedProtein),
    aiEstimatedCarbs: numOrUndef(row.aiEstimatedCarbs),
    aiEstimatedFat: numOrUndef(row.aiEstimatedFat),
    clarifyingQuestion: row.clarifyingQuestion ?? undefined,
    clarifyingSuggestions: row.clarifyingSuggestions ?? undefined,
    clarifyingAnswer: row.clarifyingAnswer ?? undefined,
    pantryItemId: row.pantryItemId ?? undefined,
    photoUrl: row.photoUrl ?? undefined,
    inputDescription: row.inputDescription ?? undefined,
    additionalContext: row.additionalContext ?? undefined,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : undefined,
  };
}

// Profile operations
export async function getProfile(userId: string): Promise<UserProfile | null> {
  const result = await sql`
    SELECT
      id, user_id, name, age, gender,
      height_cm as "heightCm",
      weight_kg as "weightKg",
      activity_level as "activityLevel",
      COALESCE(activity_approach, 'static') as "activityApproach",
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
    activityApproach: row.activityApproach as ActivityApproach,
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
      activity_level, activity_approach, goal_type, goal_value, daily_water_goal_ml, active_calorie_goal, openai_api_key
    ) VALUES (
      ${userId}, ${profile.name}, ${profile.age}, ${profile.gender},
      ${profile.heightCm}, ${profile.weightKg}, ${profile.activityLevel},
      ${profile.activityApproach || 'static'}, ${profile.goalType}, ${profile.goalValue}, ${profile.dailyWaterGoalMl},
      ${profile.activeCalorieGoal || 450}, ${profile.openaiApiKey || null}
    )
    RETURNING
      id, name, age, gender,
      height_cm as "heightCm", weight_kg as "weightKg",
      activity_level as "activityLevel",
      COALESCE(activity_approach, 'static') as "activityApproach",
      goal_type as "goalType",
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
    activityApproach: row.activityApproach as ActivityApproach,
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
      activity_approach = COALESCE(${updates.activityApproach ?? null}, activity_approach),
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
      activity_level as "activityLevel",
      COALESCE(activity_approach, 'static') as "activityApproach",
      goal_type as "goalType",
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
    activityApproach: row.activityApproach as ActivityApproach,
    goalType: row.goalType,
    goalValue: Number(row.goalValue),
    dailyWaterGoalMl: Number(row.dailyWaterGoalMl),
    activeCalorieGoal: Number(row.activeCalorieGoal),
    openaiApiKey: row.openaiApiKey,
    createdAt: row.createdAt,
  };
}

export async function deleteProfile(userId: string): Promise<boolean> {
  const result = await sql`
    DELETE FROM profiles WHERE user_id = ${userId}
  `;
  return (result.rowCount ?? 0) > 0;
}

// Food entry operations
export async function getFoodEntries(userId: string, date?: string): Promise<FoodEntry[]> {
  // sql.query is used instead of the tagged template because we want to interpolate
  // the projection string above without breaking parameterization.
  const baseQuery = `SELECT ${FOOD_ENTRY_COLUMNS} FROM food_entries WHERE user_id = $1`;
  const result = date
    ? await sql.query(`${baseQuery} AND date = $2 ORDER BY consumed_at DESC NULLS LAST, created_at DESC`, [userId, date])
    : await sql.query(`${baseQuery} ORDER BY date DESC, created_at DESC`, [userId]);
  return result.rows.map(rowToFoodEntry);
}

export async function getFoodEntryById(userId: string, id: string): Promise<FoodEntry | null> {
  const result = await sql.query(
    `SELECT ${FOOD_ENTRY_COLUMNS} FROM food_entries WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );
  return result.rows.length === 0 ? null : rowToFoodEntry(result.rows[0]);
}

export async function addFoodEntry(userId: string, entry: Partial<FoodEntry> & Pick<FoodEntry, 'name' | 'mealType' | 'date'>): Promise<FoodEntry> {
  const status: FoodEntryStatus = entry.status ?? 'resolved';
  const source: FoodEntrySource = entry.source ?? 'manual';
  const consumedAt = entry.consumedAt ?? new Date().toISOString();
  const result = await sql.query(
    `INSERT INTO food_entries (
       user_id, name, meal_type, date, consumed_at,
       calories, protein, carbs, fat,
       is_manual_entry, ai_confidence,
       ai_estimated_calories, ai_estimated_protein, ai_estimated_carbs, ai_estimated_fat,
       status, source,
       clarifying_question, clarifying_suggestions, clarifying_answer,
       pantry_item_id, photo_url,
       input_description, additional_context
     ) VALUES (
       $1, $2, $3, $4, $5,
       $6, $7, $8, $9,
       $10, $11,
       $12, $13, $14, $15,
       $16, $17,
       $18, $19::jsonb, $20,
       $21, $22,
       $23, $24
     )
     RETURNING ${FOOD_ENTRY_COLUMNS}`,
    [
      userId, entry.name, entry.mealType, entry.date, consumedAt,
      entry.calories ?? null, entry.protein ?? null, entry.carbs ?? null, entry.fat ?? null,
      entry.isManualEntry ?? (source === 'manual'), entry.aiConfidence ?? null,
      entry.aiEstimatedCalories ?? null, entry.aiEstimatedProtein ?? null, entry.aiEstimatedCarbs ?? null, entry.aiEstimatedFat ?? null,
      status, source,
      entry.clarifyingQuestion ?? null, entry.clarifyingSuggestions ? JSON.stringify(entry.clarifyingSuggestions) : null, entry.clarifyingAnswer ?? null,
      entry.pantryItemId ?? null, entry.photoUrl ?? null,
      entry.inputDescription ?? null, entry.additionalContext ?? null,
    ]
  );
  return rowToFoodEntry(result.rows[0]);
}

export async function updateFoodEntry(userId: string, id: string, updates: Partial<FoodEntry>): Promise<FoodEntry | null> {
  const suggestionsJson = updates.clarifyingSuggestions !== undefined
    ? JSON.stringify(updates.clarifyingSuggestions)
    : null;
  const result = await sql.query(
    `UPDATE food_entries SET
       name = COALESCE($1, name),
       meal_type = COALESCE($2, meal_type),
       date = COALESCE($3, date),
       consumed_at = COALESCE($4, consumed_at),
       calories = COALESCE($5, calories),
       protein = COALESCE($6, protein),
       carbs = COALESCE($7, carbs),
       fat = COALESCE($8, fat),
       ai_confidence = COALESCE($9, ai_confidence),
       ai_estimated_calories = COALESCE($10, ai_estimated_calories),
       ai_estimated_protein = COALESCE($11, ai_estimated_protein),
       ai_estimated_carbs = COALESCE($12, ai_estimated_carbs),
       ai_estimated_fat = COALESCE($13, ai_estimated_fat),
       status = COALESCE($14, status),
       source = COALESCE($15, source),
       clarifying_question = COALESCE($16, clarifying_question),
       clarifying_suggestions = COALESCE($17::jsonb, clarifying_suggestions),
       clarifying_answer = COALESCE($18, clarifying_answer),
       updated_at = NOW()
     WHERE id = $19 AND user_id = $20
     RETURNING ${FOOD_ENTRY_COLUMNS}`,
    [
      updates.name ?? null,
      updates.mealType ?? null,
      updates.date ?? null,
      updates.consumedAt ?? null,
      updates.calories ?? null,
      updates.protein ?? null,
      updates.carbs ?? null,
      updates.fat ?? null,
      updates.aiConfidence ?? null,
      updates.aiEstimatedCalories ?? null,
      updates.aiEstimatedProtein ?? null,
      updates.aiEstimatedCarbs ?? null,
      updates.aiEstimatedFat ?? null,
      updates.status ?? null,
      updates.source ?? null,
      updates.clarifyingQuestion ?? null,
      suggestionsJson,
      updates.clarifyingAnswer ?? null,
      id, userId,
    ]
  );
  return result.rows.length === 0 ? null : rowToFoodEntry(result.rows[0]);
}

export async function deleteFoodEntry(userId: string, id: string): Promise<boolean> {
  const result = await sql`
    DELETE FROM food_entries WHERE id = ${id} AND user_id = ${userId}
  `;
  return (result.rowCount ?? 0) > 0;
}

// Async-flow helpers: resolve a pending row with full nutrition, mark it as needing clarification,
// or fail it. Worker route uses these.
export async function resolveFoodEntry(userId: string, id: string, data: {
  name?: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  aiConfidence?: number;
  aiEstimated?: { calories: number; protein: number; carbs: number; fat: number };
}): Promise<FoodEntry | null> {
  const ai = data.aiEstimated ?? { calories: data.calories, protein: data.protein, carbs: data.carbs, fat: data.fat };
  const result = await sql.query(
    `UPDATE food_entries SET
       name = COALESCE($1, name),
       calories = $2, protein = $3, carbs = $4, fat = $5,
       ai_confidence = $6,
       ai_estimated_calories = COALESCE(ai_estimated_calories, $7),
       ai_estimated_protein = COALESCE(ai_estimated_protein, $8),
       ai_estimated_carbs = COALESCE(ai_estimated_carbs, $9),
       ai_estimated_fat = COALESCE(ai_estimated_fat, $10),
       status = 'resolved',
       clarifying_question = NULL,
       clarifying_suggestions = NULL,
       updated_at = NOW()
     WHERE id = $11 AND user_id = $12
     RETURNING ${FOOD_ENTRY_COLUMNS}`,
    [
      data.name ?? null,
      data.calories, data.protein, data.carbs, data.fat,
      data.aiConfidence ?? null,
      ai.calories, ai.protein, ai.carbs, ai.fat,
      id, userId,
    ]
  );
  return result.rows.length === 0 ? null : rowToFoodEntry(result.rows[0]);
}

export async function markFoodEntryNeedsClarification(userId: string, id: string, data: {
  question: string;
  suggestions: ClarifyingSuggestion[];
  // Optional preliminary estimate so the card can show a "best guess" while pending an answer
  preliminary?: { calories: number; protein: number; carbs: number; fat: number; confidence?: number };
}): Promise<FoodEntry | null> {
  const p = data.preliminary;
  const result = await sql.query(
    `UPDATE food_entries SET
       status = 'needs_clarification',
       clarifying_question = $1,
       clarifying_suggestions = $2::jsonb,
       calories = COALESCE($3, calories),
       protein = COALESCE($4, protein),
       carbs = COALESCE($5, carbs),
       fat = COALESCE($6, fat),
       ai_confidence = COALESCE($7, ai_confidence),
       ai_estimated_calories = COALESCE(ai_estimated_calories, $3),
       ai_estimated_protein = COALESCE(ai_estimated_protein, $4),
       ai_estimated_carbs = COALESCE(ai_estimated_carbs, $5),
       ai_estimated_fat = COALESCE(ai_estimated_fat, $6),
       updated_at = NOW()
     WHERE id = $8 AND user_id = $9
     RETURNING ${FOOD_ENTRY_COLUMNS}`,
    [
      data.question,
      JSON.stringify(data.suggestions),
      p?.calories ?? null, p?.protein ?? null, p?.carbs ?? null, p?.fat ?? null,
      p?.confidence ?? null,
      id, userId,
    ]
  );
  return result.rows.length === 0 ? null : rowToFoodEntry(result.rows[0]);
}

export async function failFoodEntry(userId: string, id: string, _reason: string): Promise<void> {
  await sql`
    UPDATE food_entries
    SET status = 'failed', updated_at = NOW()
    WHERE id = ${id} AND user_id = ${userId}
  `;
}

export async function setFoodEntryAnswer(userId: string, id: string, answer: string): Promise<FoodEntry | null> {
  // Move back to pending while the worker re-runs.
  const result = await sql.query(
    `UPDATE food_entries SET
       status = 'pending',
       clarifying_answer = $1,
       updated_at = NOW()
     WHERE id = $2 AND user_id = $3
     RETURNING ${FOOD_ENTRY_COLUMNS}`,
    [answer, id, userId]
  );
  return result.rows.length === 0 ? null : rowToFoodEntry(result.rows[0]);
}

// Suggestions: feeds the Quick-log rail. Rank by recency × frequency, with a time-of-day boost
// for entries eaten near this time on previous days.
export async function getFoodSuggestions(userId: string, opts?: { limit?: number; nowIso?: string }): Promise<FoodSuggestion[]> {
  const limit = opts?.limit ?? 12;
  const now = opts?.nowIso ? new Date(opts.nowIso) : new Date();
  // Hour-of-day window: entries whose consumed_at hour is within +/- 2 hours of "now" get boosted.
  const hour = now.getUTCHours();

  // Aggregate by lower(name): pick the most recent occurrence as the canonical row, count occurrences,
  // and compute a time-of-day proximity score.
  const result = await sql`
    WITH ranked AS (
      SELECT
        LOWER(name) AS key,
        name,
        meal_type,
        AVG(calories) AS avg_cal,
        AVG(protein) AS avg_p,
        AVG(carbs)   AS avg_c,
        AVG(fat)     AS avg_f,
        COUNT(*)::int AS occurrences,
        MAX(consumed_at) AS last_eaten,
        MIN(ABS(EXTRACT(HOUR FROM consumed_at)::int - ${hour})) AS hour_distance
      FROM food_entries
      WHERE user_id = ${userId}
        AND status = 'resolved'
        AND consumed_at IS NOT NULL
        AND consumed_at >= NOW() - INTERVAL '60 days'
      GROUP BY LOWER(name), name, meal_type
    )
    SELECT
      name, meal_type AS "mealType",
      ROUND(avg_cal)::int AS calories,
      ROUND(avg_p)::int   AS protein,
      ROUND(avg_c)::int   AS carbs,
      ROUND(avg_f)::int   AS fat,
      occurrences,
      last_eaten AS "lastEatenAt",
      hour_distance
    FROM ranked
    ORDER BY
      (CASE WHEN hour_distance <= 2 THEN 0 ELSE 1 END), -- time-of-day boost
      occurrences DESC,
      last_eaten DESC
    LIMIT ${limit}
  `;

  return result.rows.map((row): FoodSuggestion => ({
    source: row.hour_distance <= 2 ? 'time-of-day' : (row.occurrences >= 3 ? 'frequent' : 'recent'),
    name: row.name,
    mealType: row.mealType as MealType,
    calories: Number(row.calories) || 0,
    protein: Number(row.protein) || 0,
    carbs: Number(row.carbs) || 0,
    fat: Number(row.fat) || 0,
    occurrences: Number(row.occurrences),
    lastEatenAt: row.lastEatenAt ? new Date(row.lastEatenAt).toISOString() : undefined,
  }));
}

// History of resolved entries grouped by lower(name) within an optional mealType filter,
// from the last `days` days. Used by the alternatives endpoint to find leaner swaps the
// user has actually eaten before.
export interface HistoryItem {
  name: string;
  mealType: MealType;
  avgCalories: number;
  minCalories: number;
  occurrences: number;
  lastEatenAt?: string;
}

export async function getFoodHistoryByMealType(
  userId: string,
  mealType: MealType,
  days: number = 60,
): Promise<HistoryItem[]> {
  const result = await sql.query(
    `SELECT
       name,
       meal_type AS "mealType",
       AVG(calories)::float AS "avgCalories",
       MIN(calories)::float AS "minCalories",
       COUNT(*)::int AS occurrences,
       MAX(consumed_at) AS "lastEatenAt"
     FROM food_entries
     WHERE user_id = $1
       AND status = 'resolved'
       AND meal_type = $2
       AND calories > 0
       AND (consumed_at IS NULL OR consumed_at >= NOW() - ($3 || ' days')::interval)
     GROUP BY LOWER(name), name, meal_type
     ORDER BY occurrences DESC, MAX(consumed_at) DESC NULLS LAST`,
    [userId, mealType, String(days)],
  );

  return result.rows.map((row) => ({
    name: row.name,
    mealType: row.mealType as MealType,
    avgCalories: Number(row.avgCalories) || 0,
    minCalories: Number(row.minCalories) || 0,
    occurrences: Number(row.occurrences) || 0,
    lastEatenAt: row.lastEatenAt ? new Date(row.lastEatenAt).toISOString() : undefined,
  }));
}

// Pantry operations
export async function getActivePantryItems(userId: string): Promise<PantryItem[]> {
  const result = await sql`
    SELECT
      id, raw_text as "rawText", normalized_name as "normalizedName",
      qty_total as "qtyTotal", qty_remaining as "qtyRemaining", unit,
      est_calories_per_unit as "estCaloriesPerUnit",
      est_protein_per_unit as "estProteinPerUnit",
      est_carbs_per_unit as "estCarbsPerUnit",
      est_fat_per_unit as "estFatPerUnit",
      store, source, status, purchased_at as "purchasedAt"
    FROM pantry_items
    WHERE user_id = ${userId} AND status = 'active' AND qty_remaining > 0
    ORDER BY purchased_at DESC NULLS LAST
  `;
  return result.rows.map((row): PantryItem => ({
    id: row.id,
    rawText: row.rawText ?? undefined,
    normalizedName: row.normalizedName,
    qtyTotal: Number(row.qtyTotal),
    qtyRemaining: Number(row.qtyRemaining),
    unit: row.unit ?? 'item',
    estCaloriesPerUnit: row.estCaloriesPerUnit !== null ? Number(row.estCaloriesPerUnit) : undefined,
    estProteinPerUnit: row.estProteinPerUnit !== null ? Number(row.estProteinPerUnit) : undefined,
    estCarbsPerUnit: row.estCarbsPerUnit !== null ? Number(row.estCarbsPerUnit) : undefined,
    estFatPerUnit: row.estFatPerUnit !== null ? Number(row.estFatPerUnit) : undefined,
    store: row.store ?? undefined,
    source: row.source as PantryItem['source'],
    status: row.status as PantryItem['status'],
    purchasedAt: row.purchasedAt ? new Date(row.purchasedAt).toISOString() : undefined,
  }));
}

// Health ingest tokens ----------------------------------------------------------

export interface HealthToken {
  id: string;
  token: string;
  label: string | null;
  createdAt: string;
  lastUsedAt: string | null;
}

export async function listHealthTokens(userId: string): Promise<HealthToken[]> {
  const r = await sql`
    SELECT id, token, label, created_at as "createdAt", last_used_at as "lastUsedAt"
    FROM health_tokens WHERE user_id = ${userId}
    ORDER BY created_at DESC
  `;
  return r.rows.map((row) => ({
    id: row.id,
    token: row.token,
    label: row.label ?? null,
    createdAt: new Date(row.createdAt).toISOString(),
    lastUsedAt: row.lastUsedAt ? new Date(row.lastUsedAt).toISOString() : null,
  }));
}

export async function createHealthToken(userId: string, token: string, label?: string): Promise<HealthToken> {
  const r = await sql`
    INSERT INTO health_tokens (user_id, token, label)
    VALUES (${userId}, ${token}, ${label ?? null})
    RETURNING id, token, label, created_at as "createdAt", last_used_at as "lastUsedAt"
  `;
  const row = r.rows[0];
  return {
    id: row.id,
    token: row.token,
    label: row.label ?? null,
    createdAt: new Date(row.createdAt).toISOString(),
    lastUsedAt: null,
  };
}

export async function deleteHealthToken(userId: string, id: string): Promise<boolean> {
  const r = await sql`
    DELETE FROM health_tokens WHERE id = ${id} AND user_id = ${userId}
  `;
  return (r.rowCount ?? 0) > 0;
}

// Resolve a Bearer token to its owner. Used by the unauthenticated ingest route.
export async function getUserIdByHealthToken(token: string): Promise<string | null> {
  const r = await sql`
    SELECT user_id FROM health_tokens WHERE token = ${token} LIMIT 1
  `;
  return r.rows[0]?.user_id ?? null;
}

export async function touchHealthToken(token: string): Promise<void> {
  await sql`UPDATE health_tokens SET last_used_at = NOW() WHERE token = ${token}`;
}

// Daily activity ---------------------------------------------------------------

export async function upsertDailyActivity(
  userId: string,
  data: {
    date: string;
    activeKcal: number | null;
    bmrKcal: number | null;
    totalKcal: number | null;
    steps: number | null;
    restingHr: number | null;
    source?: string;
    raw?: unknown;
  },
): Promise<void> {
  await sql`
    INSERT INTO daily_activity (
      user_id, date, active_kcal, bmr_kcal, total_kcal, steps, resting_hr, source, raw
    ) VALUES (
      ${userId}, ${data.date}, ${data.activeKcal}, ${data.bmrKcal}, ${data.totalKcal},
      ${data.steps}, ${data.restingHr}, ${data.source ?? 'terra'},
      ${data.raw ? JSON.stringify(data.raw) : null}::jsonb
    )
    ON CONFLICT (user_id, date)
    DO UPDATE SET
      active_kcal = COALESCE(EXCLUDED.active_kcal, daily_activity.active_kcal),
      bmr_kcal = COALESCE(EXCLUDED.bmr_kcal, daily_activity.bmr_kcal),
      total_kcal = COALESCE(EXCLUDED.total_kcal, daily_activity.total_kcal),
      steps = COALESCE(EXCLUDED.steps, daily_activity.steps),
      resting_hr = COALESCE(EXCLUDED.resting_hr, daily_activity.resting_hr),
      source = EXCLUDED.source,
      raw = COALESCE(EXCLUDED.raw, daily_activity.raw),
      updated_at = NOW()
  `;
}

export interface DailyActivity {
  date: string;
  activeKcal: number | null;
  bmrKcal: number | null;
  totalKcal: number | null;
  steps: number | null;
  restingHr: number | null;
}

export async function getDailyActivity(userId: string, date: string): Promise<DailyActivity | null> {
  const r = await sql`
    SELECT
      date, active_kcal as "activeKcal", bmr_kcal as "bmrKcal", total_kcal as "totalKcal",
      steps, resting_hr as "restingHr"
    FROM daily_activity
    WHERE user_id = ${userId} AND date = ${date}
  `;
  if (r.rows.length === 0) return null;
  const row = r.rows[0];
  return {
    date: row.date,
    activeKcal: row.activeKcal !== null ? Number(row.activeKcal) : null,
    bmrKcal: row.bmrKcal !== null ? Number(row.bmrKcal) : null,
    totalKcal: row.totalKcal !== null ? Number(row.totalKcal) : null,
    steps: row.steps !== null ? Number(row.steps) : null,
    restingHr: row.restingHr !== null ? Number(row.restingHr) : null,
  };
}

export async function decrementPantryItem(userId: string, id: string, qty: number = 1): Promise<void> {
  await sql`
    UPDATE pantry_items SET
      qty_remaining = GREATEST(0, qty_remaining - ${qty}),
      status = CASE WHEN qty_remaining - ${qty} <= 0 THEN 'depleted' ELSE status END,
      updated_at = NOW()
    WHERE id = ${id} AND user_id = ${userId}
  `;
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

// Insights queries - date range operations

export async function getFoodEntriesInRange(userId: string, startDate: string, endDate: string): Promise<FoodEntry[]> {
  const result = await sql.query(
    `SELECT ${FOOD_ENTRY_COLUMNS} FROM food_entries
     WHERE user_id = $1 AND date >= $2 AND date <= $3
     ORDER BY date DESC, created_at DESC`,
    [userId, startDate, endDate]
  );
  return result.rows.map(rowToFoodEntry);
}

export async function getWeightLogsInRange(userId: string, startDate: string, endDate: string): Promise<WeightLog[]> {
  const result = await sql`
    SELECT id, date, weight_kg as "weightKg"
    FROM weight_logs
    WHERE user_id = ${userId} AND date >= ${startDate} AND date <= ${endDate}
    ORDER BY date ASC
  `;

  return result.rows.map(row => ({
    id: row.id,
    date: row.date,
    weightKg: Number(row.weightKg),
  }));
}

export async function getDailyCalorieSummaries(
  userId: string,
  startDate: string,
  endDate: string
): Promise<{ date: string; totalCalories: number; totalProtein: number; totalCarbs: number; totalFat: number }[]> {
  const result = await sql`
    SELECT
      date,
      COALESCE(SUM(calories), 0) as "totalCalories",
      COALESCE(SUM(protein), 0) as "totalProtein",
      COALESCE(SUM(carbs), 0) as "totalCarbs",
      COALESCE(SUM(fat), 0) as "totalFat"
    FROM food_entries
    WHERE user_id = ${userId} AND date >= ${startDate} AND date <= ${endDate}
    GROUP BY date
    ORDER BY date ASC
  `;

  return result.rows.map(row => ({
    date: row.date,
    totalCalories: Number(row.totalCalories),
    totalProtein: Number(row.totalProtein),
    totalCarbs: Number(row.totalCarbs),
    totalFat: Number(row.totalFat),
  }));
}

export async function getDatesWithEntries(userId: string, startDate: string, endDate: string): Promise<string[]> {
  const result = await sql`
    SELECT DISTINCT date
    FROM food_entries
    WHERE user_id = ${userId} AND date >= ${startDate} AND date <= ${endDate}
    ORDER BY date ASC
  `;

  return result.rows.map(row => row.date);
}
