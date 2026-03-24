'use client';

import { useSession } from 'next-auth/react';
import { useEffect } from 'react';
import { useStageStore } from '@/lib/store/stage';
import { useMediaGenerationStore } from '@/lib/store/media-generation';
import { useSettingsStore } from '@/lib/store/settings';

/**
 * Syncs the NextAuth session userId with the StageStore.
 * Renders nothing — purely a side-effect component.
 */
export function AuthSync() {
  const { data: session } = useSession();
  const setStageUserId = useStageStore((state) => state.setUserId);
  const setMediaUserId = useMediaGenerationStore((state) => state.setUserId);
  const { setUserId: setSettingsUserId, loadSettings } = useSettingsStore();

  useEffect(() => {
    if (session?.user?.id) {
      const userId = session.user.id;
      setStageUserId(userId);
      setMediaUserId(userId);
      setSettingsUserId(userId);
      loadSettings(userId);
    } else {
      setStageUserId(null);
      setMediaUserId(null);
      setSettingsUserId(null);
    }
  }, [session, setStageUserId, setMediaUserId, setSettingsUserId, loadSettings]);

  return null;
}
