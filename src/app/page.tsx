import { PlusIcon, SearchXIcon, UsersRoundIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { AddContactLink } from "@/components/add-contact-link";
import { ContactList } from "@/components/contact-list";
import { ContactSearch } from "@/components/contact-search";
import { DueContacts } from "@/components/due-contacts";
import { Button } from "@/components/ui/button";
import { groupFilterItems, parseGroupId, type GroupFilterItem } from "@/lib/contact-groups";
import { countContacts, listContacts, listDueContacts } from "@/lib/contacts";
import { formatContactsCount } from "@/lib/format";
import { listGroups } from "@/lib/groups";
import { MAX_SEARCH_LENGTH } from "@/lib/search";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Контакты" };

function firstParam(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

export default async function ContactsPage({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const query = firstParam(params.q).trim().slice(0, MAX_SEARCH_LENGTH);
  const addedId = Number(firstParam(params.added)) || null;
  const allGroups = await listGroups();
  const groupId = parseGroupId(firstParam(params.group), allGroups);
  const selectedGroup = groupId === null ? null : (allGroups.find((group) => group.id === groupId) ?? null);

  // "Пора связаться" is hidden while searching, so it is not even queried then.
  const [items, total, dueContacts] = await Promise.all([
    listContacts(query, groupId),
    countContacts(),
    query ? [] : listDueContacts(groupId),
  ]);

  const filterItems = groupFilterItems(allGroups, groupId, query);

  return (
    <main className="mx-auto w-full max-w-3xl px-5 pb-16">
      <div className="sticky top-0 z-10 -mx-5 border-b bg-background px-5 pt-4 pb-4 lg:pt-6">
        <div className="flex items-end justify-between gap-3">
          <div className="flex flex-col gap-2">
            <p className="font-mono text-xs tracking-eyebrow text-faint uppercase" data-testid="contacts-total">
              {formatContactsCount(total)}
            </p>
            <h1 className="font-display text-title font-semibold lg:text-title-lg">Контакты</h1>
          </div>
          <AddContactLink iconOnlyOnMobile>Добавить контакт</AddContactLink>
        </div>
        {total > 0 && <ContactSearch initialQuery={query} groupId={groupId} className="mt-5" />}
        {filterItems.length > 0 && <GroupFilterRow items={filterItems} />}
        {(query || groupId !== null) && items.length > 0 && (
          <p className="mt-3 px-1 text-sm text-muted-foreground" aria-live="polite">
            Найдено: {formatContactsCount(items.length)} из {total.toLocaleString("ru-RU")}
          </p>
        )}
      </div>

      {dueContacts.length > 0 && <DueContacts items={dueContacts} groupId={groupId} />}

      {total === 0 ? (
        <EmptyState />
      ) : items.length === 0 ? (
        <NothingFound query={query} groupName={selectedGroup?.name ?? null} />
      ) : (
        <ContactList items={items} query={query} groupId={groupId} addedId={addedId} />
      )}
    </main>
  );
}

function GroupFilterRow({ items }: { items: GroupFilterItem[] }) {
  return (
    <div className="-mx-5 mt-3 flex [scrollbar-width:none] gap-2 overflow-x-auto px-5 pb-1 whitespace-nowrap">
      {items.map((item) => (
        <Link
          key={item.id ?? "all"}
          href={item.href}
          aria-current={item.isSelected ? "true" : undefined}
          className={cn(
            "shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
            item.isSelected
              ? "border-primary bg-primary/10 text-primary"
              : "border-border text-muted-foreground hover:bg-card",
          )}
        >
          {item.name}
        </Link>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 py-20 text-center">
      <UsersRoundIcon aria-hidden className="size-10 text-faint" />
      <p className="font-display text-lg font-semibold text-balance">Пока нет ни одного контакта</p>
      <p className="max-w-sm text-pretty text-muted-foreground">
        Добавьте первого человека — кто это, откуда знакомы и о чём договорились.
      </p>
      <AddContactLink className="mt-3">Добавить первый контакт</AddContactLink>
    </div>
  );
}

function NothingFound({ query, groupName }: { query: string; groupName: string | null }) {
  if (!query && groupName !== null) {
    return (
      <div className="flex flex-col items-center gap-3 py-20 text-center">
        <UsersRoundIcon aria-hidden className="size-10 text-faint" />
        <p className="font-display text-lg font-semibold text-balance break-words">
          В группе «{groupName}» пока никого нет
        </p>
        <p className="max-w-sm text-pretty text-muted-foreground">
          Добавить человека в группу можно в его карточке, в поле «Группы»
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 py-20 text-center">
      <SearchXIcon aria-hidden className="size-10 text-faint" />
      <p className="font-display text-lg font-semibold text-balance break-words">
        {groupName !== null
          ? `Никого не нашли по запросу «${query}» в группе «${groupName}»`
          : `Никого не нашли по запросу «${query}»`}
      </p>
      <p className="text-muted-foreground">Проверьте написание или добавьте нового человека.</p>
      <Button asChild variant="outline" size="lg" className="mt-3">
        <Link href={`/contacts/new?${new URLSearchParams({ name: query })}`}>
          <PlusIcon />
          Добавить «{query}»
        </Link>
      </Button>
    </div>
  );
}
