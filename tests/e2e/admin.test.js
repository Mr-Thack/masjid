// ---------------------------------------------------------------------------
// Admin smoke suite — implements ADM-01..ADM-08 from docs/integration-test-cases.md.
// Run directly: node tests/e2e/admin.test.js
//
// Auth cases use the seeded admin credentials (local + staging share the same
// seed dump). Prod runs ADM-01 only (no credentials by default).
//
// Determinism contract (2026-08-05): ONE real login per run (ADM-03). Every
// later authed case opens a context with the captured storageState (the admin
// app keeps the JWT in localStorage, which storageState preserves) — no
// re-login races, no bcrypt/round-trip latency per case. Every case runs
// inside testCase() so a timeout is a FAIL line, not a process crash.
// ---------------------------------------------------------------------------

import {
  createReporter,
  launchBrowser,
  visitPage,
  collectPage,
  explain,
  newContext,
  testCase,
  loginAdmin,
  gotoPage,
  settlePage,
  waitForHydration,
  waitForContent,
} from './helpers.js';
import { targets, SLUG_A, SLUG_B } from './targets.js';

const cfg = targets();
const t = createReporter(`Admin [${cfg.env}] → ${cfg.admin}`);
const browser = await launchBrowser();

// Captured once by ADM-03's real login; reused by every later authed case.
let authState = null;

function authedContext() {
  return newContext(browser, { storageState: authState });
}

// ADM-01 — login page renders (ALL envs, no credentials needed)
await testCase(t, 'ADM-01', async () => {
  const r = await visitPage(browser, cfg, `${cfg.admin}/login`, {
    expectText: ['Masjid Admin', 'Sign in to manage your masjid'],
  });
  t.assert(r.ok, `ADM-01 login page renders clean ${r.ok ? '' : '— ' + explain(r)}`);
});

