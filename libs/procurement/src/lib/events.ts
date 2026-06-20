export const PROCUREMENT_EVENTS = {
  po: {
    issued: 'procurement.po.issued',
    acknowledged: 'procurement.po.acknowledged',
  },
  asn: {
    received: 'procurement.asn.received',
  },
} as const;

export const ALL_PROCUREMENT_TOPICS = [
  PROCUREMENT_EVENTS.po.issued,
  PROCUREMENT_EVENTS.po.acknowledged,
  PROCUREMENT_EVENTS.asn.received,
] as const;
