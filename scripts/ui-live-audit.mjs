import { chromium } from 'playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const startedAt = new Date();
const runId = startedAt.toISOString().replace(/[:.]/g, '-');
const outputRoot = path.resolve(
  root,
  process.env.AGM_UI_AUDIT_OUTPUT || path.join('.tmp', 'ui-live-audit'),
);
const outputDirectory = path.join(outputRoot, runId);
const timeoutMs = Number(process.env.AGM_UI_AUDIT_TIMEOUT_MS || 20_000);
const headless = process.env.AGM_UI_AUDIT_HEADLESS !== 'false';

const configuration = JSON.parse(
  await readFile(path.join(root, 'config', 'operations-health.json'), 'utf8'),
);
const targets = configuration.auditTargets.map((target) => ({
  id: target.id,
  name: target.name,
  url: process.env[target.env] || target.defaultUrl,
  capture: target.capture,
}));

const viewports = [
  { id: 'desktop', width: 1440, height: 1000, isMobile: false },
  { id: 'mobile', width: 390, height: 844, isMobile: true },
];

function publicUrl(rawUrl) {
  const parsed = new URL(rawUrl);
  parsed.username = '';
  parsed.password = '';
  parsed.search = '';
  parsed.hash = '';
  return parsed.toString();
}

function sanitizeError(error) {
  const text = error instanceof Error ? error.message : String(error);
  return text
    .replace(/([?&](?:key|token|secret|password|code)=)[^&\s]+/gi, '$1[REDACTED]')
    .replace(/(bearer\s+)[a-z0-9._~-]+/gi, '$1[REDACTED]')
    .slice(0, 500);
}

async function checkHttp(target) {
  const checkedAt = new Date();
  try {
    const response = await fetch(target.url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
      headers: { 'user-agent': 'AGM-UI-Live-Audit/1.0' },
    });
    return {
      checkedAt: checkedAt.toISOString(),
      statusCode: response.status,
      finalUrl: publicUrl(response.url),
      httpPass: response.status === 200,
      error: null,
    };
  } catch (error) {
    return {
      checkedAt: checkedAt.toISOString(),
      statusCode: null,
      finalUrl: publicUrl(target.url),
      httpPass: false,
      error: sanitizeError(error),
    };
  }
}

async function captureTarget(browser, target, httpResult) {
  const captures = [];
  if (!target.capture || !httpResult.httpPass) return captures;

  for (const viewport of viewports) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      isMobile: viewport.isMobile,
      deviceScaleFactor: 1,
      locale: 'ro-RO',
      timezoneId: 'Europe/Berlin',
      storageState: { cookies: [], origins: [] },
    });
    const page = await context.newPage();
    const filename = `${target.id}-${viewport.id}.png`;
    const absolutePath = path.join(outputDirectory, filename);
    try {
      let response;
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          response = await page.goto(target.url, {
            waitUntil: 'networkidle',
            timeout: timeoutMs,
          });
          break;
        } catch (error) {
          if (attempt === 1) throw error;
          await page.waitForTimeout(750);
        }
      }
      if (response?.status() !== 200) {
        throw new Error(`Browser navigation returned HTTP ${response?.status() ?? 'unknown'}`);
      }
      let operationStatuses = null;
      if (target.id === 'turn-local') {
        await page.evaluate(async () => {
          const [
            { renderCentralAlertPanel, renderOperationsCenter },
            { renderMonitoringDepartment },
            { bindOperationsHealthChecks },
            { readIncidentJournal },
            { bindTurnBackToTop },
          ] =
            await Promise.all([
              import('/src/turn-command-center.view.ts'),
              import('/src/monitoring-department.ts'),
              import('/src/operations-health.ts'),
              import('/src/incident-journal.ts'),
              import('/src/turn-navigation.ts'),
            ]);
          const incidents = readIncidentJournal(window.localStorage);
          document.body.innerHTML = `<main id="ui-live-operations-evidence">${renderCentralAlertPanel(incidents)}${renderOperationsCenter(incidents)}${renderMonitoringDepartment(incidents)}</main><button id="turnBackToTop" class="turn-back-to-top" type="button" hidden>↑ Înapoi sus</button>`;
          bindOperationsHealthChecks();
          bindTurnBackToTop();
        });
        const operations = page.locator('.operations-center');
        await operations.waitFor({ state: 'visible', timeout: timeoutMs });
        await page.waitForFunction(
          () =>
            [...document.querySelectorAll('.operation-service-checked')].every(
              (element) => element.textContent?.trim() !== '—',
            ),
          undefined,
          { timeout: timeoutMs },
        );
        operationStatuses = await page
          .locator('.operation-service')
          .evaluateAll((cards) =>
            cards.map((card) => ({
              service:
                card.querySelector('.operation-service-title')?.textContent?.trim() ??
                'unknown',
              status:
                card.querySelector('.operation-service-status')?.textContent?.trim() ??
                'unknown',
            })),
          );
        const unhealthy = operationStatuses.filter((item) =>
          ['DEGRADED', 'OFFLINE'].includes(item.status),
        );
        if (unhealthy.length) {
          throw new Error(
            `Operations Center unhealthy: ${unhealthy
              .map((item) => `${item.service}=${item.status}`)
              .join(', ')}`,
          );
        }
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        const backToTop = page.locator('#turnBackToTop');
        await backToTop.waitFor({ state: 'visible', timeout: timeoutMs });
        const backToTopEvidence = `${target.id}-${viewport.id}-back-to-top.png`;
        await page.screenshot({
          path: path.join(outputDirectory, backToTopEvidence),
          fullPage: false,
        });
        await backToTop.click();
        await page.waitForFunction(() => window.scrollY < 10, undefined, {
          timeout: timeoutMs,
        });
        await page.locator('#ui-live-operations-evidence').screenshot({ path: absolutePath });
      } else {
        const acceptButton = page.locator('#acceptLegalNotice');
        if (await acceptButton.isVisible()) await acceptButton.click();
        await page.screenshot({ path: absolutePath, fullPage: true });
      }
      captures.push({
        viewport: viewport.id,
        path: filename,
        width: viewport.width,
        height: viewport.height,
        operationStatuses,
        backToTop: target.id === 'turn-local' ? 'PASS' : null,
        backToTopEvidence:
          target.id === 'turn-local'
            ? `${target.id}-${viewport.id}-back-to-top.png`
            : null,
        result: 'PASS',
        error: null,
      });
    } catch (error) {
      captures.push({
        viewport: viewport.id,
        path: null,
        width: viewport.width,
        height: viewport.height,
        result: 'FAIL',
        error: sanitizeError(error),
      });
    } finally {
      await context.close();
    }
  }
  return captures;
}

