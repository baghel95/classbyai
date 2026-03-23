'use client';

import { useSession } from 'next-auth/react';
import { useEffect } from 'react';
import { useStageStore } from '@/lib/store/stage';
import { useMediaGenerationStore } from '@/lib/store/media-generation';

/**
 * Syncs the NextAuth session userId with the StageStore.
 * Renders nothing — purely a side-effect component.
 */
export function AuthSync() {
  const { data: session } = useSession();
  const setStageUserId = useStageStore((state) => state.setUserId);
  const setMediaUserId = useMediaGenerationStore((state) => state.setUserId);

  useEffect(() => {
    if (session?.user?.id) {
      setStageUserId(session.user.id);
      setMediaUserId(session.user.id);
    } else {
      setStageUserId(null);
      setMediaUserId(null);
    }
  }, [session, setStageUserId, setMediaUserId]);

  return null;
}
