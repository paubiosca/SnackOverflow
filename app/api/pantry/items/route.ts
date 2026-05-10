import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getActivePantryItems, bulkInsertPantryItems, BulkPantryInput } from '@/lib/db';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const items = await getActivePantryItems(session.user.id);
  return NextResponse.json({ items });
}

// Bulk-insert from the receipt-review screen. Each item already has the
// user-confirmed nutrition; we just commit.
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = await request.json().catch(() => ({}));
  const items = body?.items as BulkPantryInput[] | undefined;
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: 'items[] required' }, { status: 400 });
  }
  const inserted = await bulkInsertPantryItems(session.user.id, items);
  return NextResponse.json({ items: inserted });
}
