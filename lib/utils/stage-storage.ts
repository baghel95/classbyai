/**
 * Stage Storage Manager
 *
 * Saves, loads, lists and deletes courses through the server-backed document
 * store, and manages the owner's folders through the `/api/folders` routes.
 */

import { Stage, Scene } from '../types/stage';
import { ChatSession } from '../types/chat';
import { 
  saveToCloud, 
  saveBatchToCloud, 
  loadFromCloud, 
  queryFromCloud, 
  deleteFromCloud,
  STAGES_COLLECTION,
  SCENES_COLLECTION,
  CHATS_COLLECTION,
  PLAYBACK_COLLECTION,
  GENERATED_AGENTS_COLLECTION,
} from './cloud-storage';
import { clearPlaybackState } from './playback-storage';
import { db } from '@/lib/device-storage/database';
import type { FolderRecord } from '@/lib/types/folder';
import { FolderNameError } from './folder-name-validation';
export { FolderNameError } from './folder-name-validation';
import {
  ChatStorageLockUnavailableError,
  saveChatSessions,
  loadChatSessions,
  deleteChatSessions,
  type ChatStorageSnapshot,
} from './chat-storage';
import isEqual from 'lodash/isEqual';
import { clearCursor } from '@/lib/playback/cursor';
import {
  accessDocument,
  clearCurrentScene,
  getDocumentStore,
  loadCurrentScene,
  mutateDocument,
  saveCurrentScene,
  type AppDocumentOutline,
} from '@/lib/document-store';
import { clearAllForScene } from '@/lib/quiz/persistence';
import { beginStageRuntimeDeletionSafely } from '@/lib/runtime/store';
import { clearStageDrainWatermarks } from '@/lib/pbl/v2/runtime/drain';import { createLogger } from '@/lib/logger';
import {
  withRuntimeStorageExclusiveLockUntilSettled,
  withRuntimeStorageSharedLock,
} from './chat-storage-lock';
import { DocumentVersionError, type DocumentSummary } from '@openmaic/storage';
import { preparePBLScenesForDocumentPersistence } from '@/lib/pbl/v2/runtime/document-persistence';
import {
  MISSING_ASSET_LEASE,
  isConcreteMediaAddress,
  renderableMediaUrl,
  resolveMediaRef,
  type MediaTaskState,
} from '@/lib/media/resolve-media-ref';
import { withAssetUrl } from '@/lib/media/use-asset-url';
import { mayNameAPoolAsset } from '@/lib/media/media-placeholder';
import { useSettingsStore } from '@/lib/store/settings';
import {
  beginStageDeletionCascade,
  isStageDeleted,
  isStageWriteStale,
  markStageDeleted,
  settleStageDeletionCascade,
  unmarkStageDeleted,
} from './deleted-stages';
import { clearStageMediaCache } from '@/lib/media/clear-stage-media-cache';
import { clearPendingMediaAllocations } from '@/lib/media/pending-media-allocations';
import { applyKnownMediaAllocations } from '@/lib/media/reconcile-scene-media';
import {
  collectDocumentMediaElements,
  resolveMediaTaskForElement,
  resolveVideoMediaForElement,
  type MediaTaskLookupEntry,
} from '@/lib/media/media-task-resolution';
import { slideMediaReferenceSlots } from '@/lib/media/slide-media-slots';

const log = createLogger('StageStorage');

export const STAGE_OUTLINES_COLLECTION = 'stageOutlines';

/**
 * Dispatched on `window` when something other than the library page changed
 * the owner's courses or folders in the background (the one-way importer of
 * pre-server browser data does), so an open library can list them again.
 */
export const LIBRARY_CHANGED_EVENT = 'openmaic:library-changed';
export interface StageStoreData {
  stage: Stage;
  scenes: Scene[];
  currentSceneId: string | null;
  chats: ChatSession[];
  chatSnapshot?: ChatStorageSnapshot;
  /** The aggregate save contract treats omission as deletion; callers should carry this snapshot. */
  outline?: AppDocumentOutline;
}

/**
 * A logical editor change waiting for persistence. Call sites intentionally
 * describe what changed, not how it is stored, so a future operation-log
 * backend can replace the flush implementation without changing mutations.
 */
export type PendingChange =
  | { kind: 'scene'; sceneId: string }
  | { kind: 'structure' }
  | { kind: 'stage' }
  | { kind: 'outline' }
  | { kind: 'currentScene' }
  | { kind: 'chats' };

