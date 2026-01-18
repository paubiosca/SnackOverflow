import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getWaterLogs, addWaterLog, deleteWaterLog } from '@/lib/db';

export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];

    const logs = await getWaterLogs(session.user.id, date);
    return NextResponse.json({ logs });
  } catch (error) {
    console.error('Error fetching water logs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch water logs' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const data = await request.json();
    const log = await addWaterLog(session.user.id, data);
    return NextResponse.json({ log });
  } catch (error) {
    console.error('Error adding water log:', error);
    return NextResponse.json(
      { error: 'Failed to add water log' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Log ID is required' }, { status: 400 });
    }

    const success = await deleteWaterLog(session.user.id, id);

    if (!success) {
      return NextResponse.json({ error: 'Log not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting water log:', error);
    return NextResponse.json(
      { error: 'Failed to delete water log' },
      { status: 500 }
    );
  }
}
