import { LinkIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { SignInForm } from "@/components/sign-in-form";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/session";

export const metadata: Metadata = { title: "Вход" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  // Someone who is already in the app goes to their contacts.
  if (await getCurrentUser()) redirect("/");

  // Better Auth sends a person here with ?error=… when the link from the email does not work.
  const { error } = await searchParams;

  if (error) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-col items-center gap-3 px-5 py-20 text-center">
        <LinkIcon aria-hidden className="size-10 text-faint" />
        <h1 className="font-display text-lg font-semibold">Ссылка устарела, запроси новую</h1>
        <p className="text-muted-foreground">Ссылка работает 15 минут и только один раз.</p>
        <Button asChild size="lg" className="mt-3">
          <Link href="/login">На страницу входа</Link>
        </Button>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-md px-5 pt-8 pb-16 lg:pt-12">
      <h1 className="font-display text-title font-semibold lg:text-title-lg">Вход</h1>
      <p className="mt-3 mb-7 text-pretty text-muted-foreground">
        Введите почту — пришлём ссылку для входа. Пароль не нужен.
      </p>
      <SignInForm />
    </main>
  );
}
