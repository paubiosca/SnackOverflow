import { config as loadEnv } from 'dotenv';
import path from 'path';
loadEnv({ path: path.join(__dirname, '../.env.local') });
import { sql } from '@vercel/postgres';

(async () => {
  // Delete the curl-test rows (anything tagged source='apple_health' that came from
  // smoke testing) and the curl-test token.
  const r = await sql`
    DELETE FROM daily_activity
    WHERE source = 'apple_health'
      AND raw->>'active_kcal' = '485'
  `;
  console.log('Deleted', r.rowCount, 'test daily_activity rows');
  const t = await sql`DELETE FROM health_tokens WHERE label = 'curl-test'`;
  console.log('Deleted', t.rowCount, 'curl-test tokens');
})().catch((e) => { console.error(e); process.exit(1); });
