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
  const { description, photoDataUrl, photoDataUrls, mealType, date, additionalContext, consumedAt } = body as {
    description?: string;
    photoDataUrl?: string;
    photoDataUrls?: string[];
    mealType?: MealType;
    date?: string;
    additionalContext?: string;
    consumedAt?: string;
  };

  if (!mealType || !date) {
    return NextResponse.json({ error: 'mealType and date are required' }, { status: 400 });
  }

  // Normalize photos: accept either single legacy field or array. First one
  // becomes the cover (`photo_url`); the rest go into `photo_urls`.
  const photos = [
    ...(photoDataUrl ? [photoDataUrl] : []),
    ...(Array.isArray(photoDataUrls) ? photoDataUrls.filter((u) => typeof u === 'string' && u) : []),
  ];
  // De-dupe in case caller sent both photoDataUrl and photoDataUrls[0].
  const uniquePhotos = Array.from(new Set(photos));
  const coverPhoto = uniquePhotos[0];
  const extraPhotos = uniquePhotos.slice(1);

  if (!description?.trim() && uniquePhotos.length === 0) {
    return NextResponse.json({ error: 'description or photo required' }, { status: 400 });
  }

  // Use the typed input as the placeholder name. The worker will overwrite it
  // with the parsed dish name on resolve.
  const placeholderName = description?.trim() || (uniquePhotos.length > 1 ? `Photos (${uniquePhotos.length})` : 'Photo');

  const entry = await addFoodEntry(session.user.id, {
    name: placeholderName,
    mealType,
    date,
    consumedAt,
    status: 'pending',
    source: coverPhoto ? 'analyze-photo' : 'analyze-text',
    isManualEntry: false,
    inputDescription: description?.trim(),
    additionalContext: additionalContext?.trim(),
    photoUrl: coverPhoto,
    photoUrls: extraPhotos.length > 0 ? extraPhotos : undefined,
  });

  return NextResponse.json({ entry });
}
