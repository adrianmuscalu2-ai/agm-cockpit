export function responseEnvelope<T>(data: T, requestId?: string) {
  return {
    data,
    meta: {
      requestId,
      timestamp: new Date().toISOString(),
    },
  };
}
