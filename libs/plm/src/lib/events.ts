export const PLM_EVENTS = {
  document: {
    uploaded: 'plm.document.uploaded',
    revised: 'plm.document.revised',
    released: 'plm.document.released',
  },
} as const;

export const ALL_PLM_TOPICS = [
  ...Object.values(PLM_EVENTS.document),
] as const;
