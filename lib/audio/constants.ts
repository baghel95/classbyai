/**
 * Audio Provider Constants
 *
 * Registry of all TTS and ASR providers with their metadata.
 * Separated from tts-providers.ts and asr-providers.ts to avoid importing
 * Node.js libraries (like sharp, buffer) in client components.
 *
 * This file is client-safe and can be imported in both client and server components.
 *
 * To add a new provider:
 * 1. Add the provider ID to TTSProviderId or ASRProviderId in types.ts
 * 2. Add provider configuration to TTS_PROVIDERS or ASR_PROVIDERS below
 * 3. Implement provider logic in tts-providers.ts or asr-providers.ts
 * 4. Add i18n translations in lib/i18n.ts
 *
 * Provider configuration should include:
 * - id: Unique identifier matching the type definition
 * - name: Display name for the provider
 * - requiresApiKey: Whether the provider needs an API key
 * - defaultBaseUrl: Default API endpoint (optional)
 * - icon: Path to provider icon (optional)
 * - models: Available model choices (empty array if no model concept)
 * - defaultModelId: Default model ID (empty string if no models)
 * - voices: Array of available voices (TTS only)
 * - supportedFormats: Audio formats supported by the provider
 * - speedRange: Min/max/default speed settings (TTS only)
 * - supportedLanguages: Languages supported by the provider (ASR only)
 */

import type {
  BuiltInTTSProviderId,
  TTSProviderId,
  TTSProviderConfig,
  TTSVoiceInfo,
  BuiltInASRProviderId,
  ASRProviderId,
  ASRProviderConfig,
} from './types';
import { isCustomTTSProvider } from './types';
import {
  VOXCPM_AUTO_VOICE,
  VOXCPM_AUTO_VOICE_ID,
  VOXCPM_TTS_PROVIDER_ID,
  VOXCPM_VLLM_MODEL_ID,
} from './voxcpm';

/**
 * Default supported languages for custom OpenAI-compatible ASR providers.
 * A practical subset of commonly used languages + auto-detect.
 */
export const CUSTOM_ASR_DEFAULT_LANGUAGES = [
  'auto',
  'zh',
  'en',
  'ja',
  'ko',
  'es',
  'fr',
  'de',
  'ru',
  'ar',
  'pt',
  'it',
  'hi',
];

/**
 * TTS Provider Registry
 *
 * Central registry for all TTS providers.
 * Keep in sync with TTSProviderId type definition.
 */
export const MINIMAX_TTS_MODELS = [
  { id: 'speech-2.8-hd', name: 'Speech 2.8 HD' },
  { id: 'speech-2.8-turbo', name: 'Speech 2.8 Turbo' },
  { id: 'speech-2.6-hd', name: 'Speech 2.6 HD' },
  { id: 'speech-2.6-turbo', name: 'Speech 2.6 Turbo' },
  { id: 'speech-02-hd', name: 'Speech 02 HD' },
  { id: 'speech-02-turbo', name: 'Speech 02 Turbo' },
] as const;

export const DEFAULT_QWEN_TTS_VOICE_CLONE_MODEL = 'qwen3-tts-vc-2026-01-22';
/** Client-visible VC model. Server-only overrides are resolved in provider-config. */
export const QWEN_TTS_VOICE_CLONE_MODEL = DEFAULT_QWEN_TTS_VOICE_CLONE_MODEL;

export function isQwenVoiceCloneModel(modelId?: string, configuredModelId?: string): boolean {
  return (
    !!modelId &&
    (/-tts-vc(?:-|$)/iu.test(modelId) || (!!configuredModelId && modelId === configuredModelId))
  );
}

/** A Qwen catalog voice is provider-owned and must never use the clone model. */
export function isQwenCatalogVoice(voiceId?: string): boolean {
  return !!voiceId && TTS_PROVIDERS['qwen-tts'].voices.some((voice) => voice.id === voiceId);
}