function markdownReport(report) {
  const lines = [
    '# AGM UI Live Audit',
    '',
    `- Run: \`${report.runId}\``,
    `- Started: ${report.startedAt}`,
    `- Finished: ${report.finishedAt}`,
    `- Result: **${report.result}**`,
    `- Browser mode: ${report.headless ? 'headless isolated Chromium' : 'visible isolated Chromium'}`,
    '',
    '| Service | URL | HTTP | Desktop | Mobile | Result | Checked at | Error |',
    '|---|---|---:|---|---|---|---|---|',
  ];

  for (const item of report.services) {
    const captureResult = (viewport) =>
      item.captures.find((capture) => capture.viewport === viewport)?.result || 'N/A';
    const error = item.error || item.captures.find((capture) => capture.error)?.error || '';
    lines.push(
      `| ${item.name} | \`${item.url}\` | ${item.statusCode ?? 'N/A'} | ${captureResult('desktop')} | ${captureResult('mobile')} | **${item.result}** | ${item.checkedAt} | ${error.replaceAll('|', '\\|')} |`,
    );
  }

  lines.push(
    '',
    '## Security',
    '',
    '- Browser contexts are isolated and start without user cookies or local storage.',
    '- Request/response bodies and HTTP headers are not written to the report.',
    '- URL query strings, fragments, credentials, and common secret patterns are removed from logs.',
    '',
  );
  return `${lines.join('\n')}\n`;
}

await mkdir(outputDirectory, { recursive: true });
let browser;
const services = [];

try {
  browser = await chromium.launch({ headless });
  for (const target of targets) {
    const httpResult = await checkHttp(target);
    const captures = await captureTarget(browser, target, httpResult);
    const capturesPass =
      !target.capture ||
      (captures.length === viewports.length &&
        captures.every((capture) => capture.result === 'PASS'));
    services.push({
      id: target.id,
      name: target.name,
      url: publicUrl(target.url),
      ...httpResult,
      captures,
      result: httpResult.httpPass && capturesPass ? 'PASS' : 'FAIL',
    });
  }
} catch (error) {
  services.push({
    id: 'audit-runtime',
    name: 'Playwright audit runtime',
    url: 'N/A',
    checkedAt: new Date().toISOString(),
    statusCode: null,
    finalUrl: 'N/A',
    httpPass: false,
    error: sanitizeError(error),
    captures: [],
    result: 'FAIL',
  });
} finally {
  await browser?.close();
}

const report = {
  schemaVersion: 1,
  runId,
  startedAt: startedAt.toISOString(),
  finishedAt: new Date().toISOString(),
  headless,
  outputDirectory,
  result: services.every((service) => service.result === 'PASS') ? 'PASS' : 'FAIL',
  services,
};

await writeFile(
  path.join(outputDirectory, 'report.json'),
  `${JSON.stringify(report, null, 2)}\n`,
  'utf8',
);
await writeFile(
  path.join(outputDirectory, 'report.md'),
  markdownReport(report),
  'utf8',
);

console.log(`AGM UI Live Audit: ${report.result}`);
console.log(`Report: ${path.join(outputDirectory, 'report.md')}`);
for (const service of services) {
  console.log(
    `${service.result.padEnd(4)} ${String(service.statusCode ?? '-').padEnd(3)} ${service.name}`,
  );
}

process.exitCode = report.result === 'PASS' ? 0 : 1;
