import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import {
  getWeightLogsInRange,
  getDailyCalorieSummaries,
  getDatesWithEntries,
  getProfile,
} from '@/lib/db';
import {
  calculateDailyCalorieGoal,
  calculateStreaks,
  calculateMovingAverage,
  calculateDayOfWeekAnalysis,
  getAdherenceStatus,
} from '@/lib/calories';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const period = parseInt(searchParams.get('period') || '30', 10);

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - period);

    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    // Fetch profile for calorie goal
    const profile = await getProfile(session.user.id);
    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const calorieGoal = calculateDailyCalorieGoal(profile);

    // Fetch all data in parallel
    const [weightLogs, dailySummaries, datesWithEntries] = await Promise.all([
      getWeightLogsInRange(session.user.id, startDateStr, endDateStr),
      getDailyCalorieSummaries(session.user.id, startDateStr, endDateStr),
      getDatesWithEntries(session.user.id, startDateStr, endDateStr),
    ]);

    // Calculate weight trends
    const ma7 = calculateMovingAverage(weightLogs, 7);
    const ma30 = calculateMovingAverage(weightLogs, 30);

    let totalChange = 0;
    let periodChange = 0;

    if (weightLogs.length >= 2) {
      const firstWeight = weightLogs[0].weightKg;
      const lastWeight = weightLogs[weightLogs.length - 1].weightKg;
      periodChange = Math.round((lastWeight - firstWeight) * 10) / 10;
    }

    if (weightLogs.length > 0) {
      totalChange = Math.round((weightLogs[weightLogs.length - 1].weightKg - profile.weightKg) * 10) / 10;
    }

    // Calculate calorie adherence
    const adherenceStats = {
      daysOnTarget: 0,
      daysUnder: 0,
      daysOver: 0,
      avgDeficit: 0,
    };

    let totalDeficit = 0;
    const calorieDataWithStatus = dailySummaries.map(summary => {
      const status = getAdherenceStatus(summary.totalCalories, calorieGoal);
      const deficit = calorieGoal - summary.totalCalories;
      totalDeficit += deficit;

      if (status === 'on_target') adherenceStats.daysOnTarget++;
      else if (status === 'under') adherenceStats.daysUnder++;
      else adherenceStats.daysOver++;

      return {
        date: summary.date,
        calories: summary.totalCalories,
        goal: calorieGoal,
        status,
      };
    });

    if (dailySummaries.length > 0) {
      adherenceStats.avgDeficit = Math.round(totalDeficit / dailySummaries.length);
    }

    // Calculate streaks (use a longer period for accurate streak calculation)
    const streakStartDate = new Date();
    streakStartDate.setDate(streakStartDate.getDate() - 365);
    const streakStartDateStr = streakStartDate.toISOString().split('T')[0];

    const [allDatesWithEntries, allDailySummaries] = await Promise.all([
      getDatesWithEntries(session.user.id, streakStartDateStr, endDateStr),
      getDailyCalorieSummaries(session.user.id, streakStartDateStr, endDateStr),
    ]);

    const streaks = calculateStreaks(allDatesWithEntries, allDailySummaries, calorieGoal);

    // Calculate day of week analysis
    const dayOfWeekAnalysis = calculateDayOfWeekAnalysis(dailySummaries, calorieGoal);

    return NextResponse.json({
      weightData: {
        logs: weightLogs,
        trends: {
          ma7,
          ma30,
          totalChange,
          periodChange,
        },
      },
      calorieData: {
        dailySummaries: calorieDataWithStatus,
        adherenceStats,
        goal: calorieGoal,
      },
      streaks,
      dayOfWeekAnalysis,
      period,
    });
  } catch (error) {
    console.error('Error fetching insights:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error('Insights error details:', { message: errorMessage, stack: errorStack });
    return NextResponse.json(
      { error: 'Failed to fetch insights', details: errorMessage },
      { status: 500 }
    );
  }
}