/** A non-catalog Qwen voice ID is an enrolled clone; local profile storage is not authoritative. */
export function isQwenCloneVoice(voiceId?: string): boolean {
  return !!voiceId && !isQwenCatalogVoice(voiceId);
}

/**
 * Enforce the client-side half of the model-follows-voice invariant. The server
 * maps the VC sentinel to its operator-resolved model and applies model pins.
 */
export function resolveTTSModelForVoice(
  providerId: TTSProviderId,
  voiceId: string,
  requestedModelId?: string,
): string | undefined {
  if (providerId !== 'qwen-tts') return requestedModelId;
  if (isQwenCloneVoice(voiceId)) return QWEN_TTS_VOICE_CLONE_MODEL;
  return requestedModelId && !isQwenVoiceCloneModel(requestedModelId)
    ? requestedModelId
    : TTS_PROVIDERS['qwen-tts'].defaultModelId;
}

export const TTS_PROVIDERS: Record<BuiltInTTSProviderId, TTSProviderConfig> = {
  'openai-tts': {
    id: 'openai-tts',
    name: 'OpenAI TTS',
    requiresApiKey: true,
    defaultBaseUrl: 'https://api.openai.com/v1',
    icon: '/logos/openai.svg',
    models: [
      { id: 'gpt-4o-mini-tts', name: 'GPT-4o Mini TTS' },
      { id: 'tts-1', name: 'TTS-1' },
      { id: 'tts-1-hd', name: 'TTS-1 HD' },
    ],
    defaultModelId: 'gpt-4o-mini-tts',
    voices: [
      // Recommended voices (best quality)
      {
        id: 'marin',
        name: 'Marin',
        language: 'en',
        gender: 'neutral',
        description: 'voiceMarin',
        compatibleModels: ['gpt-4o-mini-tts'],
      },
      {
        id: 'cedar',
        name: 'Cedar',
        language: 'en',
        gender: 'neutral',
        description: 'voiceCedar',
        compatibleModels: ['gpt-4o-mini-tts'],
      },
      // Standard voices (alphabetical)
      {
        id: 'alloy',
        name: 'Alloy',
        language: 'en',
        gender: 'neutral',
        description: 'voiceAlloy',
      },
      {
        id: 'ash',
        name: 'Ash',
        language: 'en',
        gender: 'neutral',
        description: 'voiceAsh',
      },
      {
        id: 'ballad',
        name: 'Ballad',
        language: 'en',
        gender: 'neutral',
        description: 'voiceBallad',
      },
      {
        id: 'coral',
        name: 'Coral',
        language: 'en',
        gender: 'neutral',
        description: 'voiceCoral',
      },
      {
        id: 'echo',
        name: 'Echo',
        language: 'en',
        gender: 'male',
        description: 'voiceEcho',
      },
      {
        id: 'fable',
        name: 'Fable',
        language: 'en',
        gender: 'neutral',
        description: 'voiceFable',
      },
      {
        id: 'nova',
        name: 'Nova',
        language: 'en',
        gender: 'female',
        description: 'voiceNova',
      },
      {
        id: 'onyx',
        name: 'Onyx',
        language: 'en',
        gender: 'male',
        description: 'voiceOnyx',
      },
      {
        id: 'sage',
        name: 'Sage',
        language: 'en',
        gender: 'neutral',
        description: 'voiceSage',
      },
      {
        id: 'shimmer',
        name: 'Shimmer',
        language: 'en',
        gender: 'female',
        description: 'voiceShimmer',
      },
      {
        id: 'verse',
        name: 'Verse',
        language: 'en',
        gender: 'neutral',
        description: 'voiceVerse',
      },
    ],
    supportedFormats: ['mp3', 'opus', 'aac', 'flac'],
    speedRange: { min: 0.25, max: 4.0, default: 1.0 },
  },

  'azure-tts': {
    id: 'azure-tts',
    name: 'Azure TTS',
    requiresApiKey: true,
    defaultBaseUrl: 'https://{region}.tts.speech.microsoft.com',
    icon: '/logos/azure.svg',
    models: [],
    defaultModelId: '',
    voices: [
      {
        id: 'en-US-JennyNeural',
        name: 'Jenny',
        language: 'en-US',
        gender: 'female',
      },
      { id: 'en-US-GuyNeural', name: 'Guy', language: 'en-US', gender: 'male' },
    ],
    supportedFormats: ['mp3', 'wav', 'ogg'],
    speedRange: { min: 0.5, max: 2.0, default: 1.0 },
  },

'lemonade-tts': {
    id: 'lemonade-tts',
    name: 'Lemonade TTS',
    requiresApiKey: false,
    defaultBaseUrl: 'http://localhost:13305/v1',
    icon: '/logos/lemonade.svg',
    models: [{ id: 'kokoro-v1', name: 'Kokoro v1' }],
    defaultModelId: 'kokoro-v1',
    voices: [
      // American English — female
      { id: 'af_alloy', name: 'Alloy', language: 'en-US', gender: 'female' },
      { id: 'af_aoede', name: 'Aoede', language: 'en-US', gender: 'female' },
      { id: 'af_bella', name: 'Bella', language: 'en-US', gender: 'female' },
      { id: 'af_heart', name: 'Heart', language: 'en-US', gender: 'female' },
      { id: 'af_jessica', name: 'Jessica', language: 'en-US', gender: 'female' },
      { id: 'af_kore', name: 'Kore', language: 'en-US', gender: 'female' },
      { id: 'af_nicole', name: 'Nicole', language: 'en-US', gender: 'female' },
      { id: 'af_nova', name: 'Nova', language: 'en-US', gender: 'female' },
      { id: 'af_river', name: 'River', language: 'en-US', gender: 'female' },
      { id: 'af_sarah', name: 'Sarah', language: 'en-US', gender: 'female' },
      { id: 'af_sky', name: 'Sky', language: 'en-US', gender: 'female' },
      // American English — male
      { id: 'am_adam', name: 'Adam', language: 'en-US', gender: 'male' },
      { id: 'am_echo', name: 'Echo', language: 'en-US', gender: 'male' },
      { id: 'am_eric', name: 'Eric', language: 'en-US', gender: 'male' },
      { id: 'am_fenrir', name: 'Fenrir', language: 'en-US', gender: 'male' },
      { id: 'am_liam', name: 'Liam', language: 'en-US', gender: 'male' },
      { id: 'am_michael', name: 'Michael', language: 'en-US', gender: 'male' },
      { id: 'am_onyx', name: 'Onyx', language: 'en-US', gender: 'male' },
      { id: 'am_puck', name: 'Puck', language: 'en-US', gender: 'male' },
      // British English — female
      { id: 'bf_alice', name: 'Alice', language: 'en-GB', gender: 'female' },
      { id: 'bf_emma', name: 'Emma', language: 'en-GB', gender: 'female' },
      { id: 'bf_isabella', name: 'Isabella', language: 'en-GB', gender: 'female' },
      { id: 'bf_lily', name: 'Lily', language: 'en-GB', gender: 'female' },
      // British English — male
      { id: 'bm_daniel', name: 'Daniel', language: 'en-GB', gender: 'male' },
      { id: 'bm_fable', name: 'Fable', language: 'en-GB', gender: 'male' },
      { id: 'bm_george', name: 'George', language: 'en-GB', gender: 'male' },
      { id: 'bm_lewis', name: 'Lewis', language: 'en-GB', gender: 'male' },
      // Mandarin Chinese — female
      { id: 'zf_xiaobei', name: '晓贝', language: 'zh-CN', gender: 'female' },
      { id: 'zf_xiaoni', name: '晓妮', language: 'zh-CN', gender: 'female' },
      { id: 'zf_xiaoxiao', name: '晓晓', language: 'zh-CN', gender: 'female' },
      { id: 'zf_xiaoyi', name: '晓伊', language: 'zh-CN', gender: 'female' },
      // Mandarin Chinese — male
      { id: 'zm_yunjian', name: '云健', language: 'zh-CN', gender: 'male' },
      { id: 'zm_yunxi', name: '云希', language: 'zh-CN', gender: 'male' },
      { id: 'zm_yunxia', name: '云夏', language: 'zh-CN', gender: 'male' },
      { id: 'zm_yunyang', name: '云扬', language: 'zh-CN', gender: 'male' },
      // Japanese — female
      { id: 'jf_alpha', name: 'Alpha', language: 'ja-JP', gender: 'female' },
      { id: 'jf_gongitsune', name: 'Gongitsune', language: 'ja-JP', gender: 'female' },
      { id: 'jf_nezumi', name: 'Nezumi', language: 'ja-JP', gender: 'female' },
      { id: 'jf_tebukuro', name: 'Tebukuro', language: 'ja-JP', gender: 'female' },
      // Japanese — male
      { id: 'jm_kumo', name: 'Kumo', language: 'ja-JP', gender: 'male' },
      // Spanish
      { id: 'ef_dora', name: 'Dora', language: 'es-ES', gender: 'female' },
      { id: 'em_alex', name: 'Alex', language: 'es-ES', gender: 'male' },
      { id: 'em_santa', name: 'Santa', language: 'es-ES', gender: 'male' },
      // French
      { id: 'ff_siwis', name: 'Siwis', language: 'fr-FR', gender: 'female' },
      // Hindi
      { id: 'hf_alpha', name: 'Alpha', language: 'hi-IN', gender: 'female' },
      { id: 'hf_beta', name: 'Beta', language: 'hi-IN', gender: 'female' },
      { id: 'hm_omega', name: 'Omega', language: 'hi-IN', gender: 'male' },
      { id: 'hm_psi', name: 'Psi', language: 'hi-IN', gender: 'male' },
      // Italian
      { id: 'if_sara', name: 'Sara', language: 'it-IT', gender: 'female' },
      { id: 'im_nicola', name: 'Nicola', language: 'it-IT', gender: 'male' },
      // Brazilian Portuguese
      { id: 'pf_dora', name: 'Dora', language: 'pt-BR', gender: 'female' },
      { id: 'pm_alex', name: 'Alex', language: 'pt-BR', gender: 'male' },
      { id: 'pm_santa', name: 'Santa', language: 'pt-BR', gender: 'male' },
    ],
    supportedFormats: ['wav'],
    speedRange: { min: 0.25, max: 4.0, default: 1.0 },

  'sarvam-tts': {
    id: 'sarvam-tts',
    name: 'Sarvam AI (Bulbul v3)',
    requiresApiKey: true,
    defaultBaseUrl: 'https://api.sarvam.ai',
    icon: '/logos/sarvam.svg',
    voices: [
      { id: 'en-IN', name: 'English (India)', language: 'en-IN', gender: 'neutral' },
      { id: 'hi-IN', name: 'Hindi (हिन्दी)', language: 'hi-IN', gender: 'neutral' },
      { id: 'bn-IN', name: 'Bengali (বাংলা)', language: 'bn-IN', gender: 'neutral' },
      { id: 'kn-IN', name: 'Kannada (ಕನ್ನಡ)', language: 'kn-IN', gender: 'neutral' },
      { id: 'ml-IN', name: 'Malayalam (മലയാളം)', language: 'ml-IN', gender: 'neutral' },
      { id: 'mr-IN', name: 'Marathi (मराठी)', language: 'mr-IN', gender: 'neutral' },
      { id: 'gu-IN', name: 'Gujarati (ગુજરાતી)', language: 'gu-IN', gender: 'neutral' },
      { id: 'ta-IN', name: 'Tamil (தமிழ்)', language: 'ta-IN', gender: 'neutral' },
      { id: 'te-IN', name: 'Telugu (తెలుగు)', language: 'te-IN', gender: 'neutral' },
      { id: 'pa-IN', name: 'Punjabi (ਪੰਜਾਬੀ)', language: 'pa-IN', gender: 'neutral' },
      { id: 'od-IN', name: 'Odia (ଓଡ଼ିଆ)', language: 'od-IN', gender: 'neutral' },
    ],
    supportedFormats: ['wav', 'mp3'],
    speedRange: { min: 0.5, max: 2.0, default: 1.0 },
  },
  },
};

