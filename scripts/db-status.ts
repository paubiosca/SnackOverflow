import { config as loadEnv } from 'dotenv';
import path from 'path';
loadEnv({ path: path.join(__dirname, '../.env.local') });
import { sql } from '@vercel/postgres';

(async () => {
  const u = await sql`SELECT id FROM users WHERE email = 'pau.biosca@gmail.com'`;
  const userId = u.rows[0].id;

  const fe = await sql`
    SELECT COUNT(*)::int as n,
           COUNT(*) FILTER (WHERE date::text = CURRENT_DATE::text)::int as today,
           COUNT(*) FILTER (WHERE date >= CURRENT_DATE - INTERVAL '7 days')::int as last7,
           COUNT(*) FILTER (WHERE date >= CURRENT_DATE - INTERVAL '30 days')::int as last30,
           MIN(date)::text as earliest,
           MAX(date)::text as latest
    FROM food_entries WHERE user_id = ${userId}
  `;
  console.log('food_entries          :', fe.rows[0]);

  const pi = await sql`
    SELECT
      COUNT(*)::int as total,
      COUNT(*) FILTER (WHERE source = 'receipt')::int as receipt,
      COUNT(*) FILTER (WHERE source = 'manual')::int as manual,
      COUNT(*) FILTER (WHERE status = 'active')::int as active,
      MIN(created_at)::text as earliest, MAX(created_at)::text as latest
    FROM pantry_items WHERE user_id = ${userId}
  `;
  console.log('pantry_items          :', pi.rows[0]);

  const da = await sql`
    SELECT COUNT(*)::int as n,
           COUNT(*) FILTER (WHERE source = 'apple_health_export')::int as export_rows,
           COUNT(*) FILTER (WHERE source = 'apple_health')::int as shortcut_rows,
           MIN(date)::text as earliest, MAX(date)::text as latest
    FROM daily_activity WHERE user_id = ${userId}
  `;
  console.log('daily_activity        :', da.rows[0]);

  const sa = await sql`
    SELECT COUNT(*)::int as n,
           COUNT(*) FILTER (WHERE date >= CURRENT_DATE - INTERVAL '30 days')::int as last30,
           SUM(kcal)::int as total_kcal,
           MIN(date)::text as earliest, MAX(date)::text as latest
    FROM strava_activities WHERE user_id = ${userId}
  `;
  console.log('strava_activities     :', sa.rows[0]);

  const wl = await sql`SELECT COUNT(*)::int as n, MIN(date)::text as earliest, MAX(date)::text as latest, MAX(weight_kg)::numeric as latest_kg FROM weight_logs WHERE user_id = ${userId}`;
  console.log('weight_logs           :', wl.rows[0]);

  const water = await sql`SELECT COUNT(*)::int as n FROM water_logs WHERE user_id = ${userId}`;
  console.log('water_logs            :', water.rows[0]);

  const ht = await sql`SELECT COUNT(*)::int as n FROM health_tokens WHERE user_id = ${userId}`;
  const sacc = await sql`SELECT athlete_id FROM strava_accounts WHERE user_id = ${userId}`;
  console.log('health_tokens         :', ht.rows[0]);
  console.log('strava_accounts       :', sacc.rows[0] ?? 'none');

  const profile = await sql`
    SELECT goal_type, goal_value, tdee_baseline_kcal, weight_kg, age, gender
    FROM profiles WHERE user_id = ${userId}
  `;
  console.log('profile               :', profile.rows[0]);
})();
