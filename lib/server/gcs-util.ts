import { Storage } from '@google-cloud/storage';
import { createLogger } from '@/lib/logger';
import path from 'path';

const log = createLogger('GCS-Util');

// Initialize GCS client
let keyFilename: string | undefined = undefined;
if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  let credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  // If it starts with a slash but isn't actually an absolute Unix path to the user's home or system,
  // or it's a common pattern to put a leading slash for a file in the project root:
  if (credentialsPath.startsWith('/') && !credentialsPath.startsWith('/Users/') && !credentialsPath.startsWith('/tmp/')) {
    credentialsPath = credentialsPath.substring(1); // remove leading slash
  }
  
  keyFilename = path.resolve(process.cwd(), credentialsPath);
}

const storage = new Storage({
  keyFilename,
});

const bucketName = process.env.GCS_BUCKET_NAME;

if (!bucketName) {
  log.error('GCS_BUCKET_NAME or NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET not found in environment variables');
}

const bucket = bucketName ? storage.bucket(bucketName) : null;

/**
 * Upload a buffer or stream to GCS
 */
export async function uploadToGCS(
  destPath: string,
  content: Buffer | Uint8Array,
  contentType: string,
  metadata: Record<string, string> = {}
): Promise<string> {
  if (!bucket) {
    throw new Error('GCS bucket not initialized');
  }

  const file = bucket.file(destPath);
  
  await file.save(content, {
    contentType,
    metadata: {
      metadata: {
        ...metadata,
      },
    },
    resumable: false,
  });

  // Make public or return a signed URL? 
  // For simplicity and matching Firebase Storage behaviour, we return the public URL 
  // if the bucket is configured for public access, or a simple storage URL.
  // Standard GCS public URL format: https://storage.googleapis.com/[BUCKET]/[FILE]
  return `https://storage.googleapis.com/${bucketName}/${destPath}`;
}

/**
 * Delete a file from GCS
 */
export async function deleteFromGCS(destPath: string): Promise<void> {
  if (!bucket) {
    throw new Error('GCS bucket not initialized');
  }

  const file = bucket.file(destPath);
  try {
    await file.delete();
    log.info(`Deleted from GCS: ${destPath}`);
  } catch (error) {
    log.error(`Failed to delete from GCS: ${destPath}`, error);
    // Silent fail for deletion if file doesn't exist
  }
}

/**
 * Check if GCS is properly configured
 */
export function isGCSConfigured(): boolean {
  return !!bucket;
}
