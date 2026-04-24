export function parseJsonValue<T>(value: string | null | undefined, fallback: T): T {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function parseJsonRecord(value: string | null | undefined): Record<string, any> {
  return parseJsonValue<Record<string, any>>(value, {});
}

export function parseJsonStringArray(value: string | null | undefined): string[] {
  const parsed = parseJsonValue<unknown>(value, []);
  return Array.isArray(parsed) ? parsed.map((item) => String(item)) : [];
}

export function serializeJson(value: unknown): string | null {
  if (value === undefined) {
    return null;
  }

  return JSON.stringify(value ?? null);
}
