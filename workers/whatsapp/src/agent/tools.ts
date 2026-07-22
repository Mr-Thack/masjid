import type { ToolDefinition, ToolContext } from '../types';
import { storeMutation, listSnapshots, getSnapshot } from '../session';
import {
  getMasjidProfile,
  updateMasjidProfile,
  getPrayerConfig,
  updatePrayerConfig,
  getPrayerRulesList,
  createPrayerRule,
  updatePrayerRule,
  deletePrayerRule,
  reorderPrayerRules,
  getJumuahSessions,
  createJumuahSession,
  updateJumuahSession,
  deleteJumuahSession,
  getAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  pinAnnouncement,
  dryRunPrayerTimes,
} from '../proxy';

const NOWHERE = 'nowhere';

function nowISO(): string {
  return new Date().toISOString();
}

function describeMutation(domain: string, action: string, args: Record<string, unknown>): string {
  const truncate = (v: unknown): string => {
    const s = typeof v === 'string' ? v : JSON.stringify(v);
    return s.length > 60 ? s.slice(0, 57) + '...' : s;
  };

  switch (domain) {
    case 'THEME':
      return `Update theme: ${Object.keys(args).filter(k => k !== 'masjid_id').join(', ')}`;
    case 'PROFILE':
      return `Update profile: ${Object.keys(args).filter(k => k !== 'masjid_id').join(', ')}`;
    case 'PRAYER_RULES':
      if (action === 'CREATE') return `Create prayer rule "${args.rule_name || 'untitled'}"`;
      if (action === 'UPDATE') return `Update prayer rule`;
      if (action === 'DELETE') return `Delete prayer rule ${args.rule_id || ''}`;
      if (action === 'REORDER') return 'Reorder prayer rules';
      return 'Prayer rule change';
    case 'JUMUAH':
      if (action === 'CREATE') return `Create Jumu'ah session "${args.label || 'untitled'}"`;
      if (action === 'UPDATE') return `Update Jumu'ah session`;
      if (action === 'DELETE') return `Delete Jumu'ah session`;
      return "Jumu'ah change";
    case 'ANNOUNCEMENTS':
      if (action === 'CREATE') return `Create announcement "${args.title || 'untitled'}"`;
      if (action === 'UPDATE') return `Update announcement`;
      if (action === 'DELETE') return `Delete announcement`;
      if (action === 'PIN') return `Pin/unpin announcement`;
      return 'Announcement change';
    default:
      return `${domain} ${action}: ${truncate(args)}`;
  }
}

function stringProp(description: string, required: string[] = []) {
  return { type: 'string' as const, description };
}

function boolProp(description: string) {
  return { type: 'boolean' as const, description };
}

function enumProp(values: string[], description: string) {
  return { type: 'string' as const, enum: values, description };
}

function hexProp(description: string) {
  return { type: 'string' as const, pattern: '^#[0-9a-fA-F]{6}$', description };
}

function timeProp(description: string) {
  return { type: 'string' as const, pattern: '^([01]\\d|2[0-3]):[0-5]\\d$', description };
}

function nullableProp(inner: Record<string, unknown>) {
  return { ...inner, nullable: true };
}

