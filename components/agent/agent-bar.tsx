'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/hooks/use-i18n';
import { useSettingsStore } from '@/lib/store/settings';
import { useAgentRegistry } from '@/lib/orchestration/registry/store';
import { resolveAgentVoice, getSelectableProvidersWithVoices } from '@/lib/audio/voice-resolver';
import { playBrowserTTSPreview } from '@/lib/audio/browser-tts-preview';
import { useAllVoiceProfiles } from '@/lib/audio/voxcpm-voices';
import { resolveAgentVoiceOptions } from '@/lib/audio/agent-voice';
import { VOXCPM_AUTO_VOICE_ID, VOXCPM_TTS_PROVIDER_ID } from '@/lib/audio/voxcpm';
import {
  Sparkles,
  ChevronDown,
  ChevronUp,
  Shuffle,
  Volume2,
  VolumeX,
  Loader2,
  Search,
  Globe,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { AgentConfig } from '@/lib/orchestration/registry/types';
import type { TTSProviderId } from '@/lib/audio/types';
import type { ProviderWithVoices } from '@/lib/audio/voice-resolver';

function matchesVoiceQuery(value: string | undefined, query: string): boolean {
  return !!value?.toLowerCase().includes(query);
}

function getFilteredModelGroups(
  provider: ProviderWithVoices,
  query: string,
  autoVoiceLabel?: string,
) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return provider.modelGroups;

  return provider.modelGroups
    .map((group) => {
      const groupMatches =
        matchesVoiceQuery(provider.providerName, normalizedQuery) ||
        matchesVoiceQuery(provider.providerId, normalizedQuery) ||
        matchesVoiceQuery(group.modelName, normalizedQuery) ||
        matchesVoiceQuery(group.modelId, normalizedQuery);
      const voices = group.voices.filter(
        (voice) =>
          groupMatches ||
          matchesVoiceQuery(voice.name, normalizedQuery) ||
          matchesVoiceQuery(voice.id, normalizedQuery) ||
          matchesVoiceQuery(voice.language, normalizedQuery) ||
          // Auto Voice is shown by its localized label, not voice.name — match it too.
          (voice.id === VOXCPM_AUTO_VOICE_ID && matchesVoiceQuery(autoVoiceLabel, normalizedQuery)),
      );
      return { ...group, voices };
    })
    .filter((group) => group.voices.length > 0);
}

function isNonPreviewableVoice(providerId: TTSProviderId, voiceId: string): boolean {
  return providerId === VOXCPM_TTS_PROVIDER_ID && voiceId === VOXCPM_AUTO_VOICE_ID;
}

