import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"

const isPublic = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks/(.*)",
  "/api/debug/(.*)",
  "/api/extension/(.*)",
])

const isSelectOrg = createRouteMatcher(["/select-org(.*)"])

export default clerkMiddleware(async (auth, req) => {
  if (isPublic(req)) return NextResponse.next()
  const { userId, orgId } = await auth()
  if (!userId) {
    const signInUrl = new URL("/sign-in", req.url)
    signInUrl.searchParams.set("redirect_url", req.url)
    return NextResponse.redirect(signInUrl)
  }
  // Redirect to org selector when authenticated but no active org
  if (!orgId && !isSelectOrg(req)) {
    return NextResponse.redirect(new URL("/select-org", req.url))
  }
})

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
}
