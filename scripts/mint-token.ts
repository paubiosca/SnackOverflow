import { config as loadEnv } from 'dotenv';
import path from 'path';
loadEnv({ path: path.join(__dirname, '../.env.local') });
import { sql } from '@vercel/postgres';
import { randomBytes } from 'crypto';

(async () => {
  const users = await sql`SELECT id, email FROM users ORDER BY created_at LIMIT 5`;
  console.log('Users:');
  users.rows.forEach((u: any) => console.log(`  ${u.email} (${u.id})`));
  if (users.rows.length === 0) { console.log('No users yet — sign up at /register first.'); return; }
  const userId = users.rows[0].id;
  const token = `sf_${randomBytes(32).toString('hex')}`;
  await sql`INSERT INTO health_tokens (user_id, token, label) VALUES (${userId}, ${token}, 'curl-test')`;
  console.log('\nToken for', users.rows[0].email + ':');
  console.log(token);
})().catch(e => { console.error(e); process.exit(1); });
