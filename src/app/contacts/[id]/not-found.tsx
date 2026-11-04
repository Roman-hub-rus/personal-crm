import { UserRoundXIcon } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

// The same page for a contact that does not exist and for a contact of another user:
// by the page it is impossible to tell that someone else has such a contact.
export default function ContactNotFound() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col items-center gap-3 px-5 py-20 text-center">
      <UserRoundXIcon aria-hidden className="size-10 text-faint" />
      <h1 className="font-display text-lg font-semibold">Контакт не найден</h1>
      <Button asChild size="lg" className="mt-3">
        <Link href="/">Ко всем контактам</Link>
      </Button>
    </main>
  );
}
