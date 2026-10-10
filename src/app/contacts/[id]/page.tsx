import { ArrowLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ContactAvatar } from "@/components/contact-avatar";
import { ContactForm } from "@/components/contact-form";
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
    <main className="mx-auto w-full max-w-3xl px-4 pt-6">
      <Link
        href={backHref}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon aria-hidden className="size-4" />
        {query ? "К результатам поиска" : "Все контакты"}
      </Link>

      <header className="mt-4 mb-6 flex items-center gap-4">
        <ContactAvatar name={contact.name} size="lg" />
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight break-words">{contact.name}</h1>
          {contact.about && <p className="text-muted-foreground">{contact.about}</p>}
          <p className="mt-0.5 text-xs text-muted-foreground">
            В контактах с {formatDate(contact.createdAt)}
          </p>
        </div>
      </header>

      <ContactForm
        key={contact.id}
        mode="edit"
        contactId={contact.id}
        initialValues={toFormValues(contact)}
        updatedAtLabel={formatDateTime(contact.updatedAt)}
      />
    </main>
  );
}
