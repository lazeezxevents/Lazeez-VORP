/**
 * Pick one URL per message for rich preview (avoids fenced / inline code regions).
 */
export function extractPrimaryUrlForPreview(text: string): string | null {
  if (!text?.trim()) return null;
  let s = text.replace(/```[\s\S]*?```/g, " ");
  s = s.replace(/`[^`]+`/g, " ");
  const m = s.match(/\bhttps?:\/\/[^\s<>`[\]()]+/i);
  if (!m) return null;
  let url = m[0];
  while (/[.,;:!?)]+$/.test(url)) {
    const ch = url.slice(-1);
    if (ch === ")" && url.includes("(")) break;
    url = url.slice(0, -1);
  }
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.toString();
  } catch {
    return null;
  }
}

export function isCommunicationNotificationPayload(payload: {
  entity_type?: string | null;
  category?: string | null;
  action_url?: string | null;
  metadata?: Record<string, unknown> | null;
}): boolean {
  const et = (payload.entity_type || "").toLowerCase();
  const cat = (payload.category || "").toLowerCase();
  const url = (payload.action_url || "").toLowerCase();
  const meta = payload.metadata || {};
  if (et === "channel" || et === "direct_message" || et === "communication") return true;
  if (cat === "communication") return true;
  if (url.includes("/communication")) return true;
  if (typeof meta.channel_id === "string") return true;
  return false;
}

export function notificationChannelId(payload: {
  entity_id?: string | null;
  entity_type?: string | null;
  metadata?: Record<string, unknown> | null;
}): string | null {
  const meta = payload.metadata || {};
  if (typeof meta.channel_id === "string") return meta.channel_id;
  if ((payload.entity_type || "").toLowerCase() === "channel" && payload.entity_id)
    return payload.entity_id;
  return null;
}

export function isLikelyMentionNotification(payload: { title?: string | null; message?: string | null }): boolean {
  const t = `${payload.title || ""} ${payload.message || ""}`.toLowerCase();
  return (
    t.includes("mention") ||
    t.includes("@here") ||
    t.includes("@channel") ||
    /\bmentioned\b/.test(t)
  );
}