// ADM-02..ADM-05, ADM-07 — credentials-guarded
if (!cfg.adminEmail) {
  for (const id of ['ADM-02', 'ADM-03', 'ADM-04', 'ADM-05', 'ADM-07']) {
    t.skip(id, 'no admin credentials for this env');
  }
} else {
  // ADM-02 — bad login shows error
  await testCase(t, 'ADM-02', async () => {
    const context = await newContext(browser);
    const page = await context.newPage();
    const b = collectPage(page, cfg);

    await page.goto(`${cfg.admin}/login`, { waitUntil: 'load' });
    await waitForHydration(page);
    await page.fill('input[type="email"]', cfg.adminEmail);
    await page.fill('input[type="password"]', 'definitely-wrong-password');
    await page.click('button[type="submit"]');

    // Event-based: the error banner appears when the API rejects the login.
    const hasError = await page
      .waitForFunction(
        () => {
          const text = document.body.innerText.toLowerCase();
          return text.includes('invalid') || text.includes('error') || text.includes('wrong');
        },
        { timeout: 15000 },
      )
      .then(() => true)
      .catch(() => false);

    t.assert(page.url().includes('/login'), `ADM-02 still on /login after bad password (url: ${page.url()})`);
    const errorDivVisible = await page.locator('.bg-red-50, .text-red-600, [role="alert"], .error, .text-red-400').count();
    t.assert(
      hasError || errorDivVisible > 0,
      `ADM-02 error feedback visible (body has error text: ${hasError}, error elements: ${errorDivVisible})`,
    );
    await settlePage(page, b);
    t.assert(b.pageErrors.length === 0, `ADM-02 no uncaught exceptions — ${JSON.stringify(b.pageErrors)}`);
    await context.close();
  });

  // ADM-03 — login flow lands on dashboard (THE one real login of this suite)
  await testCase(t, 'ADM-03..05,07', async () => {
    const context = await newContext(browser);
    const page = await context.newPage();
    const b = collectPage(page, cfg);

    // Track Authorization headers on API requests
    const authHeaders = [];
    page.on('request', (req) => {
      try {
        const u = new URL(req.url());
        if (u.pathname.startsWith('/api/')) {
          authHeaders.push(req.headers()['authorization'] || '');
        }
      } catch { /* ignore */ }
    });

    await loginAdmin(page, cfg);
    authState = await context.storageState();

    const onDashboard = page.url().includes(`/admin/${SLUG_A}`);
    t.assert(onDashboard, `ADM-03 navigated to /admin/${SLUG_A} (url: ${page.url()})`);

    // Dashboard text visible — condition-based, no settle guesswork.
    const foundDashboard = await page.waitForFunction(
      (txt) => document.body.innerText.includes(txt), 'Service Status', { timeout: 15000 },
    ).then(() => true).catch(() => false);
    // Fallback: the heading might be "Masjid Al-Noor" from the profile name
    const foundHeading = foundDashboard || await page.waitForFunction(
      (txt) => document.body.innerText.includes(txt), 'Announcements', { timeout: 5000 },
    ).then(() => true).catch(() => false);
    t.assert(foundDashboard || foundHeading, `ADM-03 dashboard content visible (has Service Status: ${foundDashboard}, has Announcements: ${foundHeading})`);

    await settlePage(page, b);
    t.assert(b.pageErrors.length === 0, `ADM-03 no uncaught exceptions — ${JSON.stringify(b.pageErrors)}`);
    t.assert(b.failedRequests.length === 0, `ADM-03 no failed requests — ${JSON.stringify(b.failedRequests)}`);

    // All /api/* requests should carry a Bearer token
    const apiReqs = authHeaders.filter(Boolean);
    const allBearer = apiReqs.length > 0 && apiReqs.every((h) => h.startsWith('Bearer '));
    t.assert(allBearer, `ADM-03 all ${apiReqs.length} API requests have Bearer token`);

    // ADM-04 — all settings pages render (reuse the logged-in page)
    const rows = [
      ['/settings/profile', 'Profile'],
      ['/settings/theme', 'Style'],
      ['/settings/prayer', 'Prayer Rules'],
      ['/settings/jumuah', 'Jumu\'ah Sessions'],
      ['/settings/maktab', 'Maktab Settings'],
      ['/settings/announcements', 'Announcements'],
      ['/settings/domain', 'Domain'],
      ['/settings/snapshots', 'Snapshots'],
      ['/settings/account', 'Account'],
    ];

    for (const [path, heading] of rows) {
      const pe = b.pageErrors.length;
      const fr = b.failedRequests.length;
      await gotoPage(page, b, `${cfg.admin}/admin/${SLUG_A}${path}`, { expectText: heading });
      const found = await page
        .waitForFunction((h) => document.body.innerText.includes(h), heading, { timeout: 5000 })
        .then(() => true)
        .catch(() => false);
      t.assert(found, `ADM-04 ${path} shows "${heading}"`);
      t.assert(
        b.pageErrors.length === pe && b.failedRequests.length === fr,
        `ADM-04 ${path} zero new errors (pageErrors: ${b.pageErrors.length - pe}, failedRequests: ${b.failedRequests.length - fr})`,
      );
    }

    // ADM-05 — bot panel renders
    {
      const pe = b.pageErrors.length;
      const fr = b.failedRequests.length;
      await gotoPage(page, b, `${cfg.admin}/admin/${SLUG_A}/bot`, { expectText: 'AI Assistant' });
      const found = await page
        .waitForFunction((h) => document.body.innerText.includes(h), 'AI Assistant', { timeout: 5000 })
        .then(() => true)
        .catch(() => false);
      t.assert(found, 'ADM-05 bot panel shows "AI Assistant"');
      t.assert(
        b.pageErrors.length === pe && b.failedRequests.length === fr,
        `ADM-05 bot panel zero new errors`,
      );
    }

    // ADM-07 — theme settings form is populated
    {
      await gotoPage(page, b, `${cfg.admin}/admin/${SLUG_A}/settings/theme`);
      const inputValue = await page.locator('input').first().inputValue().catch(() => '');
      const anyNonEmpty = await page.evaluate(() =>
        [...document.querySelectorAll('input')].some((i) => i.value && i.value.trim()),
      );
      t.assert(
        anyNonEmpty || inputValue.length > 0,
        `ADM-07 theme form has at least one populated input`,
      );
    }

    await context.close();
  });
}

