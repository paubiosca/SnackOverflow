import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getFoodEntries, addFoodEntry, updateFoodEntry, deleteFoodEntry } from '@/lib/db';

export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || undefined;

    const entries = await getFoodEntries(session.user.id, date);
    return NextResponse.json({ entries });
  } catch (error) {
    console.error('Error fetching food entries:', error);
    return NextResponse.json(
      { error: 'Failed to fetch food entries' },
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
    const entry = await addFoodEntry(session.user.id, data);
    return NextResponse.json({ entry });
  } catch (error) {
    console.error('Error adding food entry:', error);
    return NextResponse.json(
      { error: 'Failed to add food entry' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id, ...updates } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'Entry ID is required' }, { status: 400 });
    }

    const entry = await updateFoodEntry(session.user.id, id, updates);

    if (!entry) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
    }

    return NextResponse.json({ entry });
  } catch (error) {
    console.error('Error updating food entry:', error);
    return NextResponse.json(
      { error: 'Failed to update food entry' },
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
      return NextResponse.json({ error: 'Entry ID is required' }, { status: 400 });
    }

    const success = await deleteFoodEntry(session.user.id, id);

    if (!success) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting food entry:', error);
    return NextResponse.json(
      { error: 'Failed to delete food entry' },
      { status: 500 }
    );
  }
}
