export const RETURNS_EVENTS = {
  rma: {
    requested: 'returns.rma.requested',
    received: 'returns.rma.received',
    resolved: 'returns.rma.resolved',
  },
} as const;

export const ALL_RETURNS_TOPICS = [
  RETURNS_EVENTS.rma.requested,
  RETURNS_EVENTS.rma.received,
  RETURNS_EVENTS.rma.resolved,
] as const;