/**
 * ASR Provider Registry
 *
 * Central registry for all ASR providers.
 * Keep in sync with ASRProviderId type definition.
 */
export const ASR_PROVIDERS: Record<BuiltInASRProviderId, ASRProviderConfig> = {
  'openai-whisper': {
    id: 'openai-whisper',
    name: 'OpenAI Whisper',
    requiresApiKey: true,
    defaultBaseUrl: 'https://api.openai.com/v1',
    icon: '/logos/openai.svg',
    models: [
      { id: 'gpt-4o-mini-transcribe', name: 'GPT-4o Mini Transcribe' },
      { id: 'gpt-4o-transcribe', name: 'GPT-4o Transcribe' },
      { id: 'whisper-1', name: 'Whisper-1' },
    ],
    defaultModelId: 'gpt-4o-mini-transcribe',
    supportedLanguages: [
      // OpenAI Whisper supports 58 languages (as of official docs)
      // Source: https://platform.openai.com/docs/guides/speech-to-text
      'auto', // Auto-detect
      // Hot languages (commonly used)
      'en', // English
      'ja', // Japanese
      'ko', // Korean
      'es', // Spanish
      'fr', // French
      'de', // German
      'ru', // Russian
      'ar', // Arabic
      'pt', // Portuguese
      'it', // Italian
      'hi', // Hindi
      // Other languages (alphabetical)
      'af', // Afrikaans
      'hy', // Armenian
      'az', // Azerbaijani
      'be', // Belarusian
      'bs', // Bosnian
      'bg', // Bulgarian
      'ca', // Catalan
      'hr', // Croatian
      'cs', // Czech
      'da', // Danish
      'nl', // Dutch
      'et', // Estonian
      'fi', // Finnish
      'gl', // Galician
      'el', // Greek
      'he', // Hebrew
      'hu', // Hungarian
      'is', // Icelandic
      'id', // Indonesian
      'kn', // Kannada
      'kk', // Kazakh
      'lv', // Latvian
      'lt', // Lithuanian
      'mk', // Macedonian
      'ms', // Malay
      'mr', // Marathi
      'mi', // Maori
      'ne', // Nepali
      'no', // Norwegian
      'fa', // Persian
      'pl', // Polish
      'ro', // Romanian
      'sr', // Serbian
      'sk', // Slovak
      'sl', // Slovenian
      'sw', // Swahili
      'sv', // Swedish
      'tl', // Tagalog
      'ta', // Tamil
      'th', // Thai
      'tr', // Turkish
      'uk', // Ukrainian
      'ur', // Urdu
      'vi', // Vietnamese
      'cy', // Welsh
    ],
    supportedFormats: ['mp3', 'mp4', 'mpeg', 'mpga', 'm4a', 'wav', 'webm'],
  },

  'qwen-asr': {
    id: 'qwen-asr',
    name: 'Qwen ASR (阿里云百炼)',
    requiresApiKey: true,
    defaultBaseUrl: 'https://dashscope.aliyuncs.com/api/v1',
    icon: '/logos/bailian.svg',
    models: [{ id: 'qwen3-asr-flash', name: 'Qwen3 ASR Flash' }],
    defaultModelId: 'qwen3-asr-flash',
    supportedLanguages: [
      // Qwen ASR supports 27 languages + auto-detect
      // If language is uncertain or mixed (e.g. Chinese-English-Japanese-Korean), use "auto" (do not specify language parameter)
      'auto', // Auto-detect (do not specify language parameter)
      // Hot languages (commonly used)
      'en', // English
      'ja', // Japanese
      'ko', // Korean
      'de', // German
      'fr', // French
      'ru', // Russian
      'es', // Spanish
      'pt', // Portuguese
      'ar', // Arabic
      'it', // Italian
      'hi', // Hindi
      // Other languages (alphabetical)
      'cs', // Czech
      'da', // Danish
      'fi', // Finnish
      'fil', // Filipino
      'id', // Indonesian
      'is', // Icelandic
      'ms', // Malay
      'no', // Norwegian
      'pl', // Polish
      'sv', // Swedish
      'th', // Thai
      'tr', // Turkish
      'uk', // Ukrainian
      'vi', // Vietnamese
    ],
    supportedFormats: ['mp3', 'wav', 'webm', 'm4a', 'flac'],
  },

  'azure-asr': {
    id: 'azure-asr',
    name: 'Azure STT',
    requiresApiKey: true,
    defaultBaseUrl: 'https://{region}.api.cognitive.microsoft.com',
    icon: '/logos/azure.svg',
    models: [],
    defaultModelId: '',
    supportedLanguages: [
      'auto',
      'en',
      'zh',
      'ja',
      'ko',
      'de',
      'fr',
      'es',
      'it',
      'pt',
      'ru',
      'ar',
      'hi',
    ],
    supportedFormats: ['wav', 'ogg', 'webm', 'mp3', 'flac', 'm4a'],
  },

  'browser-native': {
    id: 'browser-native',
    name: '浏览器原生 ASR (Web Speech API)',
    requiresApiKey: false,
    icon: '/logos/browser.svg',
    models: [],
    defaultModelId: '',
    supportedLanguages: [
      // English variants
      'en-US', // English (United States)
      'en-GB', // English (United Kingdom)
      'en-AU', // English (Australia)
      'en-CA', // English (Canada)
      'en-IN', // English (India)
      'en-NZ', // English (New Zealand)
      'en-ZA', // English (South Africa)
      // Japanese & Korean
      'ja-JP', // Japanese (Japan)
      'ko-KR', // Korean (South Korea)
      // European languages
      'de-DE', // German (Germany)
      'fr-FR', // French (France)
      'es-ES', // Spanish (Spain)
      'es-MX', // Spanish (Mexico)
      'es-AR', // Spanish (Argentina)
      'es-CO', // Spanish (Colombia)
      'it-IT', // Italian (Italy)
      'pt-BR', // Portuguese (Brazil)
      'pt-PT', // Portuguese (Portugal)
      'ru-RU', // Russian (Russia)
      'nl-NL', // Dutch (Netherlands)
      'pl-PL', // Polish (Poland)
      'cs-CZ', // Czech (Czech Republic)
      'da-DK', // Danish (Denmark)
      'fi-FI', // Finnish (Finland)
      'sv-SE', // Swedish (Sweden)
      'no-NO', // Norwegian (Norway)
      'tr-TR', // Turkish (Turkey)
      'el-GR', // Greek (Greece)
      'hu-HU', // Hungarian (Hungary)
      'ro-RO', // Romanian (Romania)
      'sk-SK', // Slovak (Slovakia)
      'bg-BG', // Bulgarian (Bulgaria)
      'hr-HR', // Croatian (Croatia)
      'ca-ES', // Catalan (Spain)
      // Middle East & Asia
      'ar-SA', // Arabic (Saudi Arabia)
      'ar-EG', // Arabic (Egypt)
      'he-IL', // Hebrew (Israel)
      'hi-IN', // Hindi (India)
      'th-TH', // Thai (Thailand)
      'vi-VN', // Vietnamese (Vietnam)
      'id-ID', // Indonesian (Indonesia)
      'ms-MY', // Malay (Malaysia)
      'fil-PH', // Filipino (Philippines)
      // Other
      'af-ZA', // Afrikaans (South Africa)
      'uk-UA', // Ukrainian (Ukraine)
    ],
    supportedFormats: ['webm'], // MediaRecorder format
  },
'funasr-asr': {
    id: 'funasr-asr',
    name: 'FunASR',
    requiresApiKey: false,
    defaultBaseUrl: 'http://localhost:8000/v1',
    icon: '/logos/funasr.png',
    models: [
      { id: 'sensevoice', name: 'SenseVoiceSmall' },
      { id: 'paraformer', name: 'Paraformer' },
      { id: 'fun-asr-nano', name: 'Fun-ASR-Nano' },
    ],
    defaultModelId: 'sensevoice',
    supportedLanguages: ['auto', 'zh', 'en', 'ja', 'ko', 'yue'],
    supportedFormats: ['wav'],
  },

  'lemonade-asr': {
    id: 'lemonade-asr',
    name: 'Lemonade ASR',
    requiresApiKey: false,
    defaultBaseUrl: 'http://localhost:13305/v1',
    icon: '/logos/lemonade.svg',
    models: [
      { id: 'Whisper-Base', name: 'Whisper Base' },
      { id: 'Whisper-Large-v3', name: 'Whisper Large v3' },
      { id: 'Whisper-Large-v3-Turbo', name: 'Whisper Large v3 Turbo' },
      { id: 'Whisper-Medium', name: 'Whisper Medium' },
      { id: 'Whisper-Small', name: 'Whisper Small' },
      { id: 'Whisper-Tiny', name: 'Whisper Tiny' },
    ],
    defaultModelId: 'Whisper-Base',
    supportedLanguages: CUSTOM_ASR_DEFAULT_LANGUAGES,
    supportedFormats: ['wav'],
  },

  'sarvam-asr': {
    id: 'sarvam-asr',
    name: 'Sarvam AI (Saaras v3)',
    requiresApiKey: true,
    defaultBaseUrl: 'https://api.sarvam.ai',
    icon: '/logos/sarvam.svg',
    supportedLanguages: [
      'en-IN',
      'hi-IN',
      'bn-IN',
      'kn-IN',
      'ml-IN',
      'mr-IN',
      'gu-IN',
      'ta-IN',
      'te-IN',
      'pa-IN',
      'od-IN',
      'as-IN',
      'brx-IN',
      'doi-IN',
      'gom-IN',
      'ks-IN',
      'mai-IN',
      'mni-IN',
      'ne-IN',
      'sa-IN',
      'sat-IN',
      'sd-IN',
      'ur-IN',
    ],
    supportedFormats: ['wav', 'mp3', 'm4a', 'flac'],
  },
};

