import { Capacitor, registerPlugin } from '@capacitor/core';
import { DeviceCapabilityRouter } from './device-capability.router';
import type { DeviceCapabilitySnapshot, RoutingDecision, RoutingMetric, RoutingRequest } from './device-capability.types';

const CACHE_KEY = 'agm.device-capabilities.v1';
const METRICS_KEY = 'agm.device-router.metrics.v1';
const CACHE_TTL_MS = 5 * 60 * 1000;

type NativeSnapshot = {
  sdkInt: number;
  online: boolean;
  speechRecognition: boolean;
  onDeviceSpeechRecognition: boolean;
  textToSpeech: boolean;
  camera: boolean;
  shareText: boolean;
  processText: boolean;
  translateText: boolean;
  assist: boolean;
  voiceSettings: boolean;
};

interface AgmCapabilityPlugin {
  getCapabilities(): Promise<NativeSnapshot>;
}

const nativeCapability = registerPlugin<AgmCapabilityPlugin>('AgmCapability');
const router = new DeviceCapabilityRouter();
let memorySnapshot: DeviceCapabilitySnapshot | undefined;
let lastCapabilityLookup = { latencyMs: 0, cacheHit: false };
let invalidationListenersInstalled = false;

function storage(): Storage | undefined {
  try { return globalThis.sessionStorage; } catch { return undefined; }
}

function browserSnapshot(now = Date.now()): DeviceCapabilitySnapshot {
  return {
    schemaVersion: 1,
    platform: 'web',
    capturedAtEpochMs: now,
    expiresAtEpochMs: now + CACHE_TTL_MS,
    online: typeof navigator === 'undefined' ? true : navigator.onLine,
    capabilities: {
      speechRecognition: false,
      onDeviceSpeechRecognition: false,
      textToSpeech: typeof window !== 'undefined' && Boolean(window.speechSynthesis),
      camera: typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices),
      localWebOcr: true,
      shareText: false,
      processText: false,
      translateText: false,
      assist: false,
      voiceSettings: false,
    },
  };
}

function readCachedSnapshot(now = Date.now()) {
  if (memorySnapshot && memorySnapshot.expiresAtEpochMs > now) return memorySnapshot;
  try {
    const value = JSON.parse(storage()?.getItem(CACHE_KEY) ?? 'null') as DeviceCapabilitySnapshot | null;
    if (value?.schemaVersion === 1 && value.expiresAtEpochMs > now && value.platform === (Capacitor.getPlatform() === 'android' ? 'android' : 'web')) {
      memorySnapshot = value;
      return value;
    }
  } catch {}
  return undefined;
}

function writeSnapshot(snapshot: DeviceCapabilitySnapshot) {
  memorySnapshot = snapshot;
  try { storage()?.setItem(CACHE_KEY, JSON.stringify(snapshot)); } catch {}
  return snapshot;
}

export async function getDeviceCapabilitySnapshot(options: { forceRefresh?: boolean } = {}) {
  const startedAt = performance.now();
  const now = Date.now();
  if (!options.forceRefresh) {
    const cached = readCachedSnapshot(now);
    if (cached) {
      lastCapabilityLookup = { latencyMs: performance.now() - startedAt, cacheHit: true };
      return cached;
    }
  }
  if (Capacitor.getPlatform() !== 'android') {
    const snapshot = writeSnapshot(browserSnapshot(now));
    lastCapabilityLookup = { latencyMs: performance.now() - startedAt, cacheHit: false };
    return snapshot;
  }
  try {
    const native = await nativeCapability.getCapabilities();
    const snapshot = writeSnapshot({
      schemaVersion: 1,
      platform: 'android',
      capturedAtEpochMs: now,
      expiresAtEpochMs: now + CACHE_TTL_MS,
      sdkInt: native.sdkInt,
      online: native.online,
      capabilities: {
        speechRecognition: native.speechRecognition,
        onDeviceSpeechRecognition: native.onDeviceSpeechRecognition,
        textToSpeech: native.textToSpeech,
        camera: native.camera,
        localWebOcr: true,
        shareText: native.shareText,
        processText: native.processText,
        translateText: native.translateText,
        assist: native.assist,
        voiceSettings: native.voiceSettings,
      },
    });
    lastCapabilityLookup = { latencyMs: performance.now() - startedAt, cacheHit: false };
    return snapshot;
  } catch {
    const fallback = browserSnapshot(now);
    fallback.platform = 'android';
    fallback.capabilities.textToSpeech = false;
    fallback.capabilities.camera = false;
    fallback.capabilities.localWebOcr = false;
    const snapshot = writeSnapshot(fallback);
    lastCapabilityLookup = { latencyMs: performance.now() - startedAt, cacheHit: false };
    return snapshot;
  }
}

export function invalidateDeviceCapabilityCache() {
  memorySnapshot = undefined;
  try { storage()?.removeItem(CACHE_KEY); } catch {}
}

function installCapabilityInvalidationListeners() {
  if (invalidationListenersInstalled || typeof window === 'undefined') return;
  invalidationListenersInstalled = true;
  window.addEventListener('online', invalidateDeviceCapabilityCache);
  window.addEventListener('offline', invalidateDeviceCapabilityCache);
  window.addEventListener('agm-native-resume', invalidateDeviceCapabilityCache);
}

installCapabilityInvalidationListeners();

export async function routeDeviceOperation(request: RoutingRequest): Promise<RoutingDecision> {
  const snapshot = await getDeviceCapabilitySnapshot();
  const decision = router.route(request, snapshot);
  recordRoutingMetric({
    operation: decision.operation,
    authority: decision.authority,
    executionMode: decision.executionMode,
    decisionLatencyMs: decision.decisionLatencyMs,
    capabilityLookupLatencyMs: Math.round(lastCapabilityLookup.latencyMs * 1000) / 1000,
    capabilityCacheHit: lastCapabilityLookup.cacheHit,
    atEpochMs: Date.now(),
  });
  return decision;
}

export function recordRoutingMetric(metric: RoutingMetric) {
  try {
    const current = JSON.parse(storage()?.getItem(METRICS_KEY) ?? '[]');
    const rows: RoutingMetric[] = Array.isArray(current) ? current : [];
    rows.push(metric);
    storage()?.setItem(METRICS_KEY, JSON.stringify(rows.slice(-100)));
  } catch {}
}

export function readRoutingMetrics(): RoutingMetric[] {
  try {
    const rows = JSON.parse(storage()?.getItem(METRICS_KEY) ?? '[]');
    return Array.isArray(rows) ? rows : [];
  } catch { return []; }
}
