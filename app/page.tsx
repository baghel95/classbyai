'use client';

import { useState, useEffect, useMemo, useRef, useDeferredValue } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { useSession } from 'next-auth/react';
import {
  ArrowUp,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  Folder,
  FolderPlus,
  ImagePlus,
  Pencil,
  Trash2,
  Search,
  Settings,
  Sun,
  Moon,
  Monitor,
  ChevronUp,
  Upload,
  Sparkles,
  Atom,
  X,
  Presentation,
  Loader2,
} from 'lucide-react';
import { useI18n } from '@/lib/hooks/use-i18n';
import { LanguageSwitcher } from '@/components/language-switcher';
import { createLogger } from '@/lib/logger';
import { Button } from '@/components/ui/button';
import { InputGroup, InputGroupInput, InputGroupButton } from '@/components/ui/input-group';
import { Textarea as UITextarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { SettingsDialog } from '@/components/settings';
import { GenerationToolbar } from '@/components/generation/generation-toolbar';
import { AgentBar } from '@/components/agent/agent-bar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useTheme } from '@/lib/hooks/use-theme';
import { nanoid } from 'nanoid';
import { deleteDocumentBlob, storeDocumentBlob } from '@/lib/utils/image-storage';
import { normalizeDocumentMimeType } from '@/lib/document/mime';
import {
  courseMaterialFingerprint,
  dedupeCourseMaterialFiles,
} from '@/lib/document/course-materials';
import type {
  SelectedCourseMaterial,
  SessionDocumentSource,
  UserRequirements,
} from '@/lib/types/generation';
import { useSettingsStore } from '@/lib/store/settings';
import { hasUsableLLMProvider } from '@/lib/store/settings-validation';
import { useUserProfileStore, AVATAR_OPTIONS } from '@/lib/store/user-profile';
import {
  StageListItem,
  listStages,
  deleteStageData,
  renameStage,
  getFirstSlideByStages,
  revokeThumbnailSlideMediaUrls,
  listFolders,
  createFolder,
  renameFolder,
  deleteFolder,
  setStageFolder,
  FolderNameError,
  LIBRARY_CHANGED_EVENT,
  type DeleteFolderMode,
} from '@/lib/utils/stage-storage';
import type { FolderRecord } from '@/lib/types/folder';
import { displayNameWidth, FOLDER_NAME_MAX_WIDTH } from '@/lib/utils/folder-name-validation';
import { FolderCard } from '@/components/discovery/folder-card';
import { NewFolderDialog } from '@/components/discovery/folder-dialogs';
import { MoveToFolderMenu } from '@/components/discovery/move-to-folder-menu';
import { SlideThumbnail } from '@/components/slide-renderer/SlideThumbnail';
import type { Slide } from '@openmaic/dsl';
import { useMediaGenerationStore } from '@/lib/store/media-generation';
import { useOnboardingStore } from '@/lib/store/onboarding';
import { toast } from 'sonner';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useDraftCache } from '@/lib/hooks/use-draft-cache';
import { SpeechButton } from '@/components/audio/speech-button';
import { FeaturesSection } from '@/components/landing/features-section';
import { UseCasesSection } from '@/components/landing/use-cases-section';
import { Header } from '@/components/landing/header';
import { Footer } from '@/components/landing/footer';
import { useImportClassroom } from '@/lib/import/use-import-classroom';
import {
  isProWorkbenchEnabled,
  isPptxImportEnabled,
  shouldShowVocationalTestUi,
} from '@/lib/config/feature-flags';
import { useImportPptx } from '@/lib/import/use-import-pptx';
import { InteractiveModeButton } from '@/components/generation/interactive-mode-button';
import { ProBadge } from '@/components/workbench/ProBadge';
import { arrivedByProSwap, startProSwap } from '@/lib/workbench/pro-swap';
import {
  readLastWorkspaceSessionId,
  workspaceResumeHref,
} from '@/lib/workbench/workspace-session-memory';

const log = createLogger('Home');

const RECENT_OPEN_STORAGE_KEY = 'recentClassroomsOpen';
const INTERACTIVE_MODE_STORAGE_KEY = 'interactiveModeEnabled';

const PPTX_IMPORT_ENABLED = isPptxImportEnabled();

let workbenchRuntimeCache: boolean | null = null;

interface FormState {
  courseMaterials: SelectedCourseMaterial[];
  requirement: string;
  language: 'en-US' | 'hi-IN' | 'en-IN' | 'zh-CN';
  interactiveMode: boolean;
  vocationalTestMode: boolean;
  webSearch: boolean;
}

const initialFormState: FormState = {
  courseMaterials: [],
  requirement: '',
  language: 'en-US',
  interactiveMode: false,
  vocationalTestMode: false,
  webSearch: false,
};