/**
 * Default voice for each TTS provider.
 * Used when switching providers or testing a non-active provider.
 */
export const DEFAULT_TTS_VOICES: Record<BuiltInTTSProviderId, string> = {
  'openai-tts': 'alloy',
  'azure-tts': 'en-US-JennyNeural',
  'qwen-tts': 'Bodega',
  'voxcpm-tts': VOXCPM_AUTO_VOICE_ID,
  'doubao-tts': 'zh_female_vv_uranus_bigtts',
  'elevenlabs-tts': 'EXAVITQu4vr4xnSDxMaL',
  'minimax-tts': 'female-yujie',
  'lemonade-tts': 'af_heart',
  'sarvam-tts': 'en-IN',
  'glm-tts': 'tongtong',
  'browser-native-tts': 'default',
};

export const DEFAULT_TTS_MODELS: Record<BuiltInTTSProviderId, string> = {
  'openai-tts': 'gpt-4o-mini-tts',
  'azure-tts': '',
  'glm-tts': 'glm-tts',
  'qwen-tts': 'qwen3-tts-flash',
  'voxcpm-tts': VOXCPM_VLLM_MODEL_ID,
  'doubao-tts': '',
  'elevenlabs-tts': 'eleven_multilingual_v2',
  'minimax-tts': 'speech-2.8-hd',
  'lemonade-tts': 'kokoro-v1',
  'browser-native-tts': '',
};

