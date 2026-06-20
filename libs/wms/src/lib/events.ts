export const WMS_EVENTS = {
  inventory: {
    received: 'wms.inventory.received',
    moved: 'wms.inventory.moved',
    shipped: 'wms.inventory.shipped',
    adjusted: 'wms.inventory.adjusted',
  },
} as const;

export const ALL_WMS_TOPICS = [
  ...Object.values(WMS_EVENTS.inventory),
] as const;
