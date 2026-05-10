import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import {
  getProfile,
  getStravaKcalForDate,
  getDailyActivity,
} from '@/lib/db';
import { calculateBMR, calculateTDEE, calculateDeficit } from '@/lib/calories';

// Smart daily calorie target. Combines:
//   - calibrated baseline TDEE (from Apple Health export, set once on profile),
//     OR a formula fallback if no baseline is set
//   - today's Strava kcal (auto-syncing — adds running calories on top)
//   - the user's deficit goal (kcal/day from goal_type+goal_value)
//
// Returns the recommended target intake plus a breakdown so the UI can show
// the math ("baseline 2,400 + run 600 - deficit 550 = 2,450 kcal").

export async function GET(_request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;
  const profile = await getProfile(userId);
  if (!profile) {
    return NextResponse.json({ error: 'No profile' }, { status: 404 });
  }

  const today = new Date().toISOString().slice(0, 10);

  // Pull today's Strava run kcal AND Apple Health daily row (if any). If both
  // exist for today we trust Apple Health's totalKcal as the baseline-equivalent
  // (since it includes basal + walking) and add Strava on top — this is the
  // "best" case where we have real-time daily data. Otherwise we fall back to
  // the calibrated baseline.
  const [stravaKcal, todayActivity] = await Promise.all([
    getStravaKcalForDate(userId, today),
    getDailyActivity(userId, today),
  ]);

  // Determine the non-running part of today's TDEE.
  let baseline: number;
  let baselineSource: 'apple_health_today' | 'calibrated' | 'formula';

  if (todayActivity?.totalKcal != null) {
    baseline = Math.round(todayActivity.totalKcal);
    baselineSource = 'apple_health_today';
  } else if (profile.tdeeBaselineKcal && profile.tdeeBaselineKcal > 0) {
    baseline = profile.tdeeBaselineKcal;
    baselineSource = 'calibrated';
  } else {
    // Formula fallback: Mifflin-St Jeor at the user's chosen activity level.
    baseline = calculateTDEE(profile.weightKg, profile.heightCm, profile.age, profile.gender, profile.activityLevel);
    baselineSource = 'formula';
  }

  // Deficit (negative kcal/day for cuts, positive for surpluses).
  const deficit = calculateDeficit(profile.goalType, profile.goalValue ?? 0);

  const tdeeToday = baseline + stravaKcal;
  const target = Math.max(1200, Math.round(tdeeToday + deficit));

  // For weight_loss_rate goals, deficit is negative — the math (TDEE + deficit)
  // gives a smaller target. For deficit_fixed, same.
  const weeklyKgLoss = Math.abs(deficit) * 7 / 7700;

  return NextResponse.json({
    target,
    deficit,
    weeklyKgLoss: Math.round(weeklyKgLoss * 100) / 100,
    baseline,
    baselineSource,
    stravaKcal,
    tdeeToday,
    bmrFormula: Math.round(calculateBMR(profile.weightKg, profile.heightCm, profile.age, profile.gender)),
    profile: {
      goalType: profile.goalType,
      goalValue: profile.goalValue,
      tdeeBaselineKcal: profile.tdeeBaselineKcal ?? null,
    },
  });
}
