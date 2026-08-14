import { useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";

import {
  COOKIE_CONSENT_CHANGE_EVENT,
  readCookieConsent,
  type CookieConsent,
} from "@/lib/cookie-consent";

const GA_ID = import.meta.env.VITE_GA_MEASUREMENT_ID || "G-9M7JBYESBP";
const META_PIXEL_ID = import.meta.env.VITE_META_PIXEL_ID || "1095272798860693";
let gaConfigured = false;
let metaConfigured = false;

type TrackerWindow = Window & {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
  fbq?: ((...args: unknown[]) => void) & {
    callMethod?: (...args: unknown[]) => void;
    queue?: unknown[];
    loaded?: boolean;
    version?: string;
  };
  _fbq?: TrackerWindow["fbq"];
};

function loadScript(id: string, src: string) {
  if (document.getElementById(id)) return;
  const script = document.createElement("script");
  script.id = id;
  script.async = true;
  script.src = src;
  document.head.appendChild(script);
}

function loadAnalytics() {
  if (gaConfigured) return;
  gaConfigured = true;
  const trackerWindow = window as TrackerWindow;
  trackerWindow.dataLayer = trackerWindow.dataLayer ?? [];
  trackerWindow.gtag =
    trackerWindow.gtag ?? ((...args: unknown[]) => trackerWindow.dataLayer?.push(args));
  trackerWindow.gtag("js", new Date());
  trackerWindow.gtag("config", GA_ID, { anonymize_ip: true, send_page_view: false });
  loadScript(
    "arteno-ga4",
    `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`,
  );
}

function loadMetaPixel() {
  if (metaConfigured) return;
  metaConfigured = true;
  const trackerWindow = window as TrackerWindow;
  if (!trackerWindow.fbq) {
    const fbq = ((...args: unknown[]) => {
      if (fbq.callMethod) fbq.callMethod(...args);
      else fbq.queue?.push(args);
    }) as TrackerWindow["fbq"];
    if (!fbq) return;
    fbq.queue = [];
    fbq.loaded = true;
    fbq.version = "2.0";
    trackerWindow.fbq = fbq;
    trackerWindow._fbq = fbq;
  }
  trackerWindow.fbq?.("init", META_PIXEL_ID);
  loadScript("arteno-meta-pixel", "https://connect.facebook.net/pt_BR/fbevents.js");
}

function applyTrackers(consent: CookieConsent | null) {
  if (consent?.analytics) loadAnalytics();
  if (consent?.marketing) loadMetaPixel();
}

export function AnalyticsLoader() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  useEffect(() => {
    applyTrackers(readCookieConsent());
    const onChange = (event: Event) => {
      applyTrackers((event as CustomEvent<CookieConsent>).detail);
    };
    window.addEventListener(COOKIE_CONSENT_CHANGE_EVENT, onChange);
    return () => window.removeEventListener(COOKIE_CONSENT_CHANGE_EVENT, onChange);
  }, []);

  useEffect(() => {
    const consent = readCookieConsent();
    const trackerWindow = window as TrackerWindow;
    if (consent?.analytics) {
      loadAnalytics();
      trackerWindow.gtag?.("event", "page_view", {
        page_location: window.location.href,
        page_path: pathname,
        page_title: document.title,
      });
    }
    if (consent?.marketing) {
      loadMetaPixel();
      trackerWindow.fbq?.("track", "PageView");
    }
  }, [pathname]);

  return null;
}
