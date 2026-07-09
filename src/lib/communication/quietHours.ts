/**
 * Quiet hours for communication / in-app notification delivery (viewer's local timezone).
 */

function timeToMinutes(t: string | null | undefined): number | null {
  if (t == null || typeof t !== "string") return null;
  const m = t.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

/**
 * Returns true when "now" falls inside [start, end) when both are on the same calendar day,
 * or inside the overnight window when start > end (e.g. 22:00–08:00).
 */
export function isWithinQuietHours(
  now: Date,
  startHHMM: string,
  endHHMM: string,
  enabled: boolean
): boolean {
  if (!enabled) return false;
  const start = timeToMinutes(startHHMM);
  const end = timeToMinutes(endHHMM);
  if (start == null || end == null) return false;

  const cur = now.getHours() * 60 + now.getMinutes();

  if (start === end) return false;

  if (start < end) {
    return cur >= start && cur < end;
  }

  return cur >= start || cur < end;
}
