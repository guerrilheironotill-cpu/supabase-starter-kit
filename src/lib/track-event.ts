import { hasCookieConsent } from "@/lib/cookie-consent";
import { trackMetaEvent } from "@/lib/meta-events";

type GtagWindow = Window & { gtag?: (...args: unknown[]) => void };

/** Sends a GA4 event when the visitor accepted analytics cookies. */
export function trackGaEvent(name: string, parameters: Record<string, unknown> = {}) {
  if (typeof window === "undefined" || !hasCookieConsent("analytics")) return;
  (window as GtagWindow).gtag?.("event", name, parameters);
}

/** A visitor clicked the WhatsApp button of an idea project. */
export function trackIdeaInterest(projectName: string) {
  trackGaEvent("idea_project_whatsapp_click", { project_name: projectName });
  trackMetaEvent("Lead", { content_name: projectName, content_category: "ideias" });
}