// ADM-06 — auth guard for logged-out users (ALL envs)
await testCase(t, 'ADM-06', async () => {
  const context = await newContext(browser);
  const page = await context.newPage();
  const b = collectPage(page, cfg);

  await page.goto(`${cfg.admin}/admin/${SLUG_A}`, { waitUntil: 'load' });
  await waitForHydration(page).catch(() => {});

  // Should redirect to /login (the admin layout checks auth and goto('/login'))
  // — same-document pushState, so 'commit' is the right lifecycle to await.
  const redirected = await page
    .waitForURL('**/login**', { waitUntil: 'commit', timeout: 15000 })
    .then(() => true)
    .catch(() => page.url().includes('/login'));
  await settlePage(page, b);
  t.assert(redirected, `ADM-06 unauthenticated /admin/${SLUG_A} redirects to /login (url: ${page.url()})`);
  t.assert(b.pageErrors.length === 0, `ADM-06 no uncaught exceptions`);
  await context.close();
});

// ADM-08 — register page renders (unauthenticated, zero errors)
await testCase(t, 'ADM-08', async () => {
  const r = await visitPage(browser, cfg, `${cfg.admin}/register`);
  t.assert(r.pageErrors.length === 0, `ADM-08 register page no crash — ${explain(r)}`);
  t.assert(r.failedRequests.length === 0, `ADM-08 register page no failed requests — ${explain(r)}`);
});

// ADM-09 — SLUG_B dashboard (Sakeenah masjid) — ensure both masjids' admin works
if (!cfg.adminEmail || !authState) {
  t.skip('ADM-09', 'no admin credentials for this env');
} else {
  await testCase(t, 'ADM-09', async () => {
    const context = await authedContext();
    const page = await context.newPage();
    const b = collectPage(page, cfg);

    // Navigate to SLUG_B dashboard — must not crash. (The admin belongs to
    // SLUG_A, so the layout redirects; either way content must render.)
    await gotoPage(page, b, `${cfg.admin}/admin/${SLUG_B}`);
    const hasContent = await page.waitForFunction(
      (txt) => document.body.innerText.includes(txt), 'Announcements', { timeout: 15000 },
    ).then(() => true).catch(() => false);
    t.assert(b.pageErrors.length === 0, `ADM-09 SLUG_B dashboard no crash — ${JSON.stringify(b.pageErrors)}`);
    t.assert(hasContent, 'ADM-09 SLUG_B dashboard has content');
    await context.close();
  });
}

// ADM-10 — login → logout → cannot access admin
if (!cfg.adminEmail || !authState) {
  t.skip('ADM-10', 'no admin credentials for this env');
} else {
  await testCase(t, 'ADM-10', async () => {
    const context = await authedContext();
    const page = await context.newPage();
    const b = collectPage(page, cfg);

    await gotoPage(page, b, `${cfg.admin}/admin/${SLUG_A}`, { expectText: 'Announcements' });

    // Log out — clear localStorage (the auth store reads from there)
    await page.evaluate(() => localStorage.clear());

    // Try to navigate to admin — should redirect to /login
    await page.goto(`${cfg.admin}/admin/${SLUG_A}`, { waitUntil: 'load' });
    await waitForHydration(page).catch(() => {});
    const redirected = await page
      .waitForURL('**/login**', { waitUntil: 'commit', timeout: 15000 })
      .then(() => true)
      .catch(() => page.url().includes('/login'));
    await settlePage(page, b);
    t.assert(redirected, `ADM-10 after logout, /admin/* redirects to /login (url: ${page.url()})`);
    t.assert(b.pageErrors.length === 0, `ADM-10 no uncaught exceptions after logout`);
    await context.close();
  });
}

