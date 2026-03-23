import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  deleteDoc, 
  query, 
  where, 
  getDocs, 
  orderBy,
  updateDoc
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { createLogger } from '@/lib/logger';

const log = createLogger('FirebaseStorage');

// Collection Names
export const STAGES_COLLECTION = 'stages';
export const SCENES_COLLECTION = 'scenes';
export const CHATS_COLLECTION = 'chats';
export const PLAYBACK_COLLECTION = 'playbackStates';
export const MEDIA_FILES_COLLECTION = 'mediaFiles';
export const AUDIO_FILES_COLLECTION = 'audioFiles';
export const GENERATED_AGENTS_COLLECTION = 'generatedAgents';

/**
 * Recursively remove undefined fields to prevent Firestore "invalid data" errors.
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
 * Save document to Firestore with userId mapping
 */
export async function saveToFirestore<T>(
  collectionName: string,
  id: string,
  data: T,
  userId: string
): Promise<void> {
  if (!userId) {
    log.warn(`Skipping save to Firestore: No userId provided for ${collectionName}/${id}`);
    return;
  }
  try {
    const docRef = doc(db, collectionName, id);
    const cleanedData = removeUndefinedFields({
      ...data,
      userId,
      updatedAt: Date.now(),
    });
    await setDoc(docRef, cleanedData);
    log.info(`Saved to Firestore: ${collectionName}/${id}`);
  } catch (error) {
    log.error(`Failed to save to Firestore (${collectionName}/${id}):`, error);
    throw error;
  }
}

/**
 * Load document from Firestore
 */
export async function loadFromFirestore<T>(
  collectionName: string,
  id: string
): Promise<T | null> {
  try {
    const docRef = doc(db, collectionName, id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data() as T;
    }
    return null;
  } catch (error) {
    log.error(`Failed to load from Firestore (${collectionName}/${id}):`, error);
    throw error;
  }
}

/**
 * Query documents from Firestore by userId
 */
export async function queryFromFirestore<T>(
  collectionName: string,
  userId: string,
  orderByField?: string,
  orderDirection: 'asc' | 'desc' = 'asc'
): Promise<T[]> {
  if (!userId) {
    log.warn(`Skipping query from Firestore: No userId provided for ${collectionName}`);
    return [];
  }
  try {
    const collRef = collection(db, collectionName);
    let q = query(collRef, where('userId', '==', userId));
    
    if (orderByField) {
      q = query(q, orderBy(orderByField, orderDirection));
    }
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => doc.data() as T);
  } catch (error) {
    log.error(`Failed to query from Firestore (${collectionName}):`, error);
    throw error;
  }
}

/**
 * Delete document from Firestore
 */
export async function deleteFromFirestore(
  collectionName: string,
  id: string
): Promise<void> {
  try {
    const docRef = doc(db, collectionName, id);
    await deleteDoc(docRef);
    log.info(`Deleted from Firestore: ${collectionName}/${id}`);
  } catch (error) {
    log.error(`Failed to delete from Firestore (${collectionName}/${id}):`, error);
    throw error;
  }
}

/**
 * Upload binary blob to Google Cloud Storage via API
 */
export async function uploadToStorage(
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
    log.info(`Uploaded to GCS: ${fullPath}`);
    return url;
  } catch (error) {
    log.error(`Failed to upload to GCS (${path}):`, error);
    throw error;
  }
}

/**
 * Delete object from Google Cloud Storage via API
 */
export async function deleteFromStorage(
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
      log.info(`Deleted from GCS: ${fullPath}`);
    }
  } catch (error) {
    log.error(`Failed to delete from GCS (${path}):`, error);
  }
}
