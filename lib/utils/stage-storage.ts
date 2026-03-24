/**
 * Stage Storage Manager
 *
 * Manages multiple stage data in IndexedDB
 * Each stage has its own storage key based on stageId
 */

import { Stage, Scene } from '../types/stage';
import { ChatSession } from '../types/chat';
import { 
  saveToCloud, 
  loadFromCloud, 
  queryFromCloud, 
  deleteFromCloud 
} from './cloud-storage';
import { saveChatSessions, loadChatSessions, deleteChatSessions } from './chat-storage';
import { clearPlaybackState } from './playback-storage';
import { createLogger } from '@/lib/logger';

const log = createLogger('StageStorage');

/**
 * Collection names
 */
const STAGES_COLLECTION = 'stages';
const SCENES_COLLECTION = 'scenes';
const STAGE_OUTLINES_COLLECTION = 'stageOutlines';
const GENERATED_AGENTS_COLLECTION = 'generatedAgents';

export interface StageStoreData {
  stage: Stage;
  scenes: Scene[];
  currentSceneId: string | null;
  chats: ChatSession[];
}

export interface StageListItem {
  id: string;
  name: string;
  description?: string;
  sceneCount: number;
  createdAt: number;
  updatedAt: number;
}

/**
 * Save stage data to Firestore
 */
export async function saveStageData(
  stageId: string, 
  data: StageStoreData, 
  userId: string
): Promise<void> {
  try {
    const now = Date.now();

    // Save to stages collection
    await saveToCloud(STAGES_COLLECTION, stageId, {
      id: stageId,
      name: data.stage.name || 'Untitled Stage',
      description: data.stage.description,
      createdAt: data.stage.createdAt || now,
      updatedAt: now,
      language: data.stage.language,
      style: data.stage.style,
      currentSceneId: data.currentSceneId || undefined,
    }, userId);

    // Save scenes to separate records
    if (data.scenes && data.scenes.length > 0) {
      for (const [index, scene] of data.scenes.entries()) {
        await saveToCloud(SCENES_COLLECTION, scene.id, {
          ...scene,
          stageId,
          order: scene.order ?? index,
          createdAt: scene.createdAt || now,
          updatedAt: now,
        }, userId);
      }
    }

    // Save chat sessions to independent collection
    if (data.chats) {
      await saveChatSessions(stageId, data.chats, userId);
    }

    log.info(`Saved stage to Cloud: ${stageId}`);
  } catch (error) {
    log.error('Failed to save stage to Cloud:', error);
    throw error;
  }
}

/**
 * Load stage data from Firestore
 */
export async function loadStageData(stageId: string): Promise<StageStoreData | null> {
  try {
    // Load stage
    const stage = await loadFromCloud<Stage & { currentSceneId?: string }>(STAGES_COLLECTION, stageId);
    if (!stage) {
      log.info(`Stage not found in Cloud: ${stageId}`);
      return null;
    }

    const userId = stage.userId as string;

    // Load scenes
    const allScenes = await queryFromCloud<Scene>(SCENES_COLLECTION, userId, 'order');
    const scenes = allScenes.filter(s => s.stageId === stageId);

    // Load chat sessions from independent collection
    const { loadChatSessionsWithUserId } = await import('./chat-storage');
    const chats = await loadChatSessionsWithUserId(stageId, userId);

    log.info(`Loaded stage from Cloud: ${stageId}, scenes: ${scenes.length}, chats: ${chats.length}`);

    return {
      stage,
      scenes,
      currentSceneId: stage.currentSceneId || scenes[0]?.id || null,
      chats,
    };
  } catch (error) {
    log.error('Failed to load stage from Cloud:', error);
    return null;
  }
}

/**
 * Delete stage and all related data from Firestore
 */
