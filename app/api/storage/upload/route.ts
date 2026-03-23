import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { uploadToGCS } from '@/lib/server/gcs-util';
import { createLogger } from '@/lib/logger';

const log = createLogger('GCS-Upload-API');

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const path = formData.get('path') as string;
    const userId = formData.get('userId') as string;

    if (!file || !path || !userId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Security check: ensure userId matches session or is authorized
    if (userId !== session.user.id) {
       return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const publicUrl = await uploadToGCS(path, buffer, file.type, { userId });

    return NextResponse.json({ success: true, url: publicUrl });
  } catch (error) {
    log.error('Upload error:', error);
    return NextResponse.json({ error: 'Upload failed', details: String(error) }, { status: 500 });
  }
}
