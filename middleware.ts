import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"

const isPublic = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks/(.*)",
  "/api/debug/(.*)",
])

const devBypass = process.env.NODE_ENV === "development" &&
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY === "pk_test_xxx"

export default devBypass
  ? () => NextResponse.next()
  : clerkMiddleware(async (auth, req) => {
      if (isPublic(req)) return NextResponse.next()
      const { userId } = await auth()
      if (!userId) {
        const signInUrl = new URL("/sign-in", req.url)
        signInUrl.searchParams.set("redirect_url", req.url)
        return NextResponse.redirect(signInUrl)
      }
    })

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
}
