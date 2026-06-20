export const QMS_EVENTS = {
  inspection: {
    completed: 'qms.inspection.completed',
  },
  nonconformance: {
    raised: 'qms.nonconformance.raised',
    resolved: 'qms.nonconformance.resolved',
  },
  scrap: {
    reported: 'qms.scrap.reported',
  },
} as const;

export const ALL_QMS_TOPICS = [
  QMS_EVENTS.inspection.completed,
  QMS_EVENTS.nonconformance.raised,
  QMS_EVENTS.nonconformance.resolved,
  QMS_EVENTS.scrap.reported,
] as const;
