export const CMMS_EVENTS = {
  workorder: {
    created: 'cmms.workorder.created',
    completed: 'cmms.workorder.completed',
  },
  pm: {
    triggered: 'cmms.pm.triggered',
  },
} as const;

export const ALL_CMMS_TOPICS = [
  CMMS_EVENTS.workorder.created,
  CMMS_EVENTS.workorder.completed,
  CMMS_EVENTS.pm.triggered,
] as const;
