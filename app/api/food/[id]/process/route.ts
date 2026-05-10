import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import {
  getFoodEntryById,
  getProfile,
  resolveFoodEntry,
  markFoodEntryNeedsClarification,
  failFoodEntry,
} from '@/lib/db';
import { analyzeFood } from '@/lib/ai/foodAnalysis';

// Background worker: runs the OpenAI analysis for a pending food entry and writes
// the result back. Triggered by the client immediately after creating the entry
// so the client can return to the UI while this finishes.
//
// This route may run for tens of seconds. Vercel serverless function timeout
// limits apply (default 10s on hobby, 60s on Pro). If you hit timeouts, raise
// the route's maxDuration via `export const maxDuration = 60`.

export const maxDuration = 60;

export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;
  const { id } = params;

  const entry = await getFoodEntryById(userId, id);
  if (!entry) {
    return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
  }
  if (entry.status !== 'pending') {
    // Idempotent: a duplicate trigger after resolution is a no-op.
    return NextResponse.json({ entry });
  }

  const profile = await getProfile(userId);
  const apiKey = profile?.openaiApiKey;
  if (!apiKey) {
    await failFoodEntry(userId, id, 'missing_api_key');
    return NextResponse.json({ error: 'OpenAI API key not set in profile' }, { status: 400 });
  }

  try {
    const result = await analyzeFood({
      apiKey,
      description: entry.inputDescription,
      photoDataUrl: entry.photoUrl,
      photoDataUrls: entry.photoUrls,
      additionalContext: entry.additionalContext,
      priorAnswer: entry.clarifyingAnswer,
    });

    const totals = result.totalNutrition;
    const firstQuestion = result.clarifyingQuestions[0];
    const breakdown = {
      dishName: result.dishName,
      rationale: result.rationale,
      components: result.components,
      totals,
      confidence: result.overallConfidence,
    };

    if (firstQuestion && result.overallConfidence < 85) {
      // Show the preliminary estimate while asking the question — user sees a "best guess"
      // calorie count immediately, with an amber dot inviting them to refine.
      const updated = await markFoodEntryNeedsClarification(userId, id, {
        question: firstQuestion.question,
        suggestions: firstQuestion.options,
        preliminary: {
          calories: totals.calories,
          protein: totals.protein,
          carbs: totals.carbs,
          fat: totals.fat,
          confidence: result.overallConfidence,
        },
        analysis: breakdown,
      });
      return NextResponse.json({ entry: updated });
    }

    const updated = await resolveFoodEntry(userId, id, {
      name: result.dishName,
      calories: totals.calories,
      protein: totals.protein,
      carbs: totals.carbs,
      fat: totals.fat,
      aiConfidence: result.overallConfidence,
      aiEstimated: totals,
      analysis: breakdown,
    });
    return NextResponse.json({ entry: updated });
  } catch (err) {
    console.error('[food/process] worker error:', err);
    await failFoodEntry(userId, id, err instanceof Error ? err.message : 'unknown');
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Worker failed' },
      { status: 500 }
    );
  }
}
