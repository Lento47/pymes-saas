export function parseJsonValue<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;

  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }

  return value as T;
}

export function stringifyJson(value: unknown): string {
  return JSON.stringify(value ?? null);
}
