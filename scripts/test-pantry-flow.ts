import { config as loadEnv } from 'dotenv';
import path from 'path';
loadEnv({ path: path.join(__dirname, '../.env.local') });
import { sql } from '@vercel/postgres';
import { bulkInsertPantryItems, getFoodSuggestions, addFoodEntry } from '../lib/db';

(async () => {
  const users = await sql`SELECT id, email FROM users ORDER BY created_at DESC LIMIT 1`;
  if (users.rows.length === 0) { console.log('No users.'); return; }
  const userId = users.rows[0].id as string;
  console.log('User:', users.rows[0].email);

  // 1) Insert a pantry item
  console.log('\n[1] Insert a pantry item');
  const inserted = await bulkInsertPantryItems(userId, [
    {
      rawText: 'M&S ITALIAN BURRATA',
      normalizedName: 'Italian burrata (test)',
      qtyTotal: 2,
      unit: 'item',
      estCaloriesPerUnit: 262,
      estProteinPerUnit: 10,
      estCarbsPerUnit: 1.1,
      estFatPerUnit: 24.2,
      store: 'M&S',
      source: 'receipt',
      purchasedAt: new Date().toISOString(),
      nutritionSource: 'web',
      nutritionConfidence: 'high',
      nutritionCitation: 'https://www.marksandspencer.com/food/italian-burrata/p/fdp60482514',
    },
  ]);
  const pantryItem = inserted[0];
  console.log('   inserted', pantryItem.id, `qty=${pantryItem.qtyRemaining}/${pantryItem.qtyTotal}`);

  // 2) Verify it shows up in suggestions
  console.log('\n[2] Quick-log suggestions:');
  const sugg1 = await getFoodSuggestions(userId);
  const matched = sugg1.find((s) => s.pantryItemId === pantryItem.id);
  console.log(`   total ${sugg1.length} chips; pantry chip present: ${matched ? 'YES' : 'NO'}`);
  if (matched) console.log('   ✓', matched.source, '·', matched.name, `· ${matched.calories} kcal · qty ${matched.qtyRemaining}`);
  else { console.log('   ✗ FAILED. dump:', JSON.stringify(sugg1.slice(0, 3), null, 2)); process.exit(1); }

  // 3) Tap the chip → addFoodEntry with pantryItemId
  console.log('\n[3] Simulate tapping the chip (one-tap log):');
  const entry1 = await addFoodEntry(userId, {
    name: matched.name,
    mealType: matched.mealType,
    date: new Date().toISOString().slice(0, 10),
    calories: matched.calories,
    protein: matched.protein,
    carbs: matched.carbs,
    fat: matched.fat,
    isManualEntry: false,
    source: 'pantry',
    pantryItemId: pantryItem.id,
  });
  console.log('   added entry', entry1.id);

  // 4) Verify qty decremented
  const after1 = await sql`SELECT qty_remaining, status FROM pantry_items WHERE id = ${pantryItem.id}`;
  console.log(`   pantry now: qty_remaining=${after1.rows[0].qty_remaining}, status=${after1.rows[0].status}`);

  // 5) Tap once more → should hit 0 and become depleted
  console.log('\n[4] Tap once more (should deplete):');
  await addFoodEntry(userId, {
    name: matched.name,
    mealType: matched.mealType,
    date: new Date().toISOString().slice(0, 10),
    calories: matched.calories,
    protein: matched.protein,
    carbs: matched.carbs,
    fat: matched.fat,
    isManualEntry: false,
    source: 'pantry',
    pantryItemId: pantryItem.id,
  });
  const after2 = await sql`SELECT qty_remaining, status FROM pantry_items WHERE id = ${pantryItem.id}`;
  console.log(`   pantry now: qty_remaining=${after2.rows[0].qty_remaining}, status=${after2.rows[0].status}`);

  // 6) Verify chip is gone now
  console.log('\n[5] Suggestions after depletion:');
  const sugg2 = await getFoodSuggestions(userId);
  const stillThere = sugg2.find((s) => s.pantryItemId === pantryItem.id);
  console.log(`   pantry chip still present: ${stillThere ? 'YES (BUG)' : 'NO ✓'}`);

  // Cleanup
  await sql`DELETE FROM food_entries WHERE pantry_item_id = ${pantryItem.id}`;
  await sql`DELETE FROM pantry_items WHERE id = ${pantryItem.id}`;
  console.log('\nCleaned up.');
})().catch((e) => { console.error('FAILED:', e); process.exit(1); });
