// Cloud Storage Utility for Node.js Backend
const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5001/api';
import { createLogger } from '@/lib/logger';

const log = createLogger('CloudStorage');

// Collection Names
export const STAGES_COLLECTION = 'stages';
export const SCENES_COLLECTION = 'scenes';
export const CHATS_COLLECTION = 'chats';
export const PLAYBACK_COLLECTION = 'playbackStates';
export const MEDIA_FILES_COLLECTION = 'mediaFiles';
export const AUDIO_FILES_COLLECTION = 'audioFiles';
export const GENERATED_AGENTS_COLLECTION = 'generatedAgents';

/**
 * Recursively remove undefined fields to prevent backend "invalid data" errors.
 */
function removeUndefinedFields(obj: any): any {
  if (obj === undefined || obj === null) return obj;
  if (Array.isArray(obj)) {
    return obj.map(removeUndefinedFields);
  }
  if (typeof obj === 'object') {
    const result: any = {};
    for (const [key, val] of Object.entries(obj)) {
      if (val !== undefined) {
        result[key] = removeUndefinedFields(val);
      }
    }
    return result;
  }
  return obj;
}

/**
 * Helper to map collection names to API paths
 */
function getApiPath(collectionName: string): string {
  switch (collectionName) {
    case PLAYBACK_COLLECTION: return 'playback';
    case MEDIA_FILES_COLLECTION: return 'media';
    case AUDIO_FILES_COLLECTION: return 'audio';
    case GENERATED_AGENTS_COLLECTION: return 'agents';
    default: return collectionName;
  }
}

/**
 * Save document to backend with userId mapping (Upsert)
 */
export async function saveToCloud<T>(
  collectionName: string,
  id: string,
  data: T,
  userId: string
): Promise<void> {
  if (!userId) {
    log.warn(`Skipping save to backend: No userId provided for ${collectionName}/${id}`);
    return;
  }
  try {
    const apiPath = getApiPath(collectionName);
    const cleanedData = removeUndefinedFields({
      ...data,
      id, // Preserve ID for backend mapping to _id
      userId,
      updatedAt: Date.now(),
    });

    const res = await fetch(`${API_BASE_URL}/${apiPath}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cleanedData),
    });

    if (!res.ok) {
      throw new Error(`Failed to save to backend: ${res.statusText}`);
    }

    log.info(`Saved to backend: ${collectionName}/${id}`);
  } catch (error) {
    log.error(`Failed to save to backend (${collectionName}/${id}):`, error);
    throw error;
  }
}

/**
 * Save an array of documents to backend in a single batch request
 */
export async function saveBatchToCloud<T>(
  collectionName: string,
  items: T[],
  userId: string,
  stageId?: string
): Promise<void> {
  if (!userId) {
    log.warn(`Skipping batch save to backend: No userId provided for ${collectionName}`);
    return;
  }
  if (!items || items.length === 0) return;

  try {
    const apiPath = getApiPath(collectionName);
    const cleanedItems = items.map((item: any, index: number) =>
      removeUndefinedFields({
        ...item,
        id: item.id || item._id,
        userId,
        ...(stageId ? { stageId } : {}),
        order: item.order ?? index,
        updatedAt: Date.now(),
      })
    );

    const res = await fetch(`${API_BASE_URL}/${apiPath}/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
      body: JSON.stringify({ items: cleanedItems, stageId }),
    });

    if (!res.ok) {
      throw new Error(`Failed to batch save to backend: ${res.statusText}`);
    }

    log.info(`Batch saved to backend: ${collectionName} (${items.length} items)`);
  } catch (error) {
    log.error(`Failed to batch save to backend (${collectionName}):`, error);
    throw error;
  }
}

/**
 * Load document from backend
 */
export async function loadFromCloud<T>(
  collectionName: string,
  id: string
): Promise<T | null> {
  try {
    const apiPath = getApiPath(collectionName);
    const res = await fetch(`${API_BASE_URL}/${apiPath}/${id}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Failed to load from backend: ${res.statusText}`);
    
    return await res.json() as T;
  } catch (error) {
    log.error(`Failed to load from backend (${collectionName}/${id}):`, error);
    throw error;
  }
}

/**
 * Query documents from backend by userId
 */
export async function queryFromCloud<T>(
  collectionName: string,
  userId: string,
  orderByField?: string,
  orderDirection: 'asc' | 'desc' = 'asc'
): Promise<T[]> {
  if (!userId) {
    log.warn(`Skipping query from backend: No userId provided for ${collectionName}`);
    return [];
  }
  try {
    const apiPath = getApiPath(collectionName);
    const queryParams = new URLSearchParams({ userId });
    if (orderByField) queryParams.append('orderBy', orderByField);
    queryParams.append('orderDir', orderDirection);

    const res = await fetch(`${API_BASE_URL}/${apiPath}?${queryParams.toString()}`);
    if (!res.ok) throw new Error(`Failed to query from backend: ${res.statusText}`);
    
    return await res.json() as T[];
  } catch (error) {
    log.error(`Failed to query from backend (${collectionName}):`, error);
    throw error;
  }
}

/**
 * Delete document from backend
 */
export async function deleteFromCloud(
  collectionName: string,
  id: string
): Promise<void> {
  try {
    const apiPath = getApiPath(collectionName);
    const res = await fetch(`${API_BASE_URL}/${apiPath}/${id}`, {
      method: 'DELETE',
    });

    if (!res.ok && res.status !== 404) {
      throw new Error(`Failed to delete from backend: ${res.statusText}`);
    }

    log.info(`Deleted from backend: ${collectionName}/${id}`);
  } catch (error) {
    log.error(`Failed to delete from backend (${collectionName}/${id}):`, error);
    throw error;
  }
}

/**
 * Upload binary blob to Cloud Storage via API
 */
export async function uploadToCloudStorage(
  path: string,
  blob: Blob | File,
  userId: string
): Promise<string> {
  try {
    const fullPath = `media/${userId}/${path}`;
    const formData = new FormData();
    formData.append('file', blob);
    formData.append('path', fullPath);
    formData.append('userId', userId);

    const res = await fetch('/api/storage/upload', {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.error || `Upload failed: ${res.status}`);
    }

    const { url } = await res.json();
    log.info(`Uploaded to Cloud Storage: ${fullPath}`);
    return url;
  } catch (error) {
    log.error(`Failed to upload to Cloud Storage (${path}):`, error);
    throw error;
  }
}

/**
 * Delete object from Cloud Storage via API
 */
export async function deleteFromCloudStorage(
  path: string,
  userId: string
): Promise<void> {
  try {
    const fullPath = `media/${userId}/${path}`;
    const res = await fetch('/api/storage/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: fullPath, userId }),
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      log.warn(`Delete request failed for ${fullPath}: ${error.error}`);
    } else {
      log.info(`Deleted from Cloud Storage: ${fullPath}`);
    }
  } catch (error) {
    log.error(`Failed to delete from Cloud Storage (${path}):`, error);
  }
}
