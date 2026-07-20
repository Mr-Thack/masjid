import { z } from 'zod';

export const PrayerName = z.enum(['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']);
export type PrayerName = z.infer<typeof PrayerName>;

export const ConditionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('always') }),
  z.object({
    type: z.literal('day_of_week'),
    days: z.array(z.number().int().min(0).max(6)).min(1),
  }),
  z.object({
    type: z.literal('month'),
    months: z.array(z.number().int().min(1).max(12)).min(1),
  }),
  z.object({
    type: z.literal('hijri_month'),
    months: z.array(z.number().int().min(1).max(12)).min(1),
  }),
  z.object({
    type: z.literal('date_range'),
    start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }),
]);
export type Condition = z.infer<typeof ConditionSchema>;

export const ActionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('add_minutes'),
    minutes: z.number().int().positive(),
  }),
  z.object({
    type: z.literal('round_up'),
    increment: z.number().int().refine((n) => [1, 5, 10, 15, 20, 30, 60].includes(n), {
      message: 'increment must be one of: 1, 5, 10, 15, 20, 30, 60',
    }),
  }),
  z.object({
    type: z.literal('round_down'),
    increment: z.number().int().refine((n) => [1, 5, 10, 15, 20, 30, 60].includes(n), {
      message: 'increment must be one of: 1, 5, 10, 15, 20, 30, 60',
    }),
  }),
  z.object({
    type: z.literal('round_nearest'),
    increment: z.number().int().refine((n) => [1, 5, 10, 15, 20, 30, 60].includes(n), {
      message: 'increment must be one of: 1, 5, 10, 15, 20, 30, 60',
    }),
  }),
  z.object({
    type: z.literal('set_fixed_time'),
    time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  }),
]);
export type Action = z.infer<typeof ActionSchema>;

export const CreatePrayerRuleSchema = z.object({
  prayer_name: PrayerName,
  rule_name: z.string().min(1).max(200),
  execution_order: z.number().int().min(0),
  conditions_json: z.array(ConditionSchema).min(1),
  action_json: ActionSchema,
});
export type CreatePrayerRule = z.infer<typeof CreatePrayerRuleSchema>;

export const UpdatePrayerRuleSchema = CreatePrayerRuleSchema.partial();
export type UpdatePrayerRule = z.infer<typeof UpdatePrayerRuleSchema>;

export const ReorderRulesSchema = z.object({
  order: z.array(z.string()).min(1),
});
export type ReorderRules = z.infer<typeof ReorderRulesSchema>;

export const PrayerRuleSchema = CreatePrayerRuleSchema.extend({
  id: z.string(),
  masjid_id: z.string(),
});
export type PrayerRule = z.infer<typeof PrayerRuleSchema>;

export const PrayerTimeSchema = z.object({
  adhaan: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  iqaamah: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
});
export type PrayerTime = z.infer<typeof PrayerTimeSchema>;

export const DailyTimesSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  masjid: z.object({
    slug: z.string(),
    name: z.string(),
  }),
  calculation_method: z.string(),
  times: z.object({
    fajr: PrayerTimeSchema,
    sunrise: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    dhuhr: PrayerTimeSchema,
    asr: PrayerTimeSchema,
    maghrib: PrayerTimeSchema,
    isha: PrayerTimeSchema,
  }),
});
export type DailyTimes = z.infer<typeof DailyTimesSchema>;