import type { ReactNode } from 'react';

export interface StepResult {
  /** null = ungraded (learn card, skipped speaking). */
  correct: boolean | null;
  tone: 'success' | 'warning' | 'error' | 'neutral';
  title: string;
  detail?: ReactNode;
}

export interface StepProps<S> {
  step: S;
  /** True once the learner committed an answer; inputs should lock. */
  answered: boolean;
  onAnswered: (result: StepResult) => void;
}
