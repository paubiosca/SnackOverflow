import { config as loadEnv } from 'dotenv';
import path from 'path';
loadEnv({ path: path.join(__dirname, '../.env.local') });
import { sql } from '@vercel/postgres';

(async () => {
  const u = await sql`SELECT id FROM users WHERE email = 'pau.biosca@gmail.com'`;
  const userId = u.rows[0].id;

  // 1. food_entries from the last 30 days (treat as synthetic per user instruction).
  const food = await sql`
    DELETE FROM food_entries
    WHERE user_id = ${userId} AND date >= CURRENT_DATE - INTERVAL '30 days'
    RETURNING id
  `;
  console.log(`food_entries: deleted ${food.rowCount} rows from the last 30 days`);

  // 2. pantry_items: everything (all 19 came from today's receipt scan).
  const pantry = await sql`
    DELETE FROM pantry_items WHERE user_id = ${userId}
    RETURNING id
  `;
  console.log(`pantry_items: deleted ${pantry.rowCount} rows`);

  // Sanity check.
  const after = await sql`
    SELECT
      (SELECT COUNT(*)::int FROM food_entries WHERE user_id = ${userId}) as food,
      (SELECT COUNT(*)::int FROM pantry_items WHERE user_id = ${userId}) as pantry,
      (SELECT MAX(date)::text FROM food_entries WHERE user_id = ${userId}) as food_latest,
      (SELECT MIN(date)::text FROM food_entries WHERE user_id = ${userId}) as food_earliest
  `;
  console.log('\nAfter cleanup:');
  console.log('  food_entries remaining:', after.rows[0].food, `(${after.rows[0].food_earliest} → ${after.rows[0].food_latest})`);
  console.log('  pantry_items remaining:', after.rows[0].pantry);
})();
