import { ArrowLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ContactAvatar } from "@/components/contact-avatar";
import { ContactForm } from "@/components/contact-form";
import { DeleteContactButton } from "@/components/delete-contact-button";
import { MarkContactedButton } from "@/components/mark-contacted-button";
import { backLink, parseGroupId } from "@/lib/contact-groups";
import { toFormValues } from "@/lib/contact-input";
import { getContact, parseContactId } from "@/lib/contacts";
import { formatDate, formatDateTime } from "@/lib/format";
import { listGroups } from "@/lib/groups";

async function loadContact(params: PageProps<"/contacts/[id]">["params"]) {
  const { id } = await params;
  const contactId = parseContactId(id);
  return contactId === null ? null : getContact(contactId);
}

export async function generateMetadata({ params }: PageProps<"/contacts/[id]">): Promise<Metadata> {
  const contact = await loadContact(params);
  return { title: contact?.name ?? "Контакт не найден" };
}

export default async function ContactPage({ params, searchParams }: PageProps<"/contacts/[id]">) {
  const [contact, allGroups] = await Promise.all([loadContact(params), listGroups()]);
  if (!contact) notFound();

  // Keep the search query and the selected group so "back" returns to the same view.
  const { q, group } = await searchParams;
  const query = (Array.isArray(q) ? q[0] : q)?.trim() ?? "";
  const groupId = parseGroupId(Array.isArray(group) ? group[0] : group, allGroups);
  const groupName = groupId === null ? null : (allGroups.find((item) => item.id === groupId)?.name ?? null);
  const back = backLink({ query, groupId, groupName });

  return (
    <main className="mx-auto w-full max-w-3xl px-5 pt-4 lg:pt-6">
      <Link
        href={back.href}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon aria-hidden className="size-4" />
        {back.text}
      </Link>

      {/* "Связались" goes under the name on a phone and to the right of it on a wider screen. */}
      <header className="mt-5 mb-7 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:gap-x-5">
        <ContactAvatar name={contact.name} size="lg" />
        <div className="flex min-w-0 flex-col gap-1.5">
          <p className="font-mono text-xs tracking-eyebrow text-faint uppercase">
            В контактах с {formatDate(contact.createdAt)}
          </p>
          <h1 className="font-display text-title font-semibold break-words lg:text-title-lg">{contact.name}</h1>
          {contact.about && <p className="text-muted-foreground">{contact.about}</p>}
        </div>
        {/* Only with a saved frequency; outside the form, so it never touches unsaved edits. */}
        {contact.contactFrequency !== null && (
          <MarkContactedButton
            contactId={contact.id}
            name={contact.name}
            className="col-start-2 h-11 gap-2 justify-self-start px-5 text-[15px] sm:col-start-3"
          />
        )}
      </header>

      <ContactForm
        key={contact.id}
        mode="edit"
        contactId={contact.id}
        initialValues={toFormValues(contact)}
        updatedAtLabel={formatDateTime(contact.updatedAt)}
        allGroups={allGroups}
        footer={<DeleteContactButton contactId={contact.id} name={contact.name} afterDeleteHref={back.href} />}
      />
    </main>
  );
}
