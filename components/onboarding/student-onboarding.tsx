'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useI18n } from '@/lib/hooks/use-i18n';
import { useOnboardingStore, type LearningStyle } from '@/lib/store/onboarding';

export function StudentOnboarding() {
  const { t } = useI18n();
  const student = useOnboardingStore((s) => s.student);
  const setStudent = useOnboardingStore((s) => s.setStudent);

  return (
    <div className="space-y-8 py-4 max-w-2xl mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="grid gap-2">
          <Label htmlFor="student-age">{t('onboarding.studentAge')}</Label>
          <Input
            id="student-age"
            type="number"
            min={3}
            max={100}
            value={student.age}
            onChange={(e) => setStudent({ age: parseInt(e.target.value) || 0 })}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="student-grade">{t('onboarding.studentGrade')}</Label>
          <Input
            id="student-grade"
            placeholder="e.g. 8th Grade"
            value={student.grade}
            onChange={(e) => setStudent({ grade: e.target.value })}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="grid gap-2">
          <Label>{t('onboarding.preferredLanguage')}</Label>
          <Select
            value={student.language}
            onValueChange={(val: any) => setStudent({ language: val })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en-US">English (US)</SelectItem>
              <SelectItem value="en-IN">English (India)</SelectItem>
              <SelectItem value="hi-IN">Hindi (India)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label>{t('onboarding.learningStyle')}</Label>
          <Select
            value={student.learningStyle}
            onValueChange={(val: LearningStyle) => setStudent({ learningStyle: val })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="visual">{t('onboarding.learningStyles.visual')}</SelectItem>
              <SelectItem value="auditory">{t('onboarding.learningStyles.auditory')}</SelectItem>
              <SelectItem value="reading">{t('onboarding.learningStyles.reading')}</SelectItem>
              <SelectItem value="kinesthetic">{t('onboarding.learningStyles.kinesthetic')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="interests">{t('onboarding.interests')}</Label>
        <Input
          id="interests"
          placeholder={t('onboarding.interestsPlaceholder')}
          value={student.interests.join(', ')}
          onChange={(e) => setStudent({ interests: e.target.value.split(',').map(s => s.trim()) })}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="goals">{t('onboarding.goals')}</Label>
        <Textarea
          id="goals"
          placeholder={t('onboarding.goalsPlaceholder')}
          value={student.goals}
          onChange={(e) => setStudent({ goals: e.target.value })}
          rows={3}
        />
      </div>
    </div>
  );
}
