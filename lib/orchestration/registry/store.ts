/**
 * Agent Registry Store
 * Manages configurable AI agents using Zustand with localStorage persistence
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AgentConfig } from './types';
import { getActionsForRole } from './types';
import type { TTSProviderId } from '@/lib/audio/types';
import { USER_AVATAR } from '@/lib/types/roundtable';
import type { Participant, ParticipantRole } from '@/lib/types/roundtable';
import { useUserProfileStore } from '@/lib/store/user-profile';
import type { AgentInfo } from '@/lib/generation/pipeline-types';
import { 
  queryFromFirestore, 
  saveToFirestore, 
  deleteFromFirestore,
  GENERATED_AGENTS_COLLECTION 
} from '@/lib/utils/firebase-storage';

interface AgentRegistryState {
  agents: Record<string, AgentConfig>; // Map of agentId -> config

  // Actions
  addAgent: (agent: AgentConfig) => void;
  updateAgent: (id: string, updates: Partial<AgentConfig>) => void;
  deleteAgent: (id: string) => void;
  getAgent: (id: string) => AgentConfig | undefined;
  listAgents: () => AgentConfig[];
}

// Action types available to agents
const WHITEBOARD_ACTIONS = [
  'wb_open',
  'wb_close',
  'wb_draw_text',
  'wb_draw_shape',
  'wb_draw_chart',
  'wb_draw_latex',
  'wb_draw_table',
  'wb_draw_line',
  'wb_clear',
  'wb_delete',
];

const SLIDE_ACTIONS = ['spotlight', 'laser', 'play_video'];

// Default agents - always available on both server and client
const DEFAULT_AGENTS: Record<string, AgentConfig> = {
  'default-1': {
    id: 'default-1',
    name: 'Arun Sir',
    role: 'teacher',
    persona: `You are Arun Sir, the lead teacher. You teach with clarity, warmth, and genuine enthusiasm, often relating concepts to the Indian context and competitive exams (like Boards, JEE, or NEET) where relevant.

Your teaching style:
- Explain concepts step by step, building from the NCERT foundation or common Indian curriculum.
- Use relatable Indian analogies (e.g., cricket, local festivals, or street food) to make abstract ideas concrete.
- Pause to check understanding — ask questions like "Samajh aaya?" (Did you understand?) or "Koi doubt?" (Any doubts?).
- Encourage students by name, using titles like 'Beta' or 'Bachho' occasionally to build rapport.
- Gently correct mistakes, ensuring students feel confident for their upcoming assessments.

You can spotlight or laser-point at slide elements, and use the whiteboard for hand-drawn explanations. Use these actions naturally.

Tone: Professional, respected, yet fatherly and approachable. Patient. Encouraging.`,
    avatar: '/avatars/teacher.png',
    color: '#3b82f6',
    allowedActions: [...SLIDE_ACTIONS, ...WHITEBOARD_ACTIONS],
    priority: 10,
    createdAt: new Date(),
    updatedAt: new Date(),
    isDefault: true,
  },
  'default-2': {
    id: 'default-2',
    name: 'Aditi',
    role: 'assistant',
    persona: `You are Aditi, the teaching assistant. You support Arun Sir by simplifying complex topics and helping students keep up with the pace of the Indian curriculum.

Your style:
- When a student is confused, rephrase explanations in simple Hinglish or use common Indian classroom shorthand.
- Provide practical examples from Indian daily life (e.g., local markets, family gatherings, or regional tech).
- Proactively offer tips for board exams or common pitfalls Indian students face.
- Summarize key formulas or definitions at the end of a section.

You play a supportive role — like a helpful senior student or a friendly tutor.

Tone: Friendly, helpful, and organized. Using a mix of English and simple Hindi terms (Hinglish) makes you feel more relatable.`,
    avatar: '/avatars/assist.png',
    color: '#10b981',
    allowedActions: [...WHITEBOARD_ACTIONS],
    priority: 7,
    createdAt: new Date(),
    updatedAt: new Date(),
    isDefault: true,
  },
  'default-3': {
    id: 'default-3',
    name: 'Rahul',
    role: 'student',
    persona: `You are Rahul, the class jokester. You bring energy to the classroom with your humor, Bollywood references, and witty takes on the lesson.

Your personality:
- You crack jokes, use famous movie dialogues, and make funny connections to the topic.
- You might pretend to be overwhelmed by "too much syllabus" for comedic effect.
- You're the heart of the class, making sure the atmosphere stays light even during tough subjects like Math or Physics.
- You speak casually, using slang like "bindass," "tension mat lo," or "ek number."

Tone: Playful, energetic, and cheerful. Keep responses SHORT — one-liners or quick reactions.`,
    avatar: '/avatars/clown.png',
    color: '#f59e0b',
    allowedActions: [...WHITEBOARD_ACTIONS],
    priority: 4,
    createdAt: new Date(),
    updatedAt: new Date(),
    isDefault: true,
  },
  'default-4': {
    id: 'default-4',
    name: 'Isha',
    role: 'student',
    persona: `You are Isha, the curious student. You always have a "why" or "how" ready, especially about how the topic relates to the world around you in India.

Your personality:
- You ask deep questions about the practical application of concepts (e.g., "How does this help in ISRO missions?").
- You're not afraid to admit when you're confused by complex heavy topics.
- You get excited about new discoveries and often share "did you know" facts.
- Your questions usually help the whole class see the broader picture.

Tone: Eager, inquisitive, and bright. Keep questions concise and direct.`,
    avatar: '/avatars/curious.png',
    color: '#ec4899',
    allowedActions: [...WHITEBOARD_ACTIONS],
    priority: 5,
    createdAt: new Date(),
    updatedAt: new Date(),
    isDefault: true,
  },
  'default-5': {
    id: 'default-5',
    name: 'Karan',
    role: 'student',
    persona: `You are Karan, the diligent scribe. You excel at organizing messy information into perfect, exam-ready notes.

Your personality:
- You distill complex lectures into structured points, focusing on what's important for marks.
- You provide summaries using bullet points, bolding key terms.
- You often use the whiteboard to list definitions, laws, or formulas.
- You're the one everyone asks for notes before a unit test.

Tone: Serious, organized, and helpful. You speak precisely and prioritize clarity.`,
    avatar: '/avatars/note-taker.png',
    color: '#06b6d4',
    allowedActions: [...WHITEBOARD_ACTIONS],
    priority: 5,
    createdAt: new Date(),
    updatedAt: new Date(),
    isDefault: true,
  },
  'default-6': {
    id: 'default-6',
    name: 'Siddharth',
    role: 'student',
    persona: `You are Siddharth, the deep thinker. You look beyond the syllabus to understand the fundamental laws and philosophical side of what's being taught.

Your personality:
- You connect class topics to broader scientific or historical contexts.
- You respectfully challenge ideas, asking "But what if...?" or "Don't you think this implies...?"
- You value conceptual depth over rote memorization.
- Your calm and steady voice adds logic to intense discussions.

Tone: Thoughtful, calm, and intellectually deep. You speak less but with high impact.`,
    avatar: '/avatars/thinker.png',
    color: '#8b5cf6',
    allowedActions: [...WHITEBOARD_ACTIONS],
    priority: 6,
    createdAt: new Date(),
    updatedAt: new Date(),
    isDefault: true,
  },
};

/**
 * Return the built-in default agents as lightweight AgentInfo objects
 * suitable for the generation pipeline (no UI-only fields like avatar/color).
 */
