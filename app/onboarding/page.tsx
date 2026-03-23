'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useI18n } from '@/lib/hooks/use-i18n';
import { useOnboardingStore } from '@/lib/store/onboarding';
import { RoleSelection } from '@/components/onboarding/role-selection';
import { AccountDetailsForm } from '@/components/onboarding/account-details';
import { SchoolOnboarding } from '@/components/onboarding/school-onboarding';
import { StudentOnboarding } from '@/components/onboarding/student-onboarding';

export default function OnboardingPage() {
  const { t } = useI18n();
  const router = useRouter();
  const { role, isCompleted, setCompleted } = useOnboardingStore();
  const [step, setStep] = useState(1);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
    if (isCompleted) {
      router.push('/');
    }
  }, [isCompleted, router]);

  if (!hydrated) return null;

  const totalSteps = role === 'student' ? 3 : 3; // Role -> Account -> Details (School or Student)

  const handleNext = () => {
    if (step < 3) {
      setStep(step + 1);
    } else {
      setCompleted(true);
      router.push('/');
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const currentProgress = (step / totalSteps) * 100;

  const renderStep = () => {
    switch (step) {
      case 1:
        return <RoleSelection />;
      case 2:
        return <AccountDetailsForm />;
      case 3:
        return role === 'student' ? <StudentOnboarding /> : <SchoolOnboarding />;
      default:
        return null;
    }
  };

  const getStepTitle = () => {
    switch (step) {
      case 1:
        return t('onboarding.roles.title');
      case 2:
        return t('onboarding.account.title');
      case 3:
        return role === 'student' ? t('onboarding.studentTitle') : t('onboarding.schoolTitle');
      default:
        return '';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center py-12 px-4">
      <div className="max-w-4xl w-full space-y-8">
        <div className="text-center space-y-2">
          <motion.h1
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl font-extrabold tracking-tight text-violet-600 dark:text-violet-400"
          >
            {t('onboarding.title')}
          </motion.h1>
          <p className="text-muted-foreground text-lg">
            {t('onboarding.subtitle')}
          </p>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm font-medium">
            <span>{getStepTitle()}</span>
            <span>Step {step} of {totalSteps}</span>
          </div>
          <Progress value={currentProgress} className="h-2" />
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-xl shadow-violet-500/5 min-h-[400px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              {renderStep()}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex items-center justify-between pt-4">
          <Button
            variant="ghost"
            size="lg"
            onClick={handleBack}
            disabled={step === 1}
            className="rounded-xl px-8"
          >
            {t('onboarding.back')}
          </Button>

          <div className="flex gap-4">
            <Button
              variant="ghost"
              size="lg"
              onClick={() => setCompleted(true)}
              className="text-muted-foreground hover:text-foreground rounded-xl"
            >
              {t('onboarding.skip')}
            </Button>
            <Button
              size="lg"
              onClick={handleNext}
              disabled={step === 1 && !role}
              className="bg-violet-600 hover:bg-violet-700 text-white rounded-xl px-12 shadow-lg shadow-violet-500/25"
            >
              {step === totalSteps ? t('onboarding.finish') : t('onboarding.next')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
