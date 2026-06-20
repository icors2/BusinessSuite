export const MPS_EVENTS = {
  workorder: {
    scheduled: 'mps.workorder.scheduled',
    rescheduled: 'mps.workorder.rescheduled',
  },
  capacity: {
    overloaded: 'mps.capacity.overloaded',
  },
} as const;

export const ALL_MPS_TOPICS = [
  ...Object.values(MPS_EVENTS.workorder),
  MPS_EVENTS.capacity.overloaded,
] as const;