export interface StageListItem {
  id: string;
  name: string;
  description?: string;
  sceneCount: number;
  createdAt: number;
  updatedAt: number;
  interactiveMode?: boolean;
  taskEngineMode?: boolean;
  /** Folder this course belongs to; undefined = unfiled. Device-local only. */
  folderId?: string;
}

function stampStage(stageId: string, stage: Stage, now: number): Stage {
  return {
    ...stage,
    id: stageId,
    name: stage.name || 'Untitled Stage',
    createdAt: stage.createdAt || now,
    updatedAt: now,
  };
}

function stampScene(stageId: string, scene: Scene, index: number, now: number): Scene {
  return {
    ...scene,
    stageId,
    order: scene.order ?? index,
    createdAt: scene.createdAt || now,
    updatedAt: scene.updatedAt || now,
  };
}

function documentSnapshot(
  stageId: string,
  data: StageStoreData,
  existingOutline: AppDocumentOutline | undefined,
  now: number,
) {
  const outline = data.outline ??
    existingOutline ?? {
      outlines: [],
      createdAt: now,
      updatedAt: now,
    };
  return {
    stage: stampStage(stageId, data.stage, now),
    scenes: data.scenes.map((scene, index) => stampScene(stageId, scene, index, now)),
    outline: {
      ...outline,
      createdAt: existingOutline?.createdAt ?? outline.createdAt,
    },
  };
}

async function saveStageChats(
  stageId: string,
  data: StageStoreData,
  globalLockHeld = false,
): Promise<boolean> {
  try {
    await saveChatSessions(stageId, data.chats, {
      ...(globalLockHeld ? { globalLockHeld: true } : {}),
      snapshot: data.chatSnapshot,
    });
    return true;
  } catch (error) {
    const unchangedSnapshot = isEqual(data.chatSnapshot?.sessions ?? [], data.chats);
    if (error instanceof ChatStorageLockUnavailableError && !unchangedSnapshot) throw error;
    log.warn(`Chat sessions failed to save for stage ${stageId}:`, error);
    return false;
  }
}

/**
/**
 * A save that was dropped by the deletion-epoch fence. Distinguishable from
 * every success shape on purpose: nothing durable survives.
 */
export type StaleDroppedSave = 'stale-dropped';

function withKnownMediaAllocations(stageId: string, data: StageStoreData): StageStoreData {
  const applied = applyKnownMediaAllocations(stageId, data.stage, data.scenes);
  if (!applied) return data;
  return { ...data, stage: applied.stage as StageStoreData['stage'], scenes: [...applied.scenes] };
}

/**
 * Save stage data to backend and DocumentStore.
 */