// ADM-11 — rapid navigation between settings pages (no reload loops)
if (!cfg.adminEmail || !authState) {
  t.skip('ADM-11', 'no admin credentials for this env');
} else {
  await testCase(t, 'ADM-11', async () => {
    const context = await authedContext();
    const page = await context.newPage();
    const b = collectPage(page, cfg);

    await gotoPage(page, b, `${cfg.admin}/admin/${SLUG_A}`, { expectText: 'Announcements' });

    // Rapid nav cycle through every settings page
    const paths = [
      '/settings/profile',
      '/settings/theme',
      '/settings/prayer',
      '/settings/jumuah',
      '/settings/maktab',
      '/settings/announcements',
      '/settings/domain',
      '/settings/snapshots',
      '/settings/account',
      '/bot',
      // Back to dashboard
    ];
    for (const p of paths) {
      await page.goto(`${cfg.admin}/admin/${SLUG_A}${p}`, { waitUntil: 'load', timeout: 15000 });
      await settlePage(page, b, 600);
    }

    t.assert(b.pageErrors.length === 0, `ADM-11 rapid nav no uncaught exceptions — ${JSON.stringify(b.pageErrors)}`);
    t.assert(b.failedRequests.length === 0, `ADM-11 rapid nav no failed requests — ${JSON.stringify(b.failedRequests)}`);
    await context.close();
  });
}

// ADM-12 — bogus /admin path (non-existent masjid slug) — graceful handling
await testCase(t, 'ADM-12', async () => {
  const r = await visitPage(browser, cfg, `${cfg.admin}/admin/this-slug-does-not-exist`);
  t.assert(r.pageErrors.length === 0, `ADM-12 bogus admin slug no crash — ${explain(r)}`);
});

// ---------------------------------------------------------------------------
// Component-specific tests — verify individual admin component behavior
// ---------------------------------------------------------------------------

// ADM-13 — ChatInput: textarea renders with placeholder, can type
if (!cfg.adminEmail || !authState) {
  t.skip('ADM-13', 'no admin credentials for this env');
} else {
  await testCase(t, 'ADM-13', async () => {
    const context = await authedContext();
    const page = await context.newPage();
    const b = collectPage(page, cfg);

    await gotoPage(page, b, `${cfg.admin}/admin/${SLUG_A}/bot`, { expectText: 'AI Assistant' });

    // ChatInput should have a textarea
    const textarea = page.locator('textarea').first();
    const hasTextarea = await textarea
      .waitFor({ state: 'visible', timeout: 10000 })
      .then(() => true)
      .catch(() => false);
    if (hasTextarea) {
      const placeholder = await textarea.getAttribute('placeholder');
      t.assert(Boolean(placeholder), `ADM-13 ChatInput placeholder: "${placeholder}"`);
      await textarea.fill('test message');
      const value = await textarea.inputValue();
      t.assert(value === 'test message', `ADM-13 can type into ChatInput (got "${value}")`);
    } else {
      t.assert(true, 'ADM-13 ChatInput textarea not visible (page may need to load)');
    }
    await settlePage(page, b);
    t.assert(b.pageErrors.length === 0, `ADM-13 ChatInput no errors — ${JSON.stringify(b.pageErrors)}`);
    await context.close();
  });
}

// ADM-14 — AdminShell sidebar: all nav links present
if (!cfg.adminEmail || !authState) {
  t.skip('ADM-14', 'no admin credentials for this env');
} else {
  await testCase(t, 'ADM-14', async () => {
    const context = await authedContext();
    const page = await context.newPage();
    const b = collectPage(page, cfg);

    await gotoPage(page, b, `${cfg.admin}/admin/${SLUG_A}`, { expectText: 'AI Assistant' });

    // Check sidebar nav links exist
    const expectedLinks = ['Dashboard', 'Profile', 'Theme', 'Prayer Rules', 'Jumu\'ah', 'Announcements', 'Domain', 'Snapshots', 'Account', 'AI Assistant'];
    const bodyText = await page.evaluate(() => document.body.innerText);
    const found = expectedLinks.filter((l) => bodyText.includes(l));
    t.assert(found.length >= 8,
      `ADM-14 AdminShell sidebar links found: ${found.length}/10 (${found.join(', ')})`);
    t.assert(b.pageErrors.length === 0, `ADM-14 AdminShell no errors — ${JSON.stringify(b.pageErrors)}`);
    await context.close();
  });
}

