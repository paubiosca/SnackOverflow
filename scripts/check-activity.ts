import { config as loadEnv } from 'dotenv';
import path from 'path';
loadEnv({ path: path.join(__dirname, '../.env.local') });
import { sql } from '@vercel/postgres';

(async () => {
  const r = await sql`
    SELECT date, active_kcal, bmr_kcal, total_kcal, steps, resting_hr, source, updated_at
    FROM daily_activity
    WHERE date = '2026-05-10'
    ORDER BY updated_at DESC
    LIMIT 1
  `;
  console.log('daily_activity row for today:', r.rows[0] ?? '(none)');
  const t = await sql`SELECT label, last_used_at FROM health_tokens WHERE label = 'curl-test'`;
  console.log('token last_used_at:', t.rows[0]?.last_used_at);
})();
