export const WORKFORCE_EVENTS = {
  shift: {
    assigned: 'workforce.shift.assigned',
  },
  clock: {
    in: 'workforce.clock.in',
    out: 'workforce.clock.out',
  },
} as const;

export const ALL_WORKFORCE_TOPICS = [
  WORKFORCE_EVENTS.shift.assigned,
  WORKFORCE_EVENTS.clock.in,
  WORKFORCE_EVENTS.clock.out,
] as const;
