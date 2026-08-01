import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  copyPlainText,
  type ClipboardCopyMethod,
} from '../src/platform/clipboard';
import {
  fetchFunctionalTranslationHealth,
  fetchHealthEndpoint,
} from '../src/platform/translation-health.client';
import {
  escapeHtml,
  formatInlinePreview,
  formatPreview,
} from '../src/text-format';

const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');

assert.equal(
  escapeHtml(`&<>"'`),
  '&amp;&lt;&gt;&quot;&#039;',
);
assert.equal(formatPreview('', 'Placeholder'), 'Placeholder');
assert.equal(formatPreview('Line 1\nLine <2>', 'Placeholder'), 'Line 1<br />Line &lt;2&gt;');
assert.equal(formatInlinePreview('A\nB & C'), 'A<br />B &amp; C');

const originalNavigator = globalThis.navigator;
const originalDocument = globalThis.document;
const originalWindow = globalThis.window;
const originalFetch = globalThis.fetch;

try {
  const fallback = createFallbackDocument();
  setGlobal('document', fallback.document);
  setGlobal('navigator', {
    clipboard: {
      writeText: async () => {
        throw new Error('clipboard unavailable');
      },
    },
  });

  assert.equal(await copyPlainText('fallback text'), 'fallback' satisfies ClipboardCopyMethod);
  assert.equal(fallback.copied(), 'fallback text');

  let nativeCopy = '';
  setGlobal('navigator', {
    clipboard: {
      writeText: async (value: string) => {
        nativeCopy = value;
      },
    },
  });
  assert.equal(await copyPlainText('native text'), 'clipboard' satisfies ClipboardCopyMethod);
  assert.equal(nativeCopy, 'native text');

  const timeoutIds: number[] = [];
  setGlobal('window', {
    location: { href: 'https://app.example.test/cockpit' },
    setTimeout: () => {
      const id = timeoutIds.length + 1;
      timeoutIds.push(id);
      return id;
    },
    clearTimeout: (id: number) => {
      assert.ok(timeoutIds.includes(id));
    },
  });

  let healthRequest: { url: string; init?: RequestInit } | undefined;
  setGlobal('fetch', async (input: URL | RequestInfo, init?: RequestInit) => {
    healthRequest = { url: String(input), init };
    return { ok: true, status: 200 } as Response;
  });
  assert.equal(await fetchHealthEndpoint('/health/live'), true);
  assert.match(healthRequest?.url ?? '', /^https:\/\/app\.example\.test\/health\/live\?_agm_probe=\d+$/);
  assert.equal(healthRequest?.init?.cache, 'no-store');
  assert.deepEqual(healthRequest?.init?.headers, { Accept: 'application/json' });

  setGlobal('fetch', async () => ({
    ok: true,
    status: 200,
    json: async () => ({ data: { functional: true, status: 'available' } }),
  }) as Response);
  assert.equal(
    await fetchFunctionalTranslationHealth('/health/functional', '/translations'),
    true,
  );

  const fallbackRequests: Array<{ url: string; init?: RequestInit }> = [];
  setGlobal('fetch', async (input: URL | RequestInfo, init?: RequestInit) => {
    fallbackRequests.push({ url: String(input), init });
    if (fallbackRequests.length === 1) {
      return { ok: false, status: 404 } as Response;
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({
        data: { available: true, provider: 'openai', text: 'Betriebsprüfung' },
      }),
    } as Response;
  });
  assert.equal(
    await fetchFunctionalTranslationHealth('/health/functional', '/translations'),
    true,
  );
  assert.equal(fallbackRequests[1]?.init?.method, 'POST');
  assert.equal(
    fallbackRequests[1]?.init?.body,
    JSON.stringify({
      text: 'Operational check',
      sourceLanguage: 'en',
      targetLanguage: 'de',
    }),
  );
} finally {
  setGlobal('navigator', originalNavigator);
  setGlobal('document', originalDocument);
  setGlobal('window', originalWindow);
  setGlobal('fetch', originalFetch);
}

for (const removedLocalFunction of [
  'async function copyPlainText(',
  'function fallbackCopy(',
  'async function fetchHealthEndpoint(',
  'async function fetchFunctionalTranslationHealth(',
  'function formatPreview(',
  'function formatInlinePreview(',
  'function escapeHtml(',
]) {
  assert.ok(!main.includes(removedLocalFunction), `Local helper still present: ${removedLocalFunction}`);
}

for (const preservedBoundary of [
  'function startTranslatorHealthChecks()',
  'async function refreshTranslatorHealth()',
  'function updateTranslatorHealth(',
  'function registerServiceWorker()',
]) {
  assert.ok(main.includes(preservedBoundary), `Protected boundary moved: ${preservedBoundary}`);
}

console.log('SR-04 low-risk extraction parity: PASS');

function createFallbackDocument() {
  let value = '';
  const area = {
    value: '',
    style: { position: '', opacity: '' },
    setAttribute: () => undefined,
    select: () => {
      value = area.value;
    },
  };
  return {
    copied: () => value,
    document: {
      createElement: () => area,
      body: {
        appendChild: () => undefined,
        removeChild: () => undefined,
      },
      execCommand: (command: string) => command === 'copy',
    },
  };
}

function setGlobal(name: 'navigator' | 'document' | 'window' | 'fetch', value: unknown) {
  Object.defineProperty(globalThis, name, {
    configurable: true,
    writable: true,
    value,
  });
}
