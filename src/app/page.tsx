import { PlusIcon, SearchXIcon, UsersRoundIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { ContactList } from "@/components/contact-list";
import { ContactSearch } from "@/components/contact-search";
import { Button } from "@/components/ui/button";
import { countContacts, listContacts } from "@/lib/contacts";
import { formatContactsCount } from "@/lib/format";
import { MAX_SEARCH_LENGTH } from "@/lib/search";

export const metadata: Metadata = { title: "Контакты" };

function firstParam(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

export default async function ContactsPage({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const query = firstParam(params.q).trim().slice(0, MAX_SEARCH_LENGTH);
  const addedId = Number(firstParam(params.added)) || null;

  const [items, total] = await Promise.all([listContacts(query), countContacts()]);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-16">
      <div className="sticky top-0 z-10 -mx-4 border-b bg-background/90 px-4 pt-6 pb-4 backdrop-blur supports-[backdrop-filter]:bg-background/75">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Контакты</h1>
            <p className="text-sm text-muted-foreground" data-testid="contacts-total">
              {formatContactsCount(total)}
            </p>
          </div>
          <Button asChild size="lg">
            <Link href="/contacts/new">
              <PlusIcon />
              Добавить контакт
            </Link>
          </Button>
        </div>
        {total > 0 && <ContactSearch initialQuery={query} className="mt-4" />}
        {query && items.length > 0 && (
          <p className="mt-2 text-sm text-muted-foreground" aria-live="polite">
            Найдено: {formatContactsCount(items.length)} из {total.toLocaleString("ru-RU")}
          </p>
        )}
      </div>

      {total === 0 ? (
        <EmptyState />
      ) : items.length === 0 ? (
        <NothingFound query={query} />
      ) : (
        <ContactList items={items} query={query} addedId={addedId} />
      )}
    </main>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 py-20 text-center">
      <UsersRoundIcon aria-hidden className="size-10 text-muted-foreground" />
      <p className="text-lg font-medium">Пока нет ни одного контакта</p>
      <p className="max-w-sm text-sm text-muted-foreground">
        Добавьте первого человека — кто это, откуда знакомы и о чём договорились.
      </p>
      <Button asChild size="lg" className="mt-2">
        <Link href="/contacts/new">
          <PlusIcon />
          Добавить первый контакт
        </Link>
      </Button>
    </div>
  );
}

function NothingFound({ query }: { query: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-20 text-center">
      <SearchXIcon aria-hidden className="size-10 text-muted-foreground" />
      <p className="text-lg font-medium">Никого не нашли по запросу «{query}»</p>
      <p className="text-sm text-muted-foreground">Проверьте написание или добавьте нового человека.</p>
      <Button asChild variant="outline" size="lg" className="mt-2">
        <Link href={`/contacts/new?${new URLSearchParams({ name: query })}`}>
          <PlusIcon />
          Добавить «{query}»
        </Link>
      </Button>
    </div>
  );
}
