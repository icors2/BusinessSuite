export const SALES_EVENTS = {
  order: {
    created: 'sales.order.created',
    allocated: 'sales.order.allocated',
    shipped: 'sales.order.shipped',
    backordered: 'sales.order.backordered',
  },
} as const;

export const ALL_SALES_TOPICS = [...Object.values(SALES_EVENTS.order)] as const;
