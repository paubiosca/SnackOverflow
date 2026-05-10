import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { addFoodEntry } from '@/lib/db';
import { MealType } from '@/lib/types';

// Async log endpoint: creates a `pending` food entry and returns immediately.
// Caller is expected to fire-and-forget POST /api/food/[id]/process to kick
// the worker, then poll GET /api/food/[id] until status leaves 'pending'.
//
// Body: {
//   description?: string,           // text path
//   photoDataUrl?: string,          // image path (base64 data URL)
//   mealType: MealType,
//   date: string,                   // YYYY-MM-DD
//   additionalContext?: string,     // user's free-text comment to refine the analysis
//   consumedAt?: string,            // ISO timestamp; defaults to now
// }

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { description, photoDataUrl, mealType, date, additionalContext, consumedAt } = body as {
    description?: string;
    photoDataUrl?: string;
    mealType?: MealType;
    date?: string;
    additionalContext?: string;
    consumedAt?: string;
  };

  if (!mealType || !date) {
    return NextResponse.json({ error: 'mealType and date are required' }, { status: 400 });
  }
  if (!description?.trim() && !photoDataUrl) {
    return NextResponse.json({ error: 'description or photoDataUrl required' }, { status: 400 });
  }

  // Use the typed input as the placeholder name. The worker will overwrite it
  // with the parsed dish name on resolve.
  const placeholderName = description?.trim() || 'Photo';

  const entry = await addFoodEntry(session.user.id, {
    name: placeholderName,
    mealType,
    date,
    consumedAt,
    status: 'pending',
    source: photoDataUrl ? 'analyze-photo' : 'analyze-text',
    isManualEntry: false,
    inputDescription: description?.trim(),
    additionalContext: additionalContext?.trim(),
    photoUrl: photoDataUrl,
  });

  return NextResponse.json({ entry });
}
