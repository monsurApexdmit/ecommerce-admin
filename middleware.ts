import { NextRequest, NextResponse } from "next/server"

// Routes that don't require authentication
const publicRoutes = [
  "/",
  "/auth/login",
  "/auth/signup",
  "/auth/forgot-password",
  "/auth/reset-password",
]

// Routes accessible only by owner or admin
const OWNER_ADMIN_ONLY = [
  "/dashboard/billing",
  "/dashboard/team",
  "/dashboard/staff/roles",
  "/dashboard/company",
]

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Public routes — no auth needed
  const isPublicRoute = publicRoutes.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  )
  if (isPublicRoute) {
    return NextResponse.next()
  }

  // Get token from cookies
  const token = request.cookies.get("token")?.value

  // Protected routes — must have token
  if (pathname.startsWith("/dashboard") && !token) {
    return NextResponse.redirect(new URL("/auth/login", request.url))
  }

  // Owner/admin-only routes — check user_role cookie
  if (token && OWNER_ADMIN_ONLY.some((path) => pathname.startsWith(path))) {
    const userRole = request.cookies.get("user_role")?.value ?? ""
    if (!["owner", "admin"].includes(userRole)) {
      return NextResponse.redirect(new URL("/dashboard", request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|public).*)",
  ],
}