/**
 * Get all available TTS providers (built-in + custom)
 */
export function getAllTTSProviders(
  customProviders?: Record<string, TTSProviderConfig>,
): TTSProviderConfig[] {
  const builtIn = Object.values(TTS_PROVIDERS);
  const custom = customProviders ? Object.values(customProviders) : [];
  return [...builtIn, ...custom];
}

/**
 * Narrow an arbitrary string (e.g. from a persisted document or an imported
 * manifest, where the contract keeps providerId an open string) to a known
 * TTS provider id: a registered built-in provider or the user-defined
 * custom-provider namespace. Anything else must be treated as "no voice".
 */
export function isKnownTTSProviderId(id: string): id is TTSProviderId {
  // Object.hasOwn, not `in`: prototype-chain keys ('toString', 'constructor',
  // …) must not pass a whitelist built from an object literal.
  return Object.hasOwn(TTS_PROVIDERS, id) || isCustomTTSProvider(id);
}

/**
 * Get TTS provider by ID (checks built-in first, then custom)
 */
export function getTTSProvider(
  providerId: TTSProviderId,
  customProviders?: Record<string, TTSProviderConfig>,
): TTSProviderConfig | undefined {
  if (Object.hasOwn(TTS_PROVIDERS, providerId)) {
    return TTS_PROVIDERS[providerId as BuiltInTTSProviderId];
  }
  return customProviders?.[providerId];
}

