/**
 * Media Generation Store
 *
 * Tracks per-element media generation status (pending → generating → done/failed).
 * Drives skeleton loading in slide renderer components.
 * Persistence is handled by IndexedDB (mediaFiles table), not Zustand middleware.
 */

import { create } from 'zustand';
import type { MediaGenerationRequest } from '@/lib/media/types';
import { db } from '@/lib/device-storage/database';
import { createLogger } from '@/lib/logger';
import { queryFromCloud, MEDIA_FILES_COLLECTION } from '@/lib/utils/cloud-storage';

const log = createLogger('MediaGenerationStore');

// ==================== Types ====================

export type MediaTaskStatus = 'pending' | 'generating' | 'done' | 'failed';

export interface MediaTask {
  elementId: string;
  /** Original generation placeholder retained after the task is re-keyed to an allocated id. */
  placeholderRef?: string;
  type: 'image' | 'video';
  status: MediaTaskStatus;
  prompt: string;
  params: {
    aspectRatio?: string;
    style?: string;
    duration?: number;
  };
  objectUrl?: string; // URL.createObjectURL() for rendering
  poster?: string; // Video poster objectUrl
  posterAssetId?: string; // Allocated poster identity used by late scene reconciliation
  error?: string;
  errorCode?: string; // Structured error code (e.g. 'CONTENT_SENSITIVE')
  retryCount: number;
  stageId: string;
}

interface MediaGenerationState {
  tasks: Record<string, MediaTask>;
  userId: string | null;

  setUserId: (userId: string | null) => void;

  // Batch enqueue
  enqueueTasks: (stageId: string, requests: MediaGenerationRequest[]) => void;

  // Status transitions
  markGenerating: (elementId: string) => void;
  markDone: (elementId: string, objectUrl: string, poster?: string) => void;
  rekeyDone: (
    oldRef: string,
    newRef: string,
    objectUrl: string,
    poster?: string,
    posterAssetId?: string,
  ) => void;
  markFailed: (elementId: string, error: string, errorCode?: string) => void;

  // Retry support
  markPendingForRetry: (elementId: string) => void;

  // Queries
  getTask: (elementId: string) => MediaTask | undefined;
  isReady: (elementId: string) => boolean;

  // Restore from Firestore on page load
  restoreFromDB: (stageId: string, userId: string) => Promise<void>;

  // Cleanup
  clearStage: (stageId: string) => void;
  revokeObjectUrls: () => void;
}

// ==================== Helper ====================

const CONCRETE_URL = /^(https?:|data:|blob:|\/|\.\.?\/)/i;

/** Check whether a media reference still needs resolution before rendering. */
export function isMediaPlaceholder(src: string): boolean {
  return !!src && !CONCRETE_URL.test(src);
}

// ==================== Store ====================

