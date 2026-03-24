/**
 * Playback Storage - Persist playback engine state to Firestore
 *
 * Stores minimal state needed to resume playback from a breakpoint:
 * position (sceneIndex + actionIndex) and consumed discussions.
 */

import { 
  saveToCloud, 
  loadFromCloud, 
  deleteFromCloud 
} from './cloud-storage';

export interface PlaybackSnapshot {
  sceneIndex: number;
  actionIndex: number;
  consumedDiscussions: string[];
  sceneId?: string; // Scene this snapshot belongs to; discard on mismatch
}

/** Collection name */
const PLAYBACK_COLLECTION = 'playbackStates';

/**
 * Save playback state for a stage.
 * Each stage has at most one playback state record.
 */
export async function savePlaybackState(
  stageId: string,
  snapshot: PlaybackSnapshot,
  userId: string
): Promise<void> {
  await saveToCloud(PLAYBACK_COLLECTION, stageId, {
    stageId,
    sceneIndex: snapshot.sceneIndex,
    actionIndex: snapshot.actionIndex,
    consumedDiscussions: snapshot.consumedDiscussions,
    sceneId: snapshot.sceneId,
    updatedAt: Date.now(),
  }, userId);
}

/**
 * Load playback state for a stage.
 * Returns null if no saved state exists.
 */
export async function loadPlaybackState(stageId: string): Promise<PlaybackSnapshot | null> {
  const record = await loadFromCloud<any>(PLAYBACK_COLLECTION, stageId);
  if (!record) return null;

  return {
    sceneIndex: record.sceneIndex,
    actionIndex: record.actionIndex,
    consumedDiscussions: record.consumedDiscussions,
    sceneId: record.sceneId,
  };
}

/**
 * Clear playback state for a stage (e.g. on playback complete or stop).
 */
export async function clearPlaybackState(stageId: string): Promise<void> {
  await deleteFromCloud(PLAYBACK_COLLECTION, stageId);
}
