import { config as loadEnv } from 'dotenv';
import path from 'path';
loadEnv({ path: '/Users/paubiosca/Documents/SnackOverflow/.env.local' });
import { sql } from '@vercel/postgres';

(async () => {
  const u = await sql`SELECT id FROM users WHERE email = 'pau.biosca@gmail.com'`;
  const userId = u.rows[0].id;

  console.log('--- food_entries today ---');
  const entries = await sql`
    SELECT name, source, status, calories, created_at
    FROM food_entries
    WHERE user_id = ${userId} AND date::text = '2026-05-10'
    ORDER BY created_at DESC
  `;
  console.log(`${entries.rows.length} entries:`);
  entries.rows.forEach((r: any) => console.log(`  [${r.source}/${r.status}] ${r.name} - ${r.calories}kcal @ ${r.created_at.toISOString().slice(11,16)}`));

  console.log('\n--- pantry_items by source ---');
  const pantry = await sql`
    SELECT source, status, COUNT(*) as n, MIN(created_at) as earliest, MAX(created_at) as latest
    FROM pantry_items
    WHERE user_id = ${userId}
    GROUP BY source, status
  `;
  pantry.rows.forEach((r: any) => console.log(`  [${r.source}/${r.status}] count=${r.n} ${r.earliest.toISOString().slice(0,16)} → ${r.latest.toISOString().slice(0,16)}`));

  console.log('\n--- daily_activity sources ---');
  const da = await sql`
    SELECT source, COUNT(*) as n FROM daily_activity WHERE user_id = ${userId} GROUP BY source
  `;
  da.rows.forEach((r: any) => console.log(`  ${r.source}: ${r.n}`));
})();
