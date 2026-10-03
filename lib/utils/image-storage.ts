/**
 * Image Storage Utilities - Use Cloud Storage
 *
 * Store PDF images in IndexedDB and Cloud Storage.
 */

import { 
  uploadToCloudStorage, 
  deleteFromCloudStorage 
} from './cloud-storage';
import { db, type ImageFileRecord } from '@/lib/device-storage/database';import { nanoid } from 'nanoid';
import { createLogger } from '@/lib/logger';

const log = createLogger('ImageStorage');
const SESSION_ID_LENGTH = 10;

/**
 * Decode a base64 data URL into its binary payload and MIME type.
 */
function decodeBase64DataUrl(base64DataUrl: string): {
  buffer: ArrayBuffer;
  mimeType: string;
} {
  const parts = base64DataUrl.split(',');
  const mimeMatch = parts[0].match(/:(.*?);/);
  const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
  const base64Data = parts[1];
  const byteString = atob(base64Data);
  const arrayBuffer = new ArrayBuffer(byteString.length);
  const uint8Array = new Uint8Array(arrayBuffer);

  for (let i = 0; i < byteString.length; i++) {
    uint8Array[i] = byteString.charCodeAt(i);
  }

  return { buffer: arrayBuffer, mimeType };
}

/**
 * Convert a stored binary value to the Blob expected by callers.
 */
function storedBinaryToBlob(value: Blob | ArrayBuffer, mimeType: string): Blob {
  if (value instanceof ArrayBuffer) {
    return new Blob([value], { type: mimeType });
  }

  return value.type ? value : new Blob([value], { type: mimeType });
}

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Store images in Cloud Storage
 * Returns array of stored image download URLs
 */
export async function storeImages(
  images: Array<{ id: string; src: string; pageNumber?: number }>,
  userId?: string
): Promise<string[]> {
  const sessionId = nanoid(SESSION_ID_LENGTH);
  const storedIds: string[] = [];
  let currentImageId: string | undefined;

  try {
    for (const img of images) {
      currentImageId = img.id;
      const { buffer, mimeType } = decodeBase64DataUrl(img.src);

      // Use session-prefixed ID to allow cleanup
      const storageId = `session_${sessionId}_${img.id}`;

      const record: ImageFileRecord = {
        id: storageId,
        blob: buffer,
        filename: `${img.id}.png`,
        mimeType,
        size: buffer.byteLength,
        createdAt: Date.now(),
      };

      await db.imageFiles.put(record);
      storedIds.push(storageId);

      if (userId) {
        try {
          const blob = new Blob([buffer], { type: mimeType });
          const storagePath = `sessions/${sessionId}/${img.id}.png`;
          await uploadToCloudStorage(storagePath, blob, userId);
        } catch (e) {
          log.warn(`Could not upload image ${img.id} to cloud:`, e);
        }
      }
    }
  } catch (error) {
    await Promise.allSettled(storedIds.map((id) => db.imageFiles.delete(id)));
    const message = `Failed to store image bundle${
      currentImageId ? ` at image ${currentImageId}` : ''
    }`;
    log.error(`${message}:`, error);
    throw new Error(message, { cause: error });
  }

  return storedIds;
}

/**
 * Load image mapping (This might need a different approach with Storage URLs)
 * In Firebase, we usually store the URL directly in the document.
 */
export async function loadImageMapping(imageIds: string[]): Promise<Record<string, string>> {
  const mapping: Record<string, string> = {};

  for (const storageId of imageIds) {
    try {
      const record = await db.imageFiles.get(storageId);
      if (record) {
        const blob = storedBinaryToBlob(record.blob, record.mimeType);
        const base64 = await blobToBase64(blob);
        const originalId = extractOriginalImageId(storageId);
        if (!originalId) {
          log.warn(`Skipping image with malformed storage ID: ${storageId}`);
          continue;
        }
        mapping[originalId] = base64;
      }
    } catch (error) {
      log.error(`Failed to load image ${storageId}:`, error);
    }
  }
  return mapping;
}

/** Extract the original image ID from `session_<10-character nanoid>_<image ID>`. */
export function extractOriginalImageId(storageId: string): string | undefined {
  const prefixLength = 'session_'.length + SESSION_ID_LENGTH;
  if (!storageId.startsWith('session_') || storageId[prefixLength] !== '_') return undefined;

  const originalId = storageId.slice(prefixLength + 1);
  return originalId || undefined;
}

/**
 * Clean up images by session prefix (Requires cloud functions or listing in Storage)
 */
export async function cleanupSessionImages(sessionId: string, userId: string): Promise<void> {
  log.info(`Cleanup for session ${sessionId} should be handled by lifecycle rules or manual listing.`);
  // Manual listing and deletion can be added if needed, but it's expensive on client.
}

/**
 * Store a PDF file in Firebase Storage.
 */
export async function cleanupOldImages(hoursOld: number = 24): Promise<void> {
  try {
    const cutoff = Date.now() - hoursOld * 60 * 60 * 1000;
    await db.imageFiles.where('createdAt').below(cutoff).delete();
    log.info(`Cleaned up images older than ${hoursOld} hours`);
  } catch (error) {
    log.error('Failed to cleanup old images:', error);
  }
}

/**
 * Get total size of stored images
 */
export async function getImageStorageSize(): Promise<number> {
  const images = await db.imageFiles.toArray();
  return images.reduce((total, img) => total + img.size, 0);
}

/**
 * Store a PDF file as an ArrayBuffer in IndexedDB (and Cloud Storage if userId provided).
 * Returns a storage key that callers can use to retrieve the file as a Blob.
 */
export async function storePdfBlob(file: File, userId?: string): Promise<string> {
  const storageKey = `pdf_${nanoid(10)}`;
  const buffer = await file.arrayBuffer();

  const record: ImageFileRecord = {
    id: storageKey,
    blob: buffer,
    filename: file.name,
    mimeType: file.type || 'application/pdf',
    size: buffer.byteLength,
    createdAt: Date.now(),
  };

  await db.imageFiles.put(record);

  if (userId) {
    try {
      const storagePath = `pdfs/${nanoid(10)}_${file.name}`;
      const blob = new Blob([buffer], { type: file.type || 'application/pdf' });
      await uploadToCloudStorage(storagePath, blob, userId);
    } catch (e) {
      log.warn('Could not upload PDF blob to cloud:', e);
    }
  }

  return storageKey;
}

/**
 * Load a PDF Blob (In Firebase, we usually just return the URL)
 */
export async function loadPdfBlob(keyOrUrl: string): Promise<Blob | string | null> {
  if (keyOrUrl.startsWith('http://') || keyOrUrl.startsWith('https://')) {
    return keyOrUrl;
  }
  const record = await db.imageFiles.get(keyOrUrl);
  return record ? storedBinaryToBlob(record.blob, record.mimeType) : null;
}

/**
 * Delete a stored PDF Blob from IndexedDB by its storage key.
 */
export async function deletePdfBlob(key: string): Promise<void> {
  await db.imageFiles.delete(key);
}

export const storeDocumentBlob = storePdfBlob;
export const loadDocumentBlob = loadPdfBlob;
export const deleteDocumentBlob = deletePdfBlob;
