import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getUserCredits, deductCredits, addCredits, findUserByEmail } from '@/lib/server/user-store';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({
        authenticated: false,
        credits: 100,
        tier: 'free',
        status: 'active',
      });
    }

    const dbUser = await findUserByEmail(session.user.email);
    if (!dbUser) {
      return NextResponse.json({
        authenticated: true,
        credits: 100,
        tier: 'free',
        status: 'active',
      });
    }

    const info = await getUserCredits(dbUser.id);
    return NextResponse.json({
      authenticated: true,
      credits: info?.credits ?? 100,
      tier: info?.tier ?? 'free',
      status: info?.status ?? 'active',
    });
  } catch (error) {
    console.error('Error fetching credits:', error);
    return NextResponse.json({ error: 'Failed to fetch credits' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const dbUser = await findUserByEmail(session.user.email);
    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await req.json();
    const { action, amount = 10, reason = 'Classroom Generation' } = body;

    if (action === 'deduct') {
      const result = await deductCredits(dbUser.id, Number(amount), reason);
      if (!result.success) {
        return NextResponse.json(
          {
            error: 'Insufficient credits',
            remaining: result.remaining,
            insufficient: true,
          },
          { status: 402 }
        );
      }
      return NextResponse.json({ success: true, remaining: result.remaining });
    }

    if (action === 'add') {
      const result = await addCredits(dbUser.id, Number(amount), reason);
      return NextResponse.json({ success: true, newCredits: result.newCredits });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error modifying credits:', error);
    return NextResponse.json({ error: 'Failed to process credits' }, { status: 500 });
  }
}
