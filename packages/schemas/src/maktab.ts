import { z } from 'zod';
import { isValidPhoneNumber } from 'libphonenumber-js';

export const ParentSchema = z
  .object({
    name: z.string().trim().min(1),
    phone: z
      .string()
      .refine(
        (v) => !v || isValidPhoneNumber(v),
        { message: 'Invalid phone number' },
      ),
    email: z.string().email(),
  })
  .partial()
  .refine(
    (data) => {
      const anyProvided = !!(data.name || data.phone || data.email);
      if (!anyProvided) return true;
      return !!(data.name && data.phone && data.email);
    },
    { message: 'When a parent is provided, name, phone, and email are required' },
  );

export type Parent = z.infer<typeof ParentSchema>;

export const ChildSchema = z.object({
  name: z.string().trim().min(2, 'Child name must be at least 2 characters'),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date of birth must be YYYY-MM-DD'),
  sex: z.enum(['male', 'female'], {
    required_error: 'Please select child gender',
  }),
});

export type Child = z.infer<typeof ChildSchema>;

const BaseEnrollmentSchema = z.object({
  father: ParentSchema.optional(),
  mother: ParentSchema.optional(),
  address_line1: z.string().min(5, 'Please enter a complete address'),
  city: z.string().min(2, 'Please enter a valid city'),
  postal_code: z
    .string()
    .regex(/^\d{5}(-\d{4})?$/, 'Please enter a valid ZIP code'),
  country: z.string().default('US'),
  children: z.array(ChildSchema).min(1, 'At least one child must be registered'),
});

const parentCheck = {
  message: "At least one parent's complete information must be provided",
  path: ['father' as const],
};

export const EnrollmentSchema = BaseEnrollmentSchema.refine(
  (data) => {
    const fatherComplete = !!(data.father?.name && data.father?.phone && data.father?.email);
    const motherComplete = !!(data.mother?.name && data.mother?.phone && data.mother?.email);
    return fatherComplete || motherComplete;
  },
  parentCheck,
);
export type EnrollmentInput = z.infer<typeof EnrollmentSchema>;

// Placeholder for future Stripe integration — not currently used.
// Current payment provider is Square (see SquareEnrollmentSchema below).
export const StripeEnrollmentSchema = BaseEnrollmentSchema.extend({
  success_url: z.string().url(),
  cancel_url: z.string().url(),
}).refine(
  (data) => {
    const fatherComplete = !!(data.father?.name && data.father?.phone && data.father?.email);
    const motherComplete = !!(data.mother?.name && data.mother?.phone && data.mother?.email);
    return fatherComplete || motherComplete;
  },
  parentCheck,
);
export type StripeEnrollmentInput = z.infer<typeof StripeEnrollmentSchema>;

export const SquareEnrollmentSchema = BaseEnrollmentSchema.extend({
  source_id: z.string().optional(),
  card_holder_name: z.string().min(1),
}).refine(
  (data) => {
    const fatherComplete = !!(data.father?.name && data.father?.phone && data.father?.email);
    const motherComplete = !!(data.mother?.name && data.mother?.phone && data.mother?.email);
    return fatherComplete || motherComplete;
  },
  parentCheck,
);
export type SquareEnrollmentInput = z.infer<typeof SquareEnrollmentSchema>;

export const ManualEnrollmentSchema = z
  .object({
    term_id: z.string().min(1, 'Select a term'),
    father: ParentSchema.optional(),
    mother: ParentSchema.optional(),
    address_line1: z.string().min(1, 'Street address is required'),
    city: z.string().min(1, 'City is required'),
    postal_code: z.string().min(1, 'ZIP code is required'),
    country: z.string().default('US'),
    children: z.array(ChildSchema).min(1, 'At least one child is required'),
    monthly_amount_cents: z.number().int().min(0, 'Amount cannot be negative'),
  })
  .refine(
    (data) => {
      const fatherComplete = !!(data.father?.name && data.father?.phone && data.father?.email);
      const motherComplete = !!(data.mother?.name && data.mother?.phone && data.mother?.email);
      return fatherComplete || motherComplete;
    },
    { message: "At least one parent's complete information must be provided", path: ['father'] },
  );

export type ManualEnrollmentInput = z.infer<typeof ManualEnrollmentSchema>;

export const TermCreateSchema = z.object({
  name: z.string().trim().min(1),
  length_months: z.number().int().min(1).max(12),
  billing_months: z.number().int().min(1).max(12).optional(),
  price_cents_1: z.number().int().positive(),
  price_cents_2: z.number().int().positive(),
  price_cents_3plus: z.number().int().positive(),
});

export type TermCreateInput = z.infer<typeof TermCreateSchema>;

export const TermPublicSchema = z.object({
  id: z.string(),
  name: z.string(),
  length_months: z.number(),
  prices: z.object({
    '1': z.number(),
    '2': z.number(),
    '3plus': z.number(),
  }),
});

export type TermPublic = z.infer<typeof TermPublicSchema>;

export const CurriculumItemSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().min(1),
});

export const FaqItemSchema = z.object({
  question: z.string().trim().min(1),
  answer: z.string().trim().min(1),
});

export const ProgramInfoSchema = z.object({
  goal: z.string().default(''),
  schedule_days: z.string().default(''),
  schedule_time: z.string().default(''),
  curriculum: z.array(CurriculumItemSchema).default([]),
  faqs: z.array(FaqItemSchema).default([]),
});

export type CurriculumItem = z.infer<typeof CurriculumItemSchema>;
export type FaqItem = z.infer<typeof FaqItemSchema>;
export type ProgramInfo = z.infer<typeof ProgramInfoSchema>;

export const SettingsUpdateSchema = z.object({
  active_term_id: z.string().nullable().optional(),
  enrollment_open: z.boolean().optional(),
  status_message: z.string().nullable().optional(),
  assistance_code: z.string().nullable().optional(),
  program_info: ProgramInfoSchema.optional(),
});

export type SettingsUpdateInput = z.infer<typeof SettingsUpdateSchema>;