export function getDefaultAgents(): AgentInfo[] {
  return Object.values(DEFAULT_AGENTS).map((a) => ({
    id: a.id,
    name: a.name,
    role: a.role,
    persona: a.persona,
  }));
}

export const useAgentRegistry = create<AgentRegistryState>()(
  persist(
    (set, get) => ({
      // Initialize with default agents so they're available on server
      agents: { ...DEFAULT_AGENTS },

      addAgent: (agent) =>
        set((state) => ({
          agents: { ...state.agents, [agent.id]: agent },
        })),

      updateAgent: (id, updates) =>
        set((state) => ({
          agents: {
            ...state.agents,
            [id]: { ...state.agents[id], ...updates, updatedAt: new Date() },
          },
        })),

      deleteAgent: (id) =>
        set((state) => {
          const { [id]: _removed, ...rest } = state.agents;
          return { agents: rest };
        }),

      getAgent: (id) => get().agents[id],

      listAgents: () => Object.values(get().agents),
    }),
    {
      name: 'agent-registry-storage',
      version: 11, // Bumped: add voiceOverrides field to AgentConfig
      migrate: (persistedState: unknown) => persistedState,
      // Merge persisted state with default agents
      // Default agents always use code-defined values (not cached)
      // Custom agents use persisted values
      merge: (persistedState: unknown, currentState) => {
        const persisted = persistedState as Record<string, unknown> | undefined;
        const persistedAgents = (persisted?.agents || {}) as Record<string, AgentConfig>;
        const mergedAgents: Record<string, AgentConfig> = { ...DEFAULT_AGENTS };

        // Only preserve non-default, non-generated (custom) agents from cache
        // Generated agents are loaded on-demand from IndexedDB per stage
        for (const [id, agent] of Object.entries(persistedAgents)) {
          const agentConfig = agent as AgentConfig;
          if (!id.startsWith('default-') && !agentConfig.isGenerated) {
            mergedAgents[id] = agentConfig;
          }
        }

        return {
          ...currentState,
          agents: mergedAgents,
        };
      },
    },
  ),
);

/**
 * Convert agents to roundtable participants
 * Maps agent roles to participant roles for the UI
 * @param t - i18n translation function for localized display names
 */
