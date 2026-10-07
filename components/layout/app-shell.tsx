import { PawPrint } from "lucide-react";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";

import { LogoutButton } from "@/components/auth/logout-button";

import {
  ActiveSidebarLinks,
  ActiveTabBarLinks,
  SidebarLinks,
  TabBarLinks,
} from "./nav-links";

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2.5 rounded-lg px-1 py-1">
      <span className="flex size-8 items-center justify-center rounded-lg bg-brand-600 text-white">
        <PawPrint className="size-4.5" aria-hidden />
      </span>
      <span className="text-base font-semibold tracking-tight text-zinc-900">PetLead</span>
    </Link>
  );
}

/**
 * Application frame: sidebar on large screens, bottom tab bar on phones.
 * The current route is read inside Suspense so the frame itself stays static.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-zinc-200 bg-white lg:flex">
        <div className="flex h-16 items-center px-4">
          <Brand />
        </div>
        <nav aria-label="Principal" className="flex-1 px-3 py-2">
          <Suspense fallback={<SidebarLinks pathname={null} />}>
            <ActiveSidebarLinks />
          </Suspense>
        </nav>
        <div className="border-t border-zinc-100 px-4 py-3">
          <p className="text-xs leading-relaxed text-zinc-500">
            Nenhuma mensagem é enviada sem a sua aprovação.
          </p>
          <LogoutButton className="mt-2 -ml-2" />
        </div>
      </aside>

      <main className="pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0 lg:pl-60">{children}</main>

      <nav
        aria-label="Principal"
        className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-zinc-200 bg-white/95 backdrop-blur lg:hidden"
      >
        <Suspense fallback={<TabBarLinks pathname={null} />}>
          <ActiveTabBarLinks />
        </Suspense>
      </nav>
    </div>
  );
}
