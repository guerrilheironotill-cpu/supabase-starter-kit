import { hasCookieConsent } from "@/lib/cookie-consent";

export type MetaEventName = "ViewContent" | "AddToCart" | "Lead";

type MetaEvent = { name: MetaEventName; parameters: Record<string, unknown> };
const pendingEvents: MetaEvent[] = [];

type MetaWindow = Window & { fbq?: (...args: unknown[]) => void };

export function trackMetaEvent(name: MetaEventName, parameters: Record<string, unknown> = {}) {
  if (typeof window === "undefined" || !hasCookieConsent("marketing")) return;
  const fbq = (window as MetaWindow).fbq;
  if (fbq) fbq("track", name, parameters);
  else pendingEvents.push({ name, parameters });
}

export function flushPendingMetaEvents() {
  if (typeof window === "undefined" || !hasCookieConsent("marketing")) return;
  const fbq = (window as MetaWindow).fbq;
  if (!fbq) return;
  for (const event of pendingEvents.splice(0)) fbq("track", event.name, event.parameters);
}
