import { ArrowLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { ContactForm } from "@/components/contact-form";
import { EMPTY_CONTACT_FORM } from "@/lib/contact-input";

export const metadata: Metadata = { title: "Новый контакт" };

export default async function NewContactPage({ searchParams }: PageProps<"/contacts/new">) {
  const { name } = await searchParams;
  const initialName = (Array.isArray(name) ? name[0] : name)?.trim().slice(0, 200) ?? "";

  return (
    <main className="mx-auto w-full max-w-3xl px-5 pt-4 lg:pt-6">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon aria-hidden className="size-4" />
        Все контакты
      </Link>
      <h1 className="mt-5 mb-7 font-display text-title font-semibold lg:text-title-lg">Новый контакт</h1>
      <ContactForm
        mode="create"
        cancelHref="/"
        initialValues={{ ...EMPTY_CONTACT_FORM, name: initialName }}
      />
    </main>
  );
}
