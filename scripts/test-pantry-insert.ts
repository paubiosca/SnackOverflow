import { config as loadEnv } from 'dotenv';
import path from 'path';
loadEnv({ path: path.join(__dirname, '../.env.local') });
import { sql } from '@vercel/postgres';
import { bulkInsertPantryItems, getActivePantryItems } from '../lib/db';

(async () => {
  const users = await sql`SELECT id, email FROM users ORDER BY created_at DESC LIMIT 1`;
  if (users.rows.length === 0) { console.log('No users.'); return; }
  const userId = users.rows[0].id as string;

  console.log('Inserting 2 test pantry items for', users.rows[0].email);
  const inserted = await bulkInsertPantryItems(userId, [
    {
      rawText: 'M&S COOK SHANK HAM 220G',
      normalizedName: 'M&S cooked shank ham',
      qtyTotal: 1,
      unit: 'g',
      estCaloriesPerUnit: 145,
      estProteinPerUnit: 22,
      estCarbsPerUnit: 1,
      estFatPerUnit: 6,
      store: 'M&S',
      source: 'receipt',
      purchasedAt: new Date().toISOString(),
      nutritionSource: 'off',
      nutritionConfidence: 'high',
    },
    {
      rawText: 'BANANA',
      normalizedName: 'Bananas',
      qtyTotal: 6,
      unit: 'item',
      estCaloriesPerUnit: 95,
      estProteinPerUnit: 1,
      estCarbsPerUnit: 25,
      estFatPerUnit: 0,
      store: 'Tesco',
      source: 'receipt',
      purchasedAt: new Date().toISOString(),
      nutritionSource: 'estimate',
      nutritionConfidence: 'low',
    },
  ]);

  console.log('Inserted', inserted.length, 'items');
  inserted.forEach((it) => console.log(' -', it.id, it.normalizedName, it.qtyTotal, it.unit, it.estCaloriesPerUnit));

  const all = await getActivePantryItems(userId);
  console.log('\nActive pantry:', all.length, 'items');
  all.slice(0, 5).forEach((it) => console.log(' -', it.normalizedName, `${it.qtyRemaining}×${it.unit}`));

  // Clean up the two test rows so they don't pollute the user's pantry.
  for (const it of inserted) {
    await sql`DELETE FROM pantry_items WHERE id = ${it.id}`;
  }
  console.log('\nCleaned up test rows.');
})().catch((e) => { console.error(e); process.exit(1); });
