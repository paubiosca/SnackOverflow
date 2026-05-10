import { config as loadEnv } from 'dotenv';
import path from 'path';
loadEnv({ path: path.join(__dirname, '../.env.local') });
import { getFoodEntries } from '../lib/db';

(async () => {
  // Get user id
  const { sql } = await import('@vercel/postgres');
  const u = await sql`SELECT id FROM users WHERE email = 'pau.biosca@gmail.com'`;
  const userId = u.rows[0].id;
  const entries = await getFoodEntries(userId, '2026-05-10');
  console.log(`Got ${entries.length} entries for 2026-05-10:`);
  entries.slice(0, 3).forEach((e: any) => {
    console.log(`  ${e.date} | ${e.name} | type ${typeof e.date}`);
  });
})();
