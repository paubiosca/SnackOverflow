// Load .env.local before importing @vercel/postgres so POSTGRES_URL is available
// when its module-level pool is initialized. Without this, running the script
// outside `next dev` fails with `missing_connection_string`.
import { config as loadEnv } from 'dotenv';
import path from 'path';
loadEnv({ path: path.join(__dirname, '../.env.local') });

import { sql } from '@vercel/postgres';
import fs from 'fs';

async function setupDatabase() {
  console.log('Setting up database...');

  const schemaPath = path.join(__dirname, '../lib/db/schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');

  // Split by semicolon and execute each statement
  const statements = schema
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  for (const statement of statements) {
    try {
      await sql.query(statement);
      console.log('Executed:', statement.substring(0, 50) + '...');
    } catch (error) {
      console.error('Error executing statement:', statement.substring(0, 50));
      console.error(error);
    }
  }

  console.log('Database setup complete!');
}

setupDatabase().catch(console.error);
