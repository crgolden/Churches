export const CorrectionStatus = { Pending: 0, Approved: 1, Rejected: 2 } as const;

export const DirectoryLimits = { maxPageSize: 50 } as const;

export const DirectoryRefusals = {
  mergeSurvivorMissing: 'Choose which church survives the merge.',
  mergeSurvivorNotInSuggestion: 'The surviving church must be one of the two in the suggestion.',
  churchInactive: 'That church is no longer active.',
} as const;
