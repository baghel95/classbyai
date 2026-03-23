'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useOnboardingStore } from '@/lib/store/onboarding';

/**
 * Client-side redirect to /onboarding if not completed.
 * Only renders children once hydrated and confirmed completed.
 */
export function OnboardingRedirect({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const isCompleted = useOnboardingStore((s) => s.isCompleted);
  const hasHydrated = useOnboardingStore((s) => s._hasHydrated);

  useEffect(() => {
    // Only redirect if hydrated and not already on /onboarding
    if (hasHydrated && !isCompleted && pathname !== '/onboarding') {
      router.push('/onboarding');
    }
  }, [hasHydrated, isCompleted, pathname, router]);

  // Prevent flash: don't render anything until hydrated
  if (!hasHydrated) {
    return null;
  }

  // If not completed and not on onboarding page, hide children while redirecting
  if (!isCompleted && pathname !== '/onboarding') {
    return null;
  }

  return <>{children}</>;
}
