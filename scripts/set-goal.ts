import { config as loadEnv } from 'dotenv';
import path from 'path';
loadEnv({ path: path.join(__dirname, '../.env.local') });
import { sql } from '@vercel/postgres';

(async () => {
  const before = await sql`
    SELECT goal_type, goal_value, activity_level, activity_approach,
           weight_kg, height_cm, age, gender, active_calorie_goal
    FROM profiles WHERE user_id = (SELECT id FROM users WHERE email = 'pau.biosca@gmail.com')
  `;
  console.log('BEFORE:', before.rows[0]);

  await sql`
    UPDATE profiles SET
      goal_type = 'weight_loss_rate',
      goal_value = 0.5,
      updated_at = NOW()
    WHERE user_id = (SELECT id FROM users WHERE email = 'pau.biosca@gmail.com')
  `;

  const after = await sql`
    SELECT goal_type, goal_value, activity_level, activity_approach
    FROM profiles WHERE user_id = (SELECT id FROM users WHERE email = 'pau.biosca@gmail.com')
  `;
  console.log('AFTER:', after.rows[0]);
})().catch((e) => { console.error(e); process.exit(1); });
