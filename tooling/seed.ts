/**
 * Seeds the local SQLite database with complete test masjids.
 * Run: npx tsx tooling/seed.ts
 */
import { getDb } from '../apps/api/src/lib/server/db/index.js';
import { hashPassword } from '../apps/api/src/lib/server/auth/password.js';
import * as schema from '../apps/api/src/lib/server/db/schema.js';
import { eq } from 'drizzle-orm';

const db = getDb();

const PASSWORD = 'password123';

// Masjid Al-Noor — Chicago, IL (existing default)
const NOOR_MASJID_ID = '00000000-0000-0000-0000-000000000001';
const NOOR_ADMIN_ID = '00000000-0000-0000-0000-000000000002';
const NOOR_SLUG = 'masjid-al-noor';

// Masjid Al-Jabal — Kennesaw, GA (Hanafi / Indo-Pak / American settings)
const JABAL_MASJID_ID = '00000000-0000-0000-0000-000000000003';
const JABAL_ADMIN_ID = '00000000-0000-0000-0000-000000000004';
const JABAL_SLUG = 'masjid-al-jabal';

function clearSeed() {
  db.delete(schema.announcementAttachments).run();
  db.delete(schema.masjidAssets).run();
  db.delete(schema.configMutations).run();
  db.delete(schema.configSnapshots).run();
  db.delete(schema.configBranches).run();
  db.delete(schema.customDomains).run();
  db.delete(schema.prayerRules).run();
  db.delete(schema.announcements).run();
  db.delete(schema.jumuahSessions).run();
  db.delete(schema.masjidPages).run();
  db.delete(schema.mktRegistrations).run();
  db.delete(schema.mktOutbox).run();
  db.delete(schema.mktTerms).run();
  db.delete(schema.mktSettings).run();
  db.delete(schema.admins).run();
  db.delete(schema.masjidThemes).run();
  db.delete(schema.masjids).run();
}