function HomePage() {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();

  const [swapped] = useState(arrivedByProSwap);
  const heroEnter = (from: Record<string, number>) => (swapped ? false : from);
  const showVocationalTestUi = shouldShowVocationalTestUi();
  const workbenchBuildEnabled = isProWorkbenchEnabled();
  const [workbenchRuntimeEnabled, setWorkbenchRuntimeEnabled] = useState(
    workbenchRuntimeCache === true,
  );

  useEffect(() => {
    if (!workbenchBuildEnabled || workbenchRuntimeCache !== null) return;
    let cancelled = false;
    fetch('/api/agent/runtime')
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => {
        workbenchRuntimeCache = body?.enabled === true;
        if (!cancelled) setWorkbenchRuntimeEnabled(workbenchRuntimeCache);
      })
      .catch(() => {
        /* probe failed */
      });
    return () => {
      cancelled = true;
    };
  }, [workbenchBuildEnabled]);

  const workbenchEntryEnabled = workbenchBuildEnabled && workbenchRuntimeEnabled;
  const enterWorkbench = () => {
    const href = workspaceResumeHref(readLastWorkspaceSessionId());
    startProSwap(href, (next) => router.push(next));
  };

  useEffect(() => {
    if (workbenchEntryEnabled) router.prefetch('/workspace');
  }, [router, workbenchEntryEnabled]);

  const [form, setForm] = useState<FormState>(initialFormState);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState<
    import('@/lib/types/settings').SettingsSection | undefined
  >(undefined);

  const generateRef = useRef<HTMLDivElement>(null);
  const scrollToGenerate = () => {
    generateRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const { cachedValue: cachedRequirement, updateCache: updateRequirementCache } =
    useDraftCache<string>({ key: 'requirementDraft' });

  const providersConfig = useSettingsStore((s) => s.providersConfig);
  const hasUsableProvider = hasUsableLLMProvider(providersConfig);
  const [storeHydrated, setStoreHydrated] = useState(false);

  const [recentOpen, setRecentOpen] = useState(true);
  const persistRecentOpen = (next: boolean) => {
    setRecentOpen(next);
    try {
      localStorage.setItem(RECENT_OPEN_STORAGE_KEY, String(next));
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    setStoreHydrated(true);
    try {
      const saved = localStorage.getItem(RECENT_OPEN_STORAGE_KEY);
      if (saved !== null) setRecentOpen(saved !== 'false');
    } catch {
      /* ignore */
    }
    try {
      const savedInteractiveMode = localStorage.getItem(INTERACTIVE_MODE_STORAGE_KEY);
      if (savedInteractiveMode === 'true') {
        setForm((prev) => ({ ...prev, interactiveMode: true }));
      }
    } catch {
      /* ignore */
    }
  }, []);

  const draftRestoredRef = useRef(false);
  useEffect(() => {
    if (draftRestoredRef.current) return;
    if (!cachedRequirement) return;
    draftRestoredRef.current = true;
    setForm((prev) => (prev.requirement ? prev : { ...prev, requirement: cachedRequirement }));
  }, [cachedRequirement]);

  // Auto-trigger generation if coming back from login
  const action = searchParams.get('action');
  useEffect(() => {
    const effectiveRequirement = form.requirement || cachedRequirement;
    if (storeHydrated && session && action === 'generate' && effectiveRequirement) {
      if (!form.requirement && cachedRequirement) {
        setForm((prev) => ({ ...prev, requirement: cachedRequirement }));
        return;
      }
      const newParams = new URLSearchParams(searchParams.toString());
      newParams.delete('action');
      newParams.delete('prompt');
      newParams.delete('callbackUrl');
      router.replace(`/?${newParams.toString()}`);
      handleGenerate();
    }
  }, [storeHydrated, session, action, form.requirement, cachedRequirement]);

  const [error, setError] = useState<string | null>(null);
  const [preparingGenerate, setPreparingGenerate] = useState(false);
  const [classrooms, setClassrooms] = useState<StageListItem[]>([]);
  const [thumbnails, setThumbnails] = useState<Record<string, Slide>>({});
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [folders, setFolders] = useState<FolderRecord[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [currentFolderId, setCurrentFolderId] = useState<string | undefined>(undefined);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [createAndMoveTarget, setCreateAndMoveTarget] = useState<string | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchButtonRef = useRef<HTMLButtonElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const thumbnailsRef = useRef<Record<string, Slide>>({});

  const replaceThumbnails = (slides: Record<string, Slide>) => {
    const previous = thumbnailsRef.current;
    thumbnailsRef.current = slides;
    setThumbnails(slides);
    window.setTimeout(() => revokeThumbnailSlideMediaUrls(previous), 0);
  };

  const loadClassrooms = async (targetUserId?: string) => {
    try {
      const uid = targetUserId || session?.user?.id;
      const list = await listStages(uid);
      setClassrooms(list);
      if (list.length > 0) {
        const slides = await getFirstSlideByStages(list.map((c) => c.id), uid);
        replaceThumbnails(slides);
      } else {
        replaceThumbnails({});
      }
    } catch (err) {
      log.error('Failed to load classrooms:', err);
      toast.error('Persistence is unavailable. Saved classrooms could not be loaded.');
    }
  };

  const loadFolders = async () => {
    try {
      setFolders(await listFolders());
    } catch (err) {
      log.error('Failed to load folders:', err);
    }
  };

  const importFolderRef = useRef<string | undefined>(undefined);
  const handleImportSuccess = async (importedStageId: string) => {
    const folderId = importFolderRef.current;
    importFolderRef.current = undefined;
    if (folderId) {
      try {
        await setStageFolder(importedStageId, folderId);
      } catch (err) {
        log.error('Failed to assign imported course to folder:', err);
        toast.error(t('classroom.moveFailed'));
      }
    }
    await loadClassrooms();
  };

  const { importing, fileInputRef, triggerFileSelect, handleFileChange } =
    useImportClassroom(handleImportSuccess);
  const triggerImport = () => {
    importFolderRef.current = currentFolderId;
    triggerFileSelect();
  };

  const {
    importing: pptxImporting,
    fileInputRef: pptxFileInputRef,
    triggerFileSelect: triggerPptxFileSelect,
    handleFileChange: handlePptxFileChange,
  } = useImportPptx();

  useEffect(() => {
    useMediaGenerationStore.getState().revokeObjectUrls();
    useMediaGenerationStore.setState({ tasks: {} });
    void Promise.all([loadClassrooms(session?.user?.id), loadFolders()]).finally(() => setHydrated(true));

    const onLibraryChanged = () => {
      void Promise.all([loadClassrooms(session?.user?.id), loadFolders()]);
    };
    window.addEventListener(LIBRARY_CHANGED_EVENT, onLibraryChanged);

    return () => {
      window.removeEventListener(LIBRARY_CHANGED_EVENT, onLibraryChanged);
      revokeThumbnailSlideMediaUrls(thumbnailsRef.current);
      thumbnailsRef.current = {};
    };
  }, [session?.user?.id]);

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setPendingDeleteId(id);
  };

  const confirmDelete = async (id: string) => {
    if (!session?.user?.id) return;
    setPendingDeleteId(null);
    try {
      await deleteStageData(id, session.user.id);
      await loadClassrooms(session.user.id);
    } catch (err) {
      log.error('Failed to delete classroom:', err);
      toast.error('Failed to delete classroom');
    }
  };

  const handleRename = async (id: string, newName: string) => {
    try {
      await renameStage(id, newName);
      setClassrooms((prev) => prev.map((c) => (c.id === id ? { ...c, name: newName } : c)));
    } catch (err) {
      log.error('Failed to rename classroom:', err);
      toast.error(t('classroom.renameFailed'));
    }
  };

  const handleCreateFolder = async (name: string) => {
    const folder = await createFolder(name);
    setFolders((prev) => [...prev, folder]);
    if (createAndMoveTarget) {
      await handleMoveCourse(createAndMoveTarget, folder.id);
      setCreateAndMoveTarget(null);
    }
  };

  const handleRenameFolder =
    (folder: FolderRecord) =>
    async (newName: string): Promise<string | null> => {
      // Empty or unchanged input just exits editing without an error.
      const trimmed = newName.trim();
      if (!trimmed || trimmed === folder.name) return null;
      try {
        await renameFolder(folder.id, newName);
        setFolders((prev) => prev.map((f) => (f.id === folder.id ? { ...f, name: trimmed } : f)));
        return null;
      } catch (err) {
        if (err instanceof FolderNameError) {
          if (err.kind === 'duplicate') return t('classroom.folderNameExists');
          if (err.kind === 'tooLong')
            return t('classroom.folderWidth', {
              width: displayNameWidth(trimmed),
              max: FOLDER_NAME_MAX_WIDTH,
            });
          return t('classroom.folderNameHint');
        }
        log.error('Failed to rename folder:', err);
        return t('classroom.folderRenameFailed');
      }
    };

  const confirmDeleteFolder = async (folder: FolderRecord, mode: DeleteFolderMode) => {
    try {
      await deleteFolder(folder.id, mode);
      if (currentFolderId === folder.id) setCurrentFolderId(undefined);
    } catch (err) {
      log.error('Failed to delete folder:', err);
      toast.error(t('classroom.folderDeleteFailed'));
    } finally {
      await Promise.all([loadFolders(), loadClassrooms()]);
    }
  };

  const handleMoveCourse = async (stageId: string, targetFolderId?: string) => {
    try {
      await setStageFolder(stageId, targetFolderId);
      setClassrooms((prev) =>
        prev.map((c) => (c.id === stageId ? { ...c, folderId: targetFolderId } : c)),
      );
    } catch (err) {
      log.error('Failed to move course:', err);
      toast.error(t('classroom.moveFailed'));
    }
  };

  const handleCreateAndMove = (stageId: string) => () => {
    setCreateAndMoveTarget(stageId);
    setNewFolderOpen(true);
  };

  const courseCountByFolder = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of classrooms) {
      if (c.folderId) {
        map.set(c.folderId, (map.get(c.folderId) ?? 0) + 1);
      }
    }
    return map;
  }, [classrooms]);

  const coverSlidesByFolder = useMemo(() => {
    const byFolder = new Map<string, Slide[]>();
    for (const c of [...classrooms].sort((a, b) => b.updatedAt - a.updatedAt)) {
      if (!c.folderId) continue;
      const slide = thumbnails[c.id];
      if (!slide) continue;
      const list = byFolder.get(c.folderId) ?? [];
      if (list.length < 3) list.push(slide);
      byFolder.set(c.folderId, list);
    }
    return byFolder;
  }, [classrooms, thumbnails]);

  const folderNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const f of folders) map.set(f.id, f.name);
    return map;
  }, [folders]);

  const isSearching = searchQuery.trim().length > 0;
  const deferredSearchQuery = useDeferredValue(searchQuery.trim().toLowerCase());

  const filteredClassrooms = useMemo(() => {
    if (!deferredSearchQuery) return classrooms;
    return classrooms.filter((c) => c.name.toLowerCase().includes(deferredSearchQuery));
  }, [classrooms, deferredSearchQuery]);

  const currentFolderClassrooms = useMemo(() => {
    if (!currentFolderId) return [];
    return classrooms.filter((c) => c.folderId === currentFolderId);
  }, [classrooms, currentFolderId]);

  const currentFolder = useMemo(
    () => folders.find((f) => f.id === currentFolderId),
    [folders, currentFolderId],
  );

  const visibleClassrooms = useMemo(() => {
    if (isSearching) return filteredClassrooms;
    if (currentFolderId !== undefined) return currentFolderClassrooms;
    return classrooms.filter((c) => !c.folderId);
  }, [isSearching, filteredClassrooms, currentFolderId, currentFolderClassrooms, classrooms]);

  const updateForm = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    try {
      if (field === 'interactiveMode')
        localStorage.setItem(INTERACTIVE_MODE_STORAGE_KEY, String(value));
      if (field === 'requirement') updateRequirementCache(value as string);
    } catch {
      /* ignore */
    }
  };

  const addCourseMaterials = (files: File[]) => {
    if (preparingGenerate) return;
    const dedupedFiles = dedupeCourseMaterialFiles(form.courseMaterials, files);
    const startOrder = form.courseMaterials.length + 1;
    const additions = dedupedFiles.map((file, index) => ({
      id: nanoid(8),
      file,
      name: file.name,
      size: file.size,
      lastModified: file.lastModified,
      type: file.type,
      order: startOrder + index,
    }));

    if (additions.length === 0) return;
    setForm((prev) => {
      const missing = additions.filter((addition) => {
        if (prev.courseMaterials.some((item) => item.id === addition.id)) return false;
        return !prev.courseMaterials.some(
          (item) => courseMaterialFingerprint(item) === courseMaterialFingerprint(addition),
        );
      });
      if (missing.length === 0) return prev;
      return { ...prev, courseMaterials: [...prev.courseMaterials, ...missing] };
    });
  };

  const removeCourseMaterial = (id: string) => {
    if (preparingGenerate) return;
    setForm((prev) => ({
      ...prev,
      courseMaterials: prev.courseMaterials
        .filter((item) => item.id !== id)
        .map((item, index) => ({ ...item, order: index + 1 })),
    }));
  };

  const handleGenerate = async () => {
    if (preparingGenerate) return;
    if (!form.requirement.trim()) {
      setError(t('upload.requirementRequired'));
      return;
    }
    if (!session) {
      toast.info('Please log in to generate an agent');
      router.push(`/login?callbackUrl=/&action=generate&prompt=${encodeURIComponent(form.requirement)}`);
      return;
    }
    setError(null);
    setPreparingGenerate(true);

    try {
      const userProfile = useUserProfileStore.getState();
      const requirements: UserRequirements = {
        requirement: form.requirement,
        language: form.language,
        userNickname: userProfile.nickname || undefined,
        userBio: userProfile.bio || undefined,
        webSearch: useSettingsStore.getState().webSearchEnabled || undefined,
        interactiveMode: form.vocationalTestMode ? true : form.interactiveMode,
        ...(form.vocationalTestMode ? { taskEngineMode: true } : {}),
      };

      const frozenMaterials = [...form.courseMaterials].sort((a, b) => a.order - b.order);
      const settingsSnapshot = useSettingsStore.getState();
      const frozenPdfProviderId = settingsSnapshot.pdfProviderId;
      const frozenPdfProviderConfig = settingsSnapshot.pdfProvidersConfig?.[
        settingsSnapshot.pdfProviderId
      ];

      let documentSources: SessionDocumentSource[] | undefined;
      let pdfProviderId: string | undefined;
      let pdfProviderConfig:
        | { apiKey?: string; baseUrl?: string; accessKeyId?: string; accessKeySecret?: string }
        | undefined;

      if (frozenMaterials.length > 0) {
        pdfProviderId = frozenPdfProviderId;
        pdfProviderConfig = frozenPdfProviderConfig;

        const storedDocumentKeys: string[] = [];
        try {
          documentSources = [];
          for (const [index, item] of frozenMaterials.entries()) {
            const storageKey = await storeDocumentBlob(item.file, session?.user?.id);
            storedDocumentKeys.push(storageKey);
            documentSources.push({
              id: item.id,
              name: item.name,
              size: item.size,
              lastModified: item.lastModified,
              mimeType: normalizeDocumentMimeType({
                mimeType: item.file.type,
                fileName: item.file.name,
              }),
              order: index + 1,
              storageKey,
              providerId: pdfProviderId,
            });
          }
        } catch (error) {
          await Promise.allSettled(storedDocumentKeys.map((key) => deleteDocumentBlob(key)));
          throw error;
        }
      }

      const sessionState = {
        sessionId: nanoid(),
        requirements,
        pdfText: '',
        pdfImages: [],
        imageStorageIds: [],
        documentSources,
        pdfStorageKey: documentSources?.[0]?.storageKey,
        pdfFileName: documentSources?.[0]?.name,
        documentMimeType: documentSources?.[0]?.mimeType,
        pdfProviderId,
        pdfProviderConfig,
        sceneOutlines: null,
        currentStep: 'generating' as const,
      };
      sessionStorage.setItem('generationSession', JSON.stringify(sessionState));
      router.push('/generation-preview');
    } catch (err) {
      log.error('Error preparing generation:', err);
      setError(err instanceof Error ? err.message : t('upload.generateFailed'));
    } finally {
      setPreparingGenerate(false);
    }
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return t('classroom.today');
    if (diffDays === 1) return t('classroom.yesterday');
    if (diffDays < 7) return `${diffDays} ${t('classroom.daysAgo')}`;
    return date.toLocaleDateString();
  };

  const canGenerate = !!form.requirement.trim() && hasUsableProvider;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      if (canGenerate) handleGenerate();
    }
  };

  return (
    <div className="relative min-h-screen w-full bg-background selection:bg-purple-100 dark:selection:bg-purple-900/40 overflow-x-hidden">
      <Header 
        onSettingsOpen={() => setSettingsOpen(true)} 
        scrollToGenerate={scrollToGenerate} 
      />

      <input
        ref={fileInputRef}
        type="file"
        accept=".zip"
        onChange={handleFileChange}
        className="hidden"
      />
      {PPTX_IMPORT_ENABLED && (
        <input
          ref={pptxFileInputRef}
          type="file"
          accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation"
          onChange={handlePptxFileChange}
          className="hidden"
        />
      )}

      <SettingsDialog
        open={settingsOpen}
        onOpenChange={(open) => {
          setSettingsOpen(open);
          if (!open) setSettingsSection(undefined);
        }}
        initialSection={settingsSection}
      />

      {/* ═══ App Section (Generation Input) ═══ */}
      <section ref={generateRef} className="relative z-20 w-full flex flex-col items-center px-4 py-24 bg-linear-to-b from-transparent to-slate-50/50 dark:to-slate-950/30">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-[850px] flex flex-col items-center"
        >
          {/* ── Marketing Hero ── */}
          <div className="relative z-10 pt-10 pb-6 px-6 flex flex-col items-center text-center">
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.1 }}
              className="text-5xl md:text-7xl font-extrabold tracking-tight mb-4 max-w-4xl"
            >
              <span className="bg-linear-to-r from-slate-900 via-purple-800 to-slate-900 dark:from-white dark:via-purple-400 dark:to-white bg-clip-text text-transparent">
                Your Immersive AI Classroom
              </span>
              <br />
              <span className="text-slate-900/40 dark:text-white/20">in Just One Click</span>
            </motion.h1>

            <motion.p
              initial={heroEnter({ opacity: 0 })}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.25 }}
              className="text-sm text-muted-foreground/60 mb-6"
            >
              {t('home.slogan')}
            </motion.p>
          </div>

          {/* ── Unified input area ── */}
          <div className="w-full relative group/input">
            <div className="absolute -inset-1 bg-linear-to-r from-purple-500/20 to-blue-500/20 rounded-[22px] blur-sm opacity-0 group-focus-within/input:opacity-100 transition duration-1000 group-hover/input:duration-200" />
            <div className="relative w-full rounded-2xl border border-white/40 dark:border-white/5 bg-white/70 dark:bg-slate-900/70 backdrop-blur-2xl shadow-2xl shadow-black/5 dark:shadow-black/20 transition-all duration-500 focus-within:ring-2 focus-within:ring-purple-500/20 overflow-hidden">
              <div className="relative z-20 flex items-start justify-between">
                <GreetingBar />
                <div className="pr-3 pt-3.5 shrink-0">
                  <AgentBar />
                </div>
              </div>

              <textarea
                ref={textareaRef}
                placeholder={t('upload.requirementPlaceholder')}
                className="w-full resize-none border-0 bg-transparent px-6 pt-2 pb-4 text-sm md:text-base leading-relaxed placeholder:text-muted-foreground/30 focus:outline-none min-h-[160px] max-h-[400px] transition-all"
                value={form.requirement}
                onChange={(e) => updateForm('requirement', e.target.value)}
                onKeyDown={handleKeyDown}
                rows={4}
              />

              <div className="px-3 pb-3 flex items-end gap-2">
                <div className="flex-1 min-w-0">
                  <GenerationToolbar
                    courseMaterials={form.courseMaterials}
                    onCourseMaterialsAdd={addCourseMaterials}
                    onCourseMaterialRemove={removeCourseMaterial}
                    onPdfError={setError}
                    materialsLocked={preparingGenerate}
                    onSettingsOpen={(section) => {
                      setSettingsSection(section);
                      setSettingsOpen(true);
                    }}
                  />
                </div>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <InteractiveModeButton
                      pressed={form.interactiveMode}
                      label={t('toolbar.interactiveModeLabel')}
                      onPressedChange={(pressed) => updateForm('interactiveMode', pressed)}
                    />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">
                    {t('toolbar.interactiveModeHint')}
                  </TooltipContent>
                </Tooltip>

                <SpeechButton
                  size="md"
                  onTranscription={(text) => {
                    setForm((prev) => {
                      const next = prev.requirement + (prev.requirement ? ' ' : '') + text;
                      updateRequirementCache(next);
                      return { ...prev, requirement: next };
                    });
                  }}
                />

                <button
                  onClick={handleGenerate}
                  disabled={!canGenerate || preparingGenerate}
                  className={cn(
                    'shrink-0 h-8 rounded-lg flex items-center justify-center gap-1.5 transition-all px-3',
                    canGenerate && !preparingGenerate
                      ? 'bg-primary text-primary-foreground hover:opacity-90 shadow-sm cursor-pointer'
                      : 'bg-muted text-muted-foreground/40 cursor-not-allowed',
                  )}
                >
                  <span className="text-xs font-medium">
                    {preparingGenerate ? t('stage.generating') : t('toolbar.enterClassroom')}
                  </span>
                  {preparingGenerate ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <ArrowUp className="size-3.5" />
                  )}
                </button>
              </div>
            </div>
          </div>

          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-3 w-full p-3 bg-destructive/10 border border-destructive/20 rounded-lg"
              >
                <p className="text-sm text-destructive">{error}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* ═══ Recent Classrooms / Folders Section ═══ */}
        <div className="w-full max-w-[1000px] mt-16 px-4">
          <div className="group w-full flex items-center gap-4 h-9">
            <div className="flex-1 h-px bg-border/40 group-hover:bg-border/70 transition-colors" />
            <div className="shrink-0 flex items-center gap-3 text-[13px] text-muted-foreground/60 select-none">
              <button
                onClick={() => {
                  if (currentFolderId) setCurrentFolderId(undefined);
                  else persistRecentOpen(!recentOpen);
                }}
                className="flex items-center gap-2 hover:text-foreground/70 transition-colors cursor-pointer"
              >
                <Clock className="size-3.5" />
                {t('classroom.recentClassrooms')}
                {currentFolder && (
                  <>
                    <ChevronRight className="size-3 opacity-40" />
                    <span className="text-foreground/80 truncate max-w-[160px]">
                      {currentFolder.name}
                    </span>
                  </>
                )}
                <span className="text-[11px] tabular-nums opacity-60">
                  {currentFolder ? currentFolderClassrooms.length : classrooms.length}
                </span>
                <motion.div
                  animate={{ rotate: recentOpen ? 180 : 0 }}
                  transition={{ duration: 0.3, ease: 'easeInOut' }}
                >
                  <ChevronDown className="size-3.5" />
                </motion.div>
              </button>

              {/* Search toggle */}
              <AnimatePresence initial={false}>
                {!searchOpen ? (
                  <motion.button
                    key="search-icon"
                    ref={searchButtonRef}
                    type="button"
                    aria-label={t('classroom.searchAriaLabel')}
                    onClick={() => {
                      setSearchOpen(true);
                      if (!recentOpen) persistRecentOpen(true);
                      requestAnimationFrame(() => searchInputRef.current?.focus());
                    }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.12, ease: 'easeOut' }}
                    className="flex items-center justify-center size-6 rounded-full text-muted-foreground/50 hover:text-foreground/70 hover:bg-muted/50 transition-colors cursor-pointer"
                  >
                    <Search className="size-3.5" />
                  </motion.button>
                ) : (
                  <motion.div
                    key="search-input"
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: 200 }}
                    exit={{ opacity: 0, width: 0 }}
                    transition={{ duration: 0.18, ease: [0.25, 0.1, 0.25, 1] }}
                    className="overflow-hidden"
                  >
                    <InputGroup
                      className={cn(
                        'h-7 text-[12px] rounded-full bg-muted/40 border-transparent shadow-none',
                        'transition-colors',
                        'hover:bg-muted/60',
                        'has-[[data-slot=input-group-control]:focus-visible]:bg-muted/60',
                        'has-[[data-slot=input-group-control]:focus-visible]:border-transparent',
                        'has-[[data-slot=input-group-control]:focus-visible]:ring-0',
                      )}
                    >
                      <InputGroupInput
                        ref={searchInputRef}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') {
                            e.preventDefault();
                            if (searchQuery) {
                              setSearchQuery('');
                            } else {
                              setSearchOpen(false);
                              requestAnimationFrame(() => searchButtonRef.current?.focus());
                            }
                          }
                        }}
                        onBlur={() => {
                          if (!searchQuery) {
                            setSearchOpen(false);
                          }
                        }}
                        placeholder={t('classroom.searchPlaceholder')}
                        aria-label={t('classroom.searchAriaLabel')}
                        className="h-7 pl-3 placeholder:text-muted-foreground/50"
                      />
                      {searchQuery && (
                        <InputGroupButton
                          size="icon-xs"
                          aria-label={t('classroom.clearSearch')}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setSearchQuery('');
                            searchInputRef.current?.focus();
                          }}
                        >
                          <X />
                        </InputGroupButton>
                      )}
                    </InputGroup>
                  </motion.div>
                )}
              </AnimatePresence>

              <button
                onClick={triggerImport}
                disabled={importing}
                className="group/import grid grid-cols-[auto_0fr] hover:grid-cols-[auto_1fr] items-center gap-1 rounded-full px-1.5 py-0.5 text-[12px] text-muted-foreground/35 hover:text-muted-foreground/70 hover:bg-muted/50 transition-all duration-200 cursor-pointer"
              >
                <Upload className="size-3" />
                <span className="overflow-hidden opacity-0 group-hover/import:opacity-100 transition-opacity duration-200 whitespace-nowrap">
                  {t('import.classroom')}
                </span>
              </button>
              {PPTX_IMPORT_ENABLED && (
                <button
                  onClick={triggerPptxFileSelect}
                  disabled={pptxImporting}
                  className="group/import-pptx grid grid-cols-[auto_0fr] hover:grid-cols-[auto_1fr] items-center gap-1 rounded-full px-1.5 py-0.5 text-[12px] text-muted-foreground/35 hover:text-muted-foreground/70 hover:bg-muted/50 transition-all duration-200 cursor-pointer"
                >
                  <Presentation className="size-3" />
                  <span className="overflow-hidden opacity-0 group-hover/import-pptx:opacity-100 transition-opacity duration-200 whitespace-nowrap">
                    {t('import.pptx')}
                  </span>
                </button>
              )}
              {/* New folder */}
              {!currentFolderId && !isSearching && (
                <button
                  type="button"
                  onClick={() => {
                    if (!recentOpen) persistRecentOpen(true);
                    setNewFolderOpen(true);
                  }}
                  aria-label={t('classroom.newFolderTitle')}
                  title={t('classroom.newFolderTitle')}
                  className="inline-flex items-center justify-center size-7 rounded-full bg-muted/40 text-muted-foreground ring-1 ring-border/50 hover:bg-muted hover:text-foreground hover:ring-border transition-[background-color,color,box-shadow] cursor-pointer"
                >
                  <FolderPlus className="size-3.5" />
                </button>
              )}
            </div>
            <div className="flex-1 h-px bg-border/40 group-hover:bg-border/70 transition-colors" />
          </div>

          {/* Expandable content */}
          <AnimatePresence>
            {recentOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
                className="w-full overflow-hidden"
              >
                {folders.length === 0 && classrooms.length === 0 ? (
                  <div className="pt-8 pb-2 text-center text-[13px] text-muted-foreground/60">
                    {t('classroom.emptyLibraryHint')}
                  </div>
                ) : !isSearching && currentFolderId && currentFolderClassrooms.length === 0 ? (
                  <div className="pt-8 text-center">
                    <p className="text-[14px] text-muted-foreground">
                      {t('classroom.emptyFolderHint')}
                    </p>
                  </div>
                ) : isSearching && filteredClassrooms.length === 0 ? (
                  <div className="pt-8 pb-2 text-center text-[13px] text-muted-foreground/60">
                    {t('classroom.searchEmpty')}
                  </div>
                ) : (
                  <div className="pt-8">
                    {isSearching && (
                      <div className="mb-4 flex items-center gap-1.5 text-[13px] text-muted-foreground">
                        <button
                          type="button"
                          onClick={() => {
                            setCurrentFolderId(undefined);
                            setSearchQuery('');
                            setSearchOpen(false);
                          }}
                          className="hover:text-foreground transition-colors"
                        >
                          {t('classroom.recentClassrooms')}
                        </button>
                        <ChevronRight className="size-3.5" />
                        <span className="text-foreground font-medium">
                          {t('classroom.searchResults')}
                        </span>
                        <span className="ml-1.5 text-[12px] text-muted-foreground tabular-nums">
                          ({filteredClassrooms.length})
                        </span>
                      </div>
                    )}

                    <AnimatePresence mode="wait">
                      <motion.div
                        key={
                          isSearching
                            ? 'search'
                            : currentFolderId
                              ? `folder-${currentFolderId}`
                              : 'root'
                        }
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.2 }}
                        className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-5 gap-y-8"
                      >
                        {!isSearching &&
                          currentFolderId === undefined &&
                          folders.map((folder, i) => (
                            <motion.div
                              key={folder.id}
                              initial={{ opacity: 0, y: 16 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: i * 0.04, duration: 0.35, ease: 'easeOut' }}
                            >
                              <FolderCard
                                folder={folder}
                                courseCount={courseCountByFolder.get(folder.id) ?? 0}
                                coverSlides={coverSlidesByFolder.get(folder.id) ?? []}
                                onOpen={() => setCurrentFolderId(folder.id)}
                                onRename={handleRenameFolder(folder)}
                                onDelete={(mode) => confirmDeleteFolder(folder, mode)}
                                onDropCourse={(stageId) => handleMoveCourse(stageId, folder.id)}
                              />
                            </motion.div>
                          ))}

                        {visibleClassrooms.map((classroom, i) => (
                          <motion.div
                            key={classroom.id}
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.04, duration: 0.35, ease: 'easeOut' }}
                          >
                            <ClassroomCard
                              classroom={classroom}
                              slide={thumbnails[classroom.id]}
                              formatDate={formatDate}
                              onDelete={handleDelete}
                              onRename={handleRename}
                              confirmingDelete={pendingDeleteId === classroom.id}
                              onConfirmDelete={() => confirmDelete(classroom.id)}
                              onCancelDelete={() => setPendingDeleteId(null)}
                              onClick={() => {
                                if (!session) {
                                  router.push(`/login?callbackUrl=/classroom/${classroom.id}`);
                                  return;
                                }
                                router.push(`/classroom/${classroom.id}`);
                              }}
                              overlay={
                                <>
                                  <MoveToFolderMenu
                                    folders={folders}
                                    currentFolderId={classroom.folderId}
                                    onMove={(folderId) => handleMoveCourse(classroom.id, folderId)}
                                    onCreateAndMove={handleCreateAndMove(classroom.id)}
                                  />
                                  {isSearching && classroom.folderId && (
                                    <span className="absolute bottom-2 left-2 z-10 inline-flex items-center gap-1 rounded-md bg-violet-500/80 px-1.5 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm pointer-events-none">
                                      <Folder className="size-2.5" />
                                      {folderNameById.get(classroom.folderId) ?? ''}
                                    </span>
                                  )}
                                </>
                              }
                            />
                          </motion.div>
                        ))}
                      </motion.div>
                    </AnimatePresence>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>

      {/* ═══ Background Decor ═══ */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-purple-500/10 dark:bg-purple-900/10 rounded-full blur-[120px] animate-blob" />
        <div className="absolute top-[10%] right-[-10%] w-[50%] h-[50%] bg-blue-500/10 dark:bg-blue-900/10 rounded-full blur-[120px] animate-blob animation-delay-2000" />
        <div className="absolute bottom-[-10%] left-[10%] w-[50%] h-[50%] bg-indigo-500/10 dark:bg-indigo-900/10 rounded-full blur-[120px] animate-blob animation-delay-4000" />
        <div className="absolute inset-0 bg-dot-pattern text-slate-900/4 dark:text-white/3" />
        <div className="absolute inset-0 bg-linear-to-b from-transparent via-white/40 to-white dark:via-slate-950/40 dark:to-slate-950" />
      </div>

      <NewFolderDialog
        open={newFolderOpen}
        onOpenChange={(open) => {
          setNewFolderOpen(open);
          if (!open) setCreateAndMoveTarget(null);
        }}
        folders={folders}
        onCreate={handleCreateFolder}
      />

      {/* ── Features & Use Cases ── */}
      <FeaturesSection />
      <UseCasesSection />
      <Footer />
    </div>
  );
}

