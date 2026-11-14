import Link from "next/link";

import { ContactAvatar } from "@/components/contact-avatar";
import { Badge } from "@/components/ui/badge";
import { birthdayRowText, type UpcomingBirthday } from "@/lib/birthdays";
import { contactHref } from "@/lib/contact-groups";
import type { BirthdayContact } from "@/lib/contacts";

// "Скоро день рождения" above "Пора связаться": the same section, rows are links to the card.
export function UpcomingBirthdays({
  items,
  groupId,
}: {
  items: UpcomingBirthday<BirthdayContact>[];
  groupId: number | null;
}) {
  return (
    <section
      aria-labelledby="upcoming-birthdays-title"
      className="-mx-2 mt-4 rounded-2xl border bg-card p-1.5 sm:mx-0 sm:mt-5 sm:p-2"
    >
      <div className="flex items-center gap-2.5 px-3 pt-2.5 pb-1 sm:pb-1.5">
        <h2
          id="upcoming-birthdays-title"
          className="font-display text-base font-semibold tracking-[-0.01em] sm:text-[17px]"
        >
          Скоро день рождения
        </h2>
        <Badge className="min-w-5">{items.length}</Badge>
      </div>
      <ul className="divide-y sm:divide-y-0">
        {items.map((item) => (
          <li key={item.contact.id} data-testid="birthday-row">
            <Link
              href={contactHref(item.contact.id, { groupId })}
              prefetch={false}
              className="flex items-center gap-3 rounded-2xl p-3 outline-none focus-visible:ring-2 focus-visible:ring-ring sm:py-2.5 sm:hover:bg-secondary"
            >
              <ContactAvatar name={item.contact.name} />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5 sm:gap-0">
                <span className="truncate font-medium">{item.contact.name}</span>
                <span className="text-sm leading-[1.35] text-ink-2 sm:truncate sm:leading-normal">
                  {birthdayRowText(item)}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
