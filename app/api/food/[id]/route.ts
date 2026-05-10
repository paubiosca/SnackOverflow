import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getFoodEntryById } from '@/lib/db';

// GET single food entry — used by the client poll loop to watch a pending row
// transition through `pending` → `needs_clarification` → `resolved`.

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const entry = await getFoodEntryById(session.user.id, params.id);
  if (!entry) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json({ entry });
}
