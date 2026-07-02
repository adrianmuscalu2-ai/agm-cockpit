import { randomUUID } from 'crypto';

export function requestIdFromHeader(value: unknown): string {
  return typeof value === 'string' && value.length > 0 ? value : randomUUID();
}
