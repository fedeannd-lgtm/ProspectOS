import { UserButton } from "@clerk/nextjs"
import { AppSidebar } from "@/components/app-sidebar"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { ThemeToggle } from "@/components/theme-toggle"
import { getPendingCount } from "./inbox/actions"

const devBypass =
  process.env.NODE_ENV === "development" &&
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY === "pk_test_xxx"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const inboxCount = await getPendingCount().catch(() => 0)
  return (
    <SidebarProvider>
      <AppSidebar inboxCount={inboxCount} />
      <SidebarInset>
        <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            {!devBypass && <UserButton />}
          </div>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}
