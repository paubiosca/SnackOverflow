import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { auth } from '@/lib/auth';
import {
  listHealthTokens,
  createHealthToken,
  deleteHealthToken,
} from '@/lib/db';

// Manage Apple Health Shortcut tokens. The actual token value is only returned
// in the POST response (so the user can copy it once); subsequent GETs return
// it too because this is single-user personal use — if you ever multi-tenant
// this seriously, return only a masked prefix from GET.

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const tokens = await listHealthTokens(session.user.id);
  return NextResponse.json({ tokens });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = await request.json().catch(() => ({}));
  const label: string | undefined = typeof body?.label === 'string' ? body.label.slice(0, 64) : undefined;

  // 32 random bytes = 64 hex chars; prefix `sf_` for grep-ability.
  const token = `sf_${randomBytes(32).toString('hex')}`;
  const created = await createHealthToken(session.user.id, token, label);
  return NextResponse.json({ token: created });
}

export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const id = new URL(request.url).searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'id required' }, { status: 400 });
  }
  const ok = await deleteHealthToken(session.user.id, id);
  return NextResponse.json({ ok });
}