export async function saveStageData(
  stageId: string,
  data: StageStoreData,
  capturedEpochOrUserId?: number | string,
  userIdParam?: string,
): Promise<{ failedChanges: PendingChange[] } | StaleDroppedSave | undefined> {
  const capturedEpoch = typeof capturedEpochOrUserId === 'number' ? capturedEpochOrUserId : 0;
  const userId = typeof capturedEpochOrUserId === 'string' ? capturedEpochOrUserId : (userIdParam || (data.stage as any)?.userId);

  if (isStageWriteStale(stageId, capturedEpoch)) {
    log.info(`Dropping save for deleted/stale stage: ${stageId}`);
    return 'stale-dropped';
  }  try {
    const now = Date.now();
    const failedChanges: PendingChange[] = [];
    let dropped = false;
    await mutateDocument(
      stageId,
      async (existing, store) => {
        // Reconciled here, under the document lock, not before it: a write-back
        // running when this save was queued may only have recorded its
        // allocation while we waited for the lock, and a departing-course flush
        // gets no corrective pass afterwards.
        data = withKnownMediaAllocations(stageId, data);
        // Re-check inside the mutation: a deletion that started while this
        // save was waiting must win. With Web Locks this runs under the
        // per-stage document lock; without them the callback is lock-free
        // best-effort LWW, so additional re-checks sit immediately before
        // each write below to shrink the check-then-act window.
        if (isStageWriteStale(stageId, capturedEpoch)) {
          dropped = true;
          return;
        }
        // Lock order: per-stage document lock, then the global runtime epoch.
        // Maintenance may wait for this save, but this save never waits on a
        // document lock while already occupying the shared epoch.
        await withRuntimeStorageSharedLock(async () => {
          const existingOutline = existing?.outline as AppDocumentOutline | undefined;
          if (isStageWriteStale(stageId, capturedEpoch)) {
            dropped = true;
            return;
          }
          await store.saveDocument(documentSnapshot(stageId, data, existingOutline, now));
          if (isStageWriteStale(stageId, capturedEpoch)) {
            dropped = true;
            return;
          }
          await saveCurrentScene(stageId, data.currentSceneId);

          // Chat sessions live in the learner RuntimeStore, outside the document DB.
          if (isStageWriteStale(stageId, capturedEpoch)) {
            dropped = true;
            return;
          }
          if (data.chats && !(await saveStageChats(stageId, data, true))) {
            failedChanges.push({ kind: 'chats' });
          }
        });
      },
      { storageSharedLockHeld: true },
    );
    if (dropped) {
      log.info(`Dropped save mid-write for deleted/stale stage: ${stageId}`);
      return 'stale-dropped';
    }

    // Also persist to backend Cloud if userId is available
    if (userId) {
      try {
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

        if (data.scenes && data.scenes.length > 0) {
          await saveBatchToCloud(SCENES_COLLECTION, data.scenes, userId, stageId);
        }

        if (data.chats) {
          await saveChatSessions(stageId, data.chats, userId);
        }
        log.info(`Saved stage to Cloud: ${stageId}`);
      } catch (cloudErr) {
        log.error('Failed to save stage to Cloud:', cloudErr);
      }
    }

    log.info(`Saved stage: ${stageId}`);
    return failedChanges.length > 0 ? { failedChanges } : undefined;  } catch (error) {
    log.error('Failed to save stage to Cloud:', error);
    throw error;
  }
}

/**
 * Persist only the logical units dirtied by the editor. Structural and outline
 * changes still use the aggregate contract: structure must reconcile scene
 * membership/order, while DocumentStore does not yet expose putOutline.
 */