export function agentsToParticipants(
  agentIds: string[],
  t?: (key: string) => string,
): Participant[] {
  const registry = useAgentRegistry.getState();
  const participants: Participant[] = [];
  let hasTeacher = false;

  // Resolve agents and sort: teacher first (by role then priority desc)
  const resolved = agentIds
    .map((id) => registry.getAgent(id))
    .filter((a): a is AgentConfig => a != null);
  resolved.sort((a, b) => {
    if (a.role === 'teacher' && b.role !== 'teacher') return -1;
    if (a.role !== 'teacher' && b.role === 'teacher') return 1;
    return (b.priority ?? 0) - (a.priority ?? 0);
  });

  for (const agent of resolved) {
    // Map agent role to participant role:
    // The first agent with role "teacher" becomes the left-side teacher.
    // If no agent has role "teacher", the highest-priority agent becomes teacher.
    let role: ParticipantRole = 'student';
    if (!hasTeacher) {
      role = 'teacher';
      hasTeacher = true;
    }

    // Use i18n name for default agents, fall back to registry name
    const i18nName = t?.(`settings.agentNames.${agent.id}`);
    const displayName =
      i18nName && i18nName !== `settings.agentNames.${agent.id}` ? i18nName : agent.name;

    participants.push({
      id: agent.id,
      name: displayName,
      role,
      avatar: agent.avatar,
      isOnline: true,
      isSpeaking: false,
    });
  }

  // Always add user participant — use profile store when available
  const userProfile = useUserProfileStore.getState();
  const userName = userProfile.nickname || t?.('common.you') || 'You';
  const userAvatar = userProfile.avatar || USER_AVATAR;

  participants.push({
    id: 'user-1',
    name: userName,
    role: 'user',
    avatar: userAvatar,
    isOnline: true,
    isSpeaking: false,
  });

  return participants;
}

/**
 * Load generated agents for a stage from IndexedDB into the registry.
 * Clears any previously loaded generated agents first.
 * Returns the loaded agent IDs.
 */
export async function loadGeneratedAgentsForStage(stageId: string, userId: string): Promise<string[]> {
  const allRecords = await queryFromFirestore<any>(GENERATED_AGENTS_COLLECTION, userId);
  const records = allRecords.filter(r => r.stageId === stageId);

  if (records.length === 0) return [];

  const registry = useAgentRegistry.getState();

  // Clear previously loaded generated agents
  const currentAgents = registry.listAgents();
  for (const agent of currentAgents) {
    if (agent.isGenerated) {
      registry.deleteAgent(agent.id);
    }
  }

  // Add new ones
  const ids: string[] = [];
  for (const record of records) {
    registry.addAgent({
      ...record,
      allowedActions: getActionsForRole(record.role),
      isDefault: false,
      isGenerated: true,
      boundStageId: record.stageId,
      createdAt: new Date(record.createdAt),
      updatedAt: new Date(record.createdAt),
    });
    ids.push(record.id);
  }

  return ids;
}

/**
 * Save generated agents to IndexedDB and registry.
 * Clears old generated agents for this stage first.
 */
export async function saveGeneratedAgents(
  stageId: string,
  userId: string,
  agents: Array<{
    id: string;
    name: string;
    role: string;
    persona: string;
    avatar: string;
    color: string;
    priority: number;
    voiceConfig?: { providerId: string; voiceId: string };
  }>,
): Promise<string[]> {
  // Clear old generated agents for this stage in Firestore
  // Note: Firestore doesn't support where delete, we'd need to query first or use a compound key as ID
  // Let's use stageId:agentId as compound key to make deletion easier if needed, 
  // or just overwrite if IDs are stable.
  
  // For now, let's just query and delete (standard Firestore pattern for small collections)
  const existing = await queryFromFirestore<any>(GENERATED_AGENTS_COLLECTION, userId);
  const toDelete = existing.filter(a => a.stageId === stageId);
  for (const agent of toDelete) {
    await deleteFromFirestore(GENERATED_AGENTS_COLLECTION, agent.id);
  }

  // Clear from registry
  const registry = useAgentRegistry.getState();
  for (const agent of registry.listAgents()) {
    if (agent.isGenerated) registry.deleteAgent(agent.id);
  }

  // Write to Firestore
  const records = agents.map((a) => ({ ...a, stageId, createdAt: Date.now() }));
  for (const record of records) {
    await saveToFirestore(GENERATED_AGENTS_COLLECTION, record.id, record, userId);
  }

  // Add to registry
  for (const record of records) {
    const { voiceConfig, ...rest } = record;
    registry.addAgent({
      ...rest,
      allowedActions: getActionsForRole(record.role),
      isDefault: false,
      isGenerated: true,
      boundStageId: stageId,
      createdAt: new Date(record.createdAt),
      updatedAt: new Date(record.createdAt),
      ...(voiceConfig
        ? {
            voiceConfig: {
              providerId: voiceConfig.providerId as TTSProviderId,
              voiceId: voiceConfig.voiceId,
            },
          }
        : {}),
    });
  }

  return records.map((r) => r.id);
}
