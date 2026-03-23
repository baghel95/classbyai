/**
 * Image Storage Utilities - Use Firebase Storage
 *
 * Store images in Firebase Storage instead of local IndexedDB.
 */

import { 
  uploadToStorage, 
  deleteFromStorage 
} from './firebase-storage';
import { nanoid } from 'nanoid';
import { createLogger } from '@/lib/logger';

const log = createLogger('ImageStorage');

/**
 * Convert base64 data URL to Blob
 */
function base64ToBlob(base64DataUrl: string): Blob {
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

  return new Blob([uint8Array], { type: mimeType });
}

/**
 * Store images in Firebase Storage
 * Returns array of stored image download URLs
 */
export async function storeImages(
  images: Array<{ id: string; src: string; pageNumber?: number }>,
  userId: string
): Promise<string[]> {
  const sessionId = nanoid(10);
  const storedUrls: string[] = [];

  for (const img of images) {
    try {
      const blob = base64ToBlob(img.src);
      const storagePath = `sessions/${sessionId}/${img.id}.png`;
      
      const downloadUrl = await uploadToStorage(storagePath, blob, userId);
      storedUrls.push(downloadUrl);
    } catch (error) {
      log.error(`Failed to store image ${img.id} to Storage:`, error);
    }
  }

  return storedUrls;
}

/**
 * Load image mapping (This might need a different approach with Storage URLs)
 * In Firebase, we usually store the URL directly in the document.
 */
export async function loadImageMapping(imageUrls: string[]): Promise<Record<string, string>> {
  const mapping: Record<string, string> = {};
  // For now, if we have URLs, we just map them. 
  // If the original IDs were encoded in the URL, we'd extract them.
  imageUrls.forEach((url, index) => {
    mapping[`img_${index + 1}`] = url;
  });
  return mapping;
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
export async function storePdfBlob(file: File, userId: string): Promise<string> {
  const storagePath = `pdfs/${nanoid(10)}_${file.name}`;
  const blob = new Blob([await file.arrayBuffer()], {
    type: file.type || 'application/pdf',
  });

  return await uploadToStorage(storagePath, blob, userId);
}

/**
 * Load a PDF Blob (In Firebase, we usually just return the URL)
 */
export async function loadPdfBlob(url: string): Promise<Blob | string | null> {
  return url;
}
