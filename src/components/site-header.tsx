"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { signOut } from "@/app/login/actions";

// `email` is the signed-in user; without it (the sign-in page) only the name of the app is shown.
export function SiteHeader({ email }: { email: string | null }) {
  const pathname = usePathname();

  return (
    <header>
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-5 py-4.5 lg:py-6">
        <div className="flex shrink-0 items-center gap-4">
          <Link href="/" className="font-display text-[15px] font-semibold hover:opacity-88 lg:text-lg">
            Личная CRM
          </Link>
          {email && (
            <Link
              href="/groups"
              aria-current={pathname === "/groups" ? "page" : undefined}
              className="text-sm font-medium text-muted-foreground hover:text-foreground aria-[current=page]:text-foreground"
            >
              Группы
            </Link>
          )}
        </div>
        {email && (
          <div className="flex min-w-0 items-center gap-3">
            {/* A long address is cut with an ellipsis, so the header never grows wider than the screen. */}
            <span data-testid="user-email" title={email} className="min-w-0 truncate text-sm text-muted-foreground">
              {email}
            </span>
            <form action={signOut} className="shrink-0">
              <button type="submit" className="text-sm font-medium text-muted-foreground hover:text-foreground">
                Выйти
              </button>
            </form>
          </div>
        )}
      </div>
    </header>
  );
}
