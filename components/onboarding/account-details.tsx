'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useI18n } from '@/lib/hooks/use-i18n';
import { useOnboardingStore } from '@/lib/store/onboarding';

export function AccountDetailsForm() {
  const { t } = useI18n();
  const role = useOnboardingStore((s) => s.role);
  const account = useOnboardingStore((s) => s.account);
  const setAccount = useOnboardingStore((s) => s.setAccount);

  return (
    <div className="space-y-6 py-4 max-w-md mx-auto">
      <div className="space-y-4">
        <div className="grid gap-2">
          <Label htmlFor="email">{t('onboarding.account.email')}</Label>
          <Input
            id="email"
            type="email"
            placeholder="email@example.com"
            value={account.email}
            onChange={(e) => setAccount({ email: e.target.value })}
          />
          {role === 'student' && (
            <p className="text-xs text-muted-foreground">{t('onboarding.account.emailHint')}</p>
          )}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="phone">{t('onboarding.account.phone')}</Label>
          <Input
            id="phone"
            type="tel"
            placeholder="+91 98765 43210"
            value={account.phone}
            onChange={(e) => setAccount({ phone: e.target.value })}
          />
          {role === 'student' && (
            <p className="text-xs text-muted-foreground">{t('onboarding.account.phoneHint')}</p>
          )}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="password">{t('onboarding.account.password')}</Label>
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            value={account.password}
            onChange={(e) => setAccount({ password: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}
