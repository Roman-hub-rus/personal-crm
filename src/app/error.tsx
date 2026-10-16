"use client";

import { TriangleAlertIcon } from "lucide-react";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col items-center gap-3 px-5 py-20 text-center">
      <TriangleAlertIcon aria-hidden className="size-10 text-destructive" />
      <h1 className="font-display text-lg font-semibold text-balance">Не получилось загрузить данные</h1>
      <p className="max-w-md text-muted-foreground text-pretty">
        Скорее всего, не запущена база данных. Откройте Docker Desktop или выполните в папке проекта{" "}
        <code className="rounded-sm bg-line-strong px-1.5 py-px font-mono text-[13px] text-foreground">
          docker compose up -d
        </code>, затем попробуйте ещё раз.
      </p>
      <Button size="lg" className="mt-3" onClick={reset}>
        Попробовать ещё раз
      </Button>
    </main>
  );
}
