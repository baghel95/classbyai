/**
 * Onboarding Store
 * Persists school and student profiles to localStorage
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type LearningStyle = 'visual' | 'auditory' | 'reading' | 'kinesthetic';
export type UserRole = 'student' | 'school' | 'coaching';

export interface AccountDetails {
  email: string;
  phone: string;
  password?: string;
}

export interface SchoolProfile {
  name: string;
  location: string;
  curriculum: string; // "CBSE", "ICSE", "IB", "State Board", etc.
  gradeRange: string; // e.g., "K-5", "6-12"
}

export interface StudentProfile {
  age: number;
  grade: string;
  interests: string[];
  goals: string;
  language: 'en-US' | 'hi-IN' | 'en-IN';
  learningStyle: LearningStyle;
}

export interface OnboardingState {
  role: UserRole | null;
  account: AccountDetails;
  school: SchoolProfile;
  student: StudentProfile;
  isCompleted: boolean;
  _hasHydrated: boolean;

  setRole: (role: UserRole) => void;
  setAccount: (account: Partial<AccountDetails>) => void;
  setSchool: (school: Partial<SchoolProfile>) => void;
  setStudent: (student: Partial<StudentProfile>) => void;
  setCompleted: (completed: boolean) => void;
  setHasHydrated: (hydrated: boolean) => void;
  reset: () => void;
}

const initialAccount: AccountDetails = {
  email: '',
  phone: '',
  password: '',
};

const initialSchool: SchoolProfile = {
  name: '',
  location: '',
  curriculum: '',
  gradeRange: '',
};

const initialStudent: StudentProfile = {
  age: 10,
  grade: '',
  interests: [],
  goals: '',
  language: 'en-US',
  learningStyle: 'visual',
};

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      role: null,
      account: initialAccount,
      school: initialSchool,
      student: initialStudent,
      isCompleted: false,
      _hasHydrated: false,

      setRole: (role) => set({ role }),

      setAccount: (account) =>
        set((state) => ({
          account: { ...state.account, ...account },
        })),

      setSchool: (school) =>
        set((state) => ({
          school: { ...state.school, ...school },
        })),

      setStudent: (student) =>
        set((state) => ({
          student: { ...state.student, ...student },
        })),

      setCompleted: (completed) => set({ isCompleted: completed }),

      setHasHydrated: (hydrated) => set({ _hasHydrated: hydrated }),

      reset: () =>
        set({
          role: null,
          account: initialAccount,
          school: initialSchool,
          student: initialStudent,
          isCompleted: false,
        }),
    }),
    {
      name: 'onboarding-storage',
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