async function seed() {
  const existingNoor = db
    .select()
    .from(schema.masjids)
    .where(eq(schema.masjids.id, NOOR_MASJID_ID))
    .get();
  if (existingNoor) {
    console.log('Seed data already exists. Clearing and re-seeding...');
    clearSeed();
  }

  const hash = await hashPassword(PASSWORD);

  // ─────────────────────────────────────────────────────────────────────────────
  // Masjid Al-Noor
  // ─────────────────────────────────────────────────────────────────────────────
  db.insert(schema.masjids).values({
    id: NOOR_MASJID_ID,
    slug: NOOR_SLUG,
    name: 'Masjid Al-Noor',
    latitude: 41.8781,
    longitude: -87.6298,
    timezone: 'America/Chicago',
    calculationMethod: 2,
    asrMadhab: 'shafi',
    highLatitudeRule: 'seventh_of_night',
    showDualAsr: false,
    fajrAngle: null,
    ishaAngle: null,
    tenantStatus: 'ACTIVE',
    addressLine1: '123 Main Street',
    city: 'Chicago',
    state: 'IL',
    postalCode: '60601',
    country: 'US',
    contactPhone: '(312) 555-0199',
    contactEmail: 'info@masjid-alnoor.org',
    websiteUrl: 'https://masjid-alnoor.org',
    externalDonationUrl: 'https://donate.masjid-alnoor.org',
    adminEmail: 'admin@masjid-alnoor.org',
  }).run();

  // Al-Noor runs the Mishkaat flagship style system (docs/design-language.md);
  // Al-Jabal stays on Sakeenah — one seed masjid per style system.
  db.insert(schema.masjidThemes).values({
    masjidId: NOOR_MASJID_ID,
    styleSystem: 'mishkaat',
    styleOptions: '{}',
    layoutPreset: 'mishkaat',
    primaryColor: '#9c7c1e',
    accentColor: '#d4af37',
    fontHeading: 'Amiri',
    fontBody: 'Inter',
    labelSpeech: 'Speech',
  }).run();

  db.insert(schema.admins).values({
    id: NOOR_ADMIN_ID,
    masjidId: NOOR_MASJID_ID,
    email: 'admin@masjid-alnoor.org',
    passwordHash: hash,
    displayName: 'Imam Abdullah',
    whatsappPhone: '+15551230001',
  }).run();

  db.insert(schema.prayerRules).values([
    {
      id: 'rule-noor-01',
      masjidId: NOOR_MASJID_ID,
      prayerName: 'fajr',
      executionOrder: 1,
      ruleName: 'Fajr default offset',
      conditionsJson: JSON.stringify([{ type: 'always' }]),
      actionJson: JSON.stringify({ type: 'add_minutes', minutes: 20 }),
    },
    {
      id: 'rule-noor-02',
      masjidId: NOOR_MASJID_ID,
      prayerName: 'dhuhr',
      executionOrder: 1,
      ruleName: 'Friday override',
      conditionsJson: JSON.stringify([{ type: 'day_of_week', days: [5] }]),
      actionJson: JSON.stringify({ type: 'set_fixed_time', time: '13:30' }),
    },
    {
      id: 'rule-noor-03',
      masjidId: NOOR_MASJID_ID,
      prayerName: 'dhuhr',
      executionOrder: 2,
      ruleName: 'Dhuhr default offset',
      conditionsJson: JSON.stringify([{ type: 'always' }]),
      actionJson: JSON.stringify({ type: 'add_minutes', minutes: 10 }),
    },
    {
      id: 'rule-noor-04',
      masjidId: NOOR_MASJID_ID,
      prayerName: 'dhuhr',
      executionOrder: 3,
      ruleName: 'Round up display',
      conditionsJson: JSON.stringify([{ type: 'always' }]),
      actionJson: JSON.stringify({ type: 'round_up', increment: 5 }),
    },
    {
      id: 'rule-noor-05',
      masjidId: NOOR_MASJID_ID,
      prayerName: 'asr',
      executionOrder: 1,
      ruleName: 'Asr default offset',
      conditionsJson: JSON.stringify([{ type: 'always' }]),
      actionJson: JSON.stringify({ type: 'add_minutes', minutes: 10 }),
    },
    {
      id: 'rule-noor-06',
      masjidId: NOOR_MASJID_ID,
      prayerName: 'maghrib',
      executionOrder: 1,
      ruleName: 'Maghrib default offset',
      conditionsJson: JSON.stringify([{ type: 'always' }]),
      actionJson: JSON.stringify({ type: 'add_minutes', minutes: 5 }),
    },
    {
      id: 'rule-noor-07',
      masjidId: NOOR_MASJID_ID,
      prayerName: 'isha',
      executionOrder: 1,
      ruleName: 'Isha default offset',
      conditionsJson: JSON.stringify([{ type: 'always' }]),
      actionJson: JSON.stringify({ type: 'add_minutes', minutes: 10 }),
    },
    {
      id: 'rule-noor-08',
      masjidId: NOOR_MASJID_ID,
      prayerName: 'isha',
      executionOrder: 2,
      ruleName: 'Isha round up',
      conditionsJson: JSON.stringify([{ type: 'always' }]),
      actionJson: JSON.stringify({ type: 'round_up', increment: 5 }),
    },
  ]).run();

  db.insert(schema.jumuahSessions).values([
    {
      id: 'jum-noor-01',
      masjidId: NOOR_MASJID_ID,
      label: '1st Session (English)',
      time: '13:30',
      khateeb: 'Imam Abdullah',
      speechTime: '13:00',
      isActive: true,
    },
    {
      id: 'jum-noor-02',
      masjidId: NOOR_MASJID_ID,
      label: '2nd Session (Arabic)',
      time: '14:30',
      khateeb: 'Sheikh Ahmad',
      isActive: true,
    },
  ]).run();

  db.insert(schema.announcements).values([
    {
      id: 'ann-noor-01',
      masjidId: NOOR_MASJID_ID,
      title: 'Welcome to Masjid Al-Noor',
      slug: 'welcome-to-masjid-al-noor',
      contentMarkdown: '## Assalamu Alaikum\n\nWelcome to Masjid Al-Noor. We are a community mosque serving the Chicago area.\n\n**Prayer times** are updated daily. Please check the schedule before visiting.',
      compiledHtml: '<h2>Assalamu Alaikum</h2><p>Welcome to Masjid Al-Noor. We are a community mosque serving the Chicago area.</p><p><strong>Prayer times</strong> are updated daily. Please check the schedule before visiting.</p>',
      isPinned: true,
      status: 'published',
      publishedAt: new Date().toISOString(),
    },
    {
      id: 'ann-noor-02',
      masjidId: NOOR_MASJID_ID,
      title: 'Community Iftar This Weekend',
      slug: 'community-iftar-this-weekend',
      contentMarkdown: 'Join us for a community iftar this Saturday after Maghrib prayer. All are welcome!\n\nPlease bring a dish to share if you can. Drinks and dates will be provided.',
      compiledHtml: '<p>Join us for a community iftar this Saturday after Maghrib prayer. All are welcome!</p><p>Please bring a dish to share if you can. Drinks and dates will be provided.</p>',
      isPinned: false,
      status: 'published',
      publishedAt: new Date(Date.now() - 86400000).toISOString(),
    },
    {
      id: 'ann-noor-03',
      masjidId: NOOR_MASJID_ID,
      title: 'Quran Classes Registration Open',
      slug: 'quran-classes-registration-open',
      contentMarkdown: 'Registration is now open for our summer Quran classes.\n\n- **Beginner Tajweed**: Mondays 6:00 PM\n- **Hifdh Program**: Tuesdays & Thursdays 5:00 PM\n- **Kids Quran**: Saturdays 10:00 AM\n\nRegister at the front desk or email info@masjid-alnoor.org.',
      compiledHtml: '<p>Registration is now open for our summer Quran classes.</p><ul><li><strong>Beginner Tajweed</strong>: Mondays 6:00 PM</li><li><strong>Hifdh Program</strong>: Tuesdays &amp; Thursdays 5:00 PM</li><li><strong>Kids Quran</strong>: Saturdays 10:00 AM</li></ul><p>Register at the front desk or email info@masjid-alnoor.org.</p>',
      isPinned: false,
      status: 'published',
      publishedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    },
  ]).run();

  // ─────────────────────────────────────────────────────────────────────────────
  // Maktab seed — Masjid Al-Noor (Fall 2026 term)
  // ─────────────────────────────────────────────────────────────────────────────
  db.insert(schema.mktTerms).values({
    id: 'term-noor-01',
    masjidId: NOOR_MASJID_ID,
    name: 'Fall 2026',
    lengthMonths: 4,
    priceCents1: 10000,
    priceCents2: 16000,
    priceCents3plus: 20000,
    paymentRefsJson: JSON.stringify({
      square: {
        plan_id: 'PLAN_NOOR_FALL_2026',
        var_1: 'VAR_NOOR_1',
        var_2: 'VAR_NOOR_2',
        var_3plus: 'VAR_NOOR_3PLUS',
      },
    }),
    isActive: true,
  }).run();

  db.insert(schema.mktSettings).values({
    masjidId: NOOR_MASJID_ID,
    activeTermId: 'term-noor-01',
    enrollmentOpen: true,
    statusMessage: null,
  }).run();

  // ─────────────────────────────────────────────────────────────────────────────
  // Masjid Al-Jabal — Kennesaw, GA
  // Hanafi congregation, Indo-Pak transliterations, American 12h display.
  // ─────────────────────────────────────────────────────────────────────────────
  db.insert(schema.masjids).values({
    id: JABAL_MASJID_ID,
    slug: JABAL_SLUG,
    name: 'Masjid Al-Jabal',
    latitude: 34.0234,
    longitude: -84.6157,
    timezone: 'America/New_York',
    calculationMethod: 2,
    asrMadhab: 'hanafi',
    highLatitudeRule: 'seventh_of_night',
    showDualAsr: true,
    fajrAngle: null,
    ishaAngle: null,
    addressLine2: 'Suite 100',
    city: 'Kennesaw',
    state: 'GA',
    postalCode: '30144',
    country: 'US',
    contactPhone: '(470) 555-0142',
    contactEmail: 'info@masjid-aljabal.org',
    facebookUrl: 'https://facebook.com/masjid.aljabal',
    youtubeUrl: 'https://youtube.com/@MasjidAlJabal',
    instagramUrl: 'https://instagram.com/masjid.aljabal',
    websiteUrl: 'https://masjid-aljabal.org',
    externalDonationUrl: 'https://donate.masjid-aljabal.org',
    adminEmail: 'admin@masjid-aljabal.org',
  }).run();

  db.insert(schema.masjidThemes).values({
    masjidId: JABAL_MASJID_ID,
    styleSystem: 'sakeenah',
    styleOptions: '{}',
    layoutPreset: 'minimal-light',
    primaryColor: '#7c3aed',
    accentColor: '#d97706',
    fontHeading: 'Amiri',
    fontBody: 'Noto Naskh Arabic',
    timeFormat: '12h',
    labelAdhaan: 'Azaan',
    labelIqaamah: 'Iqamah',
    labelJumuah: 'Jummah',
    labelSpeech: 'Bayaan',
    labelSunrise: 'Sunrise',
    labelFajr: 'Fajr',
    labelDhuhr: 'Zuhr',
    labelAsr: 'Asr',
    labelMaghrib: 'Maghrib',
    labelIsha: 'Isha',
  }).run();

  db.insert(schema.admins).values({
    id: JABAL_ADMIN_ID,
    masjidId: JABAL_MASJID_ID,
    email: 'admin@masjid-aljabal.org',
    passwordHash: hash,
    displayName: 'Imam Yusuf',
    whatsappPhone: '+15551230002',
  }).run();

  // Hanafi-style iqaamah pattern: longer Fajr window, Zuhr delayed on weekdays,
  // Maghrib iqaamah immediately after azaan, Isha rounded to nearest 5.
  db.insert(schema.prayerRules).values([
    {
      id: 'rule-jabal-01',
      masjidId: JABAL_MASJID_ID,
      prayerName: 'fajr',
      executionOrder: 1,
      ruleName: 'Fajr Hanafi offset',
      conditionsJson: JSON.stringify([{ type: 'always' }]),
      actionJson: JSON.stringify({ type: 'add_minutes', minutes: 25 }),
    },
    {
      id: 'rule-jabal-02',
      masjidId: JABAL_MASJID_ID,
      prayerName: 'dhuhr',
      executionOrder: 1,
      ruleName: 'Friday Jummah override',
      conditionsJson: JSON.stringify([{ type: 'day_of_week', days: [5] }]),
      actionJson: JSON.stringify({ type: 'set_fixed_time', time: '13:45' }),
    },
    {
      id: 'rule-jabal-03',
      masjidId: JABAL_MASJID_ID,
      prayerName: 'dhuhr',
      executionOrder: 2,
      ruleName: 'Zuhr default offset',
      conditionsJson: JSON.stringify([{ type: 'always' }]),
      actionJson: JSON.stringify({ type: 'add_minutes', minutes: 15 }),
    },
    {
      id: 'rule-jabal-04',
      masjidId: JABAL_MASJID_ID,
      prayerName: 'dhuhr',
      executionOrder: 3,
      ruleName: 'Round to nearest 5',
      conditionsJson: JSON.stringify([{ type: 'always' }]),
      actionJson: JSON.stringify({ type: 'round_nearest', increment: 5 }),
    },
    {
      id: 'rule-jabal-05',
      masjidId: JABAL_MASJID_ID,
      prayerName: 'asr',
      executionOrder: 1,
      ruleName: 'Asr Hanafi offset',
      conditionsJson: JSON.stringify([{ type: 'always' }]),
      actionJson: JSON.stringify({ type: 'add_minutes', minutes: 15 }),
    },
    {
      id: 'rule-jabal-06',
      masjidId: JABAL_MASJID_ID,
      prayerName: 'asr',
      executionOrder: 2,
      ruleName: 'Round down display',
      conditionsJson: JSON.stringify([{ type: 'always' }]),
      actionJson: JSON.stringify({ type: 'round_down', increment: 5 }),
    },
    {
      id: 'rule-jabal-07',
      masjidId: JABAL_MASJID_ID,
      prayerName: 'maghrib',
      executionOrder: 1,
      ruleName: 'Maghrib right after azaan',
      conditionsJson: JSON.stringify([{ type: 'always' }]),
      actionJson: JSON.stringify({ type: 'right_after_adhaan' }),
    },
    {
      id: 'rule-jabal-08',
      masjidId: JABAL_MASJID_ID,
      prayerName: 'isha',
      executionOrder: 1,
      ruleName: 'Isha default offset',
      conditionsJson: JSON.stringify([{ type: 'always' }]),
      actionJson: JSON.stringify({ type: 'add_minutes', minutes: 10 }),
    },
    {
      id: 'rule-jabal-09',
      masjidId: JABAL_MASJID_ID,
      prayerName: 'isha',
      executionOrder: 2,
      ruleName: 'Isha round nearest',
      conditionsJson: JSON.stringify([{ type: 'always' }]),
      actionJson: JSON.stringify({ type: 'round_nearest', increment: 5 }),
    },
  ]).run();

  // Jummah sessions reflecting the Indo-Pak/American congregation.
  // Note: location has been phased out from the public feature set; the
  // column still exists for backward compatibility but is not populated.
  db.insert(schema.jumuahSessions).values([
    {
      id: 'jum-jabal-01',
      masjidId: JABAL_MASJID_ID,
      label: '1st Jummah Khutbah (English)',
      time: '13:30',
      khateeb: 'Imam Yusuf',
      speechTime: '13:00',
      isActive: true,
    },
    {
      id: 'jum-jabal-02',
      masjidId: JABAL_MASJID_ID,
      label: '2nd Jummah Khutbah (Urdu)',
      time: '14:30',
      khateeb: 'Maulana Tariq',
      isActive: true,
    },
    {
      id: 'jum-jabal-03',
      masjidId: JABAL_MASJID_ID,
      label: '3rd Jummah Khutbah (Arabic)',
      time: '15:30',
      khateeb: null,
      isActive: true,
    },
  ]).run();

  db.insert(schema.announcements).values([
    {
      id: 'ann-jabal-01',
      masjidId: JABAL_MASJID_ID,
      title: 'Welcome to Masjid Al-Jabal',
      slug: 'welcome-to-masjid-al-jabal',
      contentMarkdown: '## Assalamu Alaikum wa Rahmatullah\n\nWelcome to **Masjid Al-Jabal** in Kennesaw, Georgia. We are a Hanafi congregation serving the growing Muslim community of Cobb and Cherokee counties.\n\n- Daily Azaan and Iqamah times are calculated using ISNA conventions.\n- Urdu and English programs are offered every weekend.\n- Please join us for Jummah at 1:30 PM, 2:30 PM, or 3:30 PM.',
      compiledHtml: '<h2>Assalamu Alaikum wa Rahmatullah</h2><p>Welcome to <strong>Masjid Al-Jabal</strong> in Kennesaw, Georgia. We are a Hanafi congregation serving the growing Muslim community of Cobb and Cherokee counties.</p><ul><li>Daily Azaan and Iqamah times are calculated using ISNA conventions.</li><li>Urdu and English programs are offered every weekend.</li><li>Please join us for Jummah at 1:30 PM, 2:30 PM, or 3:30 PM.</li></ul>',
      isPinned: true,
      status: 'published',
      publishedAt: new Date().toISOString(),
    },
    {
      id: 'ann-jabal-02',
      masjidId: JABAL_MASJID_ID,
      title: 'Sunday Madrasah Registration',
      slug: 'sunday-madrasah-registration',
      contentMarkdown: 'Registration is open for the 2026–2027 Sunday Madrasah year.\n\n- **Quran & Tajweed**: 10:00 AM – 11:30 AM\n- **Fiqh & Aqeedah (Hanafi)**: 11:45 AM – 12:45 PM\n- **Urdu Language**: 1:00 PM – 2:00 PM\n\nRegister online or at the musalla after Isha.',
      compiledHtml: '<p>Registration is open for the 2026–2027 Sunday Madrasah year.</p><ul><li><strong>Quran &amp; Tajweed</strong>: 10:00 AM – 11:30 AM</li><li><strong>Fiqh &amp; Aqeedah (Hanafi)</strong>: 11:45 AM – 12:45 PM</li><li><strong>Urdu Language</strong>: 1:00 PM – 2:00 PM</li></ul><p>Register online or at the musalla after Isha.</p>',
      isPinned: false,
      status: 'published',
      publishedAt: new Date(Date.now() - 86400000).toISOString(),
    },
    {
      id: 'ann-jabal-03',
      masjidId: JABAL_MASJID_ID,
      title: 'Monthly Community Potluck',
      slug: 'monthly-community-potluck',
      contentMarkdown: 'Join us for our monthly community potluck this Saturday after Maghrib.\n\nBring a halal dish to share. Desserts and chai will be provided. Everyone is welcome!',
      compiledHtml: '<p>Join us for our monthly community potluck this Saturday after Maghrib.</p><p>Bring a halal dish to share. Desserts and chai will be provided. Everyone is welcome!</p>',
      isPinned: false,
      status: 'published',
      publishedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    },
  ]).run();

  // Masjid pages (CMS feature) — not used by Masjid Al-Noor seed data.
  db.insert(schema.masjidPages).values([
    {
      id: 'page-jabal-about',
      masjidId: JABAL_MASJID_ID,
      slug: 'about',
      title: 'About Masjid Al-Jabal',
      rawMarkdown: '# About Masjid Al-Jabal\n\nMasjid Al-Jabal is a Hanafi congregation in Kennesaw, Georgia. We serve the Muslim community of Cobb and Cherokee counties with daily prayers, Jummah, weekend madrasah, and family programs.',
      compiledHtml: '<h1>About Masjid Al-Jabal</h1><p>Masjid Al-Jabal is a Hanafi congregation in Kennesaw, Georgia. We serve the Muslim community of Cobb and Cherokee counties with daily prayers, Jummah, weekend madrasah, and family programs.</p>',
    },
    {
      id: 'page-jabal-services',
      masjidId: JABAL_MASJID_ID,
      slug: 'services',
      title: 'Services',
      rawMarkdown: '# Services\n\n- Daily five-time prayers\n- Friday Jummah (English, Urdu, Arabic)\n- Weekend Madrasah (Quran, Tajweed, Fiqh, Urdu)\n- Nikkah and funeral services by appointment\n- Zakat and sadaqah distribution',
      compiledHtml: '<h1>Services</h1><ul><li>Daily five-time prayers</li><li>Friday Jummah (English, Urdu, Arabic)</li><li>Weekend Madrasah (Quran, Tajweed, Fiqh, Urdu)</li><li>Nikkah and funeral services by appointment</li><li>Zakat and sadaqah distribution</li></ul>',
    },
  ]).run();

  // Custom domain (feature not used by Masjid Al-Noor seed data).
  db.insert(schema.customDomains).values({
    id: 'domain-jabal-01',
    masjidId: JABAL_MASJID_ID,
    domain: 'masjidaljabal.org',
    sslStatus: 'active',
    verifiedAt: new Date().toISOString(),
  }).run();

  console.log(`Seed complete.`);
  console.log(`  Masjid Al-Noor — ${NOOR_SLUG}`);
  console.log(`    Admin: admin@masjid-alnoor.org / ${PASSWORD}`);
  console.log(`    http://localhost:5173/api/v1/masjids/${NOOR_SLUG}`);
  console.log(`    http://localhost:5174/display/${NOOR_SLUG}`);
  console.log(`    http://localhost:5175/${NOOR_SLUG}`);
  console.log(`  Masjid Al-Jabal — ${JABAL_SLUG}`);
  console.log(`    Admin: admin@masjid-aljabal.org / ${PASSWORD}`);
  console.log(`    http://localhost:5173/api/v1/masjids/${JABAL_SLUG}`);
  console.log(`    http://localhost:5174/display/${JABAL_SLUG}`);
  console.log(`    http://localhost:5175/${JABAL_SLUG}`);
}

seed().catch(console.error);