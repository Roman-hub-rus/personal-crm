"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header>
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-5 py-4.5 lg:py-6">
        <Link href="/" className="font-display text-[15px] font-semibold hover:opacity-88 lg:text-lg">
          Личная CRM
        </Link>
        <Link
          href="/groups"
          aria-current={pathname === "/groups" ? "page" : undefined}
          className="text-sm font-medium text-muted-foreground hover:text-foreground aria-[current=page]:text-foreground"
        >
          Группы
        </Link>
      </div>
    </header>
  );
}