export const useMediaGenerationStore = create<MediaGenerationState>()((set, get) => ({
  tasks: {},
  userId: null,

  setUserId: (userId) => set({ userId }),

  enqueueTasks: (stageId, requests) => {
    const newTasks: Record<string, MediaTask> = {};
    for (const req of requests) {
      // Skip if already tracked
      if (get().tasks[req.elementId]) continue;
      newTasks[req.elementId] = {
        elementId: req.elementId,
        type: req.type,
        status: 'pending',
        prompt: req.prompt,
        params: {
          aspectRatio: req.aspectRatio,
          style: req.style,
        },
        retryCount: 0,
        stageId,
      };
    }
    if (Object.keys(newTasks).length > 0) {
      set((s) => ({ tasks: { ...s.tasks, ...newTasks } }));
    }
  },

  markGenerating: (elementId) =>
    set((s) => {
      const task = s.tasks[elementId];
      if (!task) return s;
      return {
        tasks: { ...s.tasks, [elementId]: { ...task, status: 'generating' } },
      };
    }),

  markDone: (elementId, objectUrl, poster) =>
    set((s) => {
      const task = s.tasks[elementId];
      if (!task) return s;
      return {
        tasks: {
          ...s.tasks,
          [elementId]: {
            ...task,
            status: 'done',
            objectUrl,
            poster,
            error: undefined,
          },
        },
      };
    }),

  rekeyDone: (oldRef, newRef, objectUrl, poster, posterAssetId) =>
    set((s) => {
      const task = s.tasks[oldRef];
      if (!task) return s;
      const tasks = { ...s.tasks };
      delete tasks[oldRef];
      tasks[newRef] = {
        ...task,
        elementId: newRef,
        placeholderRef: task.placeholderRef ?? oldRef,
        status: 'done',
        objectUrl,
        poster,
        posterAssetId,
        error: undefined,
        errorCode: undefined,
      };
      return { tasks };
    }),

  markFailed: (elementId, error, errorCode) =>
    set((s) => {
      const task = s.tasks[elementId];
      if (!task) return s;
      return {
        tasks: {
          ...s.tasks,
          [elementId]: { ...task, status: 'failed', error, errorCode },
        },
      };
    }),

  markPendingForRetry: (elementId) =>
    set((s) => {
      const task = s.tasks[elementId];
      if (!task) return s;
      return {
        tasks: {
          ...s.tasks,
          [elementId]: {
            ...task,
            status: 'pending',
            error: undefined,
            errorCode: undefined,
            retryCount: task.retryCount + 1,
          },
        },
      };
    }),

  getTask: (elementId) => get().tasks[elementId],

  isReady: (elementId) => get().tasks[elementId]?.status === 'done',

  restoreFromDB: async (stageId, userId) => {
    try {
      const allRecords = await queryFromCloud<any>(MEDIA_FILES_COLLECTION, userId);
      const records = allRecords.filter(r => r.stageId === stageId);
      
      const restored: Record<string, MediaTask> = {};
      for (const rec of records) {
        // Extract elementId from compound key (stageId:elementId)
        const elementId = rec.id.includes(':') ? rec.id.split(':').slice(1).join(':') : rec.id;
        const params = JSON.parse(rec.params || '{}');

        if (rec.error) {
          // Restore as failed task (persisted non-retryable error)
          restored[elementId] = {
            elementId,
            placeholderRef: rec.placeholderRef,
            type: rec.type,
            status: 'failed',
            prompt: rec.prompt,
            params,
            error: rec.error,
            errorCode: rec.errorCode,
            retryCount: 0,
            stageId,
          };
        } else {
          const objectUrl = rec.url || rec.ossKey || (rec.blob ? URL.createObjectURL(
            rec.blob.type ? rec.blob : new Blob([rec.blob], { type: rec.mimeType })
          ) : undefined);
          const poster = rec.posterUrl || rec.posterOssKey || (rec.poster ? URL.createObjectURL(rec.poster) : undefined);
          restored[elementId] = {
            elementId,
            placeholderRef: rec.placeholderRef,
            type: rec.type,
            status: 'done',
            prompt: rec.prompt,
            params,
            objectUrl,
            poster,
            retryCount: 0,
            stageId,
          };
        }
      }
      if (Object.keys(restored).length > 0) {
        set((s) => ({ tasks: { ...s.tasks, ...restored } }));
      }
    } catch (err) {
      log.error('Failed to restore from Cloud Storage:', err);
    }
  },

  clearStage: (stageId) =>
    set((s) => {
      const remaining: Record<string, MediaTask> = {};
      for (const [id, task] of Object.entries(s.tasks)) {
        if (task.stageId !== stageId) {
          remaining[id] = task;
        } else if (task.objectUrl) {
          URL.revokeObjectURL(task.objectUrl);
          if (task.poster) URL.revokeObjectURL(task.poster);
        }
      }
      return { tasks: remaining };
    }),

  revokeObjectUrls: () => {
    const tasks = get().tasks;
    for (const task of Object.values(tasks)) {
      if (task.objectUrl) URL.revokeObjectURL(task.objectUrl);
      if (task.poster) URL.revokeObjectURL(task.poster);
    }
  },
}));
