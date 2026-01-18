import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';

// This endpoint sets up the database schema
// It should only be run once during initial deployment
// In production, you should protect this with a secret or remove it after setup
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret');

  // Simple protection - in production use a proper secret
  if (secret !== process.env.SETUP_SECRET && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Create users table
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255),
        name VARCHAR(255),
        email_verified TIMESTAMP WITH TIME ZONE,
        image TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `;

    // Create profiles table
    await sql`
      CREATE TABLE IF NOT EXISTS profiles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        age INTEGER NOT NULL,
        gender VARCHAR(10) NOT NULL CHECK (gender IN ('male', 'female')),
        height_cm DECIMAL(5,1) NOT NULL,
        weight_kg DECIMAL(5,1) NOT NULL,
        activity_level VARCHAR(20) NOT NULL CHECK (activity_level IN ('sedentary', 'light', 'moderate', 'active', 'very_active')),
        goal_type VARCHAR(20) NOT NULL CHECK (goal_type IN ('deficit_fixed', 'weight_loss_rate')),
        goal_value DECIMAL(5,2) NOT NULL,
        daily_water_goal_ml INTEGER NOT NULL DEFAULT 2000,
        openai_api_key TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(user_id)
      )
    `;

    // Create food_entries table
    await sql`
      CREATE TABLE IF NOT EXISTS food_entries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        meal_type VARCHAR(20) NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
        date DATE NOT NULL,
        calories DECIMAL(7,1) NOT NULL,
        protein DECIMAL(6,1) NOT NULL,
        carbs DECIMAL(6,1) NOT NULL,
        fat DECIMAL(6,1) NOT NULL,
        is_manual_entry BOOLEAN NOT NULL DEFAULT TRUE,
        ai_confidence DECIMAL(5,2),
        photo_url TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `;

    // Create water_logs table
    await sql`
      CREATE TABLE IF NOT EXISTS water_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        amount_ml INTEGER NOT NULL,
        logged_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `;

    // Create weight_logs table
    await sql`
      CREATE TABLE IF NOT EXISTS weight_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        weight_kg DECIMAL(5,1) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `;

    // Create NextAuth accounts table
    await sql`
      CREATE TABLE IF NOT EXISTS accounts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(255) NOT NULL,
        provider VARCHAR(255) NOT NULL,
        provider_account_id VARCHAR(255) NOT NULL,
        refresh_token TEXT,
        access_token TEXT,
        expires_at BIGINT,
        token_type VARCHAR(255),
        scope TEXT,
        id_token TEXT,
        session_state TEXT,
        UNIQUE(provider, provider_account_id)
      )
    `;

    // Create sessions table
    await sql`
      CREATE TABLE IF NOT EXISTS sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_token VARCHAR(255) UNIQUE NOT NULL,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires TIMESTAMP WITH TIME ZONE NOT NULL
      )
    `;

    // Create verification_tokens table
    await sql`
      CREATE TABLE IF NOT EXISTS verification_tokens (
        identifier VARCHAR(255) NOT NULL,
        token VARCHAR(255) UNIQUE NOT NULL,
        expires TIMESTAMP WITH TIME ZONE NOT NULL,
        PRIMARY KEY (identifier, token)
      )
    `;

    // Create indexes
    await sql`CREATE INDEX IF NOT EXISTS idx_food_entries_user_date ON food_entries(user_id, date)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_water_logs_user_date ON water_logs(user_id, date)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_weight_logs_user_date ON weight_logs(user_id, date)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_profiles_user ON profiles(user_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_accounts_user ON accounts(user_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)`;

    return NextResponse.json({ success: true, message: 'Database setup complete!' });
  } catch (error) {
    console.error('Database setup error:', error);
    return NextResponse.json(
      { error: 'Database setup failed', details: String(error) },
      { status: 500 }
    );
  }
}