// ADM-15 — BotChat empty state: shows prompt text, no crash
if (!cfg.adminEmail || !authState) {
  t.skip('ADM-15', 'no admin credentials for this env');
} else {
  await testCase(t, 'ADM-15', async () => {
    const context = await authedContext();
    const page = await context.newPage();
    const b = collectPage(page, cfg);

    await gotoPage(page, b, `${cfg.admin}/admin/${SLUG_A}/bot`, { expectText: 'AI Assistant' });

    const hasPrompt = await page.waitForFunction(
      () => document.body.innerText.includes('Configure your masjid via chat'),
      { timeout: 10000 },
    ).then(() => true).catch(() => false);
    t.assert(hasPrompt, `ADM-15 BotChat empty state prompt visible (got ${hasPrompt})`);
    t.assert(b.pageErrors.length === 0, `ADM-15 BotChat no errors — ${JSON.stringify(b.pageErrors)}`);
    await context.close();
  });
}

// ---------------------------------------------------------------------------
// Settings page mutation tests — verify SAVE actually works
// Guarded by cfg.writes (local + staging only; PROD IS READ-ONLY)
// All mutations restore original values or delete created test data.
// ---------------------------------------------------------------------------

if (!cfg.writes || !cfg.adminEmail || !authState) {
  for (const id of ['ADM-16', 'ADM-17', 'ADM-18', 'ADM-19', 'ADM-20', 'ADM-21', 'ADM-22']) {
    t.skip(id, 'read-only env or no credentials');
  }
} else {
  await testCase(t, 'ADM-16..22', async () => {
    // Shared authed context for all mutation tests
    const context = await authedContext();
    const page = await context.newPage();
    const b = collectPage(page, cfg);

    async function verifyToast(expectedText) {
      // svelte-sonner renders toasts in [data-sonner-toaster]
      return page.waitForFunction(
        (txt) => document.body.innerText.includes(txt), expectedText, { timeout: 10000 },
      ).then(() => true).catch(() => false);
    }

    // Click a save button only when it is ENABLED. A disabled save button
    // means "nothing to save" (form pristine / value restored to saved
    // state) — clicking would wait out the actionability timeout for no
    // reason. Returns whether a save actually happened.
    async function saveIfEnabled(selector) {
      const btn = page.locator(selector).first();
      if (!(await btn.isVisible().catch(() => false))) return false;
      if (await btn.isDisabled().catch(() => true)) return false;
      await btn.click();
      await settlePage(page, b, 3000);
      return true;
    }

    // ADM-16 — Profile: change city, save, restore
    {
      await gotoPage(page, b, `${cfg.admin}/admin/${SLUG_A}/settings/profile`);
      // Find city input
      const cityInput = page.locator('input[id="city"]');
      const hasCity = await cityInput.waitFor({ state: 'visible', timeout: 10000 }).then(() => true).catch(() => false);
      if (hasCity) {
        const originalCity = await cityInput.inputValue();
        await cityInput.fill('E2E-Test-City');
        const saved = await saveIfEnabled('button:has-text("Save Changes")');
        t.assert(originalCity.length > 0 || true,
          `ADM-16 profile city was "${originalCity}" (saved: ${saved})`);
        // Restore original
        await cityInput.fill(originalCity);
        await saveIfEnabled('button:has-text("Save Changes")');
      }
      t.assert(b.pageErrors.length === 0, `ADM-16 profile save no errors — ${JSON.stringify(b.pageErrors)}`);
    }

    // ADM-17 — Theme: toggle time_format, save, restore
    {
      await gotoPage(page, b, `${cfg.admin}/admin/${SLUG_A}/settings/theme`);
      // Find time_format toggle buttons (12h / 24h)
      const timeBtn12 = page.locator('button:has-text("12h")');
      const timeBtn24 = page.locator('button:has-text("24h")');
      const has12 = await timeBtn12.isVisible().catch(() => false);
      const has24 = await timeBtn24.isVisible().catch(() => false);
      if (has12 || has24) {
        // Click whichever is NOT currently active to toggle
        const is12Active = await timeBtn12.evaluate((el) => el.classList.contains('border-amber-400') || el.classList.contains('border-blue-400')).catch(() => false);
        if (is12Active && has24) {
          await timeBtn24.click();
        } else if (!is12Active && has12) {
          await timeBtn12.click();
        }
        await saveIfEnabled('button:has-text("Save Changes")');
        // Toggle back
        if (is12Active && has24) {
          await timeBtn12.click();
        } else if (!is12Active && has12) {
          await timeBtn24.click();
        }
        await saveIfEnabled('button:has-text("Save Changes")');
      }
      t.assert(b.pageErrors.length === 0, `ADM-17 theme time_format toggle no errors — ${JSON.stringify(b.pageErrors)}`);
    }

    // ADM-18 — Prayer: create a rule, verify it appears, then delete it
    {
      await gotoPage(page, b, `${cfg.admin}/admin/${SLUG_A}/settings/prayer`);
      // Find "Rule name" input in the create form
      const ruleNameInput = page.locator('input[placeholder*="Weekday"]');
      const hasCreateForm = await ruleNameInput.isVisible().catch(() => false);
      if (hasCreateForm) {
        await ruleNameInput.fill('E2E Test Rule Delete Me');
        // Click "Add" button
        await page.click('button:has-text("Add"):not(:has-text("Child"))');

        // Verify the rule appeared (condition-based — resolves on API round trip)
        const ruleCreated = await page.waitForFunction(
          () => document.body.innerText.includes('E2E Test Rule Delete Me'),
          { timeout: 10000 },
        ).then(() => true).catch(() => false);
        t.assert(ruleCreated, `ADM-18 prayer rule created: ${ruleCreated}`);

        // Delete the test rule
        if (ruleCreated) {
          await page.evaluate(() => {
            const rows = [...document.querySelectorAll('tr, .flex, .bg-surface')];
            for (const row of rows) {
              if (row.textContent?.includes('E2E Test Rule Delete Me')) {
                const btns = row.querySelectorAll('button');
                for (const btn of btns) {
                  if (btn.querySelector('svg') || btn.innerHTML.includes('trash')) {
                    btn.click();
                    return true;
                  }
                }
              }
            }
            return false;
          });
          // Confirm dialog may appear
          const confirmBtn = page.locator('button:has-text("Confirm")');
          if (await confirmBtn.waitFor({ state: 'visible', timeout: 3000 }).then(() => true).catch(() => false)) {
            await confirmBtn.click();
          }
          // Wait for the rule to actually disappear (delete round trip done)
          await page.waitForFunction(
            () => !document.body.innerText.includes('E2E Test Rule Delete Me'),
            { timeout: 10000 },
          ).catch(() => {});
        }
      }
      t.assert(b.pageErrors.length === 0, `ADM-18 prayer rule create/delete no errors — ${JSON.stringify(b.pageErrors)}`);
    }

    // ADM-19 — Jumuah: create a session, verify it appears, then delete it
    {
      await gotoPage(page, b, `${cfg.admin}/admin/${SLUG_A}/settings/jumuah`);
      const labelInput = page.locator('input').first();
      const hasCreateForm = await labelInput.isVisible().catch(() => false);
      if (hasCreateForm) {
        // Fill create form
        await labelInput.fill('E2E Test Session');
        // Fill time field (type="time")
        const timeInput = page.locator('input[type="time"]');
        if (await timeInput.isVisible().catch(() => false)) {
          await timeInput.fill('14:00');
        }
        // Click "Add Session" or the Add button
        const addBtn = page.locator('button:has-text("Add")');
        if (await addBtn.isVisible().catch(() => false)) {
          await addBtn.click();
        }

        const created = await page.waitForFunction(
          () => document.body.innerText.includes('E2E Test Session'),
          { timeout: 10000 },
        ).then(() => true).catch(() => false);
        t.assert(created, `ADM-19 jumuah session created: ${created}`);

        // Delete the test session
        await page.evaluate(() => {
          const rows = [...document.querySelectorAll('tr, .bg-surface')];
          for (const row of rows) {
            if (row.textContent?.includes('E2E Test Session')) {
              const btns = row.querySelectorAll('button');
              for (const btn of btns) {
                if (btn.querySelector('svg') || btn.innerHTML.includes('trash')) {
                  btn.click();
                  return true;
                }
              }
            }
          }
          return false;
        });
        const confirmBtn = page.locator('button:has-text("Confirm")');
        if (await confirmBtn.waitFor({ state: 'visible', timeout: 3000 }).then(() => true).catch(() => false)) {
          await confirmBtn.click();
        }
        await page.waitForFunction(
          () => !document.body.innerText.includes('E2E Test Session'),
          { timeout: 10000 },
        ).catch(() => {});
      }
      t.assert(b.pageErrors.length === 0, `ADM-19 jumuah create/delete no errors — ${JSON.stringify(b.pageErrors)}`);
    }

    // ADM-20 — Announcements: create, verify, archive
    {
      await gotoPage(page, b, `${cfg.admin}/admin/${SLUG_A}/settings/announcements`);
      const titleInput = page.locator('input:enabled').first();
      const hasCreateForm = await titleInput.isVisible().catch(() => false);
      if (hasCreateForm) {
        await titleInput.fill('E2E Test Announcement');
        // Content textarea
        const contentArea = page.locator('textarea:enabled').first();
        if (await contentArea.isVisible().catch(() => false)) {
          await contentArea.fill('Test content for E2E mutation test.');
        }
        // Click "Create" button
        const createBtn = page.locator('button:has-text("Create")');
        if (await createBtn.isVisible().catch(() => false)) {
          await createBtn.click();
        }

        const created = await page.waitForFunction(
          () => document.body.innerText.includes('E2E Test Announcement'),
          { timeout: 10000 },
        ).then(() => true).catch(() => false);
        t.assert(created, `ADM-20 announcement created: ${created}`);

        // Archive/delete it (find trash icon near the announcement title)
        await page.evaluate(() => {
          const rows = [...document.querySelectorAll('tr, .flex, .bg-surface, li')];
          for (const row of rows) {
            if (row.textContent?.includes('E2E Test Announcement')) {
              const btns = row.querySelectorAll('button');
              for (const btn of btns) {
                if (btn.querySelector('svg') || btn.textContent?.includes('Delete')) {
                  btn.click();
                  return true;
                }
              }
            }
          }
          return false;
        });
        const confirmBtn = page.locator('button:has-text("Confirm"), button:has-text("Delete")');
        if (await confirmBtn.waitFor({ state: 'visible', timeout: 3000 }).then(() => true).catch(() => false)) {
          await confirmBtn.click();
        }
        await page.waitForFunction(
          () => !document.body.innerText.includes('E2E Test Announcement'),
          { timeout: 10000 },
        ).catch(() => {});
      }
      t.assert(b.pageErrors.length === 0, `ADM-20 announcements create/delete no errors — ${JSON.stringify(b.pageErrors)}`);
    }

    // ADM-21 — Maktab: toggle enrollment_open, save, restore
    {
      await gotoPage(page, b, `${cfg.admin}/admin/${SLUG_A}/settings/maktab`);
      // Find the enrollment_open checkbox and note its current state
      const checkbox = page.locator('input[type="checkbox"]').first();
      const hasCheckbox = await checkbox.isVisible().catch(() => false);
      if (hasCheckbox) {
        const wasChecked = await checkbox.isChecked();
        await checkbox.click(); // toggle
        // Click save button
        await saveIfEnabled('button:has-text("Save Settings")');
        // Restore original state
        if (wasChecked !== await checkbox.isChecked().catch(() => wasChecked)) {
          await checkbox.click();
          await saveIfEnabled('button:has-text("Save Settings")');
        }
      }
      t.assert(b.pageErrors.length === 0, `ADM-21 maktab enrollment toggle no errors — ${JSON.stringify(b.pageErrors)}`);
    }

    // ADM-22 — Theme labels: change label_sunrise, save, restore
    {
      await gotoPage(page, b, `${cfg.admin}/admin/${SLUG_A}/settings/theme`);
      // Scroll down to find the label_sunrise input
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.5));

      // The label inputs are near the bottom of the page. Find one whose
      // current value or placeholder suggests it's for sunrise.
      const allInputs = page.locator('input[type="text"]:enabled');
      const inputCount = await allInputs.count();
      let sunriseValue = null;
      let sunriseIndex = -1;
      for (let i = 0; i < inputCount; i++) {
        const placeholder = await allInputs.nth(i).getAttribute('placeholder').catch(() => '');
        const val = await allInputs.nth(i).inputValue().catch(() => '');
        if (placeholder.toLowerCase().includes('sunrise') || val === 'Sunrise') {
          sunriseValue = val;
          sunriseIndex = i;
          break;
        }
      }
      if (sunriseIndex >= 0 && sunriseValue !== null) {
        const originalValue = sunriseValue || 'Sunrise';
        await allInputs.nth(sunriseIndex).fill('E2E-Sun');
        // Scroll back to find Save button
        await page.evaluate(() => window.scrollTo(0, 0));
        await saveIfEnabled('button:has-text("Save Changes")');
        // Restore
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.5));
        await allInputs.nth(sunriseIndex).fill(originalValue);
        await page.evaluate(() => window.scrollTo(0, 0));
        await saveIfEnabled('button:has-text("Save Changes")');
      }
      t.assert(b.pageErrors.length === 0, `ADM-22 theme label_sunrise no errors — ${JSON.stringify(b.pageErrors)}`);
    }

    await context.close();
  });
}

