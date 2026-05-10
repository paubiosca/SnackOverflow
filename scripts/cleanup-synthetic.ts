import { config as loadEnv } from 'dotenv';
import path from 'path';
loadEnv({ path: path.join(__dirname, '../.env.local') });
import { sql } from '@vercel/postgres';

(async () => {
  const u = await sql`SELECT id FROM users WHERE email = 'pau.biosca@gmail.com'`;
  const userId = u.rows[0].id;

  // Curl smoke tests sent fake { active_kcal: 485 } and the array test
  // [{ active_kcal: 420 }, { active_kcal: 510 }]. They were tagged
  // source='apple_health' (vs real Apple Health data which is tagged
  // 'apple_health_export'). Delete only those.
  const r = await sql`
    DELETE FROM daily_activity
    WHERE user_id = ${userId} AND source = 'apple_health'
    RETURNING date, active_kcal, bmr_kcal
  `;
  console.log(`Deleted ${r.rowCount} rows:`);
  r.rows.forEach((row: any) => console.log(`  ${row.date.toISOString().slice(0, 10)}: active=${row.active_kcal}, bmr=${row.bmr_kcal}`));
})();
