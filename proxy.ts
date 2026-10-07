import { NextResponse, type NextRequest } from "next/server";

import { readAuthSecret, SESSION_COOKIE, verifySessionToken } from "@/lib/auth/token";

/**
 * First gate: visitors without a valid session only reach the sign-in screen.
 * Pages and actions check the session again before reading or changing data.
 */
export function proxy(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const signedIn = verifySessionToken(token, readAuthSecret()) !== null;

  if (!signedIn && request.nextUrl.pathname !== "/login") {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  // Everything except build assets, the icon, the setup diagnostics and the
  // WhatsApp webhook, which authenticates each request by its signature.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/health|api/whatsapp/webhook).*)"],
};
