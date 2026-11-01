/** Remove API keys from anything that might be logged or shown. */
export function scrub(value: string): string {
  return value
    .replace(/key=[^&\s"'<>]+/gi, "key=[REDACTED]")
    .replace(/AIza[0-9A-Za-z\-_]{20,}/g, "[REDACTED]");
}
