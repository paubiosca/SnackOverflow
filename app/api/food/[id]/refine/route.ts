import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { sql } from '@vercel/postgres';
import { getFoodEntryById } from '@/lib/db';

// Refine an existing food entry without re-uploading the photo.
// Body: { additionalContext: string }
// Effect: appends the note to additional_context, flips status back to
// 'pending', and the client is expected to fire POST /api/food/[id]/process
// next so the worker re-analyzes (vision + text + the new note).
//
// Why append rather than replace: lets users layer hints over time —
// "actually only ate half" + "no dressing" + "two slices not three".

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;
  const { id } = params;
  const body = await request.json().catch(() => ({}));
  const note = (body?.additionalContext as string | undefined)?.trim();
  if (!note) {
    return NextResponse.json({ error: 'additionalContext is required' }, { status: 400 });
  }

  const entry = await getFoodEntryById(userId, id);
  if (!entry) {
    return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
  }

  const merged = entry.additionalContext ? `${entry.additionalContext}\n${note}` : note;
  await sql`
    UPDATE food_entries
    SET additional_context = ${merged},
        status = 'pending',
        updated_at = NOW()
    WHERE id = ${id} AND user_id = ${userId}
  `;
  const updated = await getFoodEntryById(userId, id);
  return NextResponse.json({ entry: updated });
}
