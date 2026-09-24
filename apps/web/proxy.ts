import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";

// Optimistic check: no session cookie means straight to /login. Real validation happens
// on the server in requireOperator().
export function proxy(request: NextRequest) {
  if (!getSessionCookie(request)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  // Everything except the login page, Better Auth's endpoints, static files, /render
  // (internal render pages: they check RENDER_TOKEN, and Caddy blocks them in production) and
  // /media (public files with unguessable names, loaded by the render pages).
  matcher: ["/((?!login|api/auth|render|media|_next/static|_next/image|favicon.ico).*)"],
};
