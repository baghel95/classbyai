/**
 * Chat Storage - Persist chat sessions to Cloud
 *
 * Independent from stage/scene storage cycle.
 * Handles serialization, truncation, and batch writes.
 */

import type { ChatSession, ChatMessageMetadata, SessionStatus } from '@/lib/types/chat';
import type { UIMessage } from 'ai';
import { 
  saveToCloud, 
  queryFromCloud, 
  deleteFromCloud 
} from './cloud-storage';
import { createLogger } from '@/lib/logger';

const log = createLogger('ChatStorage');

/** Maximum messages per session to avoid Firestore document size limits */
const MAX_MESSAGES_PER_SESSION = 200;

/** Collection name */
const CHATS_COLLECTION = 'chats';

/**
 * Save chat sessions for a stage to Cloud.
 */
export async function saveChatSessions(
  stageId: string, 
  sessions: ChatSession[], 
  userId: string
): Promise<void> {
  try {
    if (!sessions || sessions.length === 0) {
      // Delete all sessions for this stage if empty
      const allChats = await queryFromCloud<any>(CHATS_COLLECTION, userId);
      const stageChats = allChats.filter(c => c.stageId === stageId);
      for (const chat of stageChats) {
        await deleteFromCloud(CHATS_COLLECTION, chat.id);
      }
      return;
    }

    for (const session of sessions) {
      const record = {
        id: session.id,
        stageId,
        type: session.type,
        title: session.title,
        status: (session.status === 'active' ? 'interrupted' : session.status) as SessionStatus,
        messages: session.messages.slice(-MAX_MESSAGES_PER_SESSION),
        config: session.config,
        toolCalls: session.toolCalls,
        pendingToolCalls: [],
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        sceneId: session.sceneId,
        lastActionIndex: session.lastActionIndex,
      };

      await saveToCloud(CHATS_COLLECTION, session.id, record, userId);
    }
    
    log.info(`Saved chat sessions to Cloud for stage: ${stageId}`);
  } catch (error) {
    log.error('Failed to save chat sessions to Cloud:', error);
    throw error;
  }
}

/**
 * Load chat sessions for a stage from Cloud.
 */
export async function loadChatSessions(stageId: string): Promise<ChatSession[]> {
  try {
    // We can't query by stageId directly on client without an index on [userId, stageId]
    // For now, we query by userId (which firebase-storage does) and filter manually
    // In a real app, you'd add the composite index.
    // However, since we don't have the userId here, we assume the caller is using 
    // a store that has the userId, or we retrieve it from the stage itself.
    // But loadStageData calls this... and stage has userId.
    
    // Actually, let's update this to skip the query and just return empty if called without context,
    // as it's usually called from loadStageData which already has the data? 
    // No, loadStageData calls it to load.
    
    // Let's make loadChatSessions also accept userId.
    return []; // Placeholder - will be updated in next pass when I refactor the caller
  } catch (error) {
    log.error('Failed to load chat sessions from Cloud:', error);
    return [];
  }
}

/**
 * Load chat sessions for a stage from Cloud with userId.
 */
export async function loadChatSessionsWithUserId(
  stageId: string, 
  userId: string
): Promise<ChatSession[]> {
  try {
    const allChats = await queryFromCloud<any>(CHATS_COLLECTION, userId, 'createdAt');
    const records = allChats.filter(c => c.stageId === stageId);

    return records.map((record) => ({
      id: record.id,
      type: record.type,
      title: record.title,
      status: record.status,
      messages: record.messages as UIMessage<ChatMessageMetadata>[],
      config: record.config,
      toolCalls: record.toolCalls,
      pendingToolCalls: record.pendingToolCalls,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      sceneId: record.sceneId,
      lastActionIndex: record.lastActionIndex,
    }));
  } catch (error) {
    log.error('Failed to load chat sessions from Cloud:', error);
    return [];
  }
}

/**
 * Delete all chat sessions for a stage.
 */
export async function deleteChatSessions(stageId: string, userId: string): Promise<void> {
  try {
    const allChats = await queryFromCloud<any>(CHATS_COLLECTION, userId);
    const stageChats = allChats.filter(c => c.stageId === stageId);
    for (const chat of stageChats) {
      await deleteFromCloud(CHATS_COLLECTION, chat.id);
    }
  } catch (error) {
    log.error('Failed to delete chat sessions from Cloud:', error);
  }
}
