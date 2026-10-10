import { UserRoundXIcon } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col items-center gap-3 px-4 py-20 text-center">
      <UserRoundXIcon aria-hidden className="size-10 text-muted-foreground" />
      <h1 className="text-lg font-medium">Такой страницы нет</h1>
      <p className="text-sm text-muted-foreground">Возможно, ссылка устарела или в ней опечатка.</p>
      <Button asChild size="lg" className="mt-2">
        <Link href="/">Ко всем контактам</Link>
      </Button>
    </main>
  );
}
