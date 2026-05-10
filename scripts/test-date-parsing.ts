import { config as loadEnv } from 'dotenv';
import path from 'path';
loadEnv({ path: path.join(__dirname, '../.env.local') });
import { sql } from '@vercel/postgres';
import { types } from 'pg';
types.setTypeParser(1082, (v: string) => v);

(async () => {
  const r = await sql`SELECT date, name FROM food_entries
    WHERE user_id = (SELECT id FROM users WHERE email = 'pau.biosca@gmail.com')
    ORDER BY created_at DESC LIMIT 1`;
  console.log('date type:', typeof r.rows[0].date, '| value:', r.rows[0].date);
})();
