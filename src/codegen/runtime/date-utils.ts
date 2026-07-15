/**
 * Generates the `date-utils.ts` runtime file.
 *
 * Emitted only when `runtime.dateTransformer` is enabled. Exports a single
 * `transformDates` function that recursively walks a parsed JSON body and
 * converts ISO-8601 date-time strings into `Date` instances.
 */
export function generateDateUtils(): string {
  return `/**
 * Recursively converts ISO-8601 date-time strings into Date instances.
 *
 * Walks arrays and plain objects. Values that are already Date instances,
 * or strings that do not match the ISO-8601 date-time pattern, are
 * returned unchanged. Invalid dates (e.g. from a matching string that
 * Date cannot parse) fall back to the original string.
 */
export function transformDates(body: unknown): unknown {
  if (body === null || body === undefined) {
    return body;
  }

  if (body instanceof Date) {
    return body;
  }

  if (typeof body === 'string') {
    if (ISO_DATE_TIME.test(body)) {
      const date = new Date(body);
      return Number.isNaN(date.getTime()) ? body : date;
    }
    return body;
  }

  if (Array.isArray(body)) {
    return body.map(transformDates);
  }

  if (typeof body === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
      result[key] = transformDates(value);
    }
    return result;
  }

  return body;
}

/**
 * Matches full ISO-8601 date-time strings with an optional time component,
 * optional fractional seconds, and a timezone designator (Z or ±HH:MM).
 *
 * Examples that match:
 *   2026-07-15T12:00:00Z
 *   2026-07-15T12:00:00.123Z
 *   2026-07-15T12:00:00+02:00
 *   2026-07-15T12:00:00
 *
 * Pure date-only strings (2026-07-15) are intentionally NOT matched to
 * avoid false positives on non-date string fields.
 */
const ISO_DATE_TIME =
  /^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d+)?(Z|[+-]\\d{2}:\\d{2})?$/;
`;
}