import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";

/** Constant-time string comparison that is safe against length leaks. */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/** Extracts a bearer token from the Authorization header, or "" if absent. */
function bearer(request: Request): string {
  const header = request.headers.get("authorization") || "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() : "";
}

/**
 * Guards an admin-only endpoint (reset, global API-key updates).
 *
 * Returns a `NextResponse` to short-circuit the handler when the caller is not
 * authorized, or `null` when the request may proceed.
 *
 * Behaviour:
 * - `ADMIN_TOKEN` set  → require `Authorization: Bearer <ADMIN_TOKEN>`.
 * - `ADMIN_TOKEN` unset in production → deny (503) so destructive routes are
 *   never open by default on a real deployment.
 * - `ADMIN_TOKEN` unset in development → allow, to keep local DX friction-free.
 */
export function requireAdmin(request: Request): NextResponse | null {
  const token = process.env.ADMIN_TOKEN;
  if (!token) {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { error: "Admin auth is not configured. Set ADMIN_TOKEN to enable this endpoint." },
        { status: 503 }
      );
    }
    return null; // dev convenience
  }
  const provided = bearer(request);
  if (!provided || !safeEqual(provided, token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

/**
 * Guards the cron tick endpoint. Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`.
 *
 * - `CRON_SECRET` set   → require the matching bearer token.
 * - `CRON_SECRET` unset → allow (so local/manual ticks keep working); a warning is
 *   the operator's cue to configure it in production.
 */
export function requireCron(request: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      console.warn("[requireCron] CRON_SECRET is not set — the tick endpoint is unauthenticated.");
    }
    return null;
  }
  const provided = bearer(request);
  if (!provided || !safeEqual(provided, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