export async function deleteStageData(stageId: string, userId: string): Promise<void> {
  try {
    // Delete stage
    await deleteFromCloud(STAGES_COLLECTION, stageId);

    // Delete scenes (requires querying first as we don't have bulk delete by query in client SDK without loop)
    const allScenes = await queryFromCloud<Scene>(SCENES_COLLECTION, userId);
    const stageScenes = allScenes.filter(s => s.stageId === stageId);
    for (const scene of stageScenes) {
      await deleteFromCloud(SCENES_COLLECTION, scene.id);
    }

    // Delete chat sessions, playback state, and outlines
    await deleteChatSessions(stageId, userId);
    await clearPlaybackState(stageId);
    await deleteStageOutlines(stageId);

    // Delete generated agents
    const agents = await queryFromCloud<any>(GENERATED_AGENTS_COLLECTION, userId);
    const stageAgents = agents.filter(a => a.stageId === stageId);
    for (const agent of stageAgents) {
      await deleteFromCloud(GENERATED_AGENTS_COLLECTION, agent.id);
    }

    log.info(`Deleted stage from Cloud: ${stageId}`);
  } catch (error) {
    log.error('Failed to delete stage from Cloud:', error);
    throw error;
  }
}

/**
 * List all stages for a user
 */
export async function listStages(userId: string): Promise<StageListItem[]> {
  try {
    const stages = await queryFromCloud<any>(STAGES_COLLECTION, userId, 'updatedAt', 'desc');

    const stageList: StageListItem[] = await Promise.all(
      stages.map(async (stage) => {
        // This is inefficient on client, but required for the UI
        const allScenes = await queryFromCloud<Scene>(SCENES_COLLECTION, userId);
        const sceneCount = allScenes.filter(s => s.stageId === stage.id).length;

        return {
          id: stage.id,
          name: stage.name,
          description: stage.description,
          sceneCount,
          createdAt: stage.createdAt,
          updatedAt: stage.updatedAt,
        };
      }),
    );

    return stageList;
  } catch (error) {
    log.error('Failed to list stages from Cloud:', error);
    return [];
  }
}

/**
 * Get first slide scene's canvas data for each stage (for thumbnail preview).
 */
export async function getFirstSlideByStages(
  stageIds: string[],
  userId: string
): Promise<Record<string, import('../types/slides').Slide>> {
  const result: Record<string, import('../types/slides').Slide> = {};
  try {
    const allScenes = await queryFromCloud<Scene>(SCENES_COLLECTION, userId, 'order');
    
    for (const stageId of stageIds) {
      const scenes = allScenes.filter(s => s.stageId === stageId);
      const firstSlide = scenes.find((s) => s.content?.type === 'slide');
      if (firstSlide && firstSlide.content.type === 'slide') {
        // For simplicity in this first pass, we return the slide data.
        // Deep blob resolution will be handled in a follow-up if needed.
        result[stageId] = firstSlide.content.canvas;
      }
    }
  } catch (error) {
    log.error('Failed to load thumbnails from Cloud:', error);
  }
  return result;
}

/**
 * Check if stage exists
 */
export async function stageExists(stageId: string): Promise<boolean> {
  try {
    const stage = await loadFromCloud(STAGES_COLLECTION, stageId);
    return !!stage;
  } catch (error) {
    log.error('Failed to check stage existence in Cloud:', error);
    return false;
  }
}
/**
 * Save stage outlines to Firestore
 */
export async function saveStageOutlines(
  stageId: string,
  outlines: import('../types/generation').SceneOutline[],
  userId: string
): Promise<void> {
  await saveToCloud(STAGE_OUTLINES_COLLECTION, stageId, {
    stageId,
    outlines,
    updatedAt: Date.now(),
  }, userId);
}

/**
 * Load stage outlines from Firestore
 */
export async function loadStageOutlines(
  stageId: string
): Promise<import('../types/generation').SceneOutline[] | null> {
  const data = await loadFromCloud<any>(STAGE_OUTLINES_COLLECTION, stageId);
  return data?.outlines || null;
}

/**
 * Delete stage outlines from Firestore
 */
export async function deleteStageOutlines(stageId: string): Promise<void> {
  await deleteFromCloud(STAGE_OUTLINES_COLLECTION, stageId);
}