function AgentVoicePill({
  agent,
  agentIndex,
  availableProviders,
  disabled,
}: {
  agent: AgentConfig;
  agentIndex: number;
  availableProviders: ProviderWithVoices[];
  disabled?: boolean;
}) {
  const { t, locale } = useI18n();
  const ttsProvidersConfig = useSettingsStore((s) => s.ttsProvidersConfig);
  const agentVoiceOverrides = useSettingsStore((s) => s.agentVoiceOverrides);
  const setAgentVoiceOverride = useSettingsStore((s) => s.setAgentVoiceOverride);
  const resolved = resolveAgentVoice(agent, agentIndex, availableProviders, agentVoiceOverrides);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [voiceQuery, setVoiceQuery] = useState('');
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const previewCancelRef = useRef<(() => void) | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const previewAbortRef = useRef<AbortController | null>(null);
  const visibleProviderGroups = availableProviders
    .map((provider) => ({
      provider,
      groups: getFilteredModelGroups(provider, voiceQuery, t('settings.voxcpmAutoVoice')),
    }))
    .filter(({ groups }) => groups.length > 0);

  const displayName = (() => {
    if (!resolved) return t('agentBar.noVoice');
    for (const p of availableProviders) {
      if (p.providerId === resolved.providerId) {
        const v = p.voices.find((voice) => voice.id === resolved.voiceId);
        if (v) return v.id === VOXCPM_AUTO_VOICE_ID ? t('settings.voxcpmAutoVoice') : v.name;
      }
    }
    return resolved.voiceId;
  })();

  const stopPreview = useCallback(() => {
    previewCancelRef.current?.();
    previewCancelRef.current = null;
    previewAbortRef.current?.abort();
    previewAbortRef.current = null;
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current.src = '';
      previewAudioRef.current = null;
    }
    setPreviewingId(null);
  }, []);

  const handlePreview = useCallback(
    async (providerId: TTSProviderId, voiceId: string, modelId?: string) => {
      const key = `${providerId}::${voiceId}`;
      if (previewingId === key) {
        stopPreview();
        return;
      }
      stopPreview();
      setPreviewingId(key);

      const previewText = t('settings.ttsTestTextDefault');

      if (providerId === 'browser-native-tts') {
        const { promise, cancel } = playBrowserTTSPreview({ text: previewText, voice: voiceId });
        previewCancelRef.current = cancel;
        try {
          await promise;
        } catch {
          // ignore abort
        }
        setPreviewingId(null);
        return;
      }

      // Server TTS
      try {
        const controller = new AbortController();
        previewAbortRef.current = controller;
        const providerConfig = ttsProvidersConfig[providerId];
        const providerOptions = await resolveAgentVoiceOptions(agent, {
          providerId,
          providerConfig: { ...providerConfig, modelId: modelId || providerConfig?.modelId },
          voiceId,
          language: locale,
        });
        const res = await fetch('/api/generate/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: previewText,
            audioId: 'voice-preview',
            ttsProviderId: providerId,
            ttsModelId: modelId || providerConfig?.modelId,
            ttsVoice: voiceId,
            ttsSpeed: 1,
            ttsApiKey: providerConfig?.apiKey,
            // Managed providers resolve their base URL server-side; only send
            // the client's own base URL (custom providers).
            ttsBaseUrl: providerConfig?.baseUrl || providerConfig?.customDefaultBaseUrl,
            ttsProviderOptions: providerOptions,
          }),
          signal: controller.signal,
        });
        if (!res.ok) throw new Error('TTS error');
        const data = await res.json();
        if (!data.base64) throw new Error('No audio');

        const audio = new Audio(`data:audio/${data.format || 'mp3'};base64,${data.base64}`);
        previewAudioRef.current = audio;
        audio.addEventListener('ended', () => setPreviewingId(null));
        audio.addEventListener('error', () => setPreviewingId(null));
        await audio.play();
      } catch {
        setPreviewingId(null);
      }
    },
    [
      agent.name,
      agent.persona,
      agent.role,
      locale,
      previewingId,
      stopPreview,
      t,
      ttsProvidersConfig,
    ],
  );

  // Cleanup on unmount
  useEffect(() => () => stopPreview(), [stopPreview]);

  const ttsEnabled = useSettingsStore((s) => s.ttsEnabled);
  const setTTSEnabled = useSettingsStore((s) => s.setTTSEnabled);

  // Disabled (TTS off) OR no enabled provider ⇒ render pill.
  // When TTS is off but providers are available, clicking enables audio (#665).
  if (disabled) {
    const canEnable = !ttsEnabled && availableProviders.length > 0;
    return (
      <div
        onClick={(e) => {
          e.stopPropagation();
          if (canEnable) {
            setTTSEnabled(true);
          }
        }}
        onPointerDown={(e) => e.stopPropagation()}
        className={cn(
          'flex items-center gap-1.5 h-6 w-[100px] rounded-full px-2.5 text-[11px] shrink-0 transition-colors',
          canEnable
            ? 'bg-muted/40 hover:bg-primary/10 text-muted-foreground/60 hover:text-primary cursor-pointer'
            : 'bg-muted/40 text-muted-foreground/30 cursor-not-allowed',
        )}
        title={canEnable ? 'Audio is disabled. Click to enable speech audio' : undefined}
      >
        <VolumeX className="size-3 shrink-0" />
        <span className="truncate flex-1 text-left">{displayName}</span>
      </div>
    );
  }

  return (
    <Popover
      open={popoverOpen}
      onOpenChange={(open) => {
        setPopoverOpen(open);
        if (!open) {
          setVoiceQuery('');
          stopPreview();
        }
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          className="flex items-center gap-1.5 h-6 w-[100px] rounded-full bg-primary/10 hover:bg-primary/20 dark:bg-primary/25 dark:hover:bg-primary/35 px-2.5 text-[11px] text-primary/80 hover:text-primary dark:text-primary/90 transition-colors shrink-0 cursor-pointer"
        >
          <Volume2 className="size-3 shrink-0" />
          <span className="truncate flex-1 text-left">{displayName}</span>
          <ChevronDown className="size-3 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="end"
        sideOffset={4}
        className="max-w-[calc(100vw-2rem)] overflow-hidden p-0 sm:w-96 w-80"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="border-b border-border/50 p-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground/50" />
            <input
              value={voiceQuery}
              onChange={(e) => setVoiceQuery(e.target.value)}
              autoFocus
              aria-label={t('agentBar.searchVoice')}
              placeholder={t('agentBar.searchVoice')}
              className="h-8 w-full rounded-md border border-input bg-background pl-8 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
            />
          </div>
        </div>
        <div className="max-h-[min(320px,calc(var(--radix-popover-content-available-height)-64px))] min-h-0 overflow-y-auto p-1">
          {visibleProviderGroups.length === 0 && (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground/60">
              {t('agentBar.noMatchingVoices')}
            </div>
          )}
          {visibleProviderGroups.map(({ provider, groups }) =>
            groups.map((group) => (
              <div key={`${provider.providerId}::${group.modelId}`}>
                <div className="sticky top-0 bg-popover px-2 py-1 text-[11px] font-medium text-muted-foreground/60">
                  {group.modelId
                    ? `${provider.providerName} · ${group.modelName}`
                    : provider.providerName}
                </div>
                {group.voices.map((voice) => {
                  const isActive =
                    resolved?.providerId === provider.providerId &&
                    resolved?.voiceId === voice.id &&
                    (resolved?.modelId || '') === (group.modelId || '');
                  const previewKey = `${provider.providerId}::${voice.id}`;
                  const isPreviewing = previewingId === previewKey;
                  const canPreview = !isNonPreviewableVoice(provider.providerId, voice.id);
                  return (
                    <div
                      key={previewKey}
                      className={cn(
                        'flex items-center gap-1.5 rounded-sm transition-colors',
                        isActive ? 'bg-primary/10' : 'hover:bg-muted',
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          // Persisted in settings, not on the registry record:
                          // default agent records are reset from code on every
                          // load and would drop the pick.
                          setAgentVoiceOverride(agent.id, {
                            providerId: provider.providerId,
                            modelId: group.modelId || undefined,
                            voiceId: voice.id,
                          });
                          setPopoverOpen(false);
                        }}
                        className={cn(
                          'flex-1 text-left text-[13px] px-2 py-1.5 min-w-0 truncate',
                          isActive ? 'text-primary font-medium' : 'text-foreground',
                        )}
                      >
                        {voice.id === VOXCPM_AUTO_VOICE_ID
                          ? t('settings.voxcpmAutoVoice')
                          : voice.name}
                      </button>
                      {canPreview && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePreview(provider.providerId, voice.id, group.modelId);
                          }}
                          className={cn(
                            'flex size-6 shrink-0 items-center justify-center rounded-sm transition-colors',
                            isPreviewing
                              ? 'text-primary'
                              : 'text-muted-foreground/40 hover:text-muted-foreground',
                          )}
                        >
                          {isPreviewing ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Volume2 className="size-3.5" />
                          )}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )),
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Teacher voice pill — reads/writes global ttsProviderId + ttsVoice (single source of truth).
 * This ensures lecture and discussion use the same voice for the teacher.
 */
function TeacherVoicePill({
  availableProviders,
  disabled,
}: {
  availableProviders: ProviderWithVoices[];
  disabled?: boolean;
}) {
  const { t, locale } = useI18n();
  const ttsProviderId = useSettingsStore((s) => s.ttsProviderId);
  const ttsVoice = useSettingsStore((s) => s.ttsVoice);
  const setTTSProvider = useSettingsStore((s) => s.setTTSProvider);
  const setTTSVoice = useSettingsStore((s) => s.setTTSVoice);
  const setTTSProviderConfig = useSettingsStore((s) => s.setTTSProviderConfig);
  const ttsProvidersConfig = useSettingsStore((s) => s.ttsProvidersConfig);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [voiceQuery, setVoiceQuery] = useState('');
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const previewCancelRef = useRef<(() => void) | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const previewAbortRef = useRef<AbortController | null>(null);
  const visibleProviderGroups = availableProviders
    .map((provider) => ({
      provider,
      groups: getFilteredModelGroups(provider, voiceQuery, t('settings.voxcpmAutoVoice')),
    }))
    .filter(({ groups }) => groups.length > 0);

  const displayName = (() => {
    // No enabled provider ⇒ no valid voice; show the placeholder, not a stale
    // voice name from a now-disabled provider (#665).
    if (availableProviders.length === 0) return t('agentBar.noVoice');
    for (const p of availableProviders) {
      if (p.providerId === ttsProviderId) {
        const v = p.voices.find((voice) => voice.id === ttsVoice);
        if (v) return v.id === VOXCPM_AUTO_VOICE_ID ? t('settings.voxcpmAutoVoice') : v.name;
      }
    }
    return ttsVoice || 'default';
  })();

  const stopPreview = useCallback(() => {
    previewCancelRef.current?.();
    previewCancelRef.current = null;
    previewAbortRef.current?.abort();
    previewAbortRef.current = null;
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current.src = '';
      previewAudioRef.current = null;
    }
    setPreviewingId(null);
  }, []);

  const handlePreview = useCallback(
    async (providerId: TTSProviderId, voiceId: string, modelId?: string) => {
      const key = `${providerId}::${voiceId}`;
      if (previewingId === key) {
        stopPreview();
        return;
      }
      stopPreview();
      setPreviewingId(key);

      const previewText = t('settings.ttsTestTextDefault');

      if (providerId === 'browser-native-tts') {
        const { promise, cancel } = playBrowserTTSPreview({ text: previewText, voice: voiceId });
        previewCancelRef.current = cancel;
        try {
          await promise;
        } catch {
          // ignore abort
        }
        setPreviewingId(null);
        return;
      }

      try {
        const controller = new AbortController();
        previewAbortRef.current = controller;
        const providerConfig = ttsProvidersConfig[providerId];
        const providerOptions = await resolveAgentVoiceOptions(undefined, {
          providerId,
          providerConfig: { ...providerConfig, modelId: modelId || providerConfig?.modelId },
          voiceId,
          language: locale,
        });
        const res = await fetch('/api/generate/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: previewText,
            audioId: 'voice-preview',
            ttsProviderId: providerId,
            ttsModelId: modelId || providerConfig?.modelId,
            ttsVoice: voiceId,
            ttsSpeed: 1,
            ttsApiKey: providerConfig?.apiKey,
            // Managed providers resolve their base URL server-side; only send
            // the client's own base URL (custom providers).
            ttsBaseUrl: providerConfig?.baseUrl || providerConfig?.customDefaultBaseUrl,
            ttsProviderOptions: providerOptions,
          }),
          signal: controller.signal,
        });
        if (!res.ok) throw new Error('TTS error');
        const data = await res.json();
        if (!data.base64) throw new Error('No audio');
        const audio = new Audio(`data:audio/${data.format || 'mp3'};base64,${data.base64}`);
        previewAudioRef.current = audio;
        audio.addEventListener('ended', () => setPreviewingId(null));
        audio.addEventListener('error', () => setPreviewingId(null));
        await audio.play();
      } catch {
        setPreviewingId(null);
      }
    },
    [locale, previewingId, stopPreview, t, ttsProvidersConfig],
  );

  useEffect(() => () => stopPreview(), [stopPreview]);

  const ttsEnabled = useSettingsStore((s) => s.ttsEnabled);
  const setTTSEnabled = useSettingsStore((s) => s.setTTSEnabled);

  // Disabled (TTS off) OR no enabled provider ⇒ render pill.
  // When TTS is off but providers are available, clicking enables audio (#665).
  if (disabled) {
    const canEnable = !ttsEnabled && availableProviders.length > 0;
    return (
      <div
        onClick={(e) => {
          e.stopPropagation();
          if (canEnable) {
            setTTSEnabled(true);
          }
        }}
        onPointerDown={(e) => e.stopPropagation()}
        className={cn(
          'flex items-center gap-1.5 h-6 w-[100px] rounded-full px-2.5 text-[11px] shrink-0 transition-colors',
          canEnable
            ? 'bg-muted/40 hover:bg-primary/10 text-muted-foreground/60 hover:text-primary cursor-pointer'
            : 'bg-muted/40 text-muted-foreground/30 cursor-not-allowed',
        )}
        title={canEnable ? 'Audio is disabled. Click to enable speech audio' : undefined}
      >
        <VolumeX className="size-3 shrink-0" />
        <span className="truncate flex-1 text-left">{displayName}</span>
      </div>
    );
  }

  return (
    <Popover
      open={popoverOpen}
      onOpenChange={(open) => {
        setPopoverOpen(open);
        if (!open) {
          setVoiceQuery('');
          stopPreview();
        }
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          className="flex items-center gap-1.5 h-6 w-[100px] rounded-full bg-primary/10 hover:bg-primary/20 dark:bg-primary/25 dark:hover:bg-primary/35 px-2.5 text-[11px] text-primary/80 hover:text-primary dark:text-primary/90 transition-colors shrink-0 cursor-pointer"
        >
          <Volume2 className="size-3 shrink-0" />
          <span className="truncate flex-1 text-left">{displayName}</span>
          <ChevronDown className="size-3 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="end"
        sideOffset={4}
        className="max-w-[calc(100vw-2rem)] overflow-hidden p-0 sm:w-96 w-80"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="border-b border-border/50 p-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground/50" />
            <input
              value={voiceQuery}
              onChange={(e) => setVoiceQuery(e.target.value)}
              autoFocus
              aria-label={t('agentBar.searchVoice')}
              placeholder={t('agentBar.searchVoice')}
              className="h-8 w-full rounded-md border border-input bg-background pl-8 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
            />
          </div>
        </div>
        <div className="max-h-[min(320px,calc(var(--radix-popover-content-available-height)-64px))] min-h-0 overflow-y-auto p-1">
          {visibleProviderGroups.length === 0 && (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground/60">
              {t('agentBar.noMatchingVoices')}
            </div>
          )}
          {visibleProviderGroups.map(({ provider, groups }) =>
            groups.map((group) => (
              <div key={`${provider.providerId}::${group.modelId}`}>
                <div className="sticky top-0 bg-popover px-2 py-1 text-[11px] font-medium text-muted-foreground/60">
                  {group.modelId
                    ? `${provider.providerName} · ${group.modelName}`
                    : provider.providerName}
                </div>
                {group.voices.map((voice) => {
                  const currentModelId = ttsProvidersConfig[ttsProviderId]?.modelId || '';
                  const isActive =
                    ttsProviderId === provider.providerId &&
                    ttsVoice === voice.id &&
                    currentModelId === (group.modelId || '');
                  const previewKey = `${provider.providerId}::${voice.id}`;
                  const isPreviewing = previewingId === previewKey;
                  const canPreview = !isNonPreviewableVoice(provider.providerId, voice.id);
                  return (
                    <div
                      key={previewKey}
                      className={cn(
                        'flex items-center gap-1.5 rounded-sm transition-colors',
                        isActive ? 'bg-primary/10' : 'hover:bg-muted',
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setTTSProvider(provider.providerId);
                          setTTSVoice(voice.id);
                          if (group.modelId) {
                            setTTSProviderConfig(provider.providerId, { modelId: group.modelId });
                          }
                          setPopoverOpen(false);
                        }}
                        className={cn(
                          'flex-1 text-left text-[13px] px-2 py-1.5 min-w-0 truncate',
                          isActive ? 'text-primary font-medium' : 'text-foreground',
                        )}
                      >
                        {voice.id === VOXCPM_AUTO_VOICE_ID
                          ? t('settings.voxcpmAutoVoice')
                          : voice.name}
                      </button>
                      {canPreview && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePreview(provider.providerId, voice.id, group.modelId);
                          }}
                          className={cn(
                            'flex size-6 shrink-0 items-center justify-center rounded-sm transition-colors',
                            isPreviewing
                              ? 'text-primary'
                              : 'text-muted-foreground/40 hover:text-muted-foreground',
                          )}
                        >
                          {isPreviewing ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Volume2 className="size-3.5" />
                          )}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )),
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function AgentBar() {
  const { t } = useI18n();
  const { listAgents } = useAgentRegistry();
  const selectedAgentIds = useSettingsStore((s) => s.selectedAgentIds);
  const setSelectedAgentIds = useSettingsStore((s) => s.setSelectedAgentIds);
  const agentMode = useSettingsStore((s) => s.agentMode);
  const setAgentMode = useSettingsStore((s) => s.setAgentMode);
  const setAgentSelectionIsUserSet = useSettingsStore((s) => s.setAgentSelectionIsUserSet);
  const ttsProvidersConfig = useSettingsStore((s) => s.ttsProvidersConfig);
  const ttsEnabled = useSettingsStore((s) => s.ttsEnabled);
  const setTTSEnabled = useSettingsStore((s) => s.setTTSEnabled);
  const classroomLanguage = useSettingsStore((s) => s.classroomLanguage);
  const setClassroomLanguage = useSettingsStore((s) => s.setClassroomLanguage);

  const [open, setOpen] = useState(false);
  const [browserVoices, setBrowserVoices] = useState<SpeechSynthesisVoice[]>([]);
  const { profiles: voiceProfiles } = useAllVoiceProfiles();
  const containerRef = useRef<HTMLDivElement>(null);

  // Load browser native TTS voices
  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    const loadVoices = () => setBrowserVoices(speechSynthesis.getVoices());
    loadVoices();
    speechSynthesis.addEventListener('voiceschanged', loadVoices);
    return () => speechSynthesis.removeEventListener('voiceschanged', loadVoices);
  }, []);

  const allAgents = listAgents();
  const agents = allAgents.filter((a) => !a.isGenerated);
  const teacherAgent = agents.find((a) => a.role === 'teacher');
  const selectedAgents = agents.filter((a) => selectedAgentIds.includes(a.id));
  const nonTeacherSelected = selectedAgents.filter((a) => a.role !== 'teacher');

  // Single source of truth for selectable provider+voice options (enabled
  // providers + opt-in browser-native), shared with discussion TTS (#665).
  const availableProviders = getSelectableProvidersWithVoices(
    ttsProvidersConfig,
    voiceProfiles,
    browserVoices,
  );

  const handleModeChange = (mode: 'preset' | 'auto') => {
    // Clicking the already-active tab is a visual no-op; it must not convert
    // stage-derived defaults into a "user choice".
    if (mode === agentMode) return;
    // An explicit choice — restoreAgentSelection keeps it across classrooms.
    setAgentSelectionIsUserSet(true);
    setAgentMode(mode);
    if (mode === 'preset') {
      // Remove stale auto-generated agent IDs that may linger from a previous auto classroom
      const presetIds = selectedAgentIds.filter((id) => agents.some((a) => a.id === id));
      const hasTeacher = presetIds.some((id) => {
        const a = agents.find((agent) => agent.id === id);
        return a?.role === 'teacher';
      });
      if (!hasTeacher && teacherAgent) {
        presetIds.unshift(teacherAgent.id);
      }
      setSelectedAgentIds(
        presetIds.length > 0 ? presetIds : ['default-1', 'default-2', 'default-3'],
      );
    } else {
      // Auto mode plays the current classroom's generated agents — leaving the
      // preset ids selected would desync playback from the toggle (UI says
      // Auto, discussion still uses preset agents) and persist an auto
      // selection that can never validate on restore. When no classroom's
      // agents are loaded (fresh home), an empty selection falls back to the
      // stage-derived defaults on the next classroom load.
      setSelectedAgentIds(allAgents.filter((a) => a.isGenerated).map((a) => a.id));
    }
  };

  const toggleAgent = (agentId: string) => {
    const agent = agents.find((a) => a.id === agentId);
    if (agent?.role === 'teacher') return;
    setAgentSelectionIsUserSet(true);
    if (selectedAgentIds.includes(agentId)) {
      setSelectedAgentIds(selectedAgentIds.filter((id) => id !== agentId));
    } else {
      setSelectedAgentIds([...selectedAgentIds, agentId]);
    }
  };

  const getAgentName = (agent: { id: string; name: string }) => {
    const key = `settings.agentNames.${agent.id}`;
    const translated = t(key);
    return translated !== key ? translated : agent.name;
  };

  const getAgentRole = (agent: { role: string }) => {
    const key = `settings.agentRoles.${agent.role}`;
    const translated = t(key);
    return translated !== key ? translated : agent.role;
  };

  const avatarRow = (
    <div className="flex items-center gap-1.5 shrink-0">
      {teacherAgent && (
        <div className="size-9 rounded-full overflow-hidden ring-2 ring-blue-500/20 dark:ring-blue-500/30 shrink-0 shadow-sm transition-transform group-hover:scale-105">
          <img
            src={teacherAgent.avatar}
            alt={getAgentName(teacherAgent)}
            className="size-full object-cover"
          />
        </div>
      )}

      {agentMode === 'auto' ? (
        <>
          <div className="flex -space-x-2">
            {agents.find((a) => a.role === 'assistant') && (
              <div className="size-7 rounded-full overflow-hidden ring-2 ring-white/80 dark:ring-slate-900/80 shadow-sm">
                <img
                  src={agents.find((a) => a.role === 'assistant')!.avatar}
                  alt=""
                  className="size-full object-cover"
                />
              </div>
            )}
          </div>
          <div className="size-7 rounded-full bg-violet-500/10 flex items-center justify-center">
            <Shuffle className="size-3.5 text-violet-500 animate-pulse" />
          </div>
        </>
      ) : (
        <>
          {nonTeacherSelected.length > 0 && (
            <div className="flex -space-x-2.5">
              {nonTeacherSelected.slice(0, 4).map((agent) => (
                <div
                  key={agent.id}
                  className="size-7 rounded-full overflow-hidden ring-2 ring-white/80 dark:ring-slate-900/80 shadow-sm"
                >
                  <img
                    src={agent.avatar}
                    alt={getAgentName(agent)}
                    className="size-full object-cover"
                  />
                </div>
              ))}
              {nonTeacherSelected.length > 4 && (
                <div className="size-7 rounded-full bg-slate-100 dark:bg-slate-800 ring-2 ring-white/80 dark:ring-slate-900/80 flex items-center justify-center">
                  <span className="text-[10px] font-bold text-muted-foreground">
                    +{nonTeacherSelected.length - 4}
                  </span>
                </div>
              )}
            </div>
          )}
        </>
      )}
      {ttsEnabled ? (
        <Volume2 className="size-3.5 text-muted-foreground/40 group-hover:text-muted-foreground/60 transition-colors" />
      ) : (
        <VolumeX className="size-3.5 text-muted-foreground/30" />
      )}
    </div>
  );

  const renderAgentRow = (agent: AgentConfig, agentIndex: number, isTeacher: boolean) => {
    const isSelected = isTeacher || selectedAgentIds.includes(agent.id);
    return (
      <div
        key={agent.id}
        onClick={isTeacher ? undefined : () => toggleAgent(agent.id)}
        className={cn(
          'w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg transition-colors',
          isTeacher ? 'bg-primary/5' : 'cursor-pointer',
          !isTeacher && isSelected && 'bg-primary/5',
          !isTeacher && !isSelected && 'hover:bg-muted/50',
        )}
      >
        <Checkbox
          checked={isSelected}
          disabled={isTeacher}
          className={cn('pointer-events-none', isTeacher && 'opacity-50')}
        />
        <div
          className="size-7 rounded-full overflow-hidden shrink-0 ring-1 ring-border/40"
          style={{ boxShadow: isSelected ? `0 0 0 2px ${agent.color}30` : undefined }}
        >
          <img src={agent.avatar} alt={getAgentName(agent)} className="size-full object-cover" />
        </div>
        <span className="text-[13px] font-medium truncate min-w-0 flex-1">
          {getAgentName(agent)}
        </span>
        <span className="text-[10px] text-muted-foreground/50 shrink-0 w-[52px] text-right">
          {getAgentRole(agent)}
        </span>
        <AgentVoicePill
          agent={agent}
          agentIndex={agentIndex}
          availableProviders={availableProviders}
          disabled={!ttsEnabled || availableProviders.length === 0}
        />
      </div>
    );
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button
              className={cn(
                'group flex items-center gap-2 cursor-pointer rounded-full px-3 py-1.5 transition-all',
                'border border-border/50 text-muted-foreground/70 hover:text-foreground hover:bg-muted/60',
              )}
            >
              <span className="text-xs text-muted-foreground/60 group-hover:text-muted-foreground transition-colors hidden sm:block font-medium truncate max-w-[150px]">
                {open ? t('agentBar.expandedTitle') : t('agentBar.readyToLearn')}
              </span>
              {avatarRow}
              {open ? (
                <ChevronUp className="size-3 text-muted-foreground/40 group-hover:text-muted-foreground/70 transition-colors shrink-0" />
              ) : (
                <ChevronDown className="size-3 text-muted-foreground/40 group-hover:text-muted-foreground/70 transition-colors shrink-0" />
              )}
            </button>
          </PopoverTrigger>
        </TooltipTrigger>
        {!open && (
          <TooltipContent side="bottom" sideOffset={4}>
            {t('agentBar.configTooltip')}
          </TooltipContent>
        )}
      </Tooltip>

      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-96 p-2.5 rounded-2xl bg-white/95 dark:bg-[#0E1322]/95 border border-border/60 dark:border-white/10 backdrop-blur-xl shadow-2xl shadow-black/40 z-50 overflow-hidden"
      >
        {/* Header with Title and Narration / Audio Toggle */}
        <div className="flex items-center justify-between px-1 pb-2 mb-2 border-b border-border/40">
          <span className="text-xs font-semibold text-foreground/90">
            {t('agentBar.expandedTitle')}
          </span>
          <button
            type="button"
            onClick={() => setTTSEnabled(!ttsEnabled)}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all cursor-pointer border',
              ttsEnabled
                ? 'bg-primary/10 border-primary/30 text-primary hover:bg-primary/20 dark:bg-primary/20 dark:border-primary/40'
                : 'bg-muted/60 border-border/60 text-muted-foreground/70 hover:bg-muted hover:text-foreground',
            )}
            title={ttsEnabled ? 'Speech audio enabled (click to mute)' : 'Speech audio disabled (click to enable)'}
          >
            {ttsEnabled ? (
              <>
                <Volume2 className="size-3.5 text-primary" />
                <span>Audio Enabled</span>
              </>
            ) : (
              <>
                <VolumeX className="size-3.5 text-muted-foreground" />
                <span>Audio Disabled</span>
              </>
            )}
          </button>
        </div>

        {/* Classroom Language Selection: English | Hindi | Marathi */}
        <div className="flex items-center justify-between px-2 py-1.5 mb-2 rounded-xl bg-muted/40 border border-border/40">
          <span className="text-xs font-medium text-foreground/80 flex items-center gap-1.5">
            <Globe className="size-3.5 text-primary" />
            Class Language:
          </span>
          <div className="flex items-center gap-1">
            {[
              { id: 'en-IN', label: 'English' },
              { id: 'hi-IN', label: 'हिन्दी' },
              { id: 'mr-IN', label: 'मराठी' },
            ].map((lang) => (
              <button
                key={lang.id}
                type="button"
                onClick={() => setClassroomLanguage(lang.id as 'en-IN' | 'hi-IN' | 'mr-IN')}
                className={cn(
                  'px-2 py-0.5 text-xs font-semibold rounded-md transition-all cursor-pointer',
                  (classroomLanguage || 'en-IN') === lang.id
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/80',
                )}
              >
                {lang.label}
              </button>
            ))}
          </div>
        </div>

        {/* Teacher — always visible */}
        {teacherAgent && (
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-primary/5 dark:bg-primary/10 border border-primary/10 mb-2">
            <div
              className="size-7 rounded-full overflow-hidden shrink-0 ring-1 ring-border/40"
              style={{ boxShadow: `0 0 0 2px ${teacherAgent.color}30` }}
            >
              <img
                src={teacherAgent.avatar}
                alt={getAgentName(teacherAgent)}
                className="size-full object-cover"
              />
            </div>
            <span className="text-[13px] font-medium truncate min-w-0 flex-1">
              {getAgentName(teacherAgent)}
            </span>
            <TeacherVoicePill
              availableProviders={availableProviders}
              disabled={!ttsEnabled || availableProviders.length === 0}
            />
          </div>
        )}

        {/* Mode tabs */}
        <div className="flex rounded-lg border bg-muted/30 dark:bg-white/5 border-border/50 dark:border-white/10 p-0.5 mb-2">
          <button
            onClick={() => handleModeChange('preset')}
            className={cn(
              'flex-1 py-1.5 text-xs font-medium rounded-md transition-all text-center',
              agentMode === 'preset'
                ? 'bg-background shadow-sm text-foreground font-semibold'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t('settings.agentModePreset')}
          </button>
          <button
            onClick={() => handleModeChange('auto')}
            className={cn(
              'flex-1 py-1.5 text-xs font-medium rounded-md transition-all text-center flex items-center justify-center gap-1',
              agentMode === 'auto'
                ? 'bg-background shadow-sm text-foreground font-semibold'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Sparkles className="h-3 w-3" />
            {t('settings.agentModeAuto')}
          </button>
        </div>

        {agentMode === 'preset' ? (
          <div className="max-h-56 overflow-y-auto -mx-0.5 space-y-0.5">
            {agents
              .filter((a) => a.role !== 'teacher')
              .map((agent, idx) => renderAgentRow(agent, idx + 1, false))}
          </div>
        ) : (
          <div className="flex flex-col items-center pt-6 pb-3 gap-4">
            <div className="relative flex items-center justify-center">
              <div className="absolute size-10 rounded-full bg-violet-400/10 dark:bg-violet-400/15 animate-ping [animation-duration:3s]" />
              <div className="absolute size-12 rounded-full bg-violet-400/5 dark:bg-violet-400/10 animate-pulse [animation-duration:2.5s]" />
              <Shuffle className="relative size-5 text-violet-400 dark:text-violet-500" />
            </div>
            <div className="flex-1" />
            <div className="text-center space-y-1">
              <p className="text-[11px] text-muted-foreground/60">
                {t('settings.agentModeAutoDesc')}
              </p>
              <p className="text-[10px] text-muted-foreground/40">
                {t('agentBar.voiceAutoAssign')}
              </p>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
