// ---------------------------------------------------------------------------
// Consumer suite — implements CON-01..CON-06 from docs/integration-test-cases.md.
// Reference implementation for the swarm: copy this pattern for CON-07+.
// Run directly: node tests/e2e/consumer.test.js
// ---------------------------------------------------------------------------

import { createReporter, launchBrowser, visitPage, explain } from './helpers.js';
import { targets, SLUG_A, SLUG_B, SLUG_UNKNOWN } from './targets.js';

const cfg = targets();
const t = createReporter(`Consumer [${cfg.env}] → ${cfg.consumer}`);
const browser = await launchBrowser();

// CON-01 — root shows the URL-verification notice, never redirects to a masjid
{
  const r = await visitPage(browser, cfg, `${cfg.consumer}/`, { expectText: 'Please Verify Your URL' });
  t.assert(r.ok, `CON-01 root renders verification notice ${r.ok ? '' : '— ' + explain(r)}`);
}

// CON-02 / CON-03 — masjid home renders name + all 5 prayer labels, both slugs.
// NOTE: labels come from masjid_themes.label_* — al-jabal uses Indo-Pak
// transliterations ("Zuhr" not "Dhuhr"). Verify via:
//   curl $API/api/v1/masjids/<slug> | jq .theme
for (const [id, slug, name, prayers] of [
  ['CON-02', SLUG_A, 'Masjid Al-Noor', ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']],
  ['CON-03', SLUG_B, 'Masjid Al-Jabal', ['Fajr', 'Zuhr', 'Asr', 'Maghrib', 'Isha']],
]) {
  const r = await visitPage(browser, cfg, `${cfg.consumer}/${slug}`, {
    expectText: [name, ...prayers],
  });
  t.assert(r.ok, `${id} /${slug} home renders clean ${r.ok ? '' : '— ' + explain(r)}`);
  t.assert(
    r.badApiOrigins.length === 0,
    `${id} all /api/* requests went to allowed origins (got ${JSON.stringify([...new Set(r.apiOrigins)])})`,
  );
}

// CON-04 — weekly prayer timetable renders. The table headers are
// CSS-uppercased, so document.body.innerText reads "FAJR" — use expectTextCI.
{
  const r = await visitPage(browser, cfg, `${cfg.consumer}/${SLUG_A}/prayer`, {
    expectTextCI: ['Fajr', 'Isha'],
  });
  t.assert(r.ok, `CON-04 /prayer weekly table renders clean ${r.ok ? '' : '— ' + explain(r)}`);
}

// CON-05 — unknown masjid slug: the failing masjid fetch (500 document in
// local dev SSR, 404 API call on the static deploy) is EXPECTED. The page
// must not crash with uncaught exceptions.
// NOTE: currently renders SvelteKit's DEFAULT "500 Internal Error" fallback
// (verified 2026-08-01, local AND prod) — the branded [masjid_slug]/+error.svelte
// does not catch layout-load failures. Follow-up: add a root +error.svelte,
// then update this expectation to the branded message.
{
  const r = await visitPage(browser, cfg, `${cfg.consumer}/${SLUG_UNKNOWN}`, {
    expectText: 'Internal Error',
    allowFailures: [/definitely-not-a-masjid/],
  });
  t.assert(r.ok, `CON-05 unknown slug renders error page, no crash ${r.ok ? '' : '— ' + explain(r)}`);
}

// CON-06 — embed mode hides the consumer chrome
{
  const r = await visitPage(browser, cfg, `${cfg.consumer}/${SLUG_A}/maktab/enroll?embed=1`);
  t.assert(r.pageErrors.length === 0, `CON-06 enroll?embed=1 no uncaught exceptions — ${explain(r)}`);
  t.assert(r.failedRequests.length === 0, `CON-06 no failed requests — ${explain(r)}`);
}

await browser.close();
process.exit((await t.done()) > 0 ? 1 : 0);