export async function saveStageDataIncremental(
  stageId: string,
  dirty: readonly PendingChange[],
  data: StageStoreData,
  capturedEpoch: number,
): Promise<{ failedChanges: PendingChange[] } | StaleDroppedSave> {
  // `capturedEpoch` = the deletion epoch when `data` was captured (the flush
  // round / departing-stage snapshot); required so the capture point and the
  // validation point stay paired. See saveStageData for the fencing contract;
  // a stale capture is dropped even after a same-id restore, and a dropped
  // write reports `'stale-dropped'` instead of a success shape.
  if (isStageWriteStale(stageId, capturedEpoch)) {
    log.info(`Dropping incremental save for deleted/stale stage: ${stageId}`);
    return 'stale-dropped';
  }
  const has = (kind: PendingChange['kind']) => dirty.some((change) => change.kind === kind);
  const dirtySceneIds = new Set(
    dirty.flatMap((change) => (change.kind === 'scene' ? [change.sceneId] : [])),
  );
  const needsDocumentWrite =
    dirtySceneIds.size > 0 || has('structure') || has('stage') || has('outline');
  const documentCategories = new Set(
    dirty.flatMap((change) =>
      change.kind === 'scene' ||
      change.kind === 'structure' ||
      change.kind === 'stage' ||
      change.kind === 'outline'
        ? [change.kind]
        : [],
    ),
  );

  let dropped = false;
  if (needsDocumentWrite) {
    await mutateDocument(
      stageId,
      async (existing, store) => {
        // Reconciled under the lock, for the reason saveStageData gives.
        data = withKnownMediaAllocations(stageId, data);
        // Re-check inside the mutation: `existing === undefined` after a
        // deletion must not be mistaken for a legacy destination — the
        // full-save fallback below would otherwise rebuild the deleted
        // document whole. With Web Locks this runs under the per-stage
        // document lock; without them the callback is lock-free best-effort
        // LWW, so each write below re-checks immediately before landing.
        // Epoch staleness also covers the delete→restore straddle: a round
        // captured pre-delete stays fenced after the restore lifts the flag.
        if (isStageWriteStale(stageId, capturedEpoch)) {
          dropped = true;
          return;
        }
        await withRuntimeStorageSharedLock(async () => {
          const now = Date.now();
          const fullSave = async () => {
            if (isStageWriteStale(stageId, capturedEpoch)) {
              dropped = true;
              return;
            }
            const persistedScenes = await preparePBLScenesForDocumentPersistence(
              stageId,
              data.scenes,
            );
            // Preparation awaited: last re-check immediately before the write.
            if (isStageWriteStale(stageId, capturedEpoch)) {
              dropped = true;
              return;
            }
            await store.saveDocument(
              documentSnapshot(
                stageId,
                { ...data, scenes: persistedScenes },
                existing?.outline as AppDocumentOutline | undefined,
                now,
              ),
            );
          };

          // The incremental fast path is deliberately homogeneous. Combining
          // scene and stage writes would span separate requests/transactions,
          // exposing a torn document to concurrent readers. Structure and
          // outline already require the aggregate contract, and any batch with
          // more than one document category follows that same atomic path.
          if (!existing || has('structure') || has('outline') || documentCategories.size > 1) {
            await fullSave();
            return;
          }

          try {
            if (dirtySceneIds.size > 0) {
              const dirtyScenes = data.scenes.filter((scene) => dirtySceneIds.has(scene.id));
              // Preparation synchronizes and strips each PBL scene independently;
              // it has no sibling-scene dependency, so the hot path stays local.
              const persistedScenes = await preparePBLScenesForDocumentPersistence(
                stageId,
                dirtyScenes,
              );
              for (const scene of persistedScenes) {
                const index = data.scenes.findIndex((candidate) => candidate.id === scene.id);
                // Preparation and prior iterations awaited: re-check before
                // each row write (lock-free environments have no lock to win).
                if (isStageWriteStale(stageId, capturedEpoch)) {
                  dropped = true;
                  return;
                }
                await store.putScene(stageId, stampScene(stageId, scene, index, now));
              }
            }
            if (has('stage')) {
              if (isStageWriteStale(stageId, capturedEpoch)) {
                dropped = true;
                return;
              }
              await store.putStage(stageId, stampStage(stageId, data.stage, now));
            }
          } catch (error) {
            // Incremental APIs reject pre-versioned destinations. The aggregate
            // save migrates/stamps the whole document coherently.
            if (error instanceof DocumentVersionError && error.kind === 'not-current') {
              await fullSave();
              return;
            }
            throw error;
          }
        });
      },
      { storageSharedLockHeld: true },
    );
  }

  // A document-write drop fences the whole flush: once a deletion turned this
  // capture stale, staleness is permanent (the epoch never rewinds), so the
  // tail must not even be attempted.
  if (dropped) {
    log.info(`Dropped incremental save mid-write for deleted/stale stage: ${stageId}`);
    return 'stale-dropped';
  }
  // Tail writes live outside the document mutation. A delete that won the
  // race above (dropping the document write) must also fence the
  // currentScene KV row and the chat sessions, or this same flush would
  // resurrect rows the deletion cascade just cleared — mirroring the
  // aggregate path, which keeps both inside the guarded callback. Each tail
  // write re-checks independently: a delete can land while the previous tail
  // write is awaiting (there is no lock spanning the tail).
  if (isStageWriteStale(stageId, capturedEpoch)) {
    log.info(`Dropping incremental save tail for deleted/stale stage: ${stageId}`);
    return 'stale-dropped';
  }
  if (has('currentScene')) await saveCurrentScene(stageId, data.currentSceneId);
  // `saveCurrentScene` awaited: re-check immediately before the chat write.
  if (isStageWriteStale(stageId, capturedEpoch)) {
    log.info(`Dropping incremental chat tail for deleted/stale stage: ${stageId}`);
    return 'stale-dropped';
  }
  const failedChanges: PendingChange[] = [];
  if (has('chats') && !(await saveStageChats(stageId, data))) {
    failedChanges.push({ kind: 'chats' });
  }
  return { failedChanges };
}

/**
 * Load stage data from IndexedDB
 */
