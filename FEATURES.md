# Feature Roadmap: Personalized AI Nutrition Assistant

## Overview
Transform SnackOverflow from a one-shot food analyzer into a personalized AI nutrition assistant that learns from your eating habits over time.

---

## Phase 1: Meal History Context

### Description
Include recent meal history in OpenAI prompts so the AI can recognize patterns and provide smarter estimates.

### Implementation
- [ ] Create `getMealContext(userId, days = 14)` function to fetch recent food entries
- [ ] Summarize frequently eaten foods with typical portions
- [ ] Add context to OpenAI prompt: "User typically eats X, Y, Z..."
- [ ] Store food frequency counts for quick lookup

### Database Changes
```sql
-- Optional: materialized view or caching table for frequent foods
CREATE TABLE IF NOT EXISTS user_food_stats (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  food_name VARCHAR(255),
  avg_calories DECIMAL(7,1),
  avg_portion_description VARCHAR(255),
  occurrence_count INTEGER,
  last_eaten DATE,
  PRIMARY KEY (user_id, food_name)
);
```

---

## Phase 2: Portion Learning

### Description
Track user's typical portion sizes for specific foods to improve future estimates.

### Implementation
- [ ] When user edits portion, store both AI estimate and user correction
- [ ] Build per-user portion preferences over time
- [ ] Include in prompt: "User's typical pasta portion is ~250g, not restaurant-size"

### Database Changes
```sql
CREATE TABLE IF NOT EXISTS portion_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  food_category VARCHAR(100), -- e.g., "pasta", "rice", "salad"
  avg_portion_grams DECIMAL(6,1),
  avg_calories DECIMAL(7,1),
  sample_count INTEGER DEFAULT 1,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## Phase 3: Correction Tracking

### Description
When users edit AI estimates, log the difference to improve future prompts.

### Implementation
- [ ] Add `ai_estimated_calories` field to food_entries
- [ ] Calculate correction ratio: `user_value / ai_value`
- [ ] Track per-food-category correction patterns
- [ ] Include in prompt: "User typically adjusts pasta calories down by 20%"

### Database Changes
```sql
ALTER TABLE food_entries ADD COLUMN ai_estimated_calories DECIMAL(7,1);
ALTER TABLE food_entries ADD COLUMN ai_estimated_protein DECIMAL(6,1);
ALTER TABLE food_entries ADD COLUMN ai_estimated_carbs DECIMAL(6,1);
ALTER TABLE food_entries ADD COLUMN ai_estimated_fat DECIMAL(6,1);

CREATE TABLE IF NOT EXISTS correction_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  food_category VARCHAR(100),
  avg_calorie_adjustment DECIMAL(5,2), -- e.g., 0.8 means user reduces by 20%
  sample_count INTEGER DEFAULT 1,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## Phase 4: Ask Mode (Exploration Without Logging)

### Description
Allow users to ask "how many calories in X?" without creating an entry. Perfect for meal planning or curiosity.

### Implementation
- [ ] New `/ask` route with text input (no photo required)
- [ ] Lighter OpenAI call (text-only, faster response)
- [ ] Display nutrition info with optional "Add to log" button
- [ ] Support follow-up questions: "What if I add cheese?"
- [ ] Conversational history within session

### UI Components
```
┌─────────────────────────────────────────────┐
│  Ask Mode                              [X]  │
├─────────────────────────────────────────────┤
│  "How many calories in a croissant?"        │
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │ Croissant (medium, ~60g)            │    │
│  │ 🔥 231 cal                          │    │
│  │ Protein: 5g | Carbs: 26g | Fat: 12g │    │
│  │                                     │    │
│  │ [Add to breakfast] [Add to snack]   │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  💬 "What about an almond croissant?"       │
│                                             │
│  [Type your question...]           [Ask]    │
└─────────────────────────────────────────────┘
```

### API Endpoint
- `POST /api/ask` - Text-based nutrition query
- Request: `{ question: string, conversationHistory?: Message[] }`
- Response: `{ answer: string, nutrition?: NutritionInfo, canLog: boolean }`

---

## Phase 5: Smart Suggestions

### Description
Proactively suggest foods based on user's patterns and remaining daily budget.

### Implementation
- [ ] "You usually have coffee around now - 15 cal with oat milk?"
- [ ] "You have 400 cal left today. Your usual dinner options..."
- [ ] Quick-add buttons for frequent meals
- [ ] Time-of-day aware suggestions

---

## Technical Notes

### Prompt Engineering Strategy
Build dynamic prompts that include:
1. User's daily calorie goal and remaining budget
2. Recent meals (last 7-14 days summarized)
3. Frequently eaten foods with typical portions
4. Historical correction patterns
5. Time of day context

### Example Enhanced Prompt
```
Analyze this food image for a user with the following context:

CALORIE GOAL: 2000 kcal/day, 850 remaining today
RECENT PATTERNS:
- Typically eats oatmeal (250 cal) for breakfast
- Usual coffee is oat milk latte, no sugar (~80 cal)
- Pasta portions are usually 200g cooked (~280 cal)

CORRECTION HISTORY:
- User reduces AI pasta estimates by ~15%
- User increases salad estimates by ~10% (likely dressing)

Based on this context, provide your best estimate...
```

### Privacy Considerations
- All meal history processing happens server-side
- Users can opt out of personalization
- Clear data retention policies
- Export/delete personal data options

---

## Priority Order
1. **Ask Mode** - Quick win, high user value
2. **Correction Tracking** - Foundation for learning
3. **Meal History Context** - Smarter baseline estimates
4. **Portion Learning** - Personalized accuracy
5. **Smart Suggestions** - Delight features
