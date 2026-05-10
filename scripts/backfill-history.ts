import { config as loadEnv } from 'dotenv';
import path from 'path';
loadEnv({ path: path.join(__dirname, '../.env.local') });
import { sql } from '@vercel/postgres';

// Backfill ~30 days of plausible food entries for the most recent user, so the
// History page has something to render. Distribution:
//   - ~70% of days are "under goal" (good days)
//   - ~20% land near goal
//   - ~10% are "over goal"
//   - 1-2 days have no entries at all (gaps)
// Each day gets breakfast/lunch/dinner and sometimes a snack, with calories
// jittered around the day's target total.

const BREAKFAST = [
  { name: 'Greek yogurt with berries', kcal: 240, p: 18, c: 28, f: 6 },
  { name: 'Oatmeal with banana', kcal: 320, p: 9, c: 58, f: 6 },
  { name: 'Two scrambled eggs and toast', kcal: 380, p: 22, c: 24, f: 22 },
  { name: 'Avocado toast', kcal: 360, p: 10, c: 34, f: 20 },
  { name: 'Protein smoothie', kcal: 280, p: 30, c: 28, f: 4 },
  { name: 'Bagel with cream cheese', kcal: 420, p: 14, c: 56, f: 16 },
];
const LUNCH = [
  { name: 'Chicken Caesar salad', kcal: 480, p: 36, c: 18, f: 28 },
  { name: 'Turkey sandwich', kcal: 520, p: 28, c: 56, f: 18 },
  { name: 'Poke bowl', kcal: 580, p: 32, c: 72, f: 14 },
  { name: 'Burrito bowl', kcal: 720, p: 40, c: 78, f: 22 },
  { name: 'Sushi (8 pcs)', kcal: 540, p: 22, c: 78, f: 14 },
  { name: 'Lentil soup with bread', kcal: 460, p: 22, c: 68, f: 8 },
];
const DINNER = [
  { name: 'Grilled salmon with rice', kcal: 620, p: 42, c: 56, f: 22 },
  { name: 'Pasta bolognese', kcal: 780, p: 32, c: 86, f: 28 },
  { name: 'Stir-fried chicken and veg', kcal: 540, p: 44, c: 38, f: 18 },
  { name: 'Steak and potatoes', kcal: 820, p: 50, c: 48, f: 42 },
  { name: 'Veggie curry with rice', kcal: 580, p: 16, c: 88, f: 18 },
  { name: 'Pizza (3 slices)', kcal: 880, p: 36, c: 96, f: 36 },
];
const SNACK = [
  { name: 'Apple', kcal: 95, p: 0, c: 25, f: 0 },
  { name: 'Almonds (handful)', kcal: 170, p: 6, c: 6, f: 14 },
  { name: 'Protein bar', kcal: 220, p: 20, c: 22, f: 8 },
  { name: 'Dark chocolate (2 squares)', kcal: 110, p: 1, c: 12, f: 7 },
  { name: 'Latte', kcal: 180, p: 10, c: 16, f: 8 },
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function jitter(value: number, frac = 0.1): number {
  const delta = value * frac;
  return Math.round(value + (Math.random() * 2 - 1) * delta);
}
function localDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

(async () => {
  const users = await sql`SELECT id, email FROM users ORDER BY created_at DESC LIMIT 1`;
  if (users.rows.length === 0) {
    console.log('No users found. Sign up first.');
    return;
  }
  const user = users.rows[0];
  console.log('Backfilling for', user.email, `(${user.id})`);

  const profile = await sql`SELECT * FROM profiles WHERE user_id = ${user.id}`;
  if (profile.rows.length === 0) {
    console.log('User has no profile yet. Complete onboarding first.');
    return;
  }

  // Roughly compute the user's calorie goal from their profile.
  const p = profile.rows[0] as any;
  const bmrBase = 10 * Number(p.weight_kg) + 6.25 * Number(p.height_cm) - 5 * Number(p.age);
  const bmr = p.gender === 'male' ? bmrBase + 5 : bmrBase - 161;
  const mult: Record<string, number> = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9 };
  const tdee = Math.round(bmr * (mult[p.activity_level as string] || 1.55));
  let deficit = 0;
  if (p.goal_type === 'deficit_fixed') deficit = Number(p.goal_value || 0);
  else if (p.goal_type === 'weight_loss_rate') deficit = Math.round((-Number(p.goal_value || 0) * 7700) / 7);
  const goal = Math.max(1200, tdee + deficit);
  console.log('Estimated daily goal:', goal, 'kcal (TDEE', tdee, ', deficit', deficit, ')');

  const today = new Date();
  today.setHours(12, 0, 0, 0);

  let inserted = 0;
  let skippedDays = 0;
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dateStr = localDate(d);

    // 1 in 15 days has no entries (gap)
    if (Math.random() < 1 / 15) {
      skippedDays++;
      continue;
    }

    // Pick a "day archetype": under, near, over.
    const r = Math.random();
    let targetTotal: number;
    if (r < 0.7) targetTotal = goal - 200 - Math.floor(Math.random() * 500); // under by 200-700
    else if (r < 0.9) targetTotal = goal + Math.floor(Math.random() * 200) - 100; // ±100
    else targetTotal = goal + 200 + Math.floor(Math.random() * 600); // over by 200-800

    const meals: Array<{ slot: string; pool: typeof BREAKFAST }> = [
      { slot: 'breakfast', pool: BREAKFAST },
      { slot: 'lunch', pool: LUNCH },
      { slot: 'dinner', pool: DINNER },
    ];
    if (Math.random() < 0.6) meals.push({ slot: 'snack', pool: SNACK });

    // First pass: pick items.
    const chosen = meals.map((m) => ({ slot: m.slot, item: pick(m.pool) }));
    const baseSum = chosen.reduce((s, x) => s + x.item.kcal, 0);
    const scale = targetTotal / baseSum;

    for (const c of chosen) {
      const kcal = jitter(Math.round(c.item.kcal * scale), 0.08);
      const protein = jitter(Math.round(c.item.p * scale), 0.1);
      const carbs = jitter(Math.round(c.item.c * scale), 0.1);
      const fat = jitter(Math.round(c.item.f * scale), 0.1);

      const consumedAt = new Date(d);
      const hourBySlot: Record<string, number> = { breakfast: 8, lunch: 13, dinner: 19, snack: 16 };
      consumedAt.setHours(hourBySlot[c.slot] + Math.floor(Math.random() * 2), Math.floor(Math.random() * 60), 0, 0);

      await sql.query(
        `INSERT INTO food_entries (
           user_id, name, meal_type, date, consumed_at,
           calories, protein, carbs, fat,
           is_manual_entry, status, source, notes
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [user.id, c.item.name, c.slot, dateStr, consumedAt.toISOString(), kcal, protein, carbs, fat, false, 'resolved', 'analyze-text', '__backfill__']
      );
      inserted++;
    }
  }

  console.log(`Inserted ${inserted} entries across ~${30 - skippedDays} days. Skipped ${skippedDays} day(s) as gaps.`);
})().catch((e) => { console.error(e); process.exit(1); });
