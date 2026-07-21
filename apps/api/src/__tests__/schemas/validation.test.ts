import { describe, it, expect } from 'vitest';

// ---------------------------------------------------------------------------
// Import Zod schemas from the shared schema package
// ---------------------------------------------------------------------------
import {
  CreatePrayerRuleSchema,
  CreateMasjidSchema,
  CreateAnnouncementSchema,
  CreateJumuahSchema,
  LoginSchema,
  UpdateMasjidSchema,
  PrayerName,
  ConditionSchema,
  ActionSchema,
  UpdatePrayerRuleSchema,
  ReorderRulesSchema,
} from '@masjid/schemas';

// ---------------------------------------------------------------------------
// CreatePrayerRuleSchema
// ---------------------------------------------------------------------------
describe('CreatePrayerRuleSchema', () => {
  it('accepts valid input (always condition)', () => {
    const input = {
      prayer_name: 'dhuhr',
      rule_name: 'Default Dhuhr offset',
      execution_order: 1,
      conditions_json: [{ type: 'always' }],
      action_json: { type: 'add_minutes', minutes: 10 },
    };
    expect(() => CreatePrayerRuleSchema.parse(input)).not.toThrow();
  });

  it('accepts set_fixed_time action', () => {
    const input = {
      prayer_name: 'dhuhr',
      rule_name: 'Friday fixed time',
      execution_order: 2,
      conditions_json: [{ type: 'day_of_week', days: [5] }],
      action_json: { type: 'set_fixed_time', time: '13:30' },
    };
    expect(() => CreatePrayerRuleSchema.parse(input)).not.toThrow();
  });

  it('accepts round_up action', () => {
    const input = {
      prayer_name: 'dhuhr',
      rule_name: 'Round up',
      execution_order: 3,
      conditions_json: [{ type: 'always' }],
      action_json: { type: 'round_up', increment: 5 },
    };
    expect(() => CreatePrayerRuleSchema.parse(input)).not.toThrow();
  });

  it('accepts round_down action', () => {
    const input = {
      prayer_name: 'asr',
      rule_name: 'Round down',
      execution_order: 1,
      conditions_json: [{ type: 'always' }],
      action_json: { type: 'round_down', increment: 10 },
    };
    expect(() => CreatePrayerRuleSchema.parse(input)).not.toThrow();
  });

  it('accepts round_nearest action', () => {
    const input = {
      prayer_name: 'maghrib',
      rule_name: 'Round nearest',
      execution_order: 1,
      conditions_json: [{ type: 'always' }],
      action_json: { type: 'round_nearest', increment: 15 },
    };
    expect(() => CreatePrayerRuleSchema.parse(input)).not.toThrow();
  });

  it('accepts hijri_month condition', () => {
    const input = {
      prayer_name: 'isha',
      rule_name: 'Ramadan Isha',
      execution_order: 1,
      conditions_json: [{ type: 'hijri_month', months: [9] }],
      action_json: { type: 'add_minutes', minutes: 20 },
    };
    expect(() => CreatePrayerRuleSchema.parse(input)).not.toThrow();
  });

  it('accepts date_range condition', () => {
    const input = {
      prayer_name: 'isha',
      rule_name: 'Summer schedule',
      execution_order: 1,
      conditions_json: [{ type: 'date_range', start: '2026-06-01', end: '2026-08-31' }],
      action_json: { type: 'add_minutes', minutes: 30 },
    };
    expect(() => CreatePrayerRuleSchema.parse(input)).not.toThrow();
  });

  it('accepts multiple ANDed conditions', () => {
    const input = {
      prayer_name: 'dhuhr',
      rule_name: 'Friday in July',
      execution_order: 1,
      conditions_json: [
        { type: 'day_of_week', days: [5] },
        { type: 'month', months: [7] },
      ],
      action_json: { type: 'set_fixed_time', time: '13:30' },
    };
    expect(() => CreatePrayerRuleSchema.parse(input)).not.toThrow();
  });

  // Rejections
  it('rejects invalid prayer_name', () => {
    const input = {
      prayer_name: 'invalid_prayer',
      rule_name: 'Test rule',
      execution_order: 1,
      conditions_json: [{ type: 'always' }],
      action_json: { type: 'add_minutes', minutes: 10 },
    };
    expect(() => CreatePrayerRuleSchema.parse(input)).toThrow();
  });

  it('rejects empty prayer_name', () => {
    const input = {
      prayer_name: '',
      rule_name: 'Test rule',
      execution_order: 1,
      conditions_json: [{ type: 'always' }],
      action_json: { type: 'add_minutes', minutes: 10 },
    };
    expect(() => CreatePrayerRuleSchema.parse(input)).toThrow();
  });

  it('rejects invalid condition type', () => {
    const input = {
      prayer_name: 'dhuhr',
      rule_name: 'Bad condition',
      execution_order: 1,
      conditions_json: [{ type: 'invalid_condition_type' }],
      action_json: { type: 'add_minutes', minutes: 10 },
    };
    expect(() => CreatePrayerRuleSchema.parse(input)).toThrow();
  });

  it('rejects invalid action type', () => {
    const input = {
      prayer_name: 'dhuhr',
      rule_name: 'Bad action',
      execution_order: 1,
      conditions_json: [{ type: 'always' }],
      action_json: { type: 'subtract_minutes', minutes: 5 },
    };
    expect(() => CreatePrayerRuleSchema.parse(input)).toThrow();
  });

  it('rejects negative add_minutes', () => {
    const input = {
      prayer_name: 'dhuhr',
      rule_name: 'Negative minutes',
      execution_order: 1,
      conditions_json: [{ type: 'always' }],
      action_json: { type: 'add_minutes', minutes: -5 },
    };
    expect(() => CreatePrayerRuleSchema.parse(input)).toThrow();
  });

  it('rejects zero add_minutes (positive required)', () => {
    const input = {
      prayer_name: 'dhuhr',
      rule_name: 'Zero minutes',
      execution_order: 1,
      conditions_json: [{ type: 'always' }],
      action_json: { type: 'add_minutes', minutes: 0 },
    };
    expect(() => CreatePrayerRuleSchema.parse(input)).toThrow();
  });

  it('rejects non-integer add_minutes', () => {
    const input = {
      prayer_name: 'dhuhr',
      rule_name: 'Float minutes',
      execution_order: 1,
      conditions_json: [{ type: 'always' }],
      action_json: { type: 'add_minutes', minutes: 5.5 },
    };
    expect(() => CreatePrayerRuleSchema.parse(input)).toThrow();
  });

  it('rejects bad set_fixed_time format', () => {
    // Various bad formats
    const badTimes = ['13:30:00', '1:30', '25:00', '12:60', 'not a time', '3pm'];
    for (const time of badTimes) {
      const input = {
        prayer_name: 'dhuhr',
        rule_name: 'Bad time',
        execution_order: 1,
        conditions_json: [{ type: 'always' }],
        action_json: { type: 'set_fixed_time', time },
      };
      expect(() => CreatePrayerRuleSchema.parse(input), `time: ${time}`).toThrow();
    }
  });

  it('rejects invalid round increment (not in allowed set)', () => {
    const badIncrements = [2, 3, 4, 6, 7, 8, 9, 11, 12, 13, 14, 25, 45, 0, 100];
    for (const inc of badIncrements) {
      const input = {
        prayer_name: 'dhuhr',
        rule_name: 'Bad increment',
        execution_order: 1,
        conditions_json: [{ type: 'always' }],
        action_json: { type: 'round_up', increment: inc },
      };
      expect(() => CreatePrayerRuleSchema.parse(input), `increment: ${inc}`).toThrow();
    }
  });

  it('rejects day_of_week with out of range days', () => {
    const badDays = [[7], [-1], [3, 8], [0, 1, 2, 3, 4, 5, 6, 7]];
    for (const days of badDays) {
      const input = {
        prayer_name: 'dhuhr',
        rule_name: 'Bad day',
        execution_order: 1,
        conditions_json: [{ type: 'day_of_week', days }],
        action_json: { type: 'add_minutes', minutes: 10 },
      };
      expect(() => CreatePrayerRuleSchema.parse(input), `days: ${JSON.stringify(days)}`).toThrow();
    }
  });

  it('rejects day_of_week with empty days array', () => {
    const input = {
      prayer_name: 'dhuhr',
      rule_name: 'Empty days',
      execution_order: 1,
      conditions_json: [{ type: 'day_of_week', days: [] }],
      action_json: { type: 'add_minutes', minutes: 10 },
    };
    expect(() => CreatePrayerRuleSchema.parse(input)).toThrow();
  });

  it('rejects month condition with out of range months', () => {
    const badMonths = [[0], [13], [1, 14]];
    for (const months of badMonths) {
      const input = {
        prayer_name: 'dhuhr',
        rule_name: 'Bad month',
        execution_order: 1,
        conditions_json: [{ type: 'month', months }],
        action_json: { type: 'add_minutes', minutes: 10 },
      };
      expect(() => CreatePrayerRuleSchema.parse(input), `months: ${JSON.stringify(months)}`).toThrow();
    }
  });

  it('rejects empty conditions_json array', () => {
    const input = {
      prayer_name: 'dhuhr',
      rule_name: 'No conditions',
      execution_order: 1,
      conditions_json: [],
      action_json: { type: 'add_minutes', minutes: 10 },
    };
    expect(() => CreatePrayerRuleSchema.parse(input)).toThrow();
  });

  it('rejects empty rule_name', () => {
    const input = {
      prayer_name: 'dhuhr',
      rule_name: '',
      execution_order: 1,
      conditions_json: [{ type: 'always' }],
      action_json: { type: 'add_minutes', minutes: 10 },
    };
    expect(() => CreatePrayerRuleSchema.parse(input)).toThrow();
  });

  it('rejects negative execution_order', () => {
    const input = {
      prayer_name: 'dhuhr',
      rule_name: 'Negative order',
      execution_order: -1,
      conditions_json: [{ type: 'always' }],
      action_json: { type: 'add_minutes', minutes: 10 },
    };
    expect(() => CreatePrayerRuleSchema.parse(input)).toThrow();
  });

  it('rejects float execution_order', () => {
    const input = {
      prayer_name: 'dhuhr',
      rule_name: 'Float order',
      execution_order: 1.5,
      conditions_json: [{ type: 'always' }],
      action_json: { type: 'add_minutes', minutes: 10 },
    };
    expect(() => CreatePrayerRuleSchema.parse(input)).toThrow();
  });

  it('rejects date_range with bad format', () => {
    const badRanges = [
      { start: '2026/03/01', end: '2026-03-30' },
      { start: '2026-03-01', end: '2026/03/30' },
      { start: 'March 1, 2026', end: '2026-03-30' },
      { start: '2026-3-01', end: '2026-03-30' },
    ];
    for (const dateRange of badRanges) {
      const input = {
        prayer_name: 'dhuhr',
        rule_name: 'Bad date range',
        execution_order: 1,
        conditions_json: [{ type: 'date_range', start: dateRange.start, end: dateRange.end }],
        action_json: { type: 'add_minutes', minutes: 10 },
      };
      expect(
        () => CreatePrayerRuleSchema.parse(input),
        `range: ${JSON.stringify(dateRange)}`,
      ).toThrow();
    }
  });

  it('rejects hijri_month with months out of range', () => {
    const badMonths = [[0], [13], [5, 0]];
    for (const months of badMonths) {
      const input = {
        prayer_name: 'isha',
        rule_name: 'Bad hijri month',
        execution_order: 1,
        conditions_json: [{ type: 'hijri_month', months }],
        action_json: { type: 'add_minutes', minutes: 10 },
      };
      expect(
        () => CreatePrayerRuleSchema.parse(input),
        `months: ${JSON.stringify(months)}`,
      ).toThrow();
    }
  });
});

