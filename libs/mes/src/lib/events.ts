export const MES_EVENTS = {
  operation: {
    started: 'mes.operation.started',
    completed: 'mes.operation.completed',
  },
  workorder: {
    verified: 'mes.workorder.verified',
  },
  cycle: {
    recorded: 'mes.cycle.recorded',
  },
} as const;

export const ALL_MES_TOPICS = [
  MES_EVENTS.operation.started,
  MES_EVENTS.operation.completed,
  MES_EVENTS.workorder.verified,
  MES_EVENTS.cycle.recorded,
] as const;