export async function loadStageData(stageId: string, userId?: string): Promise<StageStoreData | null> {
  try {
    // Try loading from Cloud first (backend MongoDB)
    try {
      const cloudStage = await loadFromCloud<Stage & { currentSceneId?: string }>(STAGES_COLLECTION, stageId);
      if (cloudStage) {
        const effectiveUserId = (cloudStage as any).userId || userId;
        if (effectiveUserId) {
          const allScenes = await queryFromCloud<Scene>(SCENES_COLLECTION, effectiveUserId, 'order');
          const scenes = allScenes.filter(s => s.stageId === stageId);
          const { loadChatSessionsWithUserId } = await import('./chat-storage');
          const chats = await loadChatSessionsWithUserId(stageId, effectiveUserId);
          log.info(`Loaded stage from Cloud: ${stageId}, scenes: ${scenes.length}, chats: ${chats.length}`);
          return {
            stage: cloudStage,
            scenes,
            currentSceneId: cloudStage.currentSceneId || scenes[0]?.id || null,
            chats,
            chatSnapshot: { sessions: chats, restoreMarker: undefined },
          };
        }
      }
    } catch (cloudErr) {
      log.warn(`Could not load stage ${stageId} from Cloud, falling back to local:`, cloudErr);
    }

    const access = await accessDocument(stageId);
    const document = access.document;
    if (!document) {
      log.info(`Stage not found: ${stageId}`);      return null;
    }
    const currentScene = await loadCurrentScene(stageId);

    // Chat runtime data lives in a separate IndexedDB database. Keep the
    // document available when that independent store is temporarily
    // unavailable; a later chat load/save can recover without treating the
    // already-loaded stage as missing.
    let chats: ChatSession[] = [];
    let chatSnapshot: ChatStorageSnapshot = { sessions: [], restoreMarker: undefined };
    try {
      chats = await loadChatSessions(stageId, {
        onSnapshot: (snapshot) => {
          chatSnapshot = snapshot;
        },
      });
    } catch (error) {
      log.warn(`Failed to load chat sessions for stage ${stageId}:`, error);
    }

    log.info(`Loaded stage: ${stageId}, scenes: ${document.scenes.length}, chats: ${chats.length}`);

    // Deliberate defense-in-depth: persisted cursors can outlive scene deletion
    // or come from legacy storage, so never expose one absent from the document.
    const storedCursor = currentScene?.sceneId ?? access.legacyCurrentSceneId;
    const currentSceneId =
      storedCursor && document.scenes.some((scene) => scene.id === storedCursor)
        ? storedCursor
        : (document.scenes[0]?.id ?? null);
    return {
      stage: document.stage,
      scenes: document.scenes,
      currentSceneId,
      chats,
      chatSnapshot,
      outline: document.outline as AppDocumentOutline | undefined,
    };
  } catch (error) {
    log.error('Failed to load stage:', error);
    // Corrupt or future-versioned destinations must never masquerade as missing.    throw error;
  }
}

/**
/**
 * In-flight deletions, keyed by stage id. `deleteStageData` is single-flight
 * per stage: a concurrent second call joins the first cascade instead of
 * starting an overlapping one, so begin/settle pairs for one stage never
 * interleave and a settling cascade cannot expose another one's keep-window
 * (the warm-ghost retention in `loadFromStorage`) as already settled.
 */
const inFlightStageDeletions = new Map<string, Promise<void>>();

/**
 * Delete stage and all related data from Cloud and DocumentStore.
 */
export async function deleteStageData(stageId: string, userId?: string): Promise<void> {
  if (userId) {
    try {
      await deleteFromCloud(STAGES_COLLECTION, stageId);
      const allScenes = await queryFromCloud<Scene>(SCENES_COLLECTION, userId);
      const stageScenes = allScenes.filter(s => s.stageId === stageId);
      for (const scene of stageScenes) {
        await deleteFromCloud(SCENES_COLLECTION, scene.id);
      }
      await deleteChatSessions(stageId, userId);
      await clearPlaybackState(stageId);
      await deleteStageOutlines(stageId);
      const agents = await queryFromCloud<any>(GENERATED_AGENTS_COLLECTION, userId);
      const stageAgents = agents.filter(a => a.stageId === stageId);
      for (const agent of stageAgents) {
        await deleteFromCloud(GENERATED_AGENTS_COLLECTION, agent.id);
      }
      log.info(`Deleted stage from Cloud: ${stageId}`);
    } catch (error) {
      log.error('Failed to delete stage from Cloud:', error);
    }
  }

  const existing = inFlightStageDeletions.get(stageId);
  if (!existing) return runSingleFlightStageDeletion(stageId);
  return existing.then(() => {
    if (isStageDeleted(stageId)) return;
    return runSingleFlightStageDeletion(stageId);
  });
}

