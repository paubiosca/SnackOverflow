import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getWeightLogs, addWeightLog } from '@/lib/db';

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const logs = await getWeightLogs(session.user.id);
    return NextResponse.json({ logs });
  } catch (error) {
    console.error('Error fetching weight logs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch weight logs' },
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
    const log = await addWeightLog(session.user.id, {
      date: data.date,
      weightKg: data.weightKg,
    });
    return NextResponse.json({ log });
  } catch (error) {
    console.error('Error adding weight log:', error);
    return NextResponse.json(
      { error: 'Failed to add weight log' },
      { status: 500 }
    );
  }
}