export function getToolDefinitions(): ToolDefinition[] {
  return [
    {
      name: 'theme_get',
      description: 'Get the current theme settings (colors, fonts, labels, time format) for the masjid.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
      handler: async (_args, ctx) => {
        const data = await getMasjidProfile(ctx.env, ctx.adminId, ctx.masjidId);
        const theme = (data as Record<string, unknown>).theme || {};
        return { success: true, data: theme };
      },
    },
    {
      name: 'theme_update',
      description: 'Update theme settings. Only include fields you want to change. Colors must be 6-digit hex.',
      parameters: {
        type: 'object',
        properties: {
          layout_preset: stringProp('Layout preset name: "modern_minimal", "glass-dark", or "minimal-light"'),
          primary_color: hexProp('Primary brand color hex (e.g. "#1e3a8a")'),
          accent_color: hexProp('Accent color hex (e.g. "#10b981")'),
          font_heading: stringProp('Heading font family (e.g. "Inter", "Amiri")'),
          font_body: stringProp('Body font family (e.g. "Roboto", "Inter")'),
          time_format: enumProp(['12h', '24h'], 'Time display format'),
          label_adhaan: stringProp('Custom label for Adhaan (e.g. "Azaan")'),
          label_iqaamah: stringProp('Custom label for Iqaamah (e.g. "Iqamah")'),
          label_jumuah: stringProp("Custom label for Jumu'ah (e.g. 'Jummah')"),
          label_sunrise: stringProp('Custom label for Sunrise'),
          label_fajr: stringProp('Custom label for Fajr prayer'),
          label_dhuhr: stringProp('Custom label for Dhuhr prayer (e.g. "Zuhr")'),
          label_asr: stringProp('Custom label for Asr prayer'),
          label_maghrib: stringProp('Custom label for Maghrib prayer'),
          label_isha: stringProp('Custom label for Isha prayer'),
        },
        required: [],
      },
      handler: async (args, ctx) => {
        const data = await updateMasjidProfile(args as Record<string, unknown>, ctx.env, ctx.adminId, ctx.masjidId);
        const summary = describeMutation('THEME', 'UPSERT', args);
        await storeMutation(ctx.branchId, 'THEME', 'UPSERT', 'theme', args, ctx.env.DB);
        return { success: true, data, mutationSummary: summary };
      },
    },
    {
      name: 'profile_get',
      description: 'Get the current masjid profile (name, address, contact info, social links, calculation method).',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
      handler: async (_args, ctx) => {
        const data = await getMasjidProfile(ctx.env, ctx.adminId, ctx.masjidId);
        return { success: true, data };
      },
    },
    {
      name: 'profile_update',
      description: 'Update masjid profile fields. Only include fields you want to change.',
      parameters: {
        type: 'object',
        properties: {
          name: stringProp('Masjid display name'),
          address_line1: stringProp('Street address'),
          address_line2: stringProp('Address line 2'),
          city: stringProp('City'),
          state: stringProp('State/province'),
          postal_code: stringProp('Postal/ZIP code'),
          country: stringProp('Country'),
          contact_phone: stringProp('Public phone number'),
          contact_email: stringProp('Public email address'),
          facebook_url: stringProp('Facebook page URL'),
          youtube_url: stringProp('YouTube channel URL'),
          instagram_url: stringProp('Instagram profile URL'),
          website_url: stringProp('Website URL'),
          external_donation_url: stringProp('External donation link URL'),
          calculation_method: { type: 'integer', minimum: 1, description: 'Prayer calculation method (1-7, e.g. 2=ISNA, 3=MWL, 5=Egyptian)' },
          timezone: stringProp('IANA timezone (e.g. "America/Chicago", "Europe/London")'),
        },
        required: [],
      },
      handler: async (args, ctx) => {
        const data = await updateMasjidProfile(args as Record<string, unknown>, ctx.env, ctx.adminId, ctx.masjidId);
        const summary = describeMutation('PROFILE', 'UPSERT', args);
        await storeMutation(ctx.branchId, 'PROFILE', 'UPSERT', 'profile', args, ctx.env.DB);
        return { success: true, data, mutationSummary: summary };
      },
    },
    {
      name: 'prayer_config_get',
      description: 'Get the current prayer configuration (calculation method and timezone).',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
      handler: async (_args, ctx) => {
        const data = await getPrayerConfig(ctx.env, ctx.adminId, ctx.masjidId);
        return { success: true, data };
      },
    },
    {
      name: 'prayer_config_update',
      description: 'Update prayer calculation method and/or timezone.',
      parameters: {
        type: 'object',
        properties: {
          calculation_method: { type: 'integer', minimum: 1, description: 'Prayer calculation method (1=Shia, 2=ISNA, 3=MWL, 4=Makkah, 5=Egyptian, 6=Tehran, 7=Karachi)' },
          timezone: stringProp('IANA timezone (e.g. "America/Chicago")'),
        },
        required: [],
      },
      handler: async (args, ctx) => {
        const data = await updatePrayerConfig(args as Record<string, unknown>, ctx.env, ctx.adminId, ctx.masjidId);
        const summary = describeMutation('PROFILE', 'PATCH', args);
        await storeMutation(ctx.branchId, 'PROFILE', 'PATCH', 'prayer_config', args, ctx.env.DB);
        return { success: true, data, mutationSummary: summary };
      },
    },
    {
      name: 'prayer_rules_list',
      description: 'List all iqaamah prayer rules for the masjid, ordered by execution_order. Each rule has conditions (when it applies) and an action (what to do).',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
      handler: async (_args, ctx) => {
        const data = await getPrayerRulesList(ctx.env, ctx.adminId, ctx.masjidId);
        return { success: true, data };
      },
    },
    {
      name: 'prayer_rules_create',
      description: `Create a new iqaamah prayer rule. Rules control how iqaamah times are calculated.
Conditions (conditions_json array, at least one):
  - {"type":"always"} — always applies
  - {"type":"day_of_week","days":[0-6]} — specific days (0=Sun, 5=Fri)
  - {"type":"month","months":[1-12]} — Gregorian months
  - {"type":"hijri_month","months":[1-12]} — Hijri months  
  - {"type":"date_range","start":"YYYY-MM-DD","end":"YYYY-MM-DD"}
Actions (action_json object, exactly one):
  - {"type":"add_minutes","minutes":N} — add N minutes after adhaan
  - {"type":"set_fixed_time","time":"HH:MM"} — set exact time
  - {"type":"round_up","increment":N} — round up to nearest N
  - {"type":"round_down","increment":N} — round down to nearest N
  - {"type":"round_nearest","increment":N} — round to nearest N
  - {"type":"right_after_adhaan"} — iqaamah immediately after adhaan
Increments for rounding must be: 1, 5, 10, 15, 20, 30, or 60.
prayer_name must be one of: fajr, dhuhr, asr, maghrib, isha.
Higher execution_order runs later (chains with previous actions). Multiple conditions are ANDed. Use separate rules for OR logic.`,
      parameters: {
        type: 'object',
        properties: {
          prayer_name: enumProp(['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'], 'Which prayer this rule applies to'),
          rule_name: stringProp('Human-readable name for this rule (e.g. "Friday Dhuhr override")'),
          execution_order: { type: 'integer', minimum: 0, description: 'Execution order (lower numbers run first; start at 0 and increment)' },
          conditions_json: { type: 'array', description: 'Array of condition objects (see description above for types)', minItems: 1 },
          action_json: { type: 'object', description: 'Action object (see description above for types)' },
        },
        required: ['prayer_name', 'rule_name', 'execution_order', 'conditions_json', 'action_json'],
      },
      handler: async (args, ctx) => {
        const data = await createPrayerRule(args as Record<string, unknown>, ctx.env, ctx.adminId, ctx.masjidId);
        const ruleId = (data as Record<string, unknown>).id as string || NOWHERE;
        const summary = describeMutation('PRAYER_RULES', 'CREATE', args);
        await storeMutation(ctx.branchId, 'PRAYER_RULES', 'CREATE', `rule:${ruleId}`, args, ctx.env.DB);
        return { success: true, data, mutationSummary: summary };
      },
    },
    {
      name: 'prayer_rules_update',
      description: 'Update an existing prayer rule. Send only the fields you want to change. Same condition/action types as create.',
      parameters: {
        type: 'object',
        properties: {
          rule_id: stringProp('ID of the rule to update'),
          prayer_name: enumProp(['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'], 'Which prayer (optional)'),
          rule_name: stringProp('New rule name (optional)'),
          execution_order: { type: 'integer', minimum: 0, description: 'New execution order (optional)' },
          conditions_json: { type: 'array', description: 'New conditions (optional)' },
          action_json: { type: 'object', description: 'New action (optional)' },
        },
        required: ['rule_id'],
      },
      handler: async (args, ctx) => {
        const { rule_id, ...body } = args;
        const data = await updatePrayerRule(rule_id as string, body as Record<string, unknown>, ctx.env, ctx.adminId, ctx.masjidId);
        const summary = describeMutation('PRAYER_RULES', 'UPDATE', args);
        await storeMutation(ctx.branchId, 'PRAYER_RULES', 'UPDATE', `rule:${rule_id}`, args, ctx.env.DB);
        return { success: true, data, mutationSummary: summary };
      },
    },
    {
      name: 'prayer_rules_delete',
      description: 'Delete a prayer rule by its ID.',
      parameters: {
        type: 'object',
        properties: {
          rule_id: stringProp('ID of the rule to delete'),
        },
        required: ['rule_id'],
      },
      handler: async (args, ctx) => {
        await deletePrayerRule(args.rule_id as string, ctx.env, ctx.adminId, ctx.masjidId);
        const summary = describeMutation('PRAYER_RULES', 'DELETE', args);
        await storeMutation(ctx.branchId, 'PRAYER_RULES', 'DELETE', `rule:${args.rule_id}`, args, ctx.env.DB);
        return { success: true, mutationSummary: summary };
      },
    },
    {
      name: 'prayer_rules_reorder',
      description: 'Reorder all prayer rules by providing the full list of rule IDs in desired order.',
      parameters: {
        type: 'object',
        properties: {
          order: { type: 'array', items: { type: 'string' }, minItems: 1, description: 'Array of rule IDs in the desired execution order' },
        },
        required: ['order'],
      },
      handler: async (args, ctx) => {
        const data = await reorderPrayerRules(args.order as string[], ctx.env, ctx.adminId, ctx.masjidId);
        const summary = describeMutation('PRAYER_RULES', 'REORDER', {});
        await storeMutation(ctx.branchId, 'PRAYER_RULES', 'REORDER', 'order', { order: args.order }, ctx.env.DB);
        return { success: true, data, mutationSummary: summary };
      },
    },
    {
      name: 'jumuah_list',
      description: "List all Jumu'ah (Friday prayer) sessions for the masjid.",
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
      handler: async (_args, ctx) => {
        const data = await getJumuahSessions(ctx.env, ctx.adminId, ctx.masjidId);
        return { success: true, data };
      },
    },
    {
      name: 'jumuah_create',
      description: "Create a new Jumu'ah session. time is the Khutbah start time (mandatory). speech_time is an optional pre-khutbah lecture/speech start time. Time format: HH:MM (24-hour).",
      parameters: {
        type: 'object',
        properties: {
          label: stringProp("Session label for admin reference (e.g. 'First Session', 'Main Jumu\\'ah')"),
          time: timeProp("Khutbah start time in 24-hour format (e.g. '13:30')"),
          khateeb: stringProp('Name of the khateeb (optional)'),
          location: stringProp('Location within the masjid (optional)'),
          speech_time: timeProp('Optional pre-khutbah speech/lecture start time (e.g. "13:00")'),
        },
        required: ['label', 'time'],
      },
      handler: async (args, ctx) => {
        const data = await createJumuahSession(args as Record<string, unknown>, ctx.env, ctx.adminId, ctx.masjidId);
        const sessionId = (data as Record<string, unknown>).id as string || NOWHERE;
        const summary = describeMutation('JUMUAH', 'CREATE', args);
        await storeMutation(ctx.branchId, 'JUMUAH', 'CREATE', `session:${sessionId}`, args, ctx.env.DB);
        return { success: true, data, mutationSummary: summary };
      },
    },
    {
      name: 'jumuah_update',
      description: "Update an existing Jumu'ah session. Send only fields to change.",
      parameters: {
        type: 'object',
        properties: {
          session_id: stringProp('ID of the session to update'),
          label: stringProp('New label (optional)'),
          time: timeProp('New Khutbah time (optional)'),
          khateeb: nullableProp(stringProp('Khateeb name (optional)')),
          location: nullableProp(stringProp('Location (optional)')),
          speech_time: nullableProp(timeProp('Pre-khutbah speech start time (optional)')),
          is_active: { type: 'boolean', description: 'Whether the session is active (optional)' },
        },
        required: ['session_id'],
      },
      handler: async (args, ctx) => {
        const { session_id, ...body } = args;
        const data = await updateJumuahSession(session_id as string, body as Record<string, unknown>, ctx.env, ctx.adminId, ctx.masjidId);
        const summary = describeMutation('JUMUAH', 'UPDATE', args);
        await storeMutation(ctx.branchId, 'JUMUAH', 'UPDATE', `session:${session_id}`, args, ctx.env.DB);
        return { success: true, data, mutationSummary: summary };
      },
    },
    {
      name: 'jumuah_delete',
      description: "Delete a Jumu'ah session by ID.",
      parameters: {
        type: 'object',
        properties: {
          session_id: stringProp('ID of the session to delete'),
        },
        required: ['session_id'],
      },
      handler: async (args, ctx) => {
        await deleteJumuahSession(args.session_id as string, ctx.env, ctx.adminId, ctx.masjidId);
        const summary = describeMutation('JUMUAH', 'DELETE', args);
        await storeMutation(ctx.branchId, 'JUMUAH', 'DELETE', `session:${args.session_id}`, {}, ctx.env.DB);
        return { success: true, mutationSummary: summary };
      },
    },
    {
      name: 'announcements_list',
      description: 'List all announcements for the masjid, ordered by publish date.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
      handler: async (_args, ctx) => {
        const data = await getAnnouncements(ctx.env, ctx.adminId, ctx.masjidId);
        return { success: true, data };
      },
    },
    {
      name: 'announcements_create',
      description: `Create a new announcement. Content uses markdown format.
Status: 'draft' (not visible), 'published' (visible on consumer/TV), 'archived' (hidden).
If is_pinned is true, any previously pinned announcement will be unpinned.`,
      parameters: {
        type: 'object',
        properties: {
          title: stringProp('Announcement title'),
          content_markdown: stringProp('Content in markdown format (supports **bold**, *italic*, lists, links)'),
          status: enumProp(['draft', 'published', 'archived'], "Publishing status (default 'published')"),
          is_pinned: { type: 'boolean', description: 'Pin as featured announcement (default false)' },
          expires_at: stringProp('Expiration date/time in ISO 8601 (optional, e.g. "2026-08-01T00:00:00Z")'),
        },
        required: ['title', 'content_markdown'],
      },
      handler: async (args, ctx) => {
        const data = await createAnnouncement(args as Record<string, unknown>, ctx.env, ctx.adminId, ctx.masjidId);
        const slug = (data as Record<string, unknown>).slug as string || NOWHERE;
        const summary = describeMutation('ANNOUNCEMENTS', 'CREATE', args);
        await storeMutation(ctx.branchId, 'ANNOUNCEMENTS', 'CREATE', `announcement:${slug}`, args, ctx.env.DB);
        return { success: true, data, mutationSummary: summary };
      },
    },
    {
      name: 'announcements_update',
      description: 'Update an existing announcement. Send only fields to change. Re-compiles HTML if content_markdown changes.',
      parameters: {
        type: 'object',
        properties: {
          slug: stringProp('Slug of the announcement to update'),
          title: stringProp('New title (optional)'),
          content_markdown: stringProp('New markdown content (optional)'),
          status: enumProp(['draft', 'published', 'archived'], 'New status (optional)'),
          is_pinned: { type: 'boolean', description: 'Pin status (optional)' },
          expires_at: nullableProp(stringProp('Expiration date (optional)')),
        },
        required: ['slug'],
      },
      handler: async (args, ctx) => {
        const { slug, ...body } = args;
        const data = await updateAnnouncement(slug as string, body as Record<string, unknown>, ctx.env, ctx.adminId, ctx.masjidId);
        const summary = describeMutation('ANNOUNCEMENTS', 'UPDATE', args);
        await storeMutation(ctx.branchId, 'ANNOUNCEMENTS', 'UPDATE', `announcement:${slug}`, args, ctx.env.DB);
        return { success: true, data, mutationSummary: summary };
      },
    },
    {
      name: 'announcements_delete',
      description: 'Soft-delete (archive) an announcement by slug.',
      parameters: {
        type: 'object',
        properties: {
          slug: stringProp('Slug of the announcement to delete/archive'),
        },
        required: ['slug'],
      },
      handler: async (args, ctx) => {
        await deleteAnnouncement(args.slug as string, ctx.env, ctx.adminId, ctx.masjidId);
        const summary = describeMutation('ANNOUNCEMENTS', 'DELETE', args);
        await storeMutation(ctx.branchId, 'ANNOUNCEMENTS', 'DELETE', `announcement:${args.slug}`, {}, ctx.env.DB);
        return { success: true, mutationSummary: summary };
      },
    },
    {
      name: 'announcements_pin',
      description: 'Toggle the pinned status of an announcement. If pinning, any other pinned announcement is unpinned first.',
      parameters: {
        type: 'object',
        properties: {
          slug: stringProp('Slug of the announcement to pin/unpin'),
        },
        required: ['slug'],
      },
      handler: async (args, ctx) => {
        const data = await pinAnnouncement(args.slug as string, ctx.env, ctx.adminId, ctx.masjidId);
        const summary = describeMutation('ANNOUNCEMENTS', 'PIN', args);
        await storeMutation(ctx.branchId, 'ANNOUNCEMENTS', 'PIN', `announcement:${args.slug}`, args, ctx.env.DB);
        return { success: true, data, mutationSummary: summary };
      },
    },
    {
      name: 'timetable_preview',
      description: 'Preview what prayer times would look like given proposed rule changes, without committing them. Useful for verifying timetable parsing before confirming. Accepts a date and optional rule overrides.',
      parameters: {
        type: 'object',
        properties: {
          date: stringProp('Date to preview in YYYY-MM-DD format (defaults to today)'),
          rule_overrides: { type: 'array', items: { type: 'object' }, description: 'Array of proposed rule objects to simulate on top of existing rules (optional)' },
        },
        required: [],
      },
      handler: async (args, ctx) => {
        const body: Record<string, unknown> = {};
        if (args.date) body.date = args.date;
        if (args.rule_overrides) body.rule_overrides = args.rule_overrides;
        const data = await dryRunPrayerTimes(body, ctx.env, ctx.adminId, ctx.masjidId);
        return { success: true, data };
      },
    },
    {
      name: 'rollback_list_snapshots',
      description: 'List recent configuration snapshots (point-in-time rollback states). Each snapshot was created when a session was confirmed. Useful before using rollback_restore.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
      handler: async (_args, ctx) => {
        const snapshots = await listSnapshots(ctx.masjidId, ctx.env.DB);
        return { success: true, data: snapshots };
      },
    },
    {
      name: 'rollback_restore',
      description: 'EXPERIMENTAL: Request a rollback to a previous snapshot. This is a high-risk operation — it will attempt to restore the masjid configuration to a previous state. Currently provides the snapshot data for manual review.',
      parameters: {
        type: 'object',
        properties: {
          snapshot_id: stringProp('ID of the snapshot to restore (from rollback_list_snapshots)'),
        },
        required: ['snapshot_id'],
      },
      handler: async (args, ctx) => {
        const snapshot = await getSnapshot(args.snapshot_id as string, ctx.env.DB);
        if (!snapshot) {
          return { success: false, error: 'Snapshot not found. Use rollback_list_snapshots to see available snapshots.' };
        }
        return {
          success: true,
          data: snapshot,
          mutationSummary: `Snapshot ${snapshot.id} retrieved. Full state available for review. Restore functionality requires admin API support (coming soon).`,
        };
      },
    },
  ];
}