export async function listStages(userId?: string): Promise<StageListItem[]> {
  try {
    if (userId) {
      const stages = await queryFromCloud<any>(STAGES_COLLECTION, userId, 'updatedAt', 'desc');
      const allScenes = await queryFromCloud<Scene>(SCENES_COLLECTION, userId);

      return stages.map((stage) => {
        const sceneCount = allScenes.filter(s => s.stageId === stage.id).length;
        return {
          id: stage.id,
          name: stage.name,
          description: stage.description,
          sceneCount,
          createdAt: stage.createdAt,
          updatedAt: stage.updatedAt,
        };
      }).sort((a, b) => b.updatedAt - a.updatedAt);
    }

    const res = await fetch('/api/stages', { credentials: 'include' });
    if (!res.ok) {
      throw new Error(`Failed to list owner stages: HTTP ${res.status}`);
    }
    const body = (await res.json().catch(() => null)) as { stages?: unknown } | null;
    if (!body || !Array.isArray(body.stages)) {
      throw new Error('Malformed /api/stages response: expected { stages: [...] }');
    }
    return (body.stages as DocumentSummary[])
      .map((item) => {
        const base: StageListItem = {
          id: item.id,
          name: item.name,
          sceneCount: item.sceneCount,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
          ...(item.description !== undefined ? { description: item.description } : {}),
          ...(item.interactiveMode !== undefined ? { interactiveMode: item.interactiveMode } : {}),
          ...(item.taskEngineMode !== undefined ? { taskEngineMode: item.taskEngineMode } : {}),        };
        return item.folderId ? { ...base, folderId: item.folderId } : base;
      })
      .sort((a, b) => b.updatedAt - a.updatedAt);
  } catch (error) {
    log.error('Failed to list stages:', error);
    if (userId) return [];
    throw error;  }
}

/**
 * Get first slide scene's canvas data for each stage (for thumbnail preview).
 * Also resolves generated image/video refs from mediaFiles so thumbnails show real media.
 * Returns a map of stageId -> Slide (canvas data with resolved media)
 */
type ThumbnailMediaElement = {
  id: string;
  type: string;
  src?: string;
  mediaRef?: string;
  poster?: string;
};

type ThumbnailSlide = import('@openmaic/dsl').Slide;

function isResolvableThumbnailMediaRef(value: unknown): value is string {
  return typeof value === 'string' && !!value && !isConcreteMediaAddress(value);
}

function getThumbnailMediaRef(element: ThumbnailMediaElement): string | undefined {
  if (element.type === 'image' && isResolvableThumbnailMediaRef(element.src)) {
    return element.src;
  }
  return undefined;
}

function getMediaRecordElementId(recordId: string): string {
  return recordId.includes(':') ? recordId.split(':').slice(1).join(':') : recordId;
}

function blobWithType(blob: Blob, mimeType: string): Blob {
  return blob.type ? blob : new Blob([blob], { type: mimeType });
}

export async function resolveThumbnailMediaValue(
  ref: string,
  task: MediaTaskState | undefined,
  storedBlob: Blob | undefined,
  mimeType: string,
  mediaGenerationDisabled = false,
): Promise<string | undefined> {
  if (isConcreteMediaAddress(ref)) {
    return renderableMediaUrl(resolveMediaRef(ref, undefined, MISSING_ASSET_LEASE));
  }
  let blob: Blob | undefined;
  try {
    // A generation placeholder is not a pool id: leasing it is a guaranteed
    // miss, and a thumbnail grid asks once per slide per load.
    blob = mayNameAPoolAsset(ref)
      ? await withAssetUrl(ref, async (url) => {
          if (!url) return undefined;
          const response = await fetch(url);
          const fetched = response.ok ? await response.blob() : undefined;
          // Zero-byte pool answers are not usable bytes: fall back to the
          // stored row (or no thumbnail) rather than minting an empty image.
          return fetched && fetched.size > 0 ? fetched : undefined;
        })
      : undefined;
  } catch {
    // Pool access is optional for the home-page compatibility thumbnail.
  }
  blob ??= storedBlob && storedBlob.size > 0 ? blobWithType(storedBlob, mimeType) : undefined;
  if (blob) {
    const url = URL.createObjectURL(blobWithType(blob, mimeType));
    return renderableMediaUrl(
      resolveMediaRef(ref, task, { status: 'resolved', url }, mediaGenerationDisabled),
    );
  }
  return renderableMediaUrl(
    resolveMediaRef(ref, task, MISSING_ASSET_LEASE, mediaGenerationDisabled),
  );
}

