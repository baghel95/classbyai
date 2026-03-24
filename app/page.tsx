'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { useSession } from 'next-auth/react';
import { useI18n } from '@/lib/hooks/use-i18n';
import { createLogger } from '@/lib/logger';
import { Button } from '@/components/ui/button';
import { Textarea as UITextarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { SettingsDialog } from '@/components/settings';
import { GenerationToolbar } from '@/components/generation/generation-toolbar';
import { AgentBar } from '@/components/agent/agent-bar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useTheme } from '@/lib/hooks/use-theme';
import { nanoid } from 'nanoid';
import { storePdfBlob } from '@/lib/utils/image-storage';
import type { UserRequirements } from '@/lib/types/generation';
import { useSettingsStore } from '@/lib/store/settings';
import { useUserProfileStore, AVATAR_OPTIONS } from '@/lib/store/user-profile';
import {
  StageListItem,
  listStages,
  deleteStageData,
  getFirstSlideByStages,
} from '@/lib/utils/stage-storage';
import { ThumbnailSlide } from '@/components/slide-renderer/components/ThumbnailSlide';
import type { Slide } from '@/lib/types/slides';
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
import { 
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  Clock,
  Copy,
  ImagePlus,
  Moon,
  Pencil,
  Play,
  Settings,
  Sparkles,
  Sun,
  Trash2,
  ChevronUp
} from 'lucide-react';

const log = createLogger('Home');

const WEB_SEARCH_STORAGE_KEY = 'webSearchEnabled';
const LANGUAGE_STORAGE_KEY = 'generationLanguage';
const RECENT_OPEN_STORAGE_KEY = 'recentClassroomsOpen';

interface FormState {
  pdfFile: File | null;
  requirement: string;
  language: 'en-US' | 'hi-IN' | 'en-IN';
  webSearch: boolean;
}

const initialFormState: FormState = {
  pdfFile: null,
  requirement: '',
  language: 'en-US',
  webSearch: false,
};

function HomePage() {
  const { t, locale, setLocale } = useI18n();
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
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

  const currentModelId = useSettingsStore((s) => s.modelId);
  const [storeHydrated, setStoreHydrated] = useState(false);
  const [recentOpen, setRecentOpen] = useState(true);

  useEffect(() => {
    setStoreHydrated(true);
    try {
      const savedRecent = localStorage.getItem(RECENT_OPEN_STORAGE_KEY);
      if (savedRecent !== null) setRecentOpen(savedRecent !== 'false');
      
      const savedWebSearch = localStorage.getItem(WEB_SEARCH_STORAGE_KEY);
      const savedLanguage = localStorage.getItem(LANGUAGE_STORAGE_KEY);
      const updates: Partial<FormState> = {};
      if (savedWebSearch === 'true') updates.webSearch = true;
      if (['en-US', 'hi-IN', 'en-IN'].includes(savedLanguage || '')) {
        updates.language = savedLanguage as any;
      }
      if (Object.keys(updates).length > 0) {
        setForm((prev) => ({ ...prev, ...updates }));
      }
    } catch { /* ignore */ }
  }, []);

  const [prevCachedRequirement, setPrevCachedRequirement] = useState(cachedRequirement);
  if (cachedRequirement !== prevCachedRequirement) {
    setPrevCachedRequirement(cachedRequirement);
    if (cachedRequirement) {
      setForm((prev) => ({ ...prev, requirement: cachedRequirement }));
    }
  }

  // Auto-trigger generation if coming back from login
  const action = searchParams.get('action');
  useEffect(() => {
    // If we have an action but the requirement is still loading from cache, wait.
    const effectiveRequirement = form.requirement || cachedRequirement;
    
    if (storeHydrated && session && action === 'generate' && effectiveRequirement) {
      if (!form.requirement && cachedRequirement) {
        setForm((prev) => ({ ...prev, requirement: cachedRequirement }));
        return; // Wait for the next render with updated state
      }

      // Clear the action from URL to avoid re-triggering
      const newParams = new URLSearchParams(searchParams.toString());
      newParams.delete('action');
      newParams.delete('prompt');
      newParams.delete('callbackUrl');
      router.replace(`/?${newParams.toString()}`);
      
      handleGenerate();
    }
  }, [storeHydrated, session, action, form.requirement, cachedRequirement]);

  const needsSetup = storeHydrated && !currentModelId;
  const [error, setError] = useState<string | null>(null);
  const [classrooms, setClassrooms] = useState<StageListItem[]>([]);
  const [thumbnails, setThumbnails] = useState<Record<string, Slide>>({});
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const loadClassrooms = async (userId: string) => {
    try {
      const list = await listStages(userId);
      setClassrooms(list);
      if (list.length > 0) {
        const slides = await getFirstSlideByStages(list.map((c) => c.id), userId);
        setThumbnails(slides);
      }
    } catch (err) {
      log.error('Failed to load classrooms:', err);
    }
  };

  useEffect(() => {
    useMediaGenerationStore.getState().revokeObjectUrls();
    useMediaGenerationStore.setState({ tasks: {} });
  }, []);

  useEffect(() => {
    if (session?.user?.id) {
      loadClassrooms(session.user.id);
    } else {
      setClassrooms([]);
      setThumbnails({});
    }
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

  const updateForm = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    try {
      if (field === 'webSearch') localStorage.setItem(WEB_SEARCH_STORAGE_KEY, String(value));
      if (field === 'language') localStorage.setItem(LANGUAGE_STORAGE_KEY, String(value));
      if (field === 'requirement') updateRequirementCache(value as string);
    } catch { /* ignore */ }
  };

  const handleGenerate = async () => {
    if (!canGenerate) return;
    
    if (!session) {
      toast.info('Please log in to generate an agent');
      router.push(`/login?callbackUrl=/&action=generate&prompt=${encodeURIComponent(form.requirement)}`);
      return;
    }

    if (!currentModelId) {
      toast.error(t('settings.modelNotConfigured'));
      setSettingsOpen(true);
      return;
    }
    if (!form.requirement.trim()) {
      setError(t('upload.requirementRequired'));
      return;
    }
    setError(null);
    try {
      const userProfile = useUserProfileStore.getState();
      const requirements: UserRequirements = {
        requirement: form.requirement,
        language: form.language,
        userNickname: userProfile.nickname || undefined,
        userBio: userProfile.bio || undefined,
        webSearch: form.webSearch || undefined,
      };
      let pdfStorageKey: string | undefined;
      let pdfFileName: string | undefined;
      let pdfProviderId: string | undefined;
      let pdfProviderConfig: { apiKey?: string; baseUrl?: string } | undefined;
      if (form.pdfFile) {
        pdfStorageKey = await storePdfBlob(form.pdfFile, session.user?.id!);
        pdfFileName = form.pdfFile.name;
        const settings = useSettingsStore.getState();
        pdfProviderId = settings.pdfProviderId;
        const providerCfg = settings.pdfProvidersConfig?.[settings.pdfProviderId];
        if (providerCfg) {
          pdfProviderConfig = { apiKey: providerCfg.apiKey, baseUrl: providerCfg.baseUrl };
        }
      }
      const sessionState = {
        sessionId: nanoid(),
        requirements,
        pdfText: '',
        pdfImages: [],
        imageStorageIds: [],
        pdfStorageKey,
        pdfFileName,
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

  const canGenerate = !!form.requirement.trim();

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
      <section className="relative z-10 pt-10 pb-10 px-6 flex flex-col items-center text-center">
      
        
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1 }}
          className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8 max-w-4xl"
        >
          <span className="bg-linear-to-r from-slate-900 via-purple-800 to-slate-900 dark:from-white dark:via-purple-400 dark:to-white bg-clip-text text-transparent">
            Your Immersive AI Classroom
          </span>
          <br />
          <span className="text-slate-900/40 dark:text-white/20">in Just One Click</span>
        </motion.h1>
      </section>

                  {/* ── Slogan ── */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25 }}
          className="text-sm text-muted-foreground/60 mb-8"
        >
          {t('home.slogan')}
        </motion.p>


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
                    language={form.language}
                    onLanguageChange={(lang) => updateForm('language', lang)}
                    webSearch={form.webSearch}
                    onWebSearchChange={(v) => updateForm('webSearch', v)}
                    onSettingsOpen={(section) => {
                      setSettingsSection(section);
                      setSettingsOpen(true);
                    }}
                    pdfFile={form.pdfFile}
                    onPdfFileChange={(f) => updateForm('pdfFile', f)}
                    onPdfError={setError}
                  />
                </div>

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
                  disabled={!canGenerate}
                  className={cn(
                    'shrink-0 h-8 rounded-lg flex items-center justify-center gap-1.5 transition-all px-3',
                    canGenerate
                      ? 'bg-primary text-primary-foreground hover:opacity-90 shadow-sm cursor-pointer'
                      : 'bg-muted text-muted-foreground/40 cursor-not-allowed',
                  )}
                >
                  <span className="text-xs font-medium">{t('toolbar.enterClassroom')}</span>
                  <ArrowUp className="size-3.5" />
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

        {classrooms.length > 0 && (
          <div className="w-full max-w-[1000px] mt-16 px-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="relative z-10 w-full flex flex-col items-center"
            >
              <button
                onClick={() => {
                  const next = !recentOpen;
                  setRecentOpen(next);
                  try {
                    localStorage.setItem(RECENT_OPEN_STORAGE_KEY, String(next));
                  } catch { /* ignore */ }
                }}
                className="group w-full flex items-center gap-6 py-6 cursor-pointer"
              >
                <div className="flex-1 h-px bg-linear-to-r from-transparent via-border/40 to-border/40 group-hover:via-border/80 transition-all duration-500" />
                <span className="shrink-0 flex items-center gap-2.5 text-sm font-medium text-muted-foreground/50 group-hover:text-foreground/80 transition-all duration-300 select-none">
                  <div className="size-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center group-hover:bg-violet-500/10 transition-colors">
                    <Clock className="size-4 group-hover:text-violet-500 transition-colors" />
                  </div>
                  {t('classroom.recentClassrooms')}
                  <span className="px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[11px] font-bold tabular-nums opacity-60 group-hover:opacity-100 transition-opacity">
                    {classrooms.length}
                  </span>
                  <motion.div
                    animate={{ rotate: recentOpen ? 180 : 0 }}
                    transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <ChevronDown className="size-4 opacity-40 group-hover:opacity-100 transition-opacity" />
                  </motion.div>
                </span>
                <div className="flex-1 h-px bg-linear-to-l from-transparent via-border/40 to-border/40 group-hover:via-border/80 transition-all duration-500" />
              </button>

              <AnimatePresence>
                {recentOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
                    className="w-full overflow-hidden"
                  >
                    <div className="pt-8 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-x-5 gap-y-8">
                      {classrooms.map((classroom, i) => (
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
                          />
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </div>
        )}
      </section>


      {/* ═══ Background Decor ═══ */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-purple-500/10 dark:bg-purple-900/10 rounded-full blur-[120px] animate-blob" />
        <div className="absolute top-[10%] right-[-10%] w-[50%] h-[50%] bg-blue-500/10 dark:bg-blue-900/10 rounded-full blur-[120px] animate-blob animation-delay-2000" />
        <div className="absolute bottom-[-10%] left-[10%] w-[50%] h-[50%] bg-indigo-500/10 dark:bg-indigo-900/10 rounded-full blur-[120px] animate-blob animation-delay-4000" />
        <div className="absolute inset-0 bg-dot-pattern text-slate-900/4 dark:text-white/3" />
        <div className="absolute inset-0 bg-linear-to-b from-transparent via-white/40 to-white dark:via-slate-950/40 dark:to-slate-950" />
      </div>

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
              "flex items-center gap-2.5 cursor-pointer transition-all duration-200 group rounded-full px-2.5 py-1.5 border border-border/50 text-muted-foreground/70 hover:text-foreground hover:bg-muted/60 active:scale-[0.97]",
              open && "bg-muted/60"
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
                          onClick={commitName}
                          className="shrink-0 size-5 rounded flex items-center justify-center text-violet-500 hover:bg-violet-100 dark:hover:bg-violet-900/30"
                        >
                          <Check className="size-3" />
                        </button>
                      </div>
                    ) : (
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          startEditName();
                        }}
                        className="group/name inline-flex items-center gap-1 cursor-pointer"
                      >
                        <span className="text-[13px] font-semibold text-foreground/85 group-hover/name:text-foreground transition-colors">
                          {displayName}
                        </span>
                        <Pencil className="size-2.5 text-muted-foreground/30 opacity-0 group-hover/name:opacity-100 transition-opacity" />
                      </span>
                    )}
                  </div>

                  {/* Collapse arrow */}
                  <motion.div
                    initial={{ opacity: 0, y: -2 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="shrink-0 size-6 rounded-full flex items-center justify-center hover:bg-black/4 dark:hover:bg-white/6 transition-colors"
                  >
                    <ChevronUp className="size-3.5 text-muted-foreground/50" />
                  </motion.div>
                </div>

                {/* ── Expandable content ── */}
                <div className="pt-2" onClick={(e) => e.stopPropagation()}>
                  {/* Avatar picker */}
                  <AnimatePresence>
                    {avatarPickerOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.15, ease: 'easeInOut' }}
                        className="overflow-hidden"
                      >
                        <div className="p-1 pb-2.5 flex items-center gap-1.5 flex-wrap">
                          {AVATAR_OPTIONS.map((url) => (
                            <button
                              key={url}
                              onClick={() => setAvatar(url)}
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
  onDelete,
  confirmingDelete,
  onConfirmDelete,
  onCancelDelete,
  onClick,
}: {
  classroom: StageListItem;
  slide?: Slide;
  formatDate: (ts: number) => string;
  onDelete: (id: string, e: React.MouseEvent) => void;
  confirmingDelete: boolean;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  onClick: () => void;
}) {
  const { t } = useI18n();
  const thumbRef = useRef<HTMLDivElement>(null);
  const [thumbWidth, setThumbWidth] = useState(0);

  useEffect(() => {
    const el = thumbRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setThumbWidth(Math.round(entry.contentRect.width));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="group cursor-pointer" onClick={confirmingDelete ? undefined : onClick}>
      <div
        ref={thumbRef}
        className="relative w-full aspect-video rounded-[24px] bg-slate-100 dark:bg-slate-800/80 overflow-hidden transition-all duration-500 group-hover:scale-[1.03]"
      >
        {slide && thumbWidth > 0 ? (
          <ThumbnailSlide slide={slide} size={thumbWidth} viewportSize={slide.viewportSize ?? 1000} viewportRatio={slide.viewportRatio ?? 0.5625} />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-200 dark:bg-slate-800 text-2xl">📄</div>
        )}
        {!confirmingDelete && (
          <Button
            size="icon" variant="ghost" className="absolute top-2 right-2 size-7 opacity-0 group-hover:opacity-100 bg-black/20 text-white"
            onClick={(e) => onDelete(classroom.id, e)}
          >
            <Trash2 className="size-3.5" />
          </Button>
        )}
        <AnimatePresence>
          {confirmingDelete && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
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
      <div className="mt-2 text-sm">
        <div className="font-bold flex items-center gap-2">
           <span className="shrink-0 whitespace-nowrap text-[11px] px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400">
             {classroom.sceneCount} {t('classroom.slides')}
           </span>
           <span className="truncate">{classroom.name}</span>
        </div>
        <div className="text-[10px] text-muted-foreground mt-1">{formatDate(classroom.updatedAt)}</div>
      </div>
    </div>
  );
}

export default function Page() {
  return <HomePage />;
}
