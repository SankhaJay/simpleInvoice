"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, LogOut, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useLogout } from "@/hooks/use-session";
import type { SessionUser } from "@/types/session";

const NAV = [{ href: "/invoices", label: "Invoices" }];

/** First letters of the first two name parts, e.g. "James Vand" → "JV". */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0]![0]! + (parts[1]?.[0] ?? "")).toUpperCase();
}

export function AppHeader({ user }: { user: SessionUser }) {
  const pathname = usePathname();
  const logout = useLogout();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4">
        <div className="flex items-center gap-6">
          <Link href="/invoices" className="flex items-center gap-2 font-semibold">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <FileText className="h-4 w-4" />
            </span>
            <span className="hidden sm:inline">SimpleInvoice</span>
          </Link>
          <nav className="flex items-center gap-1" aria-label="Primary">
            {NAV.map((item) => {
              const active =
                item.href === "/invoices"
                  ? pathname === "/invoices"
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/profile"
            aria-current={pathname === "/profile" ? "page" : undefined}
            title="View profile"
            className={cn(
              "flex items-center gap-2 rounded-full py-1 pl-1 pr-2 transition-colors hover:bg-accent",
              pathname === "/profile" && "bg-accent",
            )}
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
              {initials(user.fullName || `${user.firstName} ${user.lastName}`)}
            </span>
            <span className="hidden text-right md:block">
              <span className="block text-sm font-medium leading-tight">{user.fullName || "User"}</span>
              <span className="block text-xs leading-tight text-muted-foreground">
                {user.organisationName}
              </span>
            </span>
          </Link>
          <Button
            variant="outline"
            size="sm"
            onClick={() => logout.mutate()}
            disabled={logout.isPending}
            aria-label="Sign out"
          >
            {logout.isPending ? <Loader2 className="animate-spin" /> : <LogOut />}
            <span className="hidden sm:inline">Sign out</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
