'use client';

import { motion } from 'motion/react';
import { User, School, BookOpen } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/hooks/use-i18n';
import { useOnboardingStore, type UserRole } from '@/lib/store/onboarding';

export function RoleSelection() {
  const { t } = useI18n();
  const selectedRole = useOnboardingStore((s) => s.role);
  const setRole = useOnboardingStore((s) => s.setRole);

  const roles: { id: UserRole; icon: any; title: string; desc: string }[] = [
    {
      id: 'student',
      icon: User,
      title: t('onboarding.roles.student'),
      desc: t('onboarding.roles.studentDesc'),
    },
    {
      id: 'school',
      icon: School,
      title: t('onboarding.roles.school'),
      desc: t('onboarding.roles.schoolDesc'),
    },
    {
      id: 'coaching',
      icon: BookOpen,
      title: t('onboarding.roles.coaching'),
      desc: t('onboarding.roles.coachingDesc'),
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 py-8">
      {roles.map((role) => (
        <motion.div
          key={role.id}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <Card
            className={cn(
              'relative p-6 cursor-pointer border-2 transition-all flex flex-col items-center text-center gap-4 h-full',
              selectedRole === role.id
                ? 'border-violet-600 bg-violet-50/50 dark:bg-violet-900/20'
                : 'border-muted hover:border-violet-300'
            )}
            onClick={() => setRole(role.id)}
          >
            <div className={cn(
              'size-16 rounded-2xl flex items-center justify-center transition-colors',
              selectedRole === role.id
                ? 'bg-violet-600 text-white'
                : 'bg-muted text-muted-foreground group-hover:bg-violet-100'
            )}>
              <role.icon className="size-8" />
            </div>
            <div>
              <h3 className="font-bold text-lg mb-1">{role.title}</h3>
              <p className="text-sm text-muted-foreground">{role.desc}</p>
            </div>
            {selectedRole === role.id && (
              <motion.div
                layoutId="active-check"
                className="absolute top-3 right-3 size-5 rounded-full bg-violet-600 flex items-center justify-center text-white"
              >
                <div className="size-2 rounded-full bg-white" />
              </motion.div>
            )}
          </Card>
        </motion.div>
      ))}
    </div>
  );
}
