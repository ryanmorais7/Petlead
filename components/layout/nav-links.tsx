"use client";

import { Inbox, LayoutDashboard, Users, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; icon: LucideIcon };

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Hoje", icon: LayoutDashboard },
  { href: "/inbox", label: "Conversas", icon: Inbox },
  { href: "/leads", label: "Leads", icon: Users },
];

function isActive(pathname: string | null, href: string): boolean {
  if (pathname === null) return false;
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

/** Vertical navigation of the desktop sidebar. */
export function SidebarLinks({ pathname }: { pathname: string | null }) {
  return (
    <ul className="space-y-1">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <li key={href}>
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-brand-50 text-brand-800"
                  : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900",
              )}
            >
              <Icon className={cn("size-4.5", active ? "text-brand-600" : "text-zinc-400")} aria-hidden />
              {label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Bottom tab bar used on phones. */
export function TabBarLinks({ pathname }: { pathname: string | null }) {
  return (
    <ul className="grid h-16 grid-cols-3">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <li key={href}>
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-full flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
                active ? "text-brand-700" : "text-zinc-500",
              )}
            >
              <Icon className="size-5" aria-hidden />
              {label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function ActiveSidebarLinks() {
  return <SidebarLinks pathname={usePathname()} />;
}

export function ActiveTabBarLinks() {
  return <TabBarLinks pathname={usePathname()} />;
}