function revokeObjectUrl(url: string | undefined) {
  if (url?.startsWith('blob:')) {
    URL.revokeObjectURL(url);
  }
}

export function revokeThumbnailSlideMediaUrls(slides: Record<string, ThumbnailSlide>) {
  for (const slide of Object.values(slides)) {
    for (const slot of slideMediaReferenceSlots(slide)) {
      if (slot.kind !== 'video-media-ref') revokeObjectUrl(slot.read());
    }
  }
}

/**
 * Get first slide scene's canvas data for each stage (for thumbnail preview).
 * Also resolves generated image/video refs from mediaFiles so thumbnails show real media.
 * Returns a map of stageId -> Slide (canvas data with resolved media)
 */
export async function getFirstSlideByStages(
  stageIds: string[],
  userId?: string,
): Promise<Record<string, ThumbnailSlide>> {
  if (userId) {
    const result: Record<string, ThumbnailSlide> = {};
    try {
      const allScenes = await queryFromCloud<Scene>(SCENES_COLLECTION, userId, 'order');
      for (const stageId of stageIds) {
        const scenes = allScenes.filter(s => s.stageId === stageId);
        const firstSlide = scenes.find((s) => s.content?.type === 'slide');
        if (firstSlide && firstSlide.content.type === 'slide') {
          result[stageId] = firstSlide.content.canvas;
        }
      }
      return result;
    } catch (error) {
      log.error('Failed to load thumbnails from Cloud:', error);
      return result;
    }
  }

  const result: Record<string, ThumbnailSlide> = {};
  try {
    await Promise.all(
      stageIds.map(async (stageId) => {
        const document = (await accessDocument(stageId)).document;
        const firstSlide = document?.scenes.find((s) => s.content?.type === 'slide');
        if (firstSlide && firstSlide.content.type === 'slide') {
          const slide = structuredClone(firstSlide.content.canvas);

          const mediaSlots = [...slideMediaReferenceSlots(slide)];
          const mediaElements = new Set<ThumbnailMediaElement>();
          for (const slot of mediaSlots) {
            if (
              slot.element &&
              (slot.element.type === 'video' ||
                !!getThumbnailMediaRef(slot.element as ThumbnailMediaElement))
            ) {
              mediaElements.add(slot.element as ThumbnailMediaElement);
            }
          }
          const backgroundSlot = mediaSlots.find((slot) => slot.kind === 'background-image');
          const backgroundRef = backgroundSlot?.read();
          if (
            mediaElements.size > 0 ||
            (backgroundRef && isResolvableThumbnailMediaRef(backgroundRef))
          ) {
            const settings = useSettingsStore.getState();
            const mediaRecords = await db.mediaFiles.where('stageId').equals(stageId).toArray();
            const mediaMap = new Map(
              mediaRecords.map((record) => [getMediaRecordElementId(record.id), record] as const),
            );
            type ThumbnailTaskEntry = MediaTaskLookupEntry & {
              readonly record: (typeof mediaRecords)[number];
            };
            const taskEntries = Object.fromEntries(
              mediaRecords.map((record) => [
                getMediaRecordElementId(record.id),
                {
                  stageId: record.stageId,
                  type: record.type,
                  status: record.error ? 'failed' : 'done',
                  placeholderRef: record.placeholderRef,
                  poster: record.poster ? `${record.id}:poster` : undefined,
                  record,
                } satisfies ThumbnailTaskEntry,
              ]),
            );
            const documentElements = collectDocumentMediaElements(
              document?.stage,
              document?.scenes ?? [],
            );

            if (backgroundSlot && backgroundRef && isResolvableThumbnailMediaRef(backgroundRef)) {
              const selectedRecord = mediaMap.get(backgroundRef);
              const task = selectedRecord?.error
                ? ({
                    status: 'failed',
                    errorCode: selectedRecord.errorCode,
                    retryCount: 0,
                  } satisfies MediaTaskState)
                : undefined;
              const record = selectedRecord && !selectedRecord.error ? selectedRecord : undefined;
              backgroundSlot.write(
                (await resolveThumbnailMediaValue(
                  backgroundRef,
                  task,
                  record?.type === 'image' ? record.blob : undefined,
                  record?.mimeType || 'image/png',
                  !settings.imageGenerationEnabled,
                )) ?? '',
              );
            }

            for (const el of mediaElements) {
              const videoBinding =
                el.type === 'video'
                  ? resolveVideoMediaForElement(
                      taskEntries,
                      el as import('@openmaic/dsl').PPTVideoElement,
                      stageId,
                      documentElements,
                    )
                  : undefined;
              const mediaRef = videoBinding?.sourceRef ?? getThumbnailMediaRef(el);
              if (!mediaRef) continue;
              const selected =
                el.type === 'video'
                  ? (videoBinding?.task as ThumbnailTaskEntry | undefined)
                  : resolveMediaTaskForElement(
                      taskEntries,
                      el as import('@openmaic/dsl').PPTElement,
                      stageId,
                    );
              const selectedRecord = selected?.record;
              const task = selectedRecord?.error
                ? ({
                    status: 'failed',
                    errorCode: selectedRecord.errorCode,
                    retryCount: 0,
                  } satisfies MediaTaskState)
                : undefined;
              const record = selectedRecord && !selectedRecord.error ? selectedRecord : undefined;

              if (el.type === 'image') {
                el.src =
                  (await resolveThumbnailMediaValue(
                    mediaRef,
                    task,
                    record?.type === 'image' ? record.blob : undefined,
                    record?.mimeType || 'image/png',
                    !settings.imageGenerationEnabled,
                  )) ?? '';
              } else if (el.type === 'video') {
                el.src =
                  (await resolveThumbnailMediaValue(
                    mediaRef,
                    task,
                    record?.type === 'video' ? record.blob : undefined,
                    record?.mimeType || 'video/mp4',
                    !settings.videoGenerationEnabled,
                  )) ?? '';
                const posterRef = videoBinding?.posterRef;
                const posterRecord =
                  posterRef && isResolvableThumbnailMediaRef(posterRef)
                    ? mediaMap.get(posterRef)
                    : undefined;
                const posterBlob =
                  posterRecord && !posterRecord.error && posterRecord.type === 'image'
                    ? blobWithType(posterRecord.blob, posterRecord.mimeType)
                    : record?.poster
                      ? blobWithType(record.poster, 'image/jpeg')
                      : undefined;
                if (posterRef) {
                  const posterTask = posterRecord?.error
                    ? ({
                        status: 'failed',
                        errorCode: posterRecord.errorCode,
                        retryCount: 0,
                      } satisfies MediaTaskState)
                    : undefined;
                  el.poster = await resolveThumbnailMediaValue(
                    posterRef,
                    posterTask,
                    posterBlob,
                    posterRecord?.mimeType || 'image/jpeg',
                  );
                } else if (posterBlob) {
                  el.poster = URL.createObjectURL(posterBlob);
                }
              }
            }
          }

          result[stageId] = slide;
        }
      }),
    );  } catch (error) {
    log.error('Failed to load thumbnails from Cloud:', error);
  }
  return result;
}

