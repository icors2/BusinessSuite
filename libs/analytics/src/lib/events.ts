export const ANALYTICS_EVENTS = {
  forecast: {
    computed: 'analytics.forecast.computed',
  },
} as const;

export const ALL_ANALYTICS_TOPICS = [
  ANALYTICS_EVENTS.forecast.computed,
] as const;
