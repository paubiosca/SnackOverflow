import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getFoodEntries, getFoodHistoryByMealType, getProfile, HistoryItem } from '@/lib/db';
import { AlternativeSuggestion, FoodAlternative, FoodEntry, MealType } from '@/lib/types';

const HEAVY_KCAL_THRESHOLD = 250;
const LEANER_RATIO = 0.8; // candidate must be <= 80% of original calories
const MAX_ORIGINALS = 3;
const MAX_ALTS_PER_ITEM = 3;

function getLocalDateString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function pickHistoryAlternatives(
  history: HistoryItem[],
  original: FoodEntry,
): FoodAlternative[] {
  const originalNameLower = original.name.toLowerCase();
  const cutoff = original.calories * LEANER_RATIO;

  const candidates = history.filter(
    (h) => h.avgCalories <= cutoff && h.name.toLowerCase() !== originalNameLower,
  );

  // Rank by frequency, break ties by recency.
  candidates.sort((a, b) => {
    if (b.occurrences !== a.occurrences) return b.occurrences - a.occurrences;
    const at = a.lastEatenAt ? Date.parse(a.lastEatenAt) : 0;
    const bt = b.lastEatenAt ? Date.parse(b.lastEatenAt) : 0;
    return bt - at;
  });

  return candidates.slice(0, MAX_ALTS_PER_ITEM).map((c) => {
    const cal = Math.round(c.avgCalories);
    return {
      name: c.name,
      calories: cal,
      savedKcal: Math.max(0, Math.round(original.calories - cal)),
      source: 'history' as const,
      occurrences: c.occurrences,
      lastEatenAt: c.lastEatenAt,
    };
  });
}

async function fetchAiAlternatives(
  apiKey: string,
  original: FoodEntry,
  excludeNames: string[],
  needed: number,
): Promise<FoodAlternative[]> {
  const exclude = excludeNames.length > 0 ? `\nDo not suggest: ${excludeNames.join(', ')}.` : '';
  const userPrompt = `The user ate "${original.name}" for ${original.mealType} (${original.calories} kcal). Suggest ${needed} leaner alternative dish(es) with at least 20% fewer calories that are similar in role and realistic to swap. Return concise common dish names.${exclude}`;

  const schema = {
    type: 'object',
    properties: {
      alternatives: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            calories: { type: 'integer' },
          },
          required: ['name', 'calories'],
          additionalProperties: false,
        },
      },
    },
    required: ['alternatives'],
    additionalProperties: false,
  } as const;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-5.2',
        temperature: 0.2,
        messages: [
          { role: 'system', content: 'You suggest leaner, realistic food swaps. Output JSON.' },
          { role: 'user', content: userPrompt },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: { name: 'leaner_alternatives', strict: true, schema },
        },
      }),
    });
    if (!response.ok) return [];
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return [];
    const parsed = JSON.parse(content) as { alternatives: { name: string; calories: number }[] };
    const cutoff = original.calories * LEANER_RATIO;
    return parsed.alternatives
      .filter((a) => a.calories > 0 && a.calories <= cutoff)
      .slice(0, needed)
      .map((a) => ({
        name: a.name,
        calories: a.calories,
        savedKcal: Math.max(0, Math.round(original.calories - a.calories)),
        source: 'ai' as const,
      }));
  } catch {
    return [];
  }
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

  const date = new URL(request.url).searchParams.get('date') ?? getLocalDateString();

  const [todayEntries, profile] = await Promise.all([
    getFoodEntries(userId, date),
    getProfile(userId),
  ]);

  const heavy = todayEntries
    .filter((e) => (e.status ?? 'resolved') === 'resolved' && e.calories > HEAVY_KCAL_THRESHOLD)
    .sort((a, b) => b.calories - a.calories)
    .slice(0, MAX_ORIGINALS);

  if (heavy.length === 0) {
    return NextResponse.json({ suggestions: [] });
  }

  // Cache history per mealType so we don't re-query when multiple originals share a meal.
  const historyCache = new Map<MealType, HistoryItem[]>();
  const getHistory = async (mt: MealType) => {
    if (!historyCache.has(mt)) {
      historyCache.set(mt, await getFoodHistoryByMealType(userId, mt, 60));
    }
    return historyCache.get(mt)!;
  };

  const suggestions: AlternativeSuggestion[] = [];

  for (const entry of heavy) {
    const history = await getHistory(entry.mealType);
    let alts = pickHistoryAlternatives(history, entry);

    if (alts.length < 2 && profile?.openaiApiKey) {
      const needed = MAX_ALTS_PER_ITEM - alts.length;
      const exclude = [entry.name, ...alts.map((a) => a.name)];
      const aiAlts = await fetchAiAlternatives(profile.openaiApiKey, entry, exclude, needed);
      alts = [...alts, ...aiAlts].slice(0, MAX_ALTS_PER_ITEM);
    }

    if (alts.length === 0) continue;

    suggestions.push({
      originalEntryId: entry.id,
      originalName: entry.name,
      originalCalories: entry.calories,
      alternatives: alts,
    });
  }

  return NextResponse.json({ suggestions });
}