/**
 * Rename a stage (updates only the name field in IndexedDB)
 */
export async function renameStage(stageId: string, newName: string): Promise<void> {
  try {
    await mutateDocument(stageId, async (document, store) => {
      if (!document) throw new Error(`Stage not found: ${stageId}`);
      await store.putStage(stageId, { ...document.stage, name: newName, updatedAt: Date.now() });
    });
    log.info(`Renamed stage ${stageId} to "${newName}"`);
  } catch (error) {
    log.error('Failed to rename stage:', error);
    throw error;
  }
}

/**
 * Check if stage exists
 */
export async function stageExists(stageId: string, userId?: string): Promise<boolean> {
  try {
    if (userId) {
      const stage = await loadFromCloud(STAGES_COLLECTION, stageId);
      if (stage) return true;
    }
    return (await getDocumentStore().loadDocument(stageId)) !== null;  } catch (error) {
    log.error('Failed to check stage existence in Cloud:', error);
    return false;
  }
}
/**
 * Save stage outlines to Cloud
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
 * Load stage outlines from Cloud
 */
export async function loadStageOutlines(
  stageId: string
): Promise<import('../types/generation').SceneOutline[] | null> {
  const data = await loadFromCloud<any>(STAGE_OUTLINES_COLLECTION, stageId);
  return data?.outlines || null;
}

/**
 * Delete stage outlines from Cloud
 */
export async function deleteStageOutlines(stageId: string): Promise<void> {
  await deleteFromCloud(STAGE_OUTLINES_COLLECTION, stageId);
}

// ==================== Course Folders ====================}
