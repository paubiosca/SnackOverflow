-- SnackOverflow Database Schema
-- Multi-user calorie tracking app

-- Users table (managed by NextAuth, but we add our fields)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255), -- NULL if using OAuth
  name VARCHAR(255),
  email_verified TIMESTAMP WITH TIME ZONE,
  image TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User profiles (nutrition goals and settings)
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
  openai_api_key TEXT, -- Encrypted or user-provided
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Food entries
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
);

-- Water logs
CREATE TABLE IF NOT EXISTS water_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  amount_ml INTEGER NOT NULL,
  logged_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Weight logs
CREATE TABLE IF NOT EXISTS weight_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  weight_kg DECIMAL(5,1) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- NextAuth.js required tables
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
);

CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_token VARCHAR(255) UNIQUE NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE IF NOT EXISTS verification_tokens (
  identifier VARCHAR(255) NOT NULL,
  token VARCHAR(255) UNIQUE NOT NULL,
  expires TIMESTAMP WITH TIME ZONE NOT NULL,
  PRIMARY KEY (identifier, token)
);

-- Pantry items: purchased food awaiting consumption, populated from receipt scans or manual entry
CREATE TABLE IF NOT EXISTS pantry_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  raw_text VARCHAR(255),
  normalized_name VARCHAR(255) NOT NULL,
  qty_total DECIMAL(6,2) NOT NULL DEFAULT 1,
  qty_remaining DECIMAL(6,2) NOT NULL DEFAULT 1,
  unit VARCHAR(32) DEFAULT 'item',
  est_calories_per_unit DECIMAL(7,1),
  est_protein_per_unit DECIMAL(6,1),
  est_carbs_per_unit DECIMAL(6,1),
  est_fat_per_unit DECIMAL(6,1),
  store VARCHAR(64),
  source VARCHAR(32) NOT NULL DEFAULT 'manual' CHECK (source IN ('receipt', 'manual')),
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'depleted', 'expired', 'discarded')),
  purchased_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Pantry: where each item's nutrition came from. 'off' = Open Food Facts hit,
-- 'web' = GPT-5.5 with web browsing, 'estimate' = pure LLM guess (low confidence),
-- 'manual' = user typed. NULL allowed for legacy rows.
ALTER TABLE pantry_items ADD COLUMN IF NOT EXISTS nutrition_source VARCHAR(16);
ALTER TABLE pantry_items ADD COLUMN IF NOT EXISTS nutrition_confidence VARCHAR(16);

-- Async logging + pantry-link columns on food_entries (idempotent additions)
ALTER TABLE food_entries ADD COLUMN IF NOT EXISTS consumed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE food_entries ADD COLUMN IF NOT EXISTS status VARCHAR(24) NOT NULL DEFAULT 'resolved'
  CHECK (status IN ('pending', 'needs_clarification', 'resolved', 'failed'));
ALTER TABLE food_entries ADD COLUMN IF NOT EXISTS clarifying_question TEXT;
ALTER TABLE food_entries ADD COLUMN IF NOT EXISTS clarifying_suggestions JSONB;
ALTER TABLE food_entries ADD COLUMN IF NOT EXISTS clarifying_answer TEXT;
ALTER TABLE food_entries ADD COLUMN IF NOT EXISTS ai_estimated_calories DECIMAL(7,1);
ALTER TABLE food_entries ADD COLUMN IF NOT EXISTS ai_estimated_protein DECIMAL(6,1);
ALTER TABLE food_entries ADD COLUMN IF NOT EXISTS ai_estimated_carbs DECIMAL(6,1);
ALTER TABLE food_entries ADD COLUMN IF NOT EXISTS ai_estimated_fat DECIMAL(6,1);
ALTER TABLE food_entries ADD COLUMN IF NOT EXISTS ai_response_id VARCHAR(128);
ALTER TABLE food_entries ADD COLUMN IF NOT EXISTS source VARCHAR(32) NOT NULL DEFAULT 'manual';
ALTER TABLE food_entries ADD COLUMN IF NOT EXISTS pantry_item_id UUID REFERENCES pantry_items(id) ON DELETE SET NULL;
ALTER TABLE food_entries ADD COLUMN IF NOT EXISTS input_description TEXT;
ALTER TABLE food_entries ADD COLUMN IF NOT EXISTS additional_context TEXT;

