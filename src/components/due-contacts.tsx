import Link from "next/link";

import { ContactAvatar } from "@/components/contact-avatar";
import { MarkContactedButton } from "@/components/mark-contacted-button";
import { Badge } from "@/components/ui/badge";
import { FREQUENCY_INLINE_LABELS } from "@/lib/contact-frequency";
import type { DueContact } from "@/lib/contacts";
import { formatElapsed } from "@/lib/format";

// "Пора связаться" above the contact list. On a phone the "Связались" button sits under the name,
// on a wider screen to the right of the row.
export function DueContacts({ items }: { items: DueContact[] }) {
  const now = new Date();

  return (
    <section
      aria-labelledby="due-contacts-title"
      className="-mx-2 mt-4 rounded-2xl border bg-card p-1.5 sm:mx-0 sm:mt-5 sm:p-2"
    >
      <div className="flex items-center gap-2.5 px-3 pt-2.5 pb-1 sm:pb-1.5">
        <h2 id="due-contacts-title" className="font-display text-base font-semibold tracking-[-0.01em] sm:text-[17px]">
          Пора связаться
        </h2>
        <Badge className="min-w-5">{items.length}</Badge>
      </div>
      <ul className="divide-y sm:divide-y-0">
        {items.map((item) => (
          <li
            key={item.id}
            data-testid="due-contact-row"
            className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:gap-2 sm:p-0 sm:pr-2"
          >
            <Link
              href={`/contacts/${item.id}`}
              prefetch={false}
              className="flex items-center gap-3 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-w-0 sm:flex-1 sm:px-3 sm:py-2.5 sm:hover:bg-secondary"
            >
              <ContactAvatar name={item.name} />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5 sm:gap-0">
                <span className="truncate font-medium">{item.name}</span>
                <span className="text-sm leading-[1.35] sm:truncate sm:leading-normal">
                  <span className="text-ink-2">{lastContactText(item, now)}</span>
                  <span className="text-muted-foreground"> · {FREQUENCY_INLINE_LABELS[item.frequency]}</span>
                </span>
              </span>
            </Link>
            <MarkContactedButton
              contactId={item.id}
              name={item.name}
              className="ml-13 h-11 self-start px-4 text-[15px] sm:ml-0 sm:h-9 sm:self-auto sm:px-3.5 sm:text-sm"
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

function lastContactText(item: DueContact, now: Date): string {
  if (item.lastContactAt) return `Последнее общение ${formatElapsed(item.lastContactAt, now)} назад`;
  // No contact since the frequency was chosen: the period runs from that moment.
  return `Не общались уже ${formatElapsed(item.frequencySetAt ?? now, now)}`;
}
