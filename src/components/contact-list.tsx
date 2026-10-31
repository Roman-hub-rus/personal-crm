"use client";

import Link from "next/link";
import { useEffect } from "react";

import { ContactAvatar } from "@/components/contact-avatar";
import { HighlightedText } from "@/components/highlighted-text";
import { Badge } from "@/components/ui/badge";
import { contactHref, splitGroupLabels } from "@/lib/contact-groups";
import type { ContactListItem } from "@/lib/contacts";
import { searchWords } from "@/lib/search";
import { cn } from "@/lib/utils";

// Rendered as a client component on purpose: the server sends only the data,
// which keeps the page small even with thousands of contacts.

type ContactListProps = {
  items: ContactListItem[];
  query: string;
  groupId: number | null;
  addedId: number | null;
};

function groupByFirstLetter(items: ContactListItem[]) {
  const groups: { letter: string; items: ContactListItem[] }[] = [];
  for (const item of items) {
    const letter = item.name.trim().charAt(0).toUpperCase() || "#";
    const last = groups[groups.length - 1];
    if (last?.letter === letter) {
      last.items.push(item);
    } else {
      groups.push({ letter, items: [item] });
    }
  }
  return groups;
}

export function ContactList({ items, query, groupId, addedId }: ContactListProps) {
  const words = searchWords(query);

  // Bring a just-added contact into view.
  useEffect(() => {
    if (addedId !== null) {
      document.getElementById(`contact-${addedId}`)?.scrollIntoView({ block: "center" });
    }
  }, [addedId]);

  return (
    <div className="pt-2">
      {groupByFirstLetter(items).map((group) => (
        <section key={group.letter} aria-label={`На букву ${group.letter}`}>
          <h2 className="px-3 pt-5 pb-1.5 font-mono text-xs tracking-eyebrow text-faint uppercase">
            {group.letter}
          </h2>
          <ul>
            {group.items.map((contact) => (
              <ContactRow
                key={contact.id}
                contact={contact}
                href={contactHref(contact.id, { query, groupId })}
                words={words}
                isNew={contact.id === addedId}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function ContactRow({
  contact,
  href,
  words,
  isNew,
}: {
  contact: ContactListItem;
  href: string;
  words: string[];
  isNew: boolean;
}) {
  const { shown, hiddenCount } = splitGroupLabels(contact.groups);

  return (
    <li id={`contact-${contact.id}`}>
      <Link
        href={href}
        prefetch={false}
        data-testid="contact-row"
        className={cn(
          "flex items-center gap-3 rounded-2xl border border-transparent px-3 py-2.5 outline-none hover:bg-card focus-visible:ring-2 focus-visible:ring-ring",
          isNew && "border-primary/50 bg-card",
        )}
      >
        <ContactAvatar name={contact.name} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium">
              <HighlightedText text={contact.name} words={words} />
            </span>
            {isNew && <Badge>Новый</Badge>}
          </div>
          {contact.about && <p className="truncate text-sm text-muted-foreground">{contact.about}</p>}
          {shown.length > 0 && (
            <div className="mt-1 flex items-center gap-1 overflow-hidden whitespace-nowrap">
              {shown.map((name) => (
                <Badge key={name} variant="secondary" className="shrink-0">
                  {name}
                </Badge>
              ))}
              {hiddenCount > 0 && (
                <Badge variant="secondary" className="shrink-0">
                  +{hiddenCount}
                </Badge>
              )}
            </div>
          )}
        </div>
        <div className="hidden shrink-0 font-mono text-[13px] text-muted-foreground sm:block">
          {contact.phone ?? contact.email}
        </div>
      </Link>
    </li>
  );
}
