export const CPQ_EVENTS = {
  quote: {
    created: 'sales.quote.created',
    sent: 'sales.quote.sent',
    accepted: 'sales.quote.accepted',
    rejected: 'sales.quote.rejected',
    expired: 'sales.quote.expired',
  },
} as const;

export const ALL_CPQ_TOPICS = [...Object.values(CPQ_EVENTS.quote)] as const;
