export const MASTERDATA_EVENTS = {
  product: {
    created: 'masterdata.product.created',
    updated: 'masterdata.product.updated',
    deactivated: 'masterdata.product.deactivated',
  },
  customer: {
    created: 'masterdata.customer.created',
    updated: 'masterdata.customer.updated',
    deactivated: 'masterdata.customer.deactivated',
  },
  vendor: {
    created: 'masterdata.vendor.created',
    updated: 'masterdata.vendor.updated',
    deactivated: 'masterdata.vendor.deactivated',
  },
} as const;

export const ALL_MASTERDATA_TOPICS = [
  ...Object.values(MASTERDATA_EVENTS.product),
  ...Object.values(MASTERDATA_EVENTS.customer),
  ...Object.values(MASTERDATA_EVENTS.vendor),
] as const;
