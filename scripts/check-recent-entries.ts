import { config as loadEnv } from 'dotenv';
import path from 'path';
loadEnv({ path: path.join(__dirname, '../.env.local') });
import { sql } from '@vercel/postgres';

(async () => {
  const r = await sql`
    SELECT id, name, date, consumed_at, created_at, status
    FROM food_entries
    WHERE user_id = (SELECT id FROM users WHERE email = 'pau.biosca@gmail.com')
    ORDER BY created_at DESC
    LIMIT 10
  `;
  console.log('Recent food entries:');
  r.rows.forEach((row) => {
    console.log({
      name: row.name,
      date: row.date,
      consumed_at: row.consumed_at,
      created_at: row.created_at,
    });
  });
})();