-- Allow nullable nutrition while a row is pending (resolved rows still must have values, enforced in app code).
ALTER TABLE food_entries ALTER COLUMN calories DROP NOT NULL;
ALTER TABLE food_entries ALTER COLUMN protein DROP NOT NULL;
ALTER TABLE food_entries ALTER COLUMN carbs DROP NOT NULL;
ALTER TABLE food_entries ALTER COLUMN fat DROP NOT NULL;

-- Backfill consumed_at from created_at for existing rows (one-time, safe to re-run).
UPDATE food_entries SET consumed_at = created_at WHERE consumed_at IS NULL;

-- Wearable / activity data (Terra-normalized daily summaries)
CREATE TABLE IF NOT EXISTS wearable_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(32) NOT NULL,
  terra_user_id VARCHAR(128),
  scopes TEXT,
  connected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, provider)
);

-- Personal ingest tokens for the iOS Shortcut. Each user can mint several
-- (e.g., one per device). The Shortcut puts this in a Bearer header when
-- POSTing daily Health summaries.
CREATE TABLE IF NOT EXISTS health_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(96) UNIQUE NOT NULL,
  label VARCHAR(64),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_used_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_health_tokens_token ON health_tokens(token);

-- Strava OAuth account. One per Strava connection (user_id by athlete_id).
-- Tokens refresh, so we store both the access token and the refresh token
-- plus expiry, allowing a request to transparently rotate.
CREATE TABLE IF NOT EXISTS strava_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  athlete_id BIGINT UNIQUE NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  scope TEXT,
  connected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_strava_accounts_athlete ON strava_accounts(athlete_id);

-- Per-activity records pulled from Strava. We keep raw payload too so future
-- features (heart rate, splits, GPS) can be derived without re-fetching.
CREATE TABLE IF NOT EXISTS strava_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  strava_activity_id BIGINT NOT NULL,
  activity_type VARCHAR(64) NOT NULL,
  name VARCHAR(255),
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  date DATE NOT NULL,
  moving_time_sec INTEGER,
  distance_m INTEGER,
  kcal INTEGER,
  raw JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, strava_activity_id)
);

CREATE INDEX IF NOT EXISTS idx_strava_activities_user_date ON strava_activities(user_id, date);

CREATE TABLE IF NOT EXISTS daily_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  active_kcal DECIMAL(7,1),
  bmr_kcal DECIMAL(7,1),
  total_kcal DECIMAL(7,1),
  steps INTEGER,
  resting_hr INTEGER,
  source VARCHAR(32),
  raw JSONB,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_food_entries_user_date ON food_entries(user_id, date);
CREATE INDEX IF NOT EXISTS idx_food_entries_user_consumed_at ON food_entries(user_id, consumed_at);
CREATE INDEX IF NOT EXISTS idx_food_entries_user_status ON food_entries(user_id, status) WHERE status IN ('pending', 'needs_clarification');
CREATE INDEX IF NOT EXISTS idx_food_entries_user_name ON food_entries(user_id, name);
CREATE INDEX IF NOT EXISTS idx_pantry_items_user_status ON pantry_items(user_id, status);
CREATE INDEX IF NOT EXISTS idx_water_logs_user_date ON water_logs(user_id, date);
CREATE INDEX IF NOT EXISTS idx_weight_logs_user_date ON weight_logs(user_id, date);
CREATE INDEX IF NOT EXISTS idx_profiles_user ON profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_accounts_user ON accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_activity_user_date ON daily_activity(user_id, date);
