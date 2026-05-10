// One-shot ingest of an Apple Health export.xml into daily_activity. Streams
// line-by-line so the 374MB file doesn't blow up Node's heap. Aggregates by
// local-date slice of `startDate` and upserts via existing helper.
//
// Usage: npx tsx scripts/ingest-apple-health-xml.ts <user-email> <path-to-xml>

import { config as loadEnv } from 'dotenv';
import path from 'path';
loadEnv({ path: path.join(__dirname, '../.env.local') });

import fs from 'fs';
import readline from 'readline';
import { sql } from '@vercel/postgres';
import { upsertDailyActivity } from '../lib/db';

const TYPES: Record<string, 'active' | 'bmr' | 'steps' | 'rhr'> = {
  HKQuantityTypeIdentifierActiveEnergyBurned: 'active',
  HKQuantityTypeIdentifierBasalEnergyBurned: 'bmr',
  HKQuantityTypeIdentifierStepCount: 'steps',
  HKQuantityTypeIdentifierRestingHeartRate: 'rhr',
};

interface Agg { active: number; bmr: number; steps: number; rhr: number[] }

async function main() {
  const email = process.argv[2];
  const xmlPath = process.argv[3];
  if (!email || !xmlPath) {
    console.error('Usage: tsx ingest-apple-health-xml.ts <email> <xml-path>');
    process.exit(1);
  }

  const u = await sql`SELECT id FROM users WHERE email = ${email}`;
  if (u.rows.length === 0) { console.error('No user'); process.exit(1); }
  const userId = u.rows[0].id;

  const stat = fs.statSync(xmlPath);
  console.log(`Streaming ${(stat.size / 1_000_000).toFixed(0)}MB...`);

  const daily = new Map<string, Agg>();
  let count = 0;
  let matched = 0;

  // Match self-closing single-line <Record .../>. Apple's exports keep these
  // on one line; if a multi-line Record appears we just miss it (rare for the
  // four numeric types we care about).
  const RECORD_RE = /<Record\s+type="([^"]+)"[^/]*?startDate="([^"]+)"[^/]*?value="([^"]+)"/;

  const rl = readline.createInterface({
    input: fs.createReadStream(xmlPath, { encoding: 'utf-8' }),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    count++;
    if (count % 200_000 === 0) console.log(`  ${count.toLocaleString()} lines / ${matched} matched`);
    const m = RECORD_RE.exec(line);
    if (!m) continue;
    const kind = TYPES[m[1]];
    if (!kind) continue;
    const day = m[2].slice(0, 10);
    const v = parseFloat(m[3]);
    if (!Number.isFinite(v)) continue;
    let row = daily.get(day);
    if (!row) { row = { active: 0, bmr: 0, steps: 0, rhr: [] }; daily.set(day, row); }
    if (kind === 'rhr') row.rhr.push(v);
    else (row[kind] as number) += v;
    matched++;
  }

  console.log(`\nParsed: ${count.toLocaleString()} lines, ${matched} relevant records, ${daily.size} unique days`);

  // Upsert. Sequential to be gentle on Postgres but with progress logging.
  let written = 0;
  const dates = Array.from(daily.keys()).sort();
  for (const date of dates) {
    const r = daily.get(date)!;
    await upsertDailyActivity(userId, {
      date,
      activeKcal: Math.round(r.active),
      bmrKcal: Math.round(r.bmr),
      totalKcal: Math.round(r.active + r.bmr),
      steps: Math.round(r.steps),
      restingHr: r.rhr.length ? Math.round(r.rhr.reduce((a, b) => a + b, 0) / r.rhr.length) : null,
      source: 'apple_health_export',
      raw: null,
    });
    written++;
    if (written % 200 === 0) console.log(`  wrote ${written}/${dates.length}`);
  }

  console.log(`\nDone. Wrote ${written} days from ${dates[0]} to ${dates[dates.length - 1]}.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
