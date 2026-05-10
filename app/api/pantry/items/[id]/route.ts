import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { deletePantryItem } from '@/lib/db';

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = params;
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const ok = await deletePantryItem(session.user.id, id);
  if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
