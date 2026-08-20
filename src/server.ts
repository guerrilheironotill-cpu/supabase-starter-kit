import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { canonicalHostRedirectFor, legacyRedirectFor } from "./lib/legacy-redirects";
import { renderMaintenancePage } from "./lib/maintenance-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

const HTML_NO_STORE =
  "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, s-maxage=0";

let serverEntryPromise: Promise<ServerEntry> | undefined;

const MAINTENANCE_COOKIE = "arteno_maintenance_preview";

function maintenanceResponse() {
  return new Response(renderMaintenancePage(), {
    status: 503,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": HTML_NO_STORE,
      "cdn-cache-control": "no-store",
      "retry-after": "3600",
      "x-robots-tag": "noindex, nofollow, noarchive",
    },
  });
}

function hasMaintenancePreview(request: Request) {
  const token = process.env.MAINTENANCE_BYPASS_TOKEN;
  if (!token) return false;
  return request.headers
    .get("cookie")
    ?.split(";")
    .some((part) => part.trim() === `${MAINTENANCE_COOKIE}=${encodeURIComponent(token)}`);
}

function maintenancePreviewRedirect(request: Request, url: URL) {
  const token = process.env.MAINTENANCE_BYPASS_TOKEN;
  const supplied = url.searchParams.get("preview");
  if (!token || !supplied || supplied !== token) return null;
  const cleanUrl = new URL(url);
  cleanUrl.searchParams.delete("preview");
  return new Response(null, {
    status: 302,
    headers: {
      location: cleanUrl.toString(),
      "set-cookie": `${MAINTENANCE_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=86400`,
      "cache-control": HTML_NO_STORE,
    },
  });
}

function shouldBypassMaintenance(request: Request, url: URL) {
  if (hasMaintenancePreview(request)) return true;
  if (request.method !== "GET" && request.method !== "HEAD") return true;
  return (
    url.pathname === "/health" ||
    url.pathname === "/health-cache" ||
    url.pathname.startsWith("/uploads/") ||
    url.pathname.startsWith("/assets/") ||
    url.pathname === "/favicon.png"
  );
}

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: noStoreHtmlHeaders({ "content-type": "text/html; charset=utf-8" }),
  });
}

function noStoreHtmlHeaders(init?: HeadersInit): Headers {
  const headers = new Headers(init);
  headers.set("cache-control", HTML_NO_STORE);
  headers.set("cdn-cache-control", "no-store");
  return headers;
}

function withNoStoreForHtml(response: Response): Response {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html")) return response;

  const headers = noStoreHtmlHeaders(response.headers);
  headers.set("strict-transport-security", "max-age=31536000; includeSubDomains");
  headers.set("x-content-type-options", "nosniff");
  headers.set("x-frame-options", "SAMEORIGIN");
  headers.set("referrer-policy", "strict-origin-when-cross-origin");
  headers.set("permissions-policy", "camera=(), microphone=(), geolocation=()");
  headers.set(
    "content-security-policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://connect.facebook.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob: https:; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' https: wss:; frame-src 'self' https:; media-src 'self' blob: https:; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'self'; form-action 'self' https://wa.me",
  );
  if (process.env.APP_ENV === "staging") {
    headers.set("x-robots-tag", "noindex, nofollow, noarchive");
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const requestUrl = new URL(request.url);
      if (process.env.MAINTENANCE_MODE === "true") {
        const previewRedirect = maintenancePreviewRedirect(request, requestUrl);
        if (previewRedirect) return previewRedirect;
        if (!shouldBypassMaintenance(request, requestUrl)) return maintenanceResponse();
      }
      const redirect = canonicalHostRedirectFor(requestUrl) ?? legacyRedirectFor(requestUrl);
      if (redirect) return Response.redirect(redirect, 301);
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return withNoStoreForHtml(await normalizeCatastrophicSsrResponse(response));
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: noStoreHtmlHeaders({ "content-type": "text/html; charset=utf-8" }),
      });
    }
  },
};
