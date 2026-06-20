import { z } from 'zod';

export const askSchema = z.object({
  question: z.string().min(3).max(500),
});

export const eventVolumeSchema = z.object({
  topic: z.string().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const scrapRateSchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  sku: z.string().optional(),
  byProduct: z.boolean().optional(),
});

export const getForecastsSchema = z.object({
  sku: z.string().optional(),
  take: z.number().int().min(1).max(100).optional(),
});

export type AskInput = z.infer<typeof askSchema>;
export type EventVolumeInput = z.infer<typeof eventVolumeSchema>;
export type ScrapRateInput = z.infer<typeof scrapRateSchema>;
export type GetForecastsInput = z.infer<typeof getForecastsSchema>;
