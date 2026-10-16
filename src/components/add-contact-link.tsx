import { PlusIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Main call to action, drawn like the landing page button: a lime pill with the icon in a dark circle.
// iconOnlyOnMobile: on narrow screens only the circle is visible, the label stays for screen readers.
export function AddContactLink({
  children,
  iconOnlyOnMobile,
  className,
}: {
  children: ReactNode;
  iconOnlyOnMobile?: boolean;
  className?: string;
}) {
  return (
    <Button asChild size="cta" className={cn(iconOnlyOnMobile && "max-sm:p-1.5", className)}>
      <Link href="/contacts/new">
        <span className={cn(iconOnlyOnMobile && "max-sm:sr-only")}>{children}</span>
        <span aria-hidden className="flex size-9 items-center justify-center rounded-full bg-background text-primary">
          <PlusIcon className="size-4.5" strokeWidth={2.5} />
        </span>
      </Link>
    </Button>
  );
}
