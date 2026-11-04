"use client";

import { Loader2Icon } from "lucide-react";
import { useState, useTransition, type FormEvent } from "react";

import { requestSignInLink } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const FAILED_MESSAGE = "Не получилось отправить письмо, попробуй ещё раз";

// The sign-in form: the address and "Получить ссылку". The checks are on the server, the form shows its answer.
export function SignInForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSentTo(null);
    startTransition(async () => {
      try {
        const result = await requestSignInLink(email);
        if (result.ok) setSentTo(result.email);
        else setError(result.error);
      } catch {
        setError(FAILED_MESSAGE);
      }
    });
  }

  return (
    // noValidate: the browser's own hint would hide our "Проверь адрес почты".
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="sign-in-email" className="text-ink-2">
          Почта
        </Label>
        <Input
          id="sign-in-email"
          type="email"
          name="email"
          autoComplete="email"
          autoFocus
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "sign-in-error" : sentTo ? "sign-in-sent" : undefined}
          className="h-11"
        />
        {error && (
          <p id="sign-in-error" role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>

      <Button type="submit" size="lg" disabled={isPending}>
        {isPending && <Loader2Icon className="animate-spin" />}
        Получить ссылку
      </Button>

      {sentTo && (
        <p id="sign-in-sent" role="status" className="text-sm text-pretty break-words text-muted-foreground">
          Ссылка для входа отправлена на {sentTo}
        </p>
      )}
    </form>
  );
}
