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
  db.delete(schema.navItems).run();
  db.delete(schema.prayerRules).run();
  db.delete(schema.announcements).run();
  db.delete(schema.jumuahSessions).run();
  db.delete(schema.content).run();
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
    showDonateQr: true,
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
    aboutMarkdown: '## Our Story\n\nMasjid Al-Noor has been serving the Chicago Muslim community since 1995. What began as a small storefront musalla has grown into a vibrant Islamic center offering daily prayers, Jumu\'ah services, educational programs, and community outreach.\n\n### Our Mission\n\nTo provide a welcoming space for worship, education, and community building in accordance with the Quran and Sunnah.\n\n### Services\n\n- Five daily prayers with iqaamah\n- Jumu\'ah khutbah and prayer\n- Quran and Islamic studies classes\n- Youth programs\n- Community iftars during Ramadan\n- Marriage and counseling services',
    donationLinks: JSON.stringify([
      { label: 'Online Donation', url: 'https://donate.masjid-alnoor.org' },
      { label: 'LaunchGood', url: 'https://www.launchgood.com/masjid-alnoor' },
    ]),
    adminEmail: 'admin@masjid-alnoor.org',
  }).run();

  // Al-Noor runs the Mishkaat flagship style system (docs/design-language.md);
  // Al-Jabal stays on Sakeenah — one seed masjid per style system.
  // style_options exercises the consumer homepage overhaul features
  // (docs/consumer-homepage-overhaul.md): photo hero, header logo, WhatsApp
  // group link, and configurable donate reasons. The image assets are
  // committed under apps/consumer/static/uploads/seed/ so the URLs resolve
  // identically in local dev, staging, and prod.
  db.insert(schema.masjidThemes).values({
    masjidId: NOOR_MASJID_ID,
    styleSystem: 'mishkaat',
    styleOptions: JSON.stringify({
      photoUrl: '/uploads/seed/noor-hero.svg',
      logoUrl: '/uploads/seed/noor-logo.svg',
      whatsappGroupUrl: 'https://chat.whatsapp.com/ENoorCommunity2026',
      donateReasons: [
        { icon: '🕌', title: 'Maintain the House of Allah', desc: 'Your sadaqah keeps the doors open, the lights on, and the musalla clean for every worshipper.' },
        { icon: '📚', title: 'Support Education', desc: 'Fund Quran classes, the evening maktab, and Islamic studies programs for children and adults.' },
        { icon: '🤝', title: 'Serve the Community', desc: 'Help fund community iftars, family counseling, and outreach programs across Chicago.' },
      ],
    }),
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
    {
      id: 'rule-noor-09',
      masjidId: NOOR_MASJID_ID,
      prayerName: 'dhuhr',
      executionOrder: 0,
      ruleName: 'Dhuhr summer offset (adhaan before 12:30)',
      conditionsJson: JSON.stringify([{ type: 'time_of_day', operator: 'before', threshold: '12:30' }]),
      actionJson: JSON.stringify({ type: 'add_minutes', minutes: 15 }),
    },
    {
      id: 'rule-noor-10',
      masjidId: NOOR_MASJID_ID,
      prayerName: 'dhuhr',
      executionOrder: 0,
      ruleName: 'Dhuhr winter offset (adhaan after 12:30)',
      conditionsJson: JSON.stringify([{ type: 'time_of_day', operator: 'after', threshold: '12:30' }]),
      actionJson: JSON.stringify({ type: 'add_minutes', minutes: 5 }),
    },
    {
      id: 'rule-noor-11',
      masjidId: NOOR_MASJID_ID,
      prayerName: 'isha',
      executionOrder: 0,
      ruleName: 'Isha = Maghrib + 90 (reference-based)',
      conditionsJson: JSON.stringify([{ type: 'always' }]),
      actionJson: JSON.stringify({ type: 'set_offset_from_prayer', prayer: 'maghrib', from: 'adhaan', minutes: 90 }),
    },
    {
      id: 'rule-noor-12',
      masjidId: NOOR_MASJID_ID,
      prayerName: 'isha',
      executionOrder: 3,
      ruleName: 'Isha cap max 22:30',
      conditionsJson: JSON.stringify([{ type: 'always' }]),
      actionJson: JSON.stringify({ type: 'cap_max', time: '22:30' }),
    },
    {
      id: 'rule-noor-13',
      masjidId: NOOR_MASJID_ID,
      prayerName: 'fajr',
      executionOrder: 0,
      ruleName: 'Ramadan last 10 nights add 10',
      conditionsJson: JSON.stringify([{ type: 'hijri_day_range', month: 9, start_day: 21, end_day: 30 }]),
      actionJson: JSON.stringify({ type: 'add_minutes', minutes: 10 }),
    },
    {
      id: 'rule-noor-14',
      masjidId: NOOR_MASJID_ID,
      prayerName: 'fajr',
      executionOrder: 2,
      ruleName: 'Winter schedule extra delay (disabled)',
      conditionsJson: JSON.stringify([{ type: 'month_day_range', start_month: 11, start_day: 1, end_month: 3, end_day: 31 }]),
      actionJson: JSON.stringify({ type: 'add_minutes', minutes: 10 }),
      enabled: false,
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
    programInfo: JSON.stringify({
      goal: 'The goal of the Evening Islamic Studies is to provide the children a sound foundation in their Islamic knowledge and practice, while inculcating the love of Allah and the Prophet, Peace be Upon Him. The \'tarbiyyah\' (upbringing) of the students is highly emphasized.',
      schedule_days: 'Monday - Thursday',
      schedule_time: '5:00 PM - 7:30 PM',
      curriculum: [
        { name: 'Quraan Recitation (تلاوة)', description: 'Reading the Quraan with proper pronunciation and tajweed.' },
        { name: 'Duas/Surah Memorization (تحفيظ)', description: 'Memorizing important Duas and Surahs under proper supervision.' },
        { name: 'Islamic Jurisprudence (فقه الإسلام)', description: 'The basics of Islam. How to pray, make wudu, fast, and rulings on common matters.' },
        { name: 'Biography of the Prophet (سيرة النبي)', description: 'The life history of the Prophet, peace be upon Him, as well as a brief history of some of the earlier Prophets.' },
        { name: 'Islamic Ethics (أخلاق الإسلام)', description: 'Manners of Islam from a theoretical and practical standpoint: how to talk, respect parents, eat, sleep, and interact with others.' },
        { name: 'Beliefs (عقائد)', description: "Beliefs that make someone a Muslim, including the beliefs about Allah, His Angels, His Books, and His Messengers from the viewpoint of the Ahl us Sunnah wal Jamaa'ah." },
      ],
      faqs: [
        { question: 'From what ages are children accepted?', answer: 'Children aged 6 and up are eligible for admittance. Children under 6 may be admitted upon taking an aptitude test.' },
        { question: 'What if my child cannot attend all days?', answer: 'We encourage full attendance so there is no shortfall in learning. However, if a child can only come for certain days, we will try our best to accommodate them.' },
        { question: 'Can I volunteer?', answer: "Volunteers are always welcome. From teaching to being an aide, we're always looking for dedicated and child-friendly teachers." },
        { question: 'How do I enroll my child?', answer: "Simply complete our online enrollment form and we'll process your application." },
        { question: 'How can I support the school?', answer: 'Be a well-wisher and keep the educational programs in your duas (supplications). We also encourage your oral, physical, and monetary support.' },
        { question: 'Who is teaching?', answer: 'Our instructors are qualified teachers with experience in Islamic education and child development.' },
      ],
    }),
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
    aboutMarkdown: '## Welcome to Masjid Al-Jabal\n\nMasjid Al-Jabal serves the growing Muslim community of Kennesaw and greater Cobb County, Georgia. Established in 2010, our masjid is a hub for worship, learning, and community service.\n\n### Our Community\n\nWe are a diverse congregation following the Hanafi school of thought. Our doors are open to all Muslims regardless of background.\n\n### What We Offer\n\n- Five daily prayers with iqaamah in congregation\n- Jumu\'ah services with English khutbah\n- Weekend Islamic school for children\n- Weekly halaqas and study circles\n- Ramadan taraweeh and iftar program\n- Interfaith outreach and community service',
    donationLinks: JSON.stringify([
      { label: 'Online Donation', url: 'https://donate.masjid-aljabal.org' },
      { label: 'Zelle', url: 'https://enroll.zellepay.com' },
    ]),
    adminEmail: 'admin@masjid-aljabal.org',
  }).run();

  // Al-Jabal keeps photoUrl/logoUrl unset so the fallback hero and the
  // letter-avatar header stay covered by seed data; it does exercise the
  // WhatsApp group link and custom donate reasons.
  db.insert(schema.masjidThemes).values({
    masjidId: JABAL_MASJID_ID,
    styleSystem: 'sakeenah',
    styleOptions: JSON.stringify({
      whatsappGroupUrl: 'https://chat.whatsapp.com/EJabalCommunity2026',
      donateReasons: [
        { icon: '🕌', title: 'The House of Allah', desc: 'Whoever builds a masjid for Allah, Allah builds for him a house in Jannah. Keep your masjid thriving.' },
        { icon: '📖', title: 'Weekend Madrasah', desc: 'Sponsor Quran, Tajweed, Fiqh, and Urdu classes for the children of Cobb County.' },
        { icon: '🤲', title: 'Zakat & Sadaqah', desc: 'Support families in need through our local zakat distribution and food pantry.' },
      ],
    }),
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

  // Content items (CMS pages) — not used by Masjid Al-Noor seed data.
  const now = new Date().toISOString();
  db.insert(schema.content).values([
    {
      id: 'content-jabal-about',
      masjidId: JABAL_MASJID_ID,
      slug: 'about',
      title: 'About Masjid Al-Jabal',
      contentMarkdown: '# About Masjid Al-Jabal\n\nMasjid Al-Jabal is a Hanafi congregation in Kennesaw, Georgia. We serve the Muslim community of Cobb and Cherokee counties with daily prayers, Jummah, weekend madrasah, and family programs.',
      compiledHtml: '<h1>About Masjid Al-Jabal</h1><p>Masjid Al-Jabal is a Hanafi congregation in Kennesaw, Georgia. We serve the Muslim community of Cobb and Cherokee counties with daily prayers, Jummah, weekend madrasah, and family programs.</p>',
      contentType: 'page',
      showOnHomepage: false,
      showOnInfo: false,
      isHidden: false,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'content-jabal-services',
      masjidId: JABAL_MASJID_ID,
      slug: 'services',
      title: 'Services',
      contentMarkdown: '# Services\n\n- Daily five-time prayers\n- Friday Jummah (English, Urdu, Arabic)\n- Weekend Madrasah (Quran, Tajweed, Fiqh, Urdu)\n- Nikkah and funeral services by appointment\n- Zakat and sadaqah distribution',
      compiledHtml: '<h1>Services</h1><ul><li>Daily five-time prayers</li><li>Friday Jummah (English, Urdu, Arabic)</li><li>Weekend Madrasah (Quran, Tajweed, Fiqh, Urdu)</li><li>Nikkah and funeral services by appointment</li><li>Zakat and sadaqah distribution</li></ul>',
      contentType: 'page',
      showOnHomepage: false,
      showOnInfo: false,
      isHidden: false,
      createdAt: now,
      updatedAt: now,
    },
    {
      // Homepage post — exercises the homepage_post branch of the consumer
      // homepage (left content column, under the pinned announcement).
      id: 'content-jabal-imam-note',
      masjidId: JABAL_MASJID_ID,
      slug: 'a-note-from-the-imam',
      title: 'A Note from the Imam',
      contentMarkdown: 'Assalamu alaikum wa rahmatullahi wa barakatuh,\n\nAlhamdulillah, our community continues to grow. Please remember the **maghrib** iqaamah is right after the azaan — plan to arrive a few minutes early.\n\nMay Allah bless you and your families.\n\n— Imam Yusuf',
      compiledHtml: '<p>Assalamu alaikum wa rahmatullahi wa barakatuh,</p><p>Alhamdulillah, our community continues to grow. Please remember the <strong>maghrib</strong> iqaamah is right after the azaan — plan to arrive a few minutes early.</p><p>May Allah bless you and your families.</p><p>— Imam Yusuf</p>',
      contentType: 'post',
      showOnHomepage: true,
      showOnInfo: false,
      isHidden: false,
      createdAt: now,
      updatedAt: now,
    },
    {
      // Resources page — reachable via the seeded nav item below (kind='page').
      id: 'content-jabal-resources',
      masjidId: JABAL_MASJID_ID,
      slug: 'resources',
      title: 'Community Resources',
      contentMarkdown: 'Community services available at Masjid Al-Jabal:\n\n- **Nikah Officiation**: Our imams perform nikah ceremonies. Please book at least two weeks in advance via the office.\n- **Financial Help (Zakat)**: Confidential zakat and sadaqah assistance for local families. Speak to Imam Yusuf after any prayer.\n- **New Muslim Support**: Weekly shahada classes and one-on-one mentorship every Saturday after Fajr.\n- **Funeral Services**: Janazah washing, prayer, and burial coordination — call the office any time.\n- **Youth Halaqa**: Fridays after Isha in the musalla basement.',
      compiledHtml: '<p>Community services available at Masjid Al-Jabal:</p><ul><li><strong>Nikah Officiation</strong>: Our imams perform nikah ceremonies. Please book at least two weeks in advance via the office.</li><li><strong>Financial Help (Zakat)</strong>: Confidential zakat and sadaqah assistance for local families. Speak to Imam Yusuf after any prayer.</li><li><strong>New Muslim Support</strong>: Weekly shahada classes and one-on-one mentorship every Saturday after Fajr.</li><li><strong>Funeral Services</strong>: Janazah washing, prayer, and burial coordination — call the office any time.</li><li><strong>Youth Halaqa</strong>: Fridays after Isha in the musalla basement.</li></ul>',
      contentType: 'page',
      showOnHomepage: false,
      showOnInfo: false,
      isHidden: false,
      createdAt: now,
      updatedAt: now,
    },
  ]).run();

  // Nav items — Masjid Al-Jabal only. When any items exist the consumer
  // layout replaces its fallback defaults entirely (Home is auto-prepended),
  // so the full route set is seeded here. Info is desktop-header-only to
  // keep the mobile bottom bar at five items.
  db.insert(schema.navItems).values([
    { id: 'nav-jabal-01', masjidId: JABAL_MASJID_ID, sortOrder: 1, kind: 'route', routeSegment: 'prayer', label: 'Times', icon: 'Clock' },
    { id: 'nav-jabal-02', masjidId: JABAL_MASJID_ID, sortOrder: 2, kind: 'route', routeSegment: 'news', label: 'News', icon: 'Megaphone' },
    { id: 'nav-jabal-03', masjidId: JABAL_MASJID_ID, sortOrder: 3, kind: 'page', pageSlug: 'resources', label: 'Resources', icon: 'FileText' },
    { id: 'nav-jabal-04', masjidId: JABAL_MASJID_ID, sortOrder: 4, kind: 'route', routeSegment: 'info', label: 'Info', icon: 'Info', showOnMobileBottom: false },
    { id: 'nav-jabal-05', masjidId: JABAL_MASJID_ID, sortOrder: 5, kind: 'route', routeSegment: 'maktab', label: 'Maktab', icon: 'GraduationCap' },
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

// Exported so tooling/dump-seed-sql.ts can await completion before reading
// the database (the CLI behavior is unchanged: errors print and exit non-zero).
export const seedPromise: Promise<void> = seed();

seedPromise.catch((e) => {
  console.error(e);
  process.exit(1);
});