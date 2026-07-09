/** Renders a plain object as a TypeScript literal (no nested objects). */
export function objectLiteral(value: Record<string, string>): string {
  const entries = Object.entries(value);
  if (entries.length === 0) {
    return '{}';
  }
  return (
    '{ ' +
    entries.map(([key, val]) => `${JSON.stringify(key)}: ${JSON.stringify(val)}`).join(', ') +
    ' }'
  );
}