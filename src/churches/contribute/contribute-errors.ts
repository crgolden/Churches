export const ContributeErrors = {
  alreadyHasValue: 'already-has-value',
  submitFailed: 'submit-failed',
} as const;

export type ContributeError = (typeof ContributeErrors)[keyof typeof ContributeErrors];

export const CONTRIBUTE_ERROR_MESSAGES: Readonly<Record<ContributeError, string>> = {
  [ContributeErrors.alreadyHasValue]: 'This field already has that value. Please enter a different correction.',
  [ContributeErrors.submitFailed]: 'Failed to submit. Please try again.',
};
