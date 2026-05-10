import { config as loadEnv } from 'dotenv';
import path from 'path';
loadEnv({ path: path.join(__dirname, '../.env.local') });
import { sql } from '@vercel/postgres';

// Removes backfilled food entries. New backfill rows are tagged with
// notes='__backfill__'. The first run of backfill (108 rows) was inserted
// before that tag existed, so this script first retro-tags untagged rows
// that match the original backfill signature: created within a small window,
// dated in the past, source='analyze-text', for the most recent user.

(async () => {
  const users = await sql`SELECT id, email FROM users ORDER BY created_at DESC LIMIT 1`;
  if (users.rows.length === 0) {
    console.log('No users found.');
    return;
  }
  const user = users.rows[0];
  console.log('Cleaning backfill for', user.email);

  // Step 1: retro-tag any untagged backfill from the original run.
  // Heuristic: source='analyze-text', resolved, dated before today, and
  // created within a single 5-minute window (a backfill batch). This is
  // narrow enough to avoid touching real entries.
  const retroTag = await sql.query(
    `WITH batch AS (
       SELECT date_trunc('minute', created_at) AS bucket, COUNT(*) AS n
       FROM food_entries
       WHERE user_id = $1
         AND source = 'analyze-text'
         AND status = 'resolved'
         AND date < CURRENT_DATE
         AND (notes IS NULL OR notes <> '__backfill__')
       GROUP BY 1
       HAVING COUNT(*) >= 20
     )
     UPDATE food_entries fe
     SET notes = '__backfill__'
     FROM batch b
     WHERE fe.user_id = $1
       AND fe.source = 'analyze-text'
       AND fe.status = 'resolved'
       AND fe.date < CURRENT_DATE
       AND (fe.notes IS NULL OR fe.notes <> '__backfill__')
       AND date_trunc('minute', fe.created_at) BETWEEN b.bucket - INTERVAL '5 minutes' AND b.bucket + INTERVAL '5 minutes'
     RETURNING fe.id`,
    [user.id]
  );
  if (retroTag.rowCount && retroTag.rowCount > 0) {
    console.log(`Retro-tagged ${retroTag.rowCount} legacy backfill entries.`);
  }

  // Step 2: delete all tagged entries.
  const del = await sql.query(
    `DELETE FROM food_entries WHERE user_id = $1 AND notes = '__backfill__' RETURNING id`,
    [user.id]
  );
  console.log(`Deleted ${del.rowCount ?? 0} backfill entries.`);
})().catch((e) => { console.error(e); process.exit(1); });
