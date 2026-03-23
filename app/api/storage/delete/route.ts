import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { deleteFromGCS } from '@/lib/server/gcs-util';
import { createLogger } from '@/lib/logger';

const log = createLogger('GCS-Delete-API');

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { path, userId } = await req.json();

    if (!path || !userId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Security check: ensure userId matches session or is authorized
    if (userId !== session.user.id) {
       return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await deleteFromGCS(path);

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error('Delete error:', error);
    return NextResponse.json({ error: 'Delete failed', details: String(error) }, { status: 500 });
  }
}
