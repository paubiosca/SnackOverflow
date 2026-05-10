import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import {
  getDailyCalorieSummaries,
  getDailyActivityInRange,
  getWeightLogsInRange,
} from '@/lib/db';

// Calibration insight: did the user actually lose what their cumulative deficit
// predicted? If not, their BMR estimate (or food logging accuracy) is off.
//
// Math:
//   cumulativeConsumed = sum(food_entries.calories) over window
//   cumulativeBurned   = sum(daily_activity.total_kcal) over window
//   expectedKgLost     = (cumulativeBurned - cumulativeConsumed) / 7700
//   actualKgLost       = startWeight - endWeight
//   delta              = actualKgLost - expectedKgLost   // negative = lost less than predicted
//
// We only return a recommendation if there's enough data: at least 14 days
// covered and weight logs at both ends of the window.

const CAL_PER_KG = 7700;

function todayLocalISO(): string { return new Date().toISOString().slice(0, 10); }
function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

  const days = Number(new URL(request.url).searchParams.get('days') ?? '30');
  const end = todayLocalISO();
  const start = daysAgo(days);

  const [foodSummaries, activity, weights] = await Promise.all([
    getDailyCalorieSummaries(userId, start, end),
    getDailyActivityInRange(userId, start, end),
    getWeightLogsInRange(userId, start, end),
  ]);

  const cumulativeConsumed = foodSummaries.reduce((s, d) => s + d.totalCalories, 0);
  const cumulativeBurned = activity.reduce((s, d) => s + (d.totalKcal ?? 0), 0);
  const daysWithFood = foodSummaries.length;
  const daysWithActivity = activity.filter((a) => a.totalKcal != null).length;

  const startWeight = weights[0]?.weightKg ?? null;
  const endWeight = weights[weights.length - 1]?.weightKg ?? null;
  const actualKgLost = startWeight != null && endWeight != null ? startWeight - endWeight : null;
  const expectedKgLost = cumulativeBurned > 0 && cumulativeConsumed > 0
    ? (cumulativeBurned - cumulativeConsumed) / CAL_PER_KG
    : null;
  const delta = actualKgLost != null && expectedKgLost != null ? actualKgLost - expectedKgLost : null;

  // Build a recommendation when we have enough signal.
  // Tolerance: 0.3 kg over the window is roughly noise (water, glycogen, scale variance).
  let status: 'insufficient_data' | 'on_track' | 'losing_less_than_expected' | 'losing_more_than_expected' = 'insufficient_data';
  let dailyAdjustmentKcal: number | null = null;
  let message = 'Need more data — keep logging food and Apple Health for ~2 weeks.';

  if (daysWithFood >= 14 && daysWithActivity >= 14 && delta != null && expectedKgLost != null) {
    if (Math.abs(delta) <= 0.3) {
      status = 'on_track';
      message = `Your daily goal is calibrated. Predicted ${expectedKgLost.toFixed(1)} kg, actual ${actualKgLost!.toFixed(1)} kg.`;
    } else if (delta < 0) {
      // Lost less than predicted → BMR overestimated OR underlogging food.
      status = 'losing_less_than_expected';
      // Convert the kg gap back to a daily kcal adjustment over the window.
      dailyAdjustmentKcal = Math.round((Math.abs(delta) * CAL_PER_KG) / days);
      message = `You lost ${actualKgLost!.toFixed(1)} kg but predicted ${expectedKgLost.toFixed(1)} kg. Try eating ~${dailyAdjustmentKcal} kcal less per day, or recheck logging accuracy.`;
    } else {
      // Lost more than predicted → BMR underestimated, you have headroom.
      status = 'losing_more_than_expected';
      dailyAdjustmentKcal = Math.round((delta * CAL_PER_KG) / days);
      message = `You lost ${actualKgLost!.toFixed(1)} kg vs predicted ${expectedKgLost.toFixed(1)} kg. You have ~${dailyAdjustmentKcal} kcal more headroom per day if you want it.`;
    }
  }

  return NextResponse.json({
    window: { start, end, days },
    daysWithFood,
    daysWithActivity,
    cumulativeConsumed: Math.round(cumulativeConsumed),
    cumulativeBurned: Math.round(cumulativeBurned),
    startWeight, endWeight,
    actualKgLost: actualKgLost != null ? Math.round(actualKgLost * 10) / 10 : null,
    expectedKgLost: expectedKgLost != null ? Math.round(expectedKgLost * 10) / 10 : null,
    delta: delta != null ? Math.round(delta * 10) / 10 : null,
    status,
    dailyAdjustmentKcal,
    message,
  });
}