// ─── Greeting Bar ───
const MAX_AVATAR_SIZE = 5 * 1024 * 1024;

function isCustomAvatar(src: string) {
  return src.startsWith('data:');
}

function GreetingBar() {
  const { t } = useI18n();
  const router = useRouter();
  const avatar = useUserProfileStore((s) => s.avatar);
  const nickname = useUserProfileStore((s) => s.nickname);
  const bio = useUserProfileStore((s) => s.bio);
  const setAvatar = useUserProfileStore((s) => s.setAvatar);
  const setNickname = useUserProfileStore((s) => s.setNickname);
  const setBio = useUserProfileStore((s) => s.setBio);

  const [open, setOpen] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const displayName = nickname || t('profile.defaultNickname');

  const startEditName = () => {
    setNameDraft(nickname);
    setEditingName(true);
    setTimeout(() => nameInputRef.current?.focus(), 50);
  };

  const commitName = () => {
    setNickname(nameDraft.trim());
    setEditingName(false);
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_AVATAR_SIZE) {
      toast.error(t('profile.fileTooLarge'));
      return;
    }
    if (!file.type.startsWith('image/')) {
      toast.error(t('profile.invalidFileType'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d')!;
        const scale = Math.max(128 / img.width, 128 / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        ctx.drawImage(img, (128 - w) / 2, (128 - h) / 2, w, h);
        setAvatar(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <div ref={containerRef} className="relative pl-4 pr-2 pt-3.5 pb-1 w-auto">
      <input
        ref={avatarInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleAvatarUpload}
      />

      <Popover
        open={open}
        onOpenChange={(val) => {
          setOpen(val);
          if (!val) {
            setEditingName(false);
            setAvatarPickerOpen(false);
          }
        }}
      >
        <PopoverTrigger asChild>
          <div
            className={cn(
              'flex items-center gap-2.5 cursor-pointer transition-all duration-200 group rounded-full px-2.5 py-1.5 border border-border/50 text-muted-foreground/70 hover:text-foreground hover:bg-muted/60 active:scale-[0.97]',
              open && 'bg-muted/60'
            )}
          >
            <div className="shrink-0 relative">
              <div className="size-8 rounded-full overflow-hidden ring-[1.5px] ring-border/30 group-hover:ring-violet-400/60 dark:group-hover:ring-violet-400/40 transition-all duration-300">
                <img src={avatar} alt="" className="size-full object-cover" />
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full bg-white dark:bg-slate-800 border border-border/40 flex items-center justify-center opacity-60 group-hover:opacity-100 transition-opacity">
                <Pencil className="size-[7px] text-muted-foreground/70" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="leading-none select-none flex items-center gap-1">
                    <span>
                      <span className="text-xs text-muted-foreground/60 group-hover:text-muted-foreground transition-colors">
                        {t('home.greeting')}
                      </span>
                      <span className="text-[13px] font-semibold text-foreground/85 group-hover:text-foreground transition-colors">
                        {displayName}
                      </span>
                    </span>
                    <ChevronDown className="size-3 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors shrink-0" />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom" sideOffset={4}>
                  {t('profile.editTooltip')}
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        </PopoverTrigger>
        <PopoverContent 
          align="start" 
          sideOffset={8} 
          className="w-64 p-0 border-none bg-transparent shadow-none z-50"
        >
          <AnimatePresence>
            {open && (
              <motion.div
                initial={{ opacity: 0, y: -4, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.97 }}
                transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
                className="w-64 bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm rounded-2xl p-3 shadow-xl ring-1 ring-black/[0.04] dark:ring-white/[0.06]"
              >
                {/* ── Row: avatar + name ── */}
                <div
                  className="flex items-center gap-2.5 cursor-pointer transition-all duration-200"
                  onClick={() => {
                    setOpen(false);
                    setEditingName(false);
                    setAvatarPickerOpen(false);
                  }}
                >
                  {/* Avatar */}
                  <div
                    className="shrink-0 relative cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      setAvatarPickerOpen(!avatarPickerOpen);
                    }}
                  >
                    <div className="size-8 rounded-full overflow-hidden ring-[1.5px] ring-violet-300/70 dark:ring-violet-500/40 transition-all duration-300">
                      <img src={avatar} alt="" className="size-full object-cover" />
                    </div>
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full bg-white dark:bg-slate-800 border border-border/60 flex items-center justify-center"
                    >
                      <ChevronDown
                        className={cn(
                          'size-2 text-muted-foreground/70 transition-transform duration-200',
                          avatarPickerOpen && 'rotate-180',
                        )}
                      />
                    </motion.div>
                  </div>

                  {/* Text */}
                  <div className="flex-1 min-w-0">
                    {editingName ? (
                      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <input
                          ref={nameInputRef}
                          value={nameDraft}
                          onChange={(e) => setNameDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') commitName();
                            if (e.key === 'Escape') {
                              setEditingName(false);
                            }
                          }}
                          onBlur={commitName}
                          maxLength={20}
                          placeholder={t('profile.defaultNickname')}
                          className="flex-1 min-w-0 h-6 bg-transparent border-b border-border/80 text-[13px] font-semibold text-foreground outline-none placeholder:text-muted-foreground/40"
                        />
                        <button
                          className="size-5 rounded flex items-center justify-center text-muted-foreground/70 hover:text-foreground hover:bg-muted/80 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            commitName();
                          }}
                        >
                          <Check className="size-3" />
                        </button>
                      </div>
                    ) : (
                      <div
                        className="group/name flex items-center gap-1 cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          startEditName();
                        }}
                      >
                        <span className="text-[13px] font-semibold text-foreground truncate">
                          {displayName}
                        </span>
                        <Pencil className="size-2.5 text-muted-foreground/40 opacity-0 group-hover/name:opacity-100 transition-opacity" />
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-3">
                  <AnimatePresence>
                    {avatarPickerOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden mb-2"
                      >
                        <div className="p-2 rounded-xl bg-muted/40 grid grid-cols-5 gap-1.5 justify-items-center">
                          {AVATAR_OPTIONS.map((url) => (
                            <button
                              key={url}
                              onClick={() => {
                                setAvatar(url);
                                setAvatarPickerOpen(false);
                              }}
                              className={cn(
                                'size-7 rounded-full overflow-hidden bg-gray-50 dark:bg-gray-800 cursor-pointer transition-all duration-150',
                                'hover:scale-110 active:scale-95',
                                avatar === url
                                  ? 'ring-2 ring-violet-400 dark:ring-violet-500 ring-offset-0'
                                  : 'hover:ring-1 hover:ring-muted-foreground/30',
                              )}
                            >
                              <img src={url} alt="" className="size-full" />
                            </button>
                          ))}
                          <label
                            className={cn(
                              'size-7 rounded-full flex items-center justify-center cursor-pointer transition-all duration-150 border border-dashed',
                              'hover:scale-110 active:scale-95',
                              isCustomAvatar(avatar)
                                ? 'ring-2 ring-violet-400 dark:ring-violet-500 ring-offset-0 border-violet-300 dark:border-violet-600 bg-violet-50 dark:bg-violet-900/30'
                                : 'border-muted-foreground/30 text-muted-foreground/50 hover:border-muted-foreground/50',
                            )}
                            onClick={() => avatarInputRef.current?.click()}
                            title={t('profile.uploadAvatar')}
                          >
                            <ImagePlus className="size-3" />
                          </label>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Bio */}
                  <UITextarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder={t('profile.bioPlaceholder')}
                    maxLength={200}
                    rows={2}
                    className="resize-none border-border/40 bg-transparent min-h-[72px] text-[13px]! leading-relaxed! placeholder:text-[11px]! placeholder:leading-relaxed! focus-visible:ring-1 focus-visible:ring-border/60 mb-2"
                  />

                  {/* Profile Action */}
                  <Button
                    className="w-full text-xs h-8"
                    onClick={() => {
                      useOnboardingStore.getState().setCompleted(false);
                      router.push("/onboarding");
                    }}
                  >
                    {t("onboarding.completeProfile")}
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </PopoverContent>
      </Popover>
    </div>
  );
}

// ─── Classroom Card ───
function ClassroomCard({
  classroom,
  slide,
  formatDate,
  overlay,
  onDelete,
  onRename,
  confirmingDelete,
  onConfirmDelete,
  onCancelDelete,
  onClick,
}: {
  classroom: StageListItem;
  slide?: Slide;
  formatDate: (ts: number) => string;
  overlay?: React.ReactNode;
  onDelete: (id: string, e: React.MouseEvent) => void;
  onRename: (id: string, newName: string) => void;
  confirmingDelete: boolean;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  onClick: () => void;
}) {
  const { t } = useI18n();
  const thumbRef = useRef<HTMLDivElement>(null);
  const [thumbWidth, setThumbWidth] = useState(0);
  const [editing, setEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = thumbRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setThumbWidth(Math.round(entry.contentRect.width));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (editing) nameInputRef.current?.focus();
  }, [editing]);

  const isTaskEngineMode = classroom.taskEngineMode === true;
  const showModeBadge = classroom.interactiveMode || isTaskEngineMode;
  const ModeBadgeIcon = isTaskEngineMode ? Sparkles : Atom;
  const modeBadgeLabel = isTaskEngineMode ? 'Vocational Mode' : t('toolbar.interactiveModeLabel');

  const startRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    setNameDraft(classroom.name);
    setEditing(true);
  };

  const commitRename = () => {
    if (!editing) return;
    const trimmed = nameDraft.trim();
    if (trimmed && trimmed !== classroom.name) {
      onRename(classroom.id, trimmed);
    }
    setEditing(false);
  };

  return (
    <div
      className="group cursor-pointer"
      onClick={confirmingDelete ? undefined : onClick}
      draggable={!confirmingDelete && !editing}
      onDragStart={(e) => {
        e.dataTransfer.setData('text/stage-id', classroom.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
      onDragEnd={() => {
        window.dispatchEvent(new CustomEvent('course-drag-end'));
      }}
    >
      <div
        ref={thumbRef}
        className="relative w-full aspect-video rounded-[24px] bg-slate-100 dark:bg-slate-800/80 overflow-hidden transition-all duration-500 group-hover:scale-[1.03]"
      >
        {slide && thumbWidth > 0 ? (
          <SlideThumbnail
            slide={slide}
            size={thumbWidth}
            viewportSize={slide.viewportSize ?? 1000}
            viewportRatio={slide.viewportRatio ?? 0.5625}
          />
        ) : !slide ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="size-12 rounded-2xl bg-gradient-to-br from-violet-100 to-blue-100 dark:from-violet-900/30 dark:to-blue-900/30 flex items-center justify-center">
              <span className="text-xl opacity-50">📄</span>
            </div>
          </div>
        ) : null}

        {showModeBadge && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                aria-label={modeBadgeLabel}
                onClick={(e) => e.stopPropagation()}
                className={cn(
                  'absolute bottom-2 left-2 inline-flex items-center justify-center size-5 rounded-full bg-white/70 dark:bg-slate-900/60 backdrop-blur-sm shadow-sm z-10',
                  isTaskEngineMode
                    ? 'text-amber-600 dark:text-amber-300 ring-1 ring-amber-500/35'
                    : 'text-cyan-600 dark:text-cyan-300 ring-1 ring-cyan-500/30',
                )}
              >
                <ModeBadgeIcon className="size-3" />
              </span>
            </TooltipTrigger>
            <TooltipContent
              side="top"
              align="start"
              sideOffset={-4}
              collisionPadding={0}
              className="text-xs"
            >
              {modeBadgeLabel}
            </TooltipContent>
          </Tooltip>
        )}

        {/* Delete & Rename — top-right, only on hover */}
        <AnimatePresence>
          {!confirmingDelete && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <Button
                size="icon"
                variant="ghost"
                className="absolute top-2 right-2 size-7 opacity-0 group-hover:opacity-100 transition-opacity bg-black/30 hover:bg-destructive/80 text-white hover:text-white backdrop-blur-sm rounded-full"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(classroom.id, e);
                }}
              >
                <Trash2 className="size-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="absolute top-2 right-11 size-7 opacity-0 group-hover:opacity-100 transition-opacity bg-black/30 hover:bg-black/50 text-white hover:text-white backdrop-blur-sm rounded-full"
                onClick={startRename}
              >
                <Pencil className="size-3.5" />
              </Button>
              {overlay}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Inline delete confirmation overlay */}
        <AnimatePresence>
          {confirmingDelete && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-2"
              onClick={(e) => e.stopPropagation()}
            >
              <span className="text-white text-xs font-bold">{t('classroom.deleteConfirmTitle')}?</span>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" className="h-7 text-white" onClick={onCancelDelete}>{t('common.cancel')}</Button>
                <Button size="sm" variant="destructive" className="h-7" onClick={onConfirmDelete}>{t('classroom.delete')}</Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Info — outside the thumbnail */}
      <div className="mt-2.5 px-1 flex items-center gap-2">
        <span className="shrink-0 inline-flex items-center rounded-full bg-violet-100 dark:bg-violet-900/30 px-2 py-0.5 text-[11px] font-medium text-violet-600 dark:text-violet-400">
          {classroom.sceneCount} {t('classroom.slides')} · {formatDate(classroom.updatedAt)}
        </span>
        {editing ? (
          <div className="flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
            <input
              ref={nameInputRef}
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitRename();
                if (e.key === 'Escape') setEditing(false);
              }}
              onBlur={commitRename}
              maxLength={100}
              placeholder={t('classroom.renamePlaceholder')}
              className="w-full bg-transparent border-b border-violet-400/60 text-[15px] font-medium text-foreground/90 outline-none placeholder:text-muted-foreground/40"
            />
          </div>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <p
                className="font-medium text-[15px] truncate text-foreground/90 min-w-0 cursor-text"
                onDoubleClick={startRename}
              >
                {classroom.name}
              </p>
            </TooltipTrigger>
            <TooltipContent
              side="bottom"
              sideOffset={4}
              className="!max-w-[min(90vw,32rem)] break-words whitespace-normal"
            >
              <div className="flex items-center gap-1.5">
                <span className="break-all">{classroom.name}</span>
                <button
                  className="shrink-0 p-0.5 rounded hover:bg-foreground/10 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigator.clipboard.writeText(classroom.name);
                    toast.success(t('classroom.nameCopied'));
                  }}
                >
                  <Copy className="size-3 opacity-60" />
                </button>
              </div>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );
}

export default function Page() {
  return <HomePage />;
}
