import { ArrowLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ContactAvatar } from "@/components/contact-avatar";
import { ContactForm } from "@/components/contact-form";
import { DeleteContactButton } from "@/components/delete-contact-button";
import { toFormValues } from "@/lib/contact-input";
import { getContact, parseContactId } from "@/lib/contacts";
import { formatDate, formatDateTime } from "@/lib/format";

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
  const contact = await loadContact(params);
  if (!contact) notFound();

  // Keep the search query so "back" returns to the same search results.
  const { q } = await searchParams;
  const query = (Array.isArray(q) ? q[0] : q)?.trim() ?? "";
  const backHref = query ? `/?${new URLSearchParams({ q: query })}` : "/";

  return (
    <main className="mx-auto w-full max-w-3xl px-5 pt-4 lg:pt-6">
      <Link
        href={backHref}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon aria-hidden className="size-4" />
        {query ? "К результатам поиска" : "Все контакты"}
      </Link>

      <header className="mt-5 mb-7 flex items-center gap-4 sm:gap-5">
        <ContactAvatar name={contact.name} size="lg" />
        <div className="flex min-w-0 flex-col gap-1.5">
          <p className="font-mono text-xs tracking-eyebrow text-faint uppercase">
            В контактах с {formatDate(contact.createdAt)}
          </p>
          <h1 className="font-display text-title font-semibold break-words lg:text-title-lg">{contact.name}</h1>
          {contact.about && <p className="text-muted-foreground">{contact.about}</p>}
        </div>
      </header>

      <ContactForm
        key={contact.id}
        mode="edit"
        contactId={contact.id}
        initialValues={toFormValues(contact)}
        updatedAtLabel={formatDateTime(contact.updatedAt)}
        footer={<DeleteContactButton contactId={contact.id} name={contact.name} afterDeleteHref={backHref} />}
      />
    </main>
  );
}
