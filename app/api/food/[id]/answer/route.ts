import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { setFoodEntryAnswer } from '@/lib/db';

// User submitted an answer (or free-text comment) to a clarifying question.
// We move the row back to `pending` and let the client kick the worker again —
// mirrors the original create flow. If the user sends an empty answer, treat it
// as a no-op so accidental taps don't lose the existing estimate.

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { answer } = await request.json();
  if (typeof answer !== 'string' || !answer.trim()) {
    return NextResponse.json({ error: 'answer is required' }, { status: 400 });
  }
  const entry = await setFoodEntryAnswer(session.user.id, params.id, answer.trim());
  if (!entry) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json({ entry });
}
