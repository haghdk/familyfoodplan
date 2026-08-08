import { NextRequest, NextResponse } from "next/server";
import { adminSessionCookieName, userRoleCookieName } from "./lib/auth";

const PUBLIC_PATHS = ["/login", "/grocery", "/forgot-password", "/reset-password"];
// Dishes and the pantry are everyday household screens rather than management
// ones, so viewers reach them too; what a viewer cannot do there (the pantry
// CSV import) is guarded on its own rather than by hiding the whole screen.
const ADMIN_ONLY_PATHS = ["/members", "/users", "/plan/new"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublicPath = PUBLIC_PATHS.some((path) => pathname.startsWith(path));
  const hasSession = Boolean(request.cookies.get(adminSessionCookieName)?.value);
  const isAdmin = request.cookies.get(userRoleCookieName)?.value === "ADMIN";

  if (!hasSession && !isPublicPath) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (hasSession && pathname === "/login") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (hasSession && !isAdmin && ADMIN_ONLY_PATHS.some((path) => pathname.startsWith(path))) {
    return NextResponse.redirect(new URL("/plan", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Icons and the web app manifest must stay reachable without a session so
    // phones can fetch them when the app is saved to the home screen. The push
    // service worker must never be redirected either: the browser refuses to
    // register a worker that answers with anything but the script itself.
    "/((?!api|_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png|icons/|manifest.webmanifest|sw.js).*)"
  ]
};
