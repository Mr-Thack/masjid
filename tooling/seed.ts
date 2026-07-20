/**
 * Seeds the local SQLite database with a complete test masjid.
 * Run: npx tsx tooling/seed.ts
 */
import { getDb } from '../apps/api/src/lib/server/db/index.js';
import { hashPassword } from '../apps/api/src/lib/server/auth/password.js';
import * as schema from '../apps/api/src/lib/server/db/schema.js';
import { eq } from 'drizzle-orm';

const db = getDb();

const MASJID_ID = '00000000-0000-0000-0000-000000000001';
const ADMIN_ID = '00000000-0000-0000-0000-000000000002';
const SLUG = 'masjid-al-noor';
const PASSWORD = 'password123';

async function seed() {
  const existing = db.select().from(schema.masjids).where(eq(schema.masjids.id, MASJID_ID)).get();
  if (existing) {
    console.log('Seed data already exists. Clearing and re-seeding...');
    db.delete(schema.customDomains).run();
    db.delete(schema.prayerRules).run();
    db.delete(schema.announcements).run();
    db.delete(schema.jumuahSessions).run();
    db.delete(schema.masjidPages).run();
    db.delete(schema.mktRegistrations).run();
    db.delete(schema.admins).run();
    db.delete(schema.masjidThemes).run();
    db.delete(schema.masjids).run();
  }

  db.insert(schema.masjids).values({
    id: MASJID_ID,
    slug: SLUG,
    name: 'Masjid Al-Noor',
    latitude: 41.8781,
    longitude: -87.6298,
    timezone: 'America/Chicago',
    calculationMethod: 2,
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

  db.insert(schema.masjidThemes).values({
    masjidId: MASJID_ID,
    layoutPreset: 'modern_minimal',
    primaryColor: '#1e3a8a',
    accentColor: '#10b981',
    fontHeading: 'Inter',
    fontBody: 'Roboto',
  }).run();

  const hash = await hashPassword(PASSWORD);
  db.insert(schema.admins).values({
    id: ADMIN_ID,
    masjidId: MASJID_ID,
    email: 'admin@masjid-alnoor.org',
    passwordHash: hash,
    displayName: 'Imam Abdullah',
  }).run();

  db.insert(schema.prayerRules).values([
    {
      id: 'rule-01',
      masjidId: MASJID_ID,
      prayerName: 'fajr',
      executionOrder: 1,
      ruleName: 'Fajr default offset',
      conditionsJson: JSON.stringify([{ type: 'always' }]),
      actionJson: JSON.stringify({ type: 'add_minutes', minutes: 20 }),
    },
    {
      id: 'rule-02',
      masjidId: MASJID_ID,
      prayerName: 'dhuhr',
      executionOrder: 1,
      ruleName: 'Friday override',
      conditionsJson: JSON.stringify([{ type: 'day_of_week', days: [5] }]),
      actionJson: JSON.stringify({ type: 'set_fixed_time', time: '13:30' }),
    },
    {
      id: 'rule-03',
      masjidId: MASJID_ID,
      prayerName: 'dhuhr',
      executionOrder: 2,
      ruleName: 'Dhuhr default offset',
      conditionsJson: JSON.stringify([{ type: 'always' }]),
      actionJson: JSON.stringify({ type: 'add_minutes', minutes: 10 }),
    },
    {
      id: 'rule-04',
      masjidId: MASJID_ID,
      prayerName: 'dhuhr',
      executionOrder: 3,
      ruleName: 'Round up display',
      conditionsJson: JSON.stringify([{ type: 'always' }]),
      actionJson: JSON.stringify({ type: 'round_up', increment: 5 }),
    },
    {
      id: 'rule-05',
      masjidId: MASJID_ID,
      prayerName: 'asr',
      executionOrder: 1,
      ruleName: 'Asr default offset',
      conditionsJson: JSON.stringify([{ type: 'always' }]),
      actionJson: JSON.stringify({ type: 'add_minutes', minutes: 10 }),
    },
    {
      id: 'rule-06',
      masjidId: MASJID_ID,
      prayerName: 'maghrib',
      executionOrder: 1,
      ruleName: 'Maghrib default offset',
      conditionsJson: JSON.stringify([{ type: 'always' }]),
      actionJson: JSON.stringify({ type: 'add_minutes', minutes: 5 }),
    },
    {
      id: 'rule-07',
      masjidId: MASJID_ID,
      prayerName: 'isha',
      executionOrder: 1,
      ruleName: 'Isha default offset',
      conditionsJson: JSON.stringify([{ type: 'always' }]),
      actionJson: JSON.stringify({ type: 'add_minutes', minutes: 10 }),
    },
    {
      id: 'rule-08',
      masjidId: MASJID_ID,
      prayerName: 'isha',
      executionOrder: 2,
      ruleName: 'Isha round up',
      conditionsJson: JSON.stringify([{ type: 'always' }]),
      actionJson: JSON.stringify({ type: 'round_up', increment: 5 }),
    },
  ]).run();

  db.insert(schema.jumuahSessions).values([
    {
      id: 'jum-01',
      masjidId: MASJID_ID,
      label: '1st Session (English)',
      time: '13:30',
      khateeb: 'Imam Abdullah',
      language: 'en',
      location: 'Main Hall',
      isActive: true,
    },
    {
      id: 'jum-02',
      masjidId: MASJID_ID,
      label: '2nd Session (Arabic)',
      time: '14:30',
      khateeb: 'Sheikh Ahmad',
      language: 'ar',
      location: 'Main Hall',
      isActive: true,
    },
  ]).run();

  db.insert(schema.announcements).values([
    {
      id: 'ann-01',
      masjidId: MASJID_ID,
      title: 'Welcome to Masjid Al-Noor',
      slug: 'welcome-to-masjid-al-noor',
      contentMarkdown: '## Assalamu Alaikum\n\nWelcome to Masjid Al-Noor. We are a community mosque serving the Chicago area.\n\n**Prayer times** are updated daily. Please check the schedule before visiting.',
      compiledHtml: '<h2>Assalamu Alaikum</h2><p>Welcome to Masjid Al-Noor. We are a community mosque serving the Chicago area.</p><p><strong>Prayer times</strong> are updated daily. Please check the schedule before visiting.</p>',
      isPinned: true,
      status: 'published',
      publishedAt: new Date().toISOString(),
    },
    {
      id: 'ann-02',
      masjidId: MASJID_ID,
      title: 'Community Iftar This Weekend',
      slug: 'community-iftar-this-weekend',
      contentMarkdown: 'Join us for a community iftar this Saturday after Maghrib prayer. All are welcome!\n\nPlease bring a dish to share if you can. Drinks and dates will be provided.',
      compiledHtml: '<p>Join us for a community iftar this Saturday after Maghrib prayer. All are welcome!</p><p>Please bring a dish to share if you can. Drinks and dates will be provided.</p>',
      isPinned: false,
      status: 'published',
      publishedAt: new Date(Date.now() - 86400000).toISOString(),
    },
    {
      id: 'ann-03',
      masjidId: MASJID_ID,
      title: 'Quran Classes Registration Open',
      slug: 'quran-classes-registration-open',
      contentMarkdown: 'Registration is now open for our summer Quran classes.\n\n- **Beginner Tajweed**: Mondays 6:00 PM\n- **Hifdh Program**: Tuesdays & Thursdays 5:00 PM\n- **Kids Quran**: Saturdays 10:00 AM\n\nRegister at the front desk or email info@masjid-alnoor.org.',
      compiledHtml: '<p>Registration is now open for our summer Quran classes.</p><ul><li><strong>Beginner Tajweed</strong>: Mondays 6:00 PM</li><li><strong>Hifdh Program</strong>: Tuesdays &amp; Thursdays 5:00 PM</li><li><strong>Kids Quran</strong>: Saturdays 10:00 AM</li></ul><p>Register at the front desk or email info@masjid-alnoor.org.</p>',
      isPinned: false,
      status: 'published',
      publishedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    },
  ]).run();

  console.log(`Seed complete.`);
  console.log(`  Masjid: ${SLUG} (id: ${MASJID_ID})`);
  console.log(`  Admin:  admin@masjid-alnoor.org / ${PASSWORD}`);
  console.log(`  http://localhost:5173/api/v1/masjids/${SLUG}`);
  console.log(`  http://localhost:5174/display/${SLUG}`);
  console.log(`  http://localhost:5175/${SLUG}`);
}

seed().catch(console.error);