/**
 * Models a user may pick manually in the UI. The Qwen voice-clone model is
 * excluded: it is never chosen by hand, only resolved implicitly from a picked
 * clone voice (model-follows-voice), so it must not appear in manual model
 * pickers while staying in the provider registry for voice-driven dispatch.
 */
export function getManuallySelectableTTSModels(
  providerId: TTSProviderId,
  customProviders?: Record<string, TTSProviderConfig>,
): TTSProviderConfig['models'] {
  const provider = getTTSProvider(providerId, customProviders);
  return (provider?.models || []).filter((model) => !isQwenVoiceCloneModel(model.id));
}

/**
 * Get voices for a specific TTS provider
 */
export function getTTSVoices(
  providerId: TTSProviderId,
  customProviders?: Record<string, TTSProviderConfig>,
): TTSVoiceInfo[] {
  return getTTSProvider(providerId, customProviders)?.voices || [];
}

/**
 * Get all available ASR providers (built-in + custom)
 */
export function getAllASRProviders(
  customProviders?: Record<string, ASRProviderConfig>,
): ASRProviderConfig[] {
  const builtIn = Object.values(ASR_PROVIDERS);
  const custom = customProviders ? Object.values(customProviders) : [];
  return [...builtIn, ...custom];
}

/**
 * Get ASR provider by ID (checks built-in first, then custom)
 */
export function getASRProvider(
  providerId: ASRProviderId,
  customProviders?: Record<string, ASRProviderConfig>,
): ASRProviderConfig | undefined {
  if (Object.hasOwn(ASR_PROVIDERS, providerId)) {
    return ASR_PROVIDERS[providerId as BuiltInASRProviderId];
  }
  return customProviders?.[providerId];
}

/**
 * Get supported languages for a specific ASR provider
 */
export function getASRSupportedLanguages(
  providerId: ASRProviderId,
  customProviders?: Record<string, ASRProviderConfig>,
): string[] {
  return getASRProvider(providerId, customProviders)?.supportedLanguages || [];
}
