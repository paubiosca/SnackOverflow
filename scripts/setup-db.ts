import { sql } from '@vercel/postgres';
import fs from 'fs';
import path from 'path';

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
