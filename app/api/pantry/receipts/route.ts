import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getReceiptHistory } from '@/lib/db';

// Returns past receipt imports grouped by (store, calendar-day) so the UI can
// render one card per shopping trip with all items underneath.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const groups = await getReceiptHistory(session.user.id, { limit: 200 });
  return NextResponse.json({ groups });
}
