import { config as loadEnv } from 'dotenv';
import path from 'path';
loadEnv({ path: path.join(__dirname, '../.env.local') });
import { sql } from '@vercel/postgres';
import { bulkInsertPantryItems, getFoodSuggestions, addFoodEntry } from '../lib/db';

(async () => {
  const users = await sql`SELECT id, email FROM users ORDER BY created_at DESC LIMIT 1`;
  const userId = users.rows[0].id as string;

  // Insert a 220g pack of Parma ham, 242 kcal/100g
  const inserted = await bulkInsertPantryItems(userId, [
    {
      rawText: 'PARMA HAM 80G',
      normalizedName: 'Parma ham (test)',
      qtyTotal: 1, unit: 'g',
      estCaloriesPerUnit: 242,        // per 100g
      estProteinPerUnit: 29.1,
      estCarbsPerUnit: 0.9,
      estFatPerUnit: 13.5,
      packGrams: 80,                  // total pack weight
      store: 'M&S', source: 'receipt',
      nutritionSource: 'web',
      nutritionConfidence: 'high',
    },
  ]);
  const id = inserted[0].id;
  console.log('Inserted:', id, 'pack 80g, 242 kcal/100g');

  // Suggestions should expose unit + packGrams
  const suggs = await getFoodSuggestions(userId);
  const chip = suggs.find((s) => s.pantryItemId === id);
  console.log('Chip:', chip?.name, '·', chip?.calories, 'kcal·100g·packGrams=', chip?.packGrams, 'unit=', chip?.unit);

  // Simulate "half this pack" → 40g consumed → 96.8 kcal, decrement 0.4 units (40g/100g)
  await addFoodEntry(userId, {
    name: 'Parma ham (test) (half · 40g)',
    mealType: 'lunch',
    date: new Date().toISOString().slice(0, 10),
    calories: 97,
    protein: 11.6,
    carbs: 0.4,
    fat: 5.4,
    isManualEntry: false,
    source: 'pantry',
    pantryItemId: id,
    pantryConsumeUnits: 0.4,
  } as Parameters<typeof addFoodEntry>[1] & { pantryConsumeUnits?: number });
  let row = (await sql`SELECT qty_remaining, status FROM pantry_items WHERE id = ${id}`).rows[0];
  console.log('After half:', row);

  // Eat the rest (40g)
  await addFoodEntry(userId, {
    name: 'Parma ham (test) (rest)',
    mealType: 'snack',
    date: new Date().toISOString().slice(0, 10),
    calories: 97, protein: 11.6, carbs: 0.4, fat: 5.4,
    isManualEntry: false, source: 'pantry',
    pantryItemId: id,
    pantryConsumeUnits: 0.4,
  } as Parameters<typeof addFoodEntry>[1] & { pantryConsumeUnits?: number });
  row = (await sql`SELECT qty_remaining, status FROM pantry_items WHERE id = ${id}`).rows[0];
  console.log('After rest:', row);

  await sql`DELETE FROM food_entries WHERE pantry_item_id = ${id}`;
  await sql`DELETE FROM pantry_items WHERE id = ${id}`;
  console.log('Cleaned up.');
})().catch((e) => { console.error(e); process.exit(1); });
