'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useI18n } from '@/lib/hooks/use-i18n';
import { useOnboardingStore } from '@/lib/store/onboarding';

export function SchoolOnboarding() {
  const { t } = useI18n();
  const school = useOnboardingStore((s) => s.school);
  const setSchool = useOnboardingStore((s) => s.setSchool);

  return (
    <div className="space-y-8 py-4 max-w-2xl mx-auto">
      <div className="grid gap-6">
        <div className="grid gap-2">
          <Label htmlFor="school-name">{t('onboarding.schoolName')}</Label>
          <Input
            id="school-name"
            placeholder="e.g. St. Xavier's International"
            value={school.name}
            onChange={(e) => setSchool({ name: e.target.value })}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="school-location">{t('onboarding.schoolLocation')}</Label>
          <Input
            id="school-location"
            placeholder="e.g. New Delhi, India"
            value={school.location}
            onChange={(e) => setSchool({ location: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label>{t('onboarding.curriculum')}</Label>
            <Select
              value={school.curriculum}
              onValueChange={(val) => setSchool({ curriculum: val })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cbse">{t('onboarding.curriculums.cbse')}</SelectItem>
                <SelectItem value="icse">{t('onboarding.curriculums.icse')}</SelectItem>
                <SelectItem value="ib">{t('onboarding.curriculums.ib')}</SelectItem>
                <SelectItem value="igcse">{t('onboarding.curriculums.igcse')}</SelectItem>
                <SelectItem value="stateBoard">{t('onboarding.curriculums.stateBoard')}</SelectItem>
                <SelectItem value="other">{t('onboarding.curriculums.other')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="grade-range">{t('onboarding.gradeRange')}</Label>
            <Input
              id="grade-range"
              placeholder="e.g. 6-12"
              value={school.gradeRange}
              onChange={(e) => setSchool({ gradeRange: e.target.value })}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
