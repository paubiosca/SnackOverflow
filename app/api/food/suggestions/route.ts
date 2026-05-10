import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getFoodSuggestions, getActivePantryItems } from '@/lib/db';
import { FoodSuggestion } from '@/lib/types';

// Quick-log rail data source. Returns ranked suggestions from:
//   - recent / time-of-day-yesterday / frequent (food_entries history)
//   - pantry (purchased but unconsumed items)

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;
  const limit = Number(new URL(request.url).searchParams.get('limit') ?? '12');

  const [history, pantry] = await Promise.all([
    getFoodSuggestions(userId, { limit }),
    getActivePantryItems(userId),
  ]);

  // Pantry items at the front of the list — the user explicitly bought them and
  // is likely to eat them; freshness beats history for these.
  const pantrySuggestions: FoodSuggestion[] = pantry.slice(0, 6).map((p) => ({
    source: 'pantry',
    name: p.normalizedName,
    mealType: 'snack',
    calories: p.estCaloriesPerUnit ?? 0,
    protein: p.estProteinPerUnit ?? 0,
    carbs: p.estCarbsPerUnit ?? 0,
    fat: p.estFatPerUnit ?? 0,
    pantryItemId: p.id,
    qtyRemaining: p.qtyRemaining,
  }));

  return NextResponse.json({ suggestions: [...pantrySuggestions, ...history] });
}
