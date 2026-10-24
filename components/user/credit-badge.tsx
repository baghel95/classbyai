'use client';

import { useState, useEffect } from 'react';
import { Zap } from 'lucide-react';
import { SubscriptionModal } from '@/components/subscription/subscription-modal';

export function CreditBadge() {
  const [credits, setCredits] = useState<number>(100);
  const [tier, setTier] = useState<string>('free');
  const [modalOpen, setModalOpen] = useState(false);

  const fetchCredits = async () => {
    try {
      const res = await fetch('/api/user/credits');
      if (res.ok) {
        const data = await res.json();
        if (data.credits !== undefined) setCredits(data.credits);
        if (data.tier) setTier(data.tier);
      }
    } catch {
      // offline or unauth
    }
  };

  useEffect(() => {
    fetchCredits();
    const interval = setInterval(fetchCredits, 30000);
    const onUpdate = () => fetchCredits();
    window.addEventListener('credits-updated', onUpdate);
    return () => {
      clearInterval(interval);
      window.removeEventListener('credits-updated', onUpdate);
    };
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 hover:bg-primary/20 text-primary border border-primary/25 transition-all shadow-sm cursor-pointer"
        title="Classby-AI Credits. Click to upgrade or view subscription plans."
      >
        <Zap className="size-3.5 fill-primary text-primary animate-pulse" />
        <span>{credits}</span>
        <span className="text-[10px] uppercase font-bold tracking-wider opacity-70">
          {tier === 'free' ? 'CR' : tier}
        </span>
      </button>

      <SubscriptionModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        currentCredits={credits}
        currentTier={tier}
        onCreditsUpdated={(newCredits) => setCredits(newCredits)}
      />
    </>
  );
}