// ---------------------------------------------------------------------------
// UpdatePrayerRuleSchema (partial)
// ---------------------------------------------------------------------------
describe('UpdatePrayerRuleSchema', () => {
  it('accepts partial update with just rule_name', () => {
    expect(() => UpdatePrayerRuleSchema.parse({ rule_name: 'Updated name' })).not.toThrow();
  });

  it('accepts empty update', () => {
    expect(() => UpdatePrayerRuleSchema.parse({})).not.toThrow();
  });

  it('rejects invalid field in partial update', () => {
    expect(() =>
      UpdatePrayerRuleSchema.parse({ action_json: { type: 'add_minutes', minutes: -1 } }),
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// ReorderRulesSchema
// ---------------------------------------------------------------------------
describe('ReorderRulesSchema', () => {
  it('accepts valid reorder', () => {
    expect(() =>
      ReorderRulesSchema.parse({ order: ['id1', 'id2', 'id3'] }),
    ).not.toThrow();
  });

  it('rejects empty order array', () => {
    expect(() => ReorderRulesSchema.parse({ order: [] })).toThrow();
  });
});

// ---------------------------------------------------------------------------
// CreateMasjidSchema
// ---------------------------------------------------------------------------
describe('CreateMasjidSchema', () => {
  const validInput = {
    slug: 'masjid-al-noor',
    name: 'Masjid Al Noor',
    latitude: 41.85,
    longitude: -87.65,
    timezone: 'America/Chicago',
    calculation_method: 2,
    admin_email: 'admin@masjidnoor.com',
    admin_password: 'securepassword123',
    admin_display_name: 'Imam Abdullah',
  };

  it('accepts valid input', () => {
    expect(() => CreateMasjidSchema.parse(validInput)).not.toThrow();
  });

  it('accepts valid input without optional admin_display_name', () => {
    const { admin_display_name: _, ...withoutDisplay } = validInput;
    expect(() => CreateMasjidSchema.parse(withoutDisplay)).not.toThrow();
  });

  it('uses defaults for timezone and calculation_method', () => {
    const minimal = {
      slug: 'test-masjid',
      name: 'Test Masjid',
      latitude: 0,
      longitude: 0,
      admin_email: 'admin@test.com',
      admin_password: 'password123',
    };
    const parsed = CreateMasjidSchema.parse(minimal);
    expect(parsed.timezone).toBe('America/Chicago');
    expect(parsed.calculation_method).toBe(2);
  });

  // Rejections
  it('rejects invalid slug (uppercase)', () => {
    expect(() =>
      CreateMasjidSchema.parse({ ...validInput, slug: 'Masjid-Al-Noor' }),
    ).toThrow();
  });

  it('rejects invalid slug (special chars)', () => {
    expect(() =>
      CreateMasjidSchema.parse({ ...validInput, slug: 'masjid@noor' }),
    ).toThrow();
  });

  it('rejects slug too short', () => {
    expect(() => CreateMasjidSchema.parse({ ...validInput, slug: 'ab' })).toThrow();
  });

  it('rejects slug too long', () => {
    expect(() =>
      CreateMasjidSchema.parse({ ...validInput, slug: 'a'.repeat(51) }),
    ).toThrow();
  });

  it('rejects latitude out of range (>90)', () => {
    expect(() =>
      CreateMasjidSchema.parse({ ...validInput, latitude: 91 }),
    ).toThrow();
  });

  it('rejects latitude out of range (<-90)', () => {
    expect(() =>
      CreateMasjidSchema.parse({ ...validInput, latitude: -91 }),
    ).toThrow();
  });

  it('rejects longitude out of range (>180)', () => {
    expect(() =>
      CreateMasjidSchema.parse({ ...validInput, longitude: 181 }),
    ).toThrow();
  });

  it('rejects longitude out of range (<-180)', () => {
    expect(() =>
      CreateMasjidSchema.parse({ ...validInput, longitude: -181 }),
    ).toThrow();
  });

  it('rejects invalid admin_email', () => {
    expect(() =>
      CreateMasjidSchema.parse({ ...validInput, admin_email: 'not-an-email' }),
    ).toThrow();
  });

  it('rejects short admin_password (< 8)', () => {
    expect(() =>
      CreateMasjidSchema.parse({ ...validInput, admin_password: 'short' }),
    ).toThrow();
  });

  it('rejects empty name', () => {
    expect(() => CreateMasjidSchema.parse({ ...validInput, name: '' })).toThrow();
  });
});

// ---------------------------------------------------------------------------
// UpdateMasjidSchema (partial)
// ---------------------------------------------------------------------------
describe('UpdateMasjidSchema', () => {
  it('accepts partial update with only name', () => {
    expect(() => UpdateMasjidSchema.parse({ name: 'New Masjid Name' })).not.toThrow();
  });

  it('accepts partial update with multiple fields', () => {
    expect(() =>
      UpdateMasjidSchema.parse({
        name: 'Updated',
        city: 'Chicago',
        state: 'IL',
        calculation_method: 3,
      }),
    ).not.toThrow();
  });

  it('accepts empty partial update', () => {
    expect(() => UpdateMasjidSchema.parse({})).not.toThrow();
  });

  it('accepts nullable fields set to null', () => {
    expect(() =>
      UpdateMasjidSchema.parse({
        facebook_url: null,
        website_url: null,
      }),
    ).not.toThrow();
  });

  it('rejects invalid URL in website_url', () => {
    expect(() =>
      UpdateMasjidSchema.parse({ website_url: 'not-a-url' }),
    ).toThrow();
  });

  it('rejects invalid email in contact_email', () => {
    expect(() =>
      UpdateMasjidSchema.parse({ contact_email: 'invalid' }),
    ).toThrow();
  });

  it('rejects invalid calculation_method', () => {
    expect(() =>
      UpdateMasjidSchema.parse({ calculation_method: 2.5 }),
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// CreateAnnouncementSchema
// ---------------------------------------------------------------------------
describe('CreateAnnouncementSchema', () => {
  const validInput = {
    title: 'Ramadan Iftar Sponsorship',
    content_markdown: '## Join us for Iftar\n\nSign up at the front desk.',
    status: 'published' as const,
    is_pinned: false,
  };

  it('accepts valid input', () => {
    expect(() => CreateAnnouncementSchema.parse(validInput)).not.toThrow();
  });

  it('uses defaults for status=published and is_pinned=false', () => {
    const minimal = {
      title: 'Test',
      content_markdown: 'Content',
    };
    const parsed = CreateAnnouncementSchema.parse(minimal);
    expect(parsed.status).toBe('published');
    expect(parsed.is_pinned).toBe(false);
  });

  it('accepts draft status', () => {
    expect(() =>
      CreateAnnouncementSchema.parse({ ...validInput, status: 'draft' }),
    ).not.toThrow();
  });

  it('accepts is_pinned=true', () => {
    expect(() =>
      CreateAnnouncementSchema.parse({ ...validInput, is_pinned: true }),
    ).not.toThrow();
  });

  // Rejections
  it('rejects empty title', () => {
    expect(() =>
      CreateAnnouncementSchema.parse({ ...validInput, title: '' }),
    ).toThrow();
  });

  it('rejects invalid status', () => {
    expect(() =>
      CreateAnnouncementSchema.parse({ ...validInput, status: 'deleted' }),
    ).toThrow();
  });

  it('rejects empty content_markdown', () => {
    expect(() =>
      CreateAnnouncementSchema.parse({ ...validInput, content_markdown: '' }),
    ).toThrow();
  });

  it('rejects title too long (>300)', () => {
    expect(() =>
      CreateAnnouncementSchema.parse({ ...validInput, title: 'x'.repeat(301) }),
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// CreateJumuahSchema
// ---------------------------------------------------------------------------
describe('CreateJumuahSchema', () => {
  const validInput = {
    label: '1st Session (English)',
    time: '13:30',
    khateeb: 'Imam Abdullah',
    location: 'Main Hall',
  };

  it('accepts valid input', () => {
    expect(() => CreateJumuahSchema.parse(validInput)).not.toThrow();
  });

  it('accepts minimal input (label + time only)', () => {
    expect(() =>
      CreateJumuahSchema.parse({ label: 'Jumuah', time: '13:00' }),
    ).not.toThrow();
  });

  // Rejections
  it('rejects bad time format (25:00)', () => {
    expect(() =>
      CreateJumuahSchema.parse({ ...validInput, time: '25:00' }),
    ).toThrow();
  });

  it('rejects bad time format (12:60)', () => {
    expect(() =>
      CreateJumuahSchema.parse({ ...validInput, time: '12:60' }),
    ).toThrow();
  });

  it('rejects bad time format (9:00 instead of 09:00)', () => {
    expect(() =>
      CreateJumuahSchema.parse({ ...validInput, time: '9:00' }),
    ).toThrow();
  });

  it('rejects empty label', () => {
    expect(() =>
      CreateJumuahSchema.parse({ ...validInput, label: '' }),
    ).toThrow();
  });

  it('rejects label too long (>200)', () => {
    expect(() =>
      CreateJumuahSchema.parse({ ...validInput, label: 'x'.repeat(201) }),
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// LoginSchema
// ---------------------------------------------------------------------------
describe('LoginSchema', () => {
  it('accepts valid email and password', () => {
    expect(() =>
      LoginSchema.parse({ email: 'admin@masjid.com', password: 'secret123' }),
    ).not.toThrow();
  });

  it('rejects invalid email', () => {
    expect(() =>
      LoginSchema.parse({ email: 'not-email', password: 'secret123' }),
    ).toThrow();
  });

  it('rejects empty email', () => {
    expect(() => LoginSchema.parse({ email: '', password: 'secret123' })).toThrow();
  });

  it('rejects empty password', () => {
    expect(() =>
      LoginSchema.parse({ email: 'admin@masjid.com', password: '' }),
    ).toThrow();
  });

  it('rejects missing email', () => {
    expect(() => LoginSchema.parse({ password: 'secret123' })).toThrow();
  });

  it('rejects missing password', () => {
    expect(() => LoginSchema.parse({ email: 'admin@masjid.com' })).toThrow();
  });
});

// ---------------------------------------------------------------------------
// ConditionSchema — valid condition types
// ---------------------------------------------------------------------------
describe('ConditionSchema', () => {
  it('validates "always" condition', () => {
    expect(() => ConditionSchema.parse({ type: 'always' })).not.toThrow();
  });

  it('validates "day_of_week" condition', () => {
    expect(() =>
      ConditionSchema.parse({ type: 'day_of_week', days: [5] }),
    ).not.toThrow();
  });

  it('validates "month" condition', () => {
    expect(() =>
      ConditionSchema.parse({ type: 'month', months: [7, 8] }),
    ).not.toThrow();
  });

  it('validates "hijri_month" condition', () => {
    expect(() =>
      ConditionSchema.parse({ type: 'hijri_month', months: [9] }),
    ).not.toThrow();
  });

  it('validates "date_range" condition', () => {
    expect(() =>
      ConditionSchema.parse({
        type: 'date_range',
        start: '2026-03-01',
        end: '2026-03-30',
      }),
    ).not.toThrow();
  });

  it('rejects unknown condition type', () => {
    expect(() => ConditionSchema.parse({ type: 'is_friday' })).toThrow();
  });
});

// ---------------------------------------------------------------------------
// ActionSchema — valid action types
// ---------------------------------------------------------------------------
describe('ActionSchema', () => {
  it('validates add_minutes', () => {
    expect(() =>
      ActionSchema.parse({ type: 'add_minutes', minutes: 15 }),
    ).not.toThrow();
  });

  it('validates round_up', () => {
    expect(() =>
      ActionSchema.parse({ type: 'round_up', increment: 5 }),
    ).not.toThrow();
  });

  it('validates round_down', () => {
    expect(() =>
      ActionSchema.parse({ type: 'round_down', increment: 10 }),
    ).not.toThrow();
  });

  it('validates round_nearest', () => {
    expect(() =>
      ActionSchema.parse({ type: 'round_nearest', increment: 15 }),
    ).not.toThrow();
  });

  it('validates set_fixed_time', () => {
    expect(() =>
      ActionSchema.parse({ type: 'set_fixed_time', time: '13:30' }),
    ).not.toThrow();
  });

  it('rejects unknown action type', () => {
    expect(() => ActionSchema.parse({ type: 'multiply', factor: 2 })).toThrow();
  });
});

// ---------------------------------------------------------------------------
// PrayerName enum
// ---------------------------------------------------------------------------
describe('PrayerName', () => {
  it('validates all 5 prayer names', () => {
    const prayers = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const;
    for (const p of prayers) {
      expect(() => PrayerName.parse(p)).not.toThrow();
    }
  });

  it('rejects sunrise (not a prayer)', () => {
    expect(() => PrayerName.parse('sunrise')).toThrow();
  });
});