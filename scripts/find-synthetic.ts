import { config as loadEnv } from 'dotenv';
import path from 'path';
loadEnv({ path: path.join(__dirname, '../.env.local') });
import { sql } from '@vercel/postgres';

(async () => {
  const u = await sql`SELECT id FROM users WHERE email = 'pau.biosca@gmail.com'`;
  const userId = u.rows[0].id;

  // Test-script markers we know about
  console.log('--- food_entries with "(test)" marker ---');
  const tests = await sql`
    SELECT id, name, calories, source, status, created_at FROM food_entries
    WHERE user_id = ${userId} AND (name ILIKE '%(test)%' OR name ILIKE '%parma ham%' OR name ILIKE '%test%')
  `;
  console.log(`${tests.rows.length} matches:`);
  tests.rows.forEach((r: any) => console.log(`  [${r.id.slice(0,8)}] ${r.name} (${r.calories}kcal, ${r.source})`));

  console.log('\n--- pantry_items with "test" marker ---');
  const ptests = await sql`
    SELECT id, normalized_name, raw_text, source, status FROM pantry_items
    WHERE user_id = ${userId} AND (normalized_name ILIKE '%test%' OR raw_text ILIKE '%test%')
  `;
  console.log(`${ptests.rows.length} matches:`);
  ptests.rows.forEach((r: any) => console.log(`  [${r.id.slice(0,8)}] ${r.normalized_name} (${r.source}/${r.status})`));

  console.log('\n--- daily_activity tagged source=apple_health (likely curl tests, not export) ---');
  const da = await sql`
    SELECT date, active_kcal, bmr_kcal, total_kcal, raw, updated_at FROM daily_activity
    WHERE user_id = ${userId} AND source = 'apple_health'
    ORDER BY date DESC
  `;
  da.rows.forEach((r: any) => console.log(`  ${r.date}: active=${r.active_kcal}, bmr=${r.bmr_kcal}, total=${r.total_kcal} ${r.raw ? '(has raw)' : ''}`));
})();
