const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext();
  const page = await context.newPage();

  const logs = [];
  page.on('console', msg => {
    const text = `[${msg.type()}] ${msg.text()}`;
    logs.push(text);
    console.log(text);
  });
  page.on('pageerror', err => {
    const text = `[pageerror] ${err.message}\n${err.stack || ''}`;
    logs.push(text);
    console.log(text);
  });
  page.on('response', resp => {
    if (!resp.ok() && resp.url().includes('localhost')) {
      console.log(`[http ${resp.status()}] ${resp.url()}`);
    }
  });

  try {
    await page.goto('http://localhost:5175/masjid-al-noor', { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(3000);
    const html = await page.content();
    const has500 = html.includes('Internal Error') || html.includes('Hydration') || html.includes('console.error');
    console.log('has error indicator in HTML:', has500);
  } catch (e) {
    console.log('nav error', e.message);
  }

  await browser.close();
})();
