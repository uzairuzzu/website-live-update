export { auth as middleware } from "@/lib/auth"

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/websites/:path*",
    "/analytics/:path*",
    "/reports/:path*",
    "/notifications/:path*",
    "/settings/:path*",
    "/profile/:path*",
    "/billing/:path*",
    "/api/websites/:path*",
    "/api/checks/:path*",
    "/api/incidents/:path*",
    "/api/analytics/:path*",
  ],
}