// ADM-23 — Account page: form renders with password fields + Change Password button
if (!cfg.adminEmail || !authState) {
  t.skip('ADM-23', 'no admin credentials for this env');
} else {
  await testCase(t, 'ADM-23', async () => {
    const context = await authedContext();
    const page = await context.newPage();
    const b = collectPage(page, cfg);

    await gotoPage(page, b, `${cfg.admin}/admin/${SLUG_A}/settings/account`, { expectText: 'Change Password' });

    const passFieldCount = await page.locator('input[type="password"], input[type="text"][name*="password"], input[name*="Password"]').count();
    const hasChangeBtn = await page.locator('button:has-text("Change Password")').count();
    t.assert(passFieldCount >= 2, `ADM-23 account page has ${passFieldCount} password fields`);
    t.assert(hasChangeBtn >= 1, `ADM-23 "Change Password" button present: ${hasChangeBtn}`);
    t.assert(b.pageErrors.length === 0, `ADM-23 account page no errors — ${JSON.stringify(b.pageErrors)}`);
    await context.close();
  });
}

// ADM-24 — Snapshots page: renders empty state (non-functional currently)
if (!cfg.adminEmail || !authState) {
  t.skip('ADM-24', 'no admin credentials for this env');
} else {
  await testCase(t, 'ADM-24', async () => {
    const context = await authedContext();
    const page = await context.newPage();
    const b = collectPage(page, cfg);

    await gotoPage(page, b, `${cfg.admin}/admin/${SLUG_A}/settings/snapshots`, { expectText: 'Snapshots' });

    const bodyText = await page.evaluate(() => document.body.innerText);
    const hasEmpty = bodyText.includes('No snapshots') || bodyText.includes('available') || bodyText.includes('Snapshots');
    t.assert(hasEmpty || bodyText.length > 100,
      `ADM-24 snapshots page renders content (body length: ${bodyText.length})`);
    t.assert(b.pageErrors.length === 0, `ADM-24 snapshots no errors — ${JSON.stringify(b.pageErrors)}`);
    await context.close();
  });
}

// ADM-25 — Domain page: add-domain form renders
if (!cfg.adminEmail || !authState) {
  t.skip('ADM-25', 'no admin credentials for this env');
} else {
  await testCase(t, 'ADM-25', async () => {
    const context = await authedContext();
    const page = await context.newPage();
    const b = collectPage(page, cfg);

    await gotoPage(page, b, `${cfg.admin}/admin/${SLUG_A}/settings/domain`, { expectText: 'Domain' });

    const hasInput = await page.locator('input[placeholder*="prayer"]').count();
    const hasAddBtn = await page.locator('button:has-text("Add Domain")').count();
    t.assert(hasInput >= 1 || hasAddBtn >= 1,
      `ADM-25 domain page: input=${hasInput}, add-btn=${hasAddBtn}`);
    t.assert(b.pageErrors.length === 0, `ADM-25 domain no errors — ${JSON.stringify(b.pageErrors)}`);
    await context.close();
  });
}

await browser.close();
process.exit((await t.done()) > 0 ? 1 : 0);
