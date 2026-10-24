'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Check, Sparkles, Zap, Shield, Crown } from 'lucide-react';
import { toast } from 'sonner';

interface Plan {
  id: string;
  name: string;
  price: number;
  credits: number;
  popular?: boolean;
  features: string[];
}

const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Free Starter',
    price: 0,
    credits: 100,
    features: [
      '100 Free credits on signup',
      'AI Teacher & Student avatars',
      'English, Hindi & Marathi narration',
      'Interactive Whiteboard',
    ],
  },
  {
    id: 'starter',
    name: 'Pro Learner',
    price: 9.99,
    credits: 1000,
    popular: true,
    features: [
      '1,000 Credits / month',
      'Natural Sarvam AI bulbul:v3 voices',
      'Unlimited Quizzes & Discussions',
      'Export Classroom Recordings',
      'Fast Cloud Generation',
    ],
  },
  {
    id: 'pro',
    name: 'Unlimited Educator',
    price: 29.99,
    credits: 5000,
    features: [
      '5,000 Credits / month',
      'Custom Agent Voices & Personas',
      'Document & PDF Course Builder',
      'High-Speed Audio & Video Engine',
      'Priority 24/7 Support',
    ],
  },
];

interface SubscriptionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentCredits?: number;
  currentTier?: string;
  onCreditsUpdated?: (credits: number) => void;
}

export function SubscriptionModal({
  open,
  onOpenChange,
  currentCredits = 100,
  currentTier = 'free',
  onCreditsUpdated,
}: SubscriptionModalProps) {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  const handleSubscribe = async (plan: Plan) => {
    if (plan.id === 'free') {
      toast.info('You already have the Free Trial active!');
      return;
    }

    try {
      setLoadingPlan(plan.id);
      const res = await fetch('/api/subscriptions/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: plan.id }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to upgrade plan');
      }

      toast.success(data.message || `Upgraded to ${plan.name}!`);
      if (data.credits !== undefined && onCreditsUpdated) {
        onCreditsUpdated(data.credits);
      }
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || 'Subscription failed');
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-6 rounded-3xl bg-[#0B0F19]/95 border border-white/10 backdrop-blur-2xl text-foreground">
        <DialogHeader className="text-center mb-6">
          <div className="mx-auto mb-2 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs font-semibold text-primary">
            <Sparkles className="size-3.5" />
            Classby-AI Credits & Subscription
          </div>
          <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-white via-white/90 to-white/70 bg-clip-text text-transparent">
            Choose Your Learning Plan
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground/80 max-w-lg mx-auto">
            You currently have <span className="font-semibold text-primary">⚡ {currentCredits} credits</span>. Each classroom generation uses 10 credits. Upgrade anytime for higher limits and natural Indian AI voices.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {PLANS.map((plan) => {
            const isCurrent = currentTier === plan.id;
            return (
              <div
                key={plan.id}
                className={`relative rounded-2xl p-5 border flex flex-col justify-between transition-all ${
                  plan.popular
                    ? 'bg-gradient-to-b from-primary/15 via-[#131B2E] to-[#0E1424] border-primary/40 shadow-xl shadow-primary/10 ring-1 ring-primary/30'
                    : 'bg-white/[0.03] border-white/10 hover:border-white/20'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-primary text-[10px] font-bold text-primary-foreground tracking-wider uppercase shadow-md">
                    Most Popular
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-base text-foreground">{plan.name}</h3>
                    {plan.id === 'pro' ? (
                      <Crown className="size-4 text-amber-400" />
                    ) : (
                      <Zap className="size-4 text-primary" />
                    )}
                  </div>

                  <div className="flex items-baseline gap-1 my-3">
                    <span className="text-3xl font-extrabold text-foreground">
                      ${plan.price}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {plan.price === 0 ? 'free forever' : '/ month'}
                    </span>
                  </div>

                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-white/5 text-xs font-semibold text-primary/90 mb-4 w-full justify-center">
                    <Zap className="size-3 text-primary animate-pulse" />
                    {plan.credits.toLocaleString()} Credits
                  </div>

                  <ul className="space-y-2.5 text-xs text-muted-foreground mb-6">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <Check className="size-3.5 text-primary shrink-0 mt-0.5" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <Button
                  onClick={() => handleSubscribe(plan)}
                  disabled={loadingPlan !== null || (isCurrent && plan.id === 'free')}
                  variant={plan.popular ? 'default' : 'outline'}
                  className={`w-full rounded-xl py-2 font-medium cursor-pointer ${
                    plan.popular
                      ? 'bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20'
                      : 'border-white/15 hover:bg-white/10'
                  }`}
                >
                  {loadingPlan === plan.id
                    ? 'Processing...'
                    : isCurrent
                      ? 'Current Plan'
                      : plan.price === 0
                        ? 'Included Free'
                        : 'Upgrade Plan'}
                </Button>
              </div>
            );
          })}
        </div>

        <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between text-xs text-muted-foreground/60">
          <span className="flex items-center gap-1.5">
            <Shield className="size-3.5 text-emerald-400" /> Secure 256-bit encrypted checkout
          </span>
          <span>Cancel or change plans anytime</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
