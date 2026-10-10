import { UsersRoundIcon } from "lucide-react";
import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="border-b">
      <div className="mx-auto flex h-12 w-full max-w-3xl items-center px-4">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-semibold tracking-tight hover:opacity-80"
        >
          <UsersRoundIcon aria-hidden className="size-4" />
          Личная CRM
        </Link>
      </div>
    </header>
  );
}
