import type { ToolDefinition, ToolContext } from './types';
import { storeMutation, listSnapshots, getSnapshot } from './session';
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
  getPosts,
  createPost,
  updatePost,
  deletePost,
  pinPostHomepage,
  pinPostInfo,
  dryRunPrayerTimes,
  rollbackRestore,
  explainPrayerRules,
  importTimetable,
  getMaktabSettings,
  updateMaktabSettings,
  getMaktabTerms,
  activateMaktabTerm,
  getNavItems,
  createNavItem,
  updateNavItem,
  deleteNavItem,
  reorderNavItems,
  getPages,
  createPage,
  updatePage,
  deletePage,
} from './api-client';
import { explainAllPrayers, validateRules } from './rules-engine';
import type { RuleWithDb, ConditionEval, RuleTrace, PrayerTrace } from './rules-engine';
import type { PrayerName } from './types';
import type { Condition, Action } from '@masjid/schemas';
import { searchWeb, fetchUrl } from './web';

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
case 'POSTS':
      if (action === 'CREATE') return `Create post "${args.title || 'untitled'}"`;
      if (action === 'UPDATE') return `Update post`;
      if (action === 'DELETE') return `Delete post ${args.slug || ''}`;
      if (action === 'PIN_HOMEPAGE') return 'Toggle homepage pin for post';
      if (action === 'PIN_INFO') return 'Toggle info pin for post';
      return 'Post change';
    case 'TIMETABLE_IMPORT':
      if (action === 'IMPORT') return `Import timetable rules`;
      return 'Timetable change';
    case 'MAKTAB':
      if (action === 'UPSERT') return 'Update maktab settings';
      if (action === 'ACTIVATE') return `Activate maktab term`;
      return 'Maktab change';
    case 'NAV':
      if (action === 'CREATE') return `Add nav item "${args.label || 'untitled'}"`;
      if (action === 'UPDATE') return `Update nav item`;
      if (action === 'DELETE') return 'Delete nav item';
      if (action === 'REORDER') return 'Reorder nav items';
      return 'Nav change';
    case 'PAGES':
      if (action === 'CREATE') return `Create page "${args.title || args.slug || 'untitled'}"`;
      if (action === 'UPDATE') return `Update page "${args.slug || ''}"`;
      if (action === 'DELETE') return `Delete page "${args.slug || ''}"`;
      return 'Page change';
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
        const data = await getMasjidProfile(ctx);
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
          layout_preset: stringProp('Layout preset: "mishkaat" (flagship) or "minimal-light" (Sakeenah)'),
          style_system: enumProp(['sakeenah', 'mishkaat'], 'Style system: "sakeenah" (minimal) or "mishkaat" (soul-forward with ceremony states, frames, ambient palette)'),
          style_options: {
            type: 'object',
            description: 'Style options (advanced visual settings for the selected style system)',
            properties: {
              metal: enumProp(['gold', 'silver', 'copper', 'rose'], 'Accent metal palette (Mishkaat only)'),
              motif: enumProp(['eight-point-star', 'honeycomb', 'girih', 'arabesque', 'none'], 'Geometric motif pattern (Mishkaat only)'),
              arch: boolProp('Show mihrab arch niche around the clock (Mishkaat only)'),
              numerals: enumProp(['western', 'arabic-indic'], 'Numeral style for clock and times'),
              density: enumProp(['standard', 'large-print'], 'Display density (large-print for accessibility)'),
              ambient: boolProp('Enable ambient palette that shifts colors through the day'),
              quietHours: {
                type: 'object',
                description: 'Night calm settings',
                properties: {
                  enabled: boolProp('Enable quiet hours (dims the display overnight)'),
                  quietMinutes: { type: 'integer', minimum: 0, maximum: 180, description: 'Minutes of quiet transition (default: 30)' },
                  sleepAfterIshaMinutes: { type: 'integer', minimum: 0, maximum: 360, description: 'Minutes after Isha iqaamah to enter night calm (default: 90)' },
                  wakeBeforeFajrMinutes: { type: 'integer', minimum: 0, maximum: 180, description: 'Minutes before Fajr adhaan to wake from night calm (default: 30)' },
                },
              },
              frames: {
                type: 'array',
                description: 'Soul-column frames to show: "hadith", "jumuah", "announcements", "donate", "qr", "community"',
                items: { type: 'string' },
              },
              emblem: enumProp(['engraved', 'medallion'], 'Masjid emblem style'),
              donateAppeal: { type: 'string', maxLength: 80, description: 'Donation appeal text (max 80 chars, shown on donate frame)' },
            },
          },
          primary_color: hexProp('Primary brand color hex (e.g. "#1e3a8a")'),
          accent_color: hexProp('Accent color hex (e.g. "#10b981")'),
          font_heading: stringProp('Heading font family (e.g. "Inter", "Amiri")'),
          font_body: stringProp('Body font family (e.g. "Roboto", "Inter")'),
          time_format: enumProp(['12h', '24h'], 'Time display format'),
          label_adhaan: stringProp('Custom label for Adhaan (e.g. "Azaan", "Adhan", "Ezan", "Azan")'),
          label_iqaamah: stringProp('Custom label for Iqaamah (e.g. "Iqamah", "Iqama", "Kamet", "Iqamat")'),
          label_jumuah: stringProp("Custom label for Jumu'ah (e.g. 'Jummah', 'Cuma', 'Jumaat', 'Džuma')"),
          label_speech: stringProp('Custom label for speech/sermon (e.g. "Bayaan", "Khutbah", "Hutbe", "Hutba")'),
          label_sunrise: stringProp('Custom label for Sunrise (e.g. "Güneş")'),
          label_fajr: stringProp('Custom label for Fajr prayer (e.g. "Sabah")'),
          label_dhuhr: stringProp('Custom label for Dhuhr prayer (e.g. "Zuhr", "Öğle", "Zohor", "Podne")'),
          label_asr: stringProp('Custom label for Asr prayer (e.g. "İkindi", "Asar", "Ikindija")'),
          label_maghrib: stringProp('Custom label for Maghrib prayer (e.g. "Akşam")'),
          label_isha: stringProp('Custom label for Isha prayer (e.g. "Yatsı", "Jacija")'),
        },
        required: [],
      },
      handler: async (args, ctx) => {
        const data = await updateMasjidProfile(args as Record<string, unknown>, ctx);
        const summary = describeMutation('THEME', 'UPSERT', args);
        await storeMutation(ctx.branchId, 'THEME', 'UPSERT', 'theme', args, ctx.db);
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
        const data = await getMasjidProfile(ctx);
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
          about_markdown: stringProp('About Us markdown content (history, story, etc.)'),
          donation_links: stringProp('JSON array of {label, url} donation links (e.g. \'[{"label":"PayPal","url":"https://..."}]\')'),
          show_donate_qr: { type: 'boolean', description: 'If true, show a QR code card on the donate page' },
          latitude: { type: 'number', minimum: -90, maximum: 90, description: 'Geographic latitude (e.g. 41.88 for Chicago)' },
          longitude: { type: 'number', minimum: -180, maximum: 180, description: 'Geographic longitude (e.g. -87.63 for Chicago)' },
          calculation_method: { type: 'integer', minimum: 1, description: 'Prayer calculation method (1-13, e.g. 2=ISNA, 3=MWL, 4=Umm al-Qura, 7=Karachi)' },
          asr_madhab: { type: 'string', enum: ['shafi', 'hanafi'], description: 'Asr madhab: shafi (earlier) or hanafi (later, common for Indo-Pak)' },
          high_latitude_rule: { type: 'string', enum: ['seventh_of_night', 'middle_of_night', 'twilight_angle', 'none'], description: 'High latitude rule for locations above 48°N' },
          show_dual_asr: { type: 'boolean', description: 'If true, display both Shafi and Hanafi Asr times' },
          fajr_angle: { type: 'number', minimum: 8, maximum: 22, description: 'Custom Fajr twilight angle in degrees (null = use preset default). Set to null to clear.' },
          isha_angle: { type: 'number', minimum: 8, maximum: 22, description: 'Custom Isha twilight angle in degrees (null = use preset default). Set to null to clear.' },
          adjust_fajr: { type: 'integer', description: 'Manual minute offset for Fajr adhaan (can be negative)' },
          adjust_sunrise: { type: 'integer', description: 'Manual minute offset for Sunrise display' },
          adjust_dhuhr: { type: 'integer', description: 'Manual minute offset for Dhuhr adhaan' },
          adjust_asr: { type: 'integer', description: 'Manual minute offset for Asr adhaan' },
          adjust_maghrib: { type: 'integer', description: 'Manual minute offset for Maghrib adhaan' },
          adjust_isha: { type: 'integer', description: 'Manual minute offset for Isha adhaan' },
          timezone: stringProp('IANA timezone (e.g. "America/Chicago", "Europe/London")'),
        },
        required: [],
      },
      handler: async (args, ctx) => {
        const data = await updateMasjidProfile(args as Record<string, unknown>, ctx);
        const summary = describeMutation('PROFILE', 'UPSERT', args);
        await storeMutation(ctx.branchId, 'PROFILE', 'UPSERT', 'profile', args, ctx.db);
        return { success: true, data, mutationSummary: summary };
      },
    },
    {
      name: 'prayer_config_get',
      description: 'Get the current prayer configuration: calculation method, timezone, asr_madhab, high_latitude_rule, show_dual_asr, fajr/isha angles, and minute adjustments for each prayer.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
      handler: async (_args, ctx) => {
        const data = await getPrayerConfig(ctx);
        return { success: true, data };
      },
    },
    {
      name: 'prayer_config_update',
      description: 'Update prayer calculation method, asr madhab, high latitude rule, and/or timezone.',
      parameters: {
        type: 'object',
        properties: {
          calculation_method: { type: 'integer', minimum: 1, description: 'Prayer calculation method (1=Shia, 2=ISNA, 3=MWL, 4=Makkah, 5=Egyptian, 6=Tehran, 7=Karachi, 8=Turkey, 9=Singapore, 10=Dubai, 11=Kuwait, 12=Qatar, 13=Moonsighting)' },
          asr_madhab: { type: 'string', enum: ['shafi', 'hanafi'], description: 'Asr madhab: shafi (earlier Asr) or hanafi (later Asr)' },
          high_latitude_rule: { type: 'string', enum: ['seventh_of_night', 'middle_of_night', 'twilight_angle', 'none'], description: 'High latitude rule for >48°N' },
          show_dual_asr: { type: 'boolean', description: 'Display both Shafi + Hanafi Asr times' },
          fajr_angle: { type: 'number', minimum: 8, maximum: 22, description: 'Custom Fajr twilight angle in degrees (null = use preset default)' },
          isha_angle: { type: 'number', minimum: 8, maximum: 22, description: 'Custom Isha twilight angle in degrees (null = use preset default)' },
          adjust_fajr: { type: 'integer', description: 'Manual minute offset for Fajr adhaan (can be negative)' },
          adjust_sunrise: { type: 'integer', description: 'Manual minute offset for Sunrise' },
          adjust_dhuhr: { type: 'integer', description: 'Manual minute offset for Dhuhr adhaan' },
          adjust_asr: { type: 'integer', description: 'Manual minute offset for Asr adhaan' },
          adjust_maghrib: { type: 'integer', description: 'Manual minute offset for Maghrib adhaan' },
          adjust_isha: { type: 'integer', description: 'Manual minute offset for Isha adhaan' },
          timezone: stringProp('IANA timezone (e.g. "America/Chicago")'),
        },
        required: [],
      },
      handler: async (args, ctx) => {
        const data = await updatePrayerConfig(args as Record<string, unknown>, ctx);
        const summary = describeMutation('PROFILE', 'PATCH', args);
        await storeMutation(ctx.branchId, 'PROFILE', 'PATCH', 'prayer_config', args, ctx.db);
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
        const data = await getPrayerRulesList(ctx);
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
  - {"type":"month_day_range","start_month":N,"start_day":N,"end_month":N,"end_day":N} — recurring annual range (wraps across years)
  - {"type":"hijri_month","months":[1-12]} — Hijri months
  - {"type":"hijri_day_range","month":N,"start_day":N,"end_day":N} — day range within a Hijri month
  - {"type":"date_range","start":"YYYY-MM-DD","end":"YYYY-MM-DD"}
  - {"type":"time_of_day","operator":"before|after","threshold":"HH:MM"} — match based on adhaan time
Actions (action_json object, exactly one):
  - {"type":"add_minutes","minutes":N} — add N minutes after adhaan
  - {"type":"set_fixed_time","time":"HH:MM"} — set exact time
  - {"type":"set_offset_from_prayer","prayer":"name","from":"adhaan|iqaamah|sunrise","minutes":N}
  - {"type":"round_up","increment":N} — round up to nearest N
  - {"type":"round_down","increment":N} — round down to nearest N
  - {"type":"round_nearest","increment":N} — round to nearest N
  - {"type":"cap_min","time":"HH:MM"} — floor constraint
  - {"type":"cap_max","time":"HH:MM"} — ceiling constraint
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
        const data = await createPrayerRule(args as Record<string, unknown>, ctx);
        const ruleId = (data as Record<string, unknown>).id as string || NOWHERE;
        const summary = describeMutation('PRAYER_RULES', 'CREATE', args);
        await storeMutation(ctx.branchId, 'PRAYER_RULES', 'CREATE', `rule:${ruleId}`, args, ctx.db);
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
        const data = await updatePrayerRule(rule_id as string, body as Record<string, unknown>, ctx);
        const summary = describeMutation('PRAYER_RULES', 'UPDATE', args);
        await storeMutation(ctx.branchId, 'PRAYER_RULES', 'UPDATE', `rule:${rule_id}`, args, ctx.db);
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
        await deletePrayerRule(args.rule_id as string, ctx);
        const summary = describeMutation('PRAYER_RULES', 'DELETE', args);
        await storeMutation(ctx.branchId, 'PRAYER_RULES', 'DELETE', `rule:${args.rule_id}`, args, ctx.db);
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
        const data = await reorderPrayerRules(args.order as string[], ctx);
        const summary = describeMutation('PRAYER_RULES', 'REORDER', {});
        await storeMutation(ctx.branchId, 'PRAYER_RULES', 'REORDER', 'order', { order: args.order }, ctx.db);
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
        const data = await getJumuahSessions(ctx);
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
        const data = await createJumuahSession(args as Record<string, unknown>, ctx);
        const sessionId = (data as Record<string, unknown>).id as string || NOWHERE;
        const summary = describeMutation('JUMUAH', 'CREATE', args);
        await storeMutation(ctx.branchId, 'JUMUAH', 'CREATE', `session:${sessionId}`, args, ctx.db);
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
        const data = await updateJumuahSession(session_id as string, body as Record<string, unknown>, ctx);
        const summary = describeMutation('JUMUAH', 'UPDATE', args);
        await storeMutation(ctx.branchId, 'JUMUAH', 'UPDATE', `session:${session_id}`, args, ctx.db);
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
        await deleteJumuahSession(args.session_id as string, ctx);
        const summary = describeMutation('JUMUAH', 'DELETE', args);
        await storeMutation(ctx.branchId, 'JUMUAH', 'DELETE', `session:${args.session_id}`, {}, ctx.db);
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
        const data = await getAnnouncements(ctx);
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
        const data = await createAnnouncement(args as Record<string, unknown>, ctx);
        const slug = (data as Record<string, unknown>).slug as string || NOWHERE;
        const summary = describeMutation('ANNOUNCEMENTS', 'CREATE', args);
        await storeMutation(ctx.branchId, 'ANNOUNCEMENTS', 'CREATE', `announcement:${slug}`, args, ctx.db);
        let warning = '';
        if (typeof args.content_markdown === 'string' && args.content_markdown.length > 500) {
          warning = ` Note: This announcement is quite long (${args.content_markdown.length} characters). A Post might be better suited for detailed, permanent content.`;
        }
        return { success: true, data, mutationSummary: summary + warning };
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
        const data = await updateAnnouncement(slug as string, body as Record<string, unknown>, ctx);
        const summary = describeMutation('ANNOUNCEMENTS', 'UPDATE', args);
        await storeMutation(ctx.branchId, 'ANNOUNCEMENTS', 'UPDATE', `announcement:${slug}`, args, ctx.db);
        let warning = '';
        if (typeof args.content_markdown === 'string' && args.content_markdown.length > 500) {
          warning = ` Note: This announcement is quite long (${args.content_markdown.length} characters). A Post might be better suited for detailed, permanent content.`;
        }
        return { success: true, data, mutationSummary: summary + warning };
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
        await deleteAnnouncement(args.slug as string, ctx);
        const summary = describeMutation('ANNOUNCEMENTS', 'DELETE', args);
        await storeMutation(ctx.branchId, 'ANNOUNCEMENTS', 'DELETE', `announcement:${args.slug}`, {}, ctx.db);
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
        const data = await pinAnnouncement(args.slug as string, ctx);
        const summary = describeMutation('ANNOUNCEMENTS', 'PIN', args);
        await storeMutation(ctx.branchId, 'ANNOUNCEMENTS', 'PIN', `announcement:${args.slug}`, args, ctx.db);
        return { success: true, data, mutationSummary: summary };
      },
    },
    {
      name: 'posts_list',
      description: 'List all posts for the masjid (including hidden).',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
      handler: async (_args, ctx) => {
        const data = await getPosts(ctx);
        return { success: true, data };
      },
    },
    {
      name: 'posts_create',
      description: `Create a new post. Posts are rich, permanent content that can be pinned to the homepage or Info page. Use markdown for formatting (supports **bold**, *italic*, headings, links, images via ![alt](url)).`,
      parameters: {
        type: 'object',
        properties: {
          title: stringProp('Post title'),
          content_markdown: stringProp('Content in markdown format (supports **bold**, *italic*, headings, links, images)'),
          show_on_homepage: { type: 'boolean', description: 'Pin to homepage (default false). Only one post can be homepage-pinned at a time.', default: false },
          show_on_info: { type: 'boolean', description: 'Pin to Info page (default false). Only one post can be info-pinned at a time.', default: false },
          is_hidden: { type: 'boolean', description: 'Hide post without deleting (default false)' },
        },
        required: ['title', 'content_markdown'],
      },
      handler: async (args, ctx) => {
        const data = await createPost(args as Record<string, unknown>, ctx);
        const slug = (data as Record<string, unknown>).slug as string || NOWHERE;
        const summary = describeMutation('POSTS', 'CREATE', args);
        await storeMutation(ctx.branchId, 'POSTS', 'CREATE', `post:${slug}`, args, ctx.db);
        return { success: true, data, mutationSummary: summary };
      },
    },
    {
      name: 'posts_update',
      description: 'Update an existing post by slug. Send only fields to change. Re-compiles HTML if content_markdown changes.',
      parameters: {
        type: 'object',
        properties: {
          slug: stringProp('Slug of the post to update'),
          title: stringProp('New title (optional)'),
          content_markdown: stringProp('New markdown content (optional)'),
          show_on_homepage: { type: 'boolean', description: 'Homepage pin status (optional)' },
          show_on_info: { type: 'boolean', description: 'Info pin status (optional)' },
          is_hidden: { type: 'boolean', description: 'Hidden status (optional)' },
        },
        required: ['slug'],
      },
      handler: async (args, ctx) => {
        const { slug, ...body } = args;
        const data = await updatePost(slug as string, body as Record<string, unknown>, ctx);
        const summary = describeMutation('POSTS', 'UPDATE', args);
        await storeMutation(ctx.branchId, 'POSTS', 'UPDATE', `post:${slug}`, args, ctx.db);
        return { success: true, data, mutationSummary: summary };
      },
    },
    {
      name: 'posts_delete',
      description: 'Permanently delete a post by slug. This is irreversible.',
      parameters: {
        type: 'object',
        properties: {
          slug: stringProp('Slug of the post to delete'),
        },
        required: ['slug'],
      },
      handler: async (args, ctx) => {
        await deletePost(args.slug as string, ctx);
        const summary = describeMutation('POSTS', 'DELETE', args);
        await storeMutation(ctx.branchId, 'POSTS', 'DELETE', `post:${args.slug}`, {}, ctx.db);
        return { success: true, mutationSummary: summary };
      },
    },
    {
      name: 'posts_pin_homepage',
      description: 'Toggle the homepage pin status of a post. If pinning, any other homepage-pinned post is unpinned first. Only one post can be pinned to the homepage at a time.',
      parameters: {
        type: 'object',
        properties: {
          slug: stringProp('Slug of the post to pin/unpin'),
        },
        required: ['slug'],
      },
      handler: async (args, ctx) => {
        const data = await pinPostHomepage(args.slug as string, ctx);
        const summary = describeMutation('POSTS', 'PIN_HOMEPAGE', args);
        await storeMutation(ctx.branchId, 'POSTS', 'PIN_HOMEPAGE', `post:${args.slug}`, args, ctx.db);
        return { success: true, data, mutationSummary: summary };
      },
    },
    {
      name: 'posts_pin_info',
      description: 'Toggle the Info page pin status of a post. If pinning, any other info-pinned post is unpinned first. Only one post can be pinned to the Info page at a time.',
      parameters: {
        type: 'object',
        properties: {
          slug: stringProp('Slug of the post to pin/unpin on Info page'),
        },
        required: ['slug'],
      },
      handler: async (args, ctx) => {
        const data = await pinPostInfo(args.slug as string, ctx);
        const summary = describeMutation('POSTS', 'PIN_INFO', args);
        await storeMutation(ctx.branchId, 'POSTS', 'PIN_INFO', `post:${args.slug}`, args, ctx.db);
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
        const data = await dryRunPrayerTimes(body, ctx);
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
        const snapshots = await listSnapshots(ctx.masjidId, ctx.db);
        return { success: true, data: snapshots };
      },
    },
    {
      name: 'rollback_restore',
      description: 'Restore the masjid configuration to a previous snapshot. This is a high-risk operation that rewrites all configuration (theme, profile, prayer rules, jumuah sessions, announcements) to the state captured in the snapshot. Always use rollback_list_snapshots first to review available snapshots.',
      parameters: {
        type: 'object',
        properties: {
          snapshot_id: stringProp('ID of the snapshot to restore (from rollback_list_snapshots)'),
        },
        required: ['snapshot_id'],
      },
      handler: async (args, ctx) => {
        const snapshot = await getSnapshot(args.snapshot_id as string, ctx.db);
        if (!snapshot) {
          return { success: false, error: 'Snapshot not found. Use rollback_list_snapshots to see available snapshots.' };
        }

        const data = await rollbackRestore(args.snapshot_id as string, ctx);

        await storeMutation(ctx.branchId, 'ROLLBACK', 'UPSERT', `snapshot.${args.snapshot_id}`, { restored_at: nowISO(), result: data }, ctx.db);

        return {
          success: true,
          data,
          mutationSummary: `Restored masjid configuration from snapshot ${args.snapshot_id}. Restored domains: ${(data.restored as string[])?.join(', ') || 'all'}.`,
        };
      },
    },
  {
      name: 'rules_explain',
      description: `Explain which prayer rules fired (or didn't) for a given date, producing a human-readable trace of the rule chain for each prayer. Useful when an admin asks why a specific iqaamah time is what it is.`,
      parameters: {
        type: 'object',
        properties: {
          date: stringProp('Date to explain (YYYY-MM-DD). Defaults to today.'),
          prayer: enumProp(['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'], 'Optional: explain only one prayer. If omitted, explains all five.'),
        },
        required: [],
      },
      handler: async (args, ctx) => {
        const dateStr = (args.date as string) || new Date().toISOString().slice(0, 10);
        const { dryRun, rules: rulesList } = await explainPrayerRules(args.date as string | undefined, ctx);

        const date = new Date(dateStr + 'T12:00:00Z');

        const rules: RuleWithDb[] = (rulesList as Array<Record<string, unknown>>).map((r: Record<string, unknown>) => ({
          id: r.id as string,
          prayer_name: r.prayer_name as PrayerName,
          rule_name: r.rule_name as string,
          execution_order: r.execution_order as number,
          conditions: (r.conditions_json || []) as Condition[],
          action: r.action_json as Action,
        }));

        const dryData = dryRun as Record<string, unknown>;

        const adhaanTimes: Record<PrayerName, string> = {
          fajr: ((dryData.fajr as Record<string, string>)?.adhaan) || '00:00',
          dhuhr: ((dryData.dhuhr as Record<string, string>)?.adhaan) || '00:00',
          asr: ((dryData.asr as Record<string, string>)?.adhaan) || '00:00',
          maghrib: ((dryData.maghrib as Record<string, string>)?.adhaan) || '00:00',
          isha: ((dryData.isha as Record<string, string>)?.adhaan) || '00:00',
        };

        const hijriDate = dryData.hijri_date as { month: number; day: number; year: number } | undefined
          || { month: 1, day: 1, year: 1447 };

        const allExplained = explainAllPrayers(rules, adhaanTimes, date, hijriDate);

        if (args.prayer) {
          return {
            success: true,
            data: {
              date: dateStr,
              hijri_date: hijriDate,
              prayer: args.prayer,
              ...allExplained[args.prayer as PrayerName],
            },
          };
        }

        return {
          success: true,
          data: {
            date: dateStr,
            hijri_date: hijriDate,
            prayers: allExplained,
          },
        };
      },
    },
    {
      name: 'rules_validate',
      description: `Validate the current prayer rule set for common issues. Returns warnings about dead rules, conflicting rules, missing prayer coverage, and other potential problems. Read-only — does not modify anything.`,
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
      handler: async (_args, ctx) => {
        const rulesRes = await getPrayerRulesList(ctx);
        const rulesList = (rulesRes as Record<string, unknown>).rules as Array<Record<string, unknown>> || [];

        const rules: RuleWithDb[] = rulesList.map((r: Record<string, unknown>) => ({
          id: r.id as string,
          prayer_name: r.prayer_name as PrayerName,
          rule_name: r.rule_name as string,
          execution_order: r.execution_order as number,
          conditions: (r.conditions_json || []) as Condition[],
          action: r.action_json as Action,
        }));

        const result = validateRules(rules);
        return { success: true, data: result };
      },
    },
    {
      name: 'timetable_import',
      description: `Import a complete prayer timetable as a set of rules. Accepts a structured timetable object (prayer names, times, date ranges, and conditions) and creates all rules in one atomic operation. Use this after extracting times from a timetable photo or when an admin provides a full schedule.`,
      parameters: {
        type: 'object',
        properties: {
          rules: {
            type: 'array',
            description: 'Array of rule objects to create. Each rule follows the same shape as prayer_rules_create (prayer_name, rule_name, conditions_json, action_json). Rules are created in array order with auto-incrementing execution_order per prayer.',
            items: {
              type: 'object',
              properties: {
                prayer_name: { type: 'string', enum: ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] },
                rule_name: { type: 'string' },
                conditions_json: { type: 'array' },
                action_json: { type: 'object' },
              },
              required: ['prayer_name', 'rule_name', 'conditions_json', 'action_json'],
            },
          },
          replace_existing: boolProp('If true, delete ALL existing prayer rules before importing. If false (default), append new rules with execution_order after existing ones.'),
        },
        required: ['rules'],
      },
      handler: async (args, ctx) => {
        const rules = args.rules as Array<{
          prayer_name: string;
          rule_name: string;
          conditions_json: unknown[];
          action_json: Record<string, unknown>;
        }>;
        const replaceExisting = !!(args.replace_existing);

        const data = await importTimetable(rules, replaceExisting, ctx);
        const summary = describeMutation('TIMETABLE_IMPORT', 'IMPORT', { count: data.created, deleted: data.deleted });
        await storeMutation(ctx.branchId, 'TIMETABLE_IMPORT', 'IMPORT', 'timetable', { rules, replace_existing: replaceExisting }, ctx.db);
        return { success: true, data, mutationSummary: summary };
      },
    },
    // ── Maktab ──────────────────────────────────────────────────────────────
    {
      name: 'maktab_get',
      description: 'Get current maktab (Islamic school) settings: enrollment open/close, status message, program info (goal, schedule, curriculum, FAQs), active term with pricing, and all available terms.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
      handler: async (_args, ctx) => {
        const [settings, terms] = await Promise.all([
          getMaktabSettings(ctx),
          getMaktabTerms(ctx),
        ]);
        return { success: true, data: { ...(settings as Record<string, unknown>), ...(terms as Record<string, unknown>) } };
      },
    },
    {
      name: 'maktab_update',
      description: `Update maktab settings and program info. Only include fields you want to change.

Enrollment controls:
  - enrollment_open: boolean — open/close enrollment
  - status_message: string or null — shown on public page when enrollment is closed
  - assistance_code: string or null — discount code for financial aid

Program info (all optional — leave empty to hide that section on the public page):
  - program_info.goal: string — e.g. "To provide structured Islamic education"
  - program_info.schedule_days: string — e.g. "Tuesday – Thursday"
  - program_info.schedule_time: string — e.g. "5:30 PM – 7:00 PM"
  - program_info.curriculum: [{ name: string, description: string }] — subject list
  - program_info.faqs: [{ question: string, answer: string }] — FAQ accordion`,
      parameters: {
        type: 'object',
        properties: {
          enrollment_open: boolProp('Whether public enrollment is currently open'),
          status_message: stringProp('Message shown on the public maktab page (e.g. "Registration opens August 1st"). Set to null to clear.'),
          assistance_code: stringProp('Discount code for financial aid applicants. Set to null to clear.'),
          program_info: {
            type: 'object',
            description: 'Program information shown on the public maktab page',
            properties: {
              goal: stringProp('Program goal statement'),
              schedule_days: stringProp('Days of the week (e.g. "Tuesday – Thursday")'),
              schedule_time: stringProp('Time of day (e.g. "5:30 PM – 7:00 PM")'),
              curriculum: {
                type: 'array',
                description: 'List of subjects',
                items: {
                  type: 'object',
                  properties: {
                    name: stringProp('Subject name (e.g. "Quran")'),
                    description: stringProp('Subject description (e.g. "Tajweed, memorisation, tafsir")'),
                  },
                  required: ['name', 'description'],
                },
              },
              faqs: {
                type: 'array',
                description: 'Frequently asked questions',
                items: {
                  type: 'object',
                  properties: {
                    question: stringProp('The question'),
                    answer: stringProp('The answer'),
                  },
                  required: ['question', 'answer'],
                },
              },
            },
          },
        },
        required: [],
      },
      handler: async (args, ctx) => {
        const body: Record<string, unknown> = { ...args };
        const data = await updateMaktabSettings(body, ctx);
        const summary = describeMutation('MAKTAB', 'UPSERT', args);
        await storeMutation(ctx.branchId, 'MAKTAB', 'UPSERT', 'maktab_settings', args, ctx.db);
        return { success: true, data, mutationSummary: summary };
      },
    },
    {
      name: 'maktab_terms_list',
      description: 'List all maktab program terms with their pricing (1 child / 2 children / 3+ children). Each term has an id, name, length in months, billing months, and prices in cents.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
      handler: async (_args, ctx) => {
        const data = await getMaktabTerms(ctx);
        return { success: true, data };
      },
    },
    {
      name: 'maktab_term_activate',
      description: 'Activate a maktab term. This sets it as the active term AND opens enrollment. Provide the term ID from maktab_terms_list.',
      parameters: {
        type: 'object',
        properties: {
          term_id: stringProp('ID of the term to activate (from maktab_terms_list)'),
        },
        required: ['term_id'],
      },
      handler: async (args, ctx) => {
        const data = await activateMaktabTerm(args.term_id as string, ctx);
        const summary = describeMutation('MAKTAB', 'ACTIVATE', { term_id: args.term_id });
        await storeMutation(ctx.branchId, 'MAKTAB', 'ACTIVATE', `term:${args.term_id}`, args, ctx.db);
        return { success: true, data, mutationSummary: summary };
      },
    },
    // ── Navigation ───────────────────────────────────────────────────────────
    {
      name: 'nav_list',
      description: 'List all navigation items for the masjid\'s public website (header and bottom nav). Each item has a kind (route/page/link), label, icon, visibility toggles (desktop/mobile), highlight flag, and sort order.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
      handler: async (_args, ctx) => {
        const data = await getNavItems(ctx);
        return { success: true, data };
      },
    },
    {
      name: 'nav_create',
      description: `Add a navigation item to the public website.
Kind "route" (built-in page): route_segment must be one of "prayer", "news", "info", "maktab", "donate", "jumuah", "announcements".
Kind "page" (custom page): use page_slug from pages_list.
Kind "link" (external URL): use external_url (must be valid URL).
All kinds: label (display text), icon (one of: book, calendar, clock, compass, donate, graduation-cap, heart, home, info, megaphone, message-square, palette, users — optional), show_on_desktop_header (default true), show_on_mobile_bottom (default true), is_highlighted (default false, only one at a time).`,
      parameters: {
        type: 'object',
        properties: {
          kind: enumProp(['route', 'page', 'link'], 'Nav item kind'),
          route_segment: enumProp(['prayer', 'news', 'info', 'maktab', 'donate', 'jumuah', 'announcements'], 'Built-in route (only for kind=route)'),
          page_slug: stringProp('Custom page slug (only for kind=page)'),
          external_url: stringProp('External URL (only for kind=link)'),
          label: stringProp('Display text for this nav item'),
          icon: stringProp('Icon name: book, calendar, clock, compass, donate, graduation-cap, heart, home, info, megaphone, message-square, palette, users'),
          show_on_desktop_header: boolProp('Show in desktop header nav (default true)'),
          show_on_mobile_bottom: boolProp('Show in mobile bottom nav (default true)'),
          is_highlighted: boolProp('Highlight this item (only one at a time; removes highlight from others)'),
        },
        required: ['kind', 'label'],
      },
      handler: async (args, ctx) => {
        const data = await createNavItem(args as Record<string, unknown>, ctx);
        const summary = describeMutation('NAV', 'CREATE', args);
        await storeMutation(ctx.branchId, 'NAV', 'CREATE', `nav:${(data as Record<string, unknown>).id}`, args, ctx.db);
        return { success: true, data, mutationSummary: summary };
      },
    },
    {
      name: 'nav_update',
      description: 'Update a navigation item. Send only the fields you want to change. All fields are optional.',
      parameters: {
        type: 'object',
        properties: {
          item_id: stringProp('ID of the nav item to update (from nav_list)'),
          label: stringProp('New display text'),
          icon: stringProp('New icon name, or null to remove'),
          show_on_desktop_header: boolProp('Toggle desktop visibility'),
          show_on_mobile_bottom: boolProp('Toggle mobile visibility'),
          is_highlighted: boolProp('Toggle highlight (only one at a time)'),
        },
        required: ['item_id'],
      },
      handler: async (args, ctx) => {
        const { item_id, ...body } = args;
        const data = await updateNavItem(item_id as string, body as Record<string, unknown>, ctx);
        const summary = describeMutation('NAV', 'UPDATE', args);
        await storeMutation(ctx.branchId, 'NAV', 'UPDATE', `nav:${item_id}`, args, ctx.db);
        return { success: true, data, mutationSummary: summary };
      },
    },
    {
      name: 'nav_delete',
      description: 'Remove a navigation item from the public website. Provide the item ID from nav_list.',
      parameters: {
        type: 'object',
        properties: {
          item_id: stringProp('ID of the nav item to delete'),
        },
        required: ['item_id'],
      },
      handler: async (args, ctx) => {
        await deleteNavItem(args.item_id as string, ctx);
        const summary = describeMutation('NAV', 'DELETE', args);
        await storeMutation(ctx.branchId, 'NAV', 'DELETE', `nav:${args.item_id}`, args, ctx.db);
        return { success: true, mutationSummary: summary };
      },
    },
    {
      name: 'nav_reorder',
      description: 'Reorder all navigation items by providing the full list of item IDs in the desired order.',
      parameters: {
        type: 'object',
        properties: {
          item_ids: { type: 'array', items: { type: 'string' }, minItems: 1, description: 'Array of all nav item IDs in the desired order' },
        },
        required: ['item_ids'],
      },
      handler: async (args, ctx) => {
        const data = await reorderNavItems(args.item_ids as string[], ctx);
        const summary = describeMutation('NAV', 'REORDER', {});
        await storeMutation(ctx.branchId, 'NAV', 'REORDER', 'nav_order', { item_ids: args.item_ids }, ctx.db);
        return { success: true, data, mutationSummary: summary };
      },
    },
    // ── Custom Pages ─────────────────────────────────────────────────────────
    {
      name: 'pages_list',
      description: 'List all custom pages. Custom pages are permanent informational content (About Us, Services, Programs, etc.).',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
      handler: async (_args, ctx) => {
        const data = await getPages(ctx);
        return { success: true, data };
      },
    },
    {
      name: 'pages_create',
      description: 'Create a custom page. Provide a URL-safe slug (lowercase, hyphens), a title, and markdown content. The page is compiled to HTML and can be added to the navigation via nav_create.',
      parameters: {
        type: 'object',
        properties: {
          slug: { type: 'string', pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$', description: 'URL-safe slug (lowercase letters, numbers, hyphens). e.g. "about-us", "weekend-school", "food-pantry"' },
          title: stringProp('Page title (1-200 characters)'),
          raw_markdown: stringProp('Markdown content (supports headings, bold, italic, links, images, lists)'),
        },
        required: ['slug', 'title', 'raw_markdown'],
      },
      handler: async (args, ctx) => {
        const data = await createPage(args as Record<string, unknown>, ctx);
        const summary = describeMutation('PAGES', 'CREATE', args);
        await storeMutation(ctx.branchId, 'PAGES', 'CREATE', `page:${args.slug}`, args, ctx.db);
        return { success: true, data, mutationSummary: summary };
      },
    },
    {
      name: 'pages_update',
      description: 'Update a custom page. Send only the fields you want to change. If you change the content, the HTML is recompiled.',
      parameters: {
        type: 'object',
        properties: {
          slug: stringProp('Slug of the page to update (from pages_list)'),
          title: stringProp('New title'),
          raw_markdown: stringProp('New markdown content'),
        },
        required: ['slug'],
      },
      handler: async (args, ctx) => {
        const { slug, ...body } = args;
        const data = await updatePage(slug as string, body as Record<string, unknown>, ctx);
        const summary = describeMutation('PAGES', 'UPDATE', args);
        await storeMutation(ctx.branchId, 'PAGES', 'UPDATE', `page:${slug}`, args, ctx.db);
        return { success: true, data, mutationSummary: summary };
      },
    },
    {
      name: 'pages_delete',
      description: 'Permanently delete a custom page by its slug. This also removes any nav items that reference this page.',
      parameters: {
        type: 'object',
        properties: {
          slug: stringProp('Slug of the page to delete'),
        },
        required: ['slug'],
      },
      handler: async (args, ctx) => {
        await deletePage(args.slug as string, ctx);
        const summary = describeMutation('PAGES', 'DELETE', args);
        await storeMutation(ctx.branchId, 'PAGES', 'DELETE', `page:${args.slug}`, args, ctx.db);
        return { success: true, mutationSummary: summary };
      },
    },
    // ── Web ──────────────────────────────────────────────────────────────────
    {
      name: 'web_search',
      description: `Search the web using DuckDuckGo. Returns up to ${/* MAX_SEARCH_RESULTS */ 8} results with titles, URLs, and snippets. Use this to find information the masjid admin needs — prayer timetables from other masjids, contact details for organizations, reference material (hadith, Quran verses, fatwas), or general research. Results are plain text snippets. To read a full page, use web_fetch with one of the returned URLs.`,
      parameters: {
        type: 'object',
        properties: {
          query: stringProp('Search query (e.g. "ISNA prayer timetable 2026", "contact details for Islamic Relief", "hadith about charity")'),
        },
        required: ['query'],
      },
      handler: async (args) => {
        const { results, error } = await searchWeb(args.query as string);
        if (error) {
          return { success: false, error: `Search failed: ${error}` };
        }
        if (results.length === 0) {
          return { success: true, data: { results: [], note: 'No results found. Try a different query.' } };
        }
        return { success: true, data: { results } };
      },
    },
    {
      name: 'web_fetch',
      description: `Download and read the text content of a web page. Use this after web_search to read a specific page in detail, or when the admin provides a URL directly. Returns cleaned plain text (HTML tags, scripts, and styles removed). Content is truncated to ${/* MAX_CONTENT_LENGTH */ 8000} characters. Only HTML, plain text, and JSON pages are supported.`,
      parameters: {
        type: 'object',
        properties: {
          url: stringProp('Full URL to fetch (e.g. "https://example.com/prayer-times")'),
        },
        required: ['url'],
      },
      handler: async (args) => {
        const url = args.url as string;
        try {
          new URL(url);
        } catch {
          return { success: false, error: `Invalid URL: "${url}". Provide a full URL starting with https:// or http://.` };
        }
        const { content, contentType, error } = await fetchUrl(url);
        if (error) {
          return { success: false, error: `Failed to fetch ${url}: ${error}` };
        }
        return {
          success: true,
          data: { url, content_type: contentType, text: content },
        };
      },
    },
  ];
}
