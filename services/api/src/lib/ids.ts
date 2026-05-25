/** UUID v4 string (Postgres / Supabase ids). */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuidString(id: string): boolean {
  return typeof id === "string" && UUID_RE.test(id);
}
