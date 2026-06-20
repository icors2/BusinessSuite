export const MRP_EVENTS = {
  run: {
    completed: 'mrp.run.completed',
  },
  requisition: {
    created: 'mrp.requisition.created',
  },
} as const;

export const ALL_MRP_TOPICS = [
  MRP_EVENTS.run.completed,
  MRP_EVENTS.requisition.created,
] as const;
