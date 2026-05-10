import { config as loadEnv } from 'dotenv';
import path from 'path';
loadEnv({ path: path.join(__dirname, '../.env.local') });
import { sql } from '@vercel/postgres';
import { getFoodSuggestions } from '../lib/db';

(async () => {
  const u = await sql`SELECT id FROM users WHERE email = 'pau.biosca@gmail.com'`;
  const userId = u.rows[0].id;
  const suggestions = await getFoodSuggestions(userId, { limit: 12 });
  const byKind: Record<string, number> = {};
  suggestions.forEach((s) => { byKind[s.source] = (byKind[s.source] || 0) + 1; });
  console.log('Total:', suggestions.length);
  console.log('By source:', byKind);
  console.log('\nFirst 3 of each non-pantry kind:');
  ['recent', 'frequent', 'time-of-day'].forEach((kind) => {
    const matches = suggestions.filter((s) => s.source === kind).slice(0, 3);
    console.log(` ${kind}:`, matches.map((s) => `${s.name} (${s.calories}kcal × ${s.occurrences})`));
  });
})();
