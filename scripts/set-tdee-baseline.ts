import { config as loadEnv } from 'dotenv';
import path from 'path';
loadEnv({ path: path.join(__dirname, '../.env.local') });
import { sql } from '@vercel/postgres';

(async () => {
  const r = await sql`
    UPDATE profiles SET tdee_baseline_kcal = 2400, updated_at = NOW()
    WHERE user_id = (SELECT id FROM users WHERE email = 'pau.biosca@gmail.com')
    RETURNING tdee_baseline_kcal, weight_kg, age, gender
  `;
  console.log('Set baseline:', r.rows[0]);
})();
