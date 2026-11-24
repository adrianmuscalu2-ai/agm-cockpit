import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

for (const url of [
  'http://127.0.0.1:4173/copilot.html',
  'http://127.0.0.1:4173/contabilitate.html',
]) {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15_000 });
  } catch (error) {
    if (!String(error).includes('interrupted by another navigation')) throw error;
  }
  await page.waitForURL((current) => current.pathname !== new URL(url).pathname, { timeout: 15_000 }).catch(() => undefined);
  await page.waitForTimeout(700);
  console.log(`${url} -> ${page.url()}`);
}

await browser.close();
