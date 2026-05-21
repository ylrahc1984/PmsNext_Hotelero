export function asArray<T>(response: T[] | { datos?: T[]; data?: T[]; items?: T[] } | null | undefined): T[] {
  if (Array.isArray(response)) {
    return response;
  }

  return response?.datos ?? response?.data ?? response?.items ?? [];
}

export function readValue(record: Record<string, unknown> | null | undefined, keys: string[], fallback: unknown = ''): unknown {
  if (!record) {
    return fallback;
  }

  for (const key of keys) {
    const value = record[key];
    if (value !== null && value !== undefined && String(value).trim() !== '') {
      return value;
    }
  }

  return fallback;
}

export function readText(record: Record<string, unknown> | null | undefined, keys: string[], fallback = 'N/D'): string {
  return String(readValue(record, keys, fallback));
}

export function readNumber(record: Record<string, unknown> | null | undefined, keys: string[], fallback = 0): number {
  const value = Number(readValue(record, keys, fallback));
  return Number.isFinite(value) ? value : fallback;
}

export function readBoolean(record: Record<string, unknown> | null | undefined, keys: string[], fallback = false): boolean {
  const value = readValue(record, keys, fallback);
  if (typeof value === 'boolean') {
    return value;
  }
  return ['true', '1', 'si', 's', 'activo'].includes(String(value).toLowerCase());
}
