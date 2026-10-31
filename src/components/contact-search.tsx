"use client";

import { Loader2Icon, SearchIcon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { Input } from "@/components/ui/input";
import { homeHref } from "@/lib/contact-groups";
import { MAX_SEARCH_LENGTH } from "@/lib/search";
import { cn } from "@/lib/utils";

const DEBOUNCE_MS = 250;

// Search by name. The query lives in the URL (?q=...), the server does the filtering.
// Switching the query keeps the selected group, which lives in the same URL (?group=...).
export function ContactSearch({
  initialQuery,
  groupId,
  className,
}: {
  initialQuery: string;
  groupId: number | null;
  className?: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initialQuery);
  const [isPending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  function applyQuery(query: string) {
    clearTimeout(timer.current);
    const url = homeHref({ query: query.trim(), groupId });
    startTransition(() => router.replace(url, { scroll: false }));
  }

  function handleChange(next: string) {
    setValue(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => applyQuery(next), DEBOUNCE_MS);
  }

  function clear() {
    setValue("");
    applyQuery("");
  }

  return (
    <div role="search" className={cn("relative", className)}>
      <SearchIcon
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-4.5 size-4 -translate-y-1/2 text-faint"
      />
      <Input
        type="search"
        aria-label="Найти контакт по имени"
        placeholder="Найти по имени…"
        autoComplete="off"
        spellCheck={false}
        maxLength={MAX_SEARCH_LENGTH}
        value={value}
        onChange={(event) => handleChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") applyQuery(value);
          if (event.key === "Escape" && value) {
            event.preventDefault();
            clear();
          }
        }}
        className="h-12 rounded-full border-border bg-card pr-12 pl-11 text-base md:text-base [&::-webkit-search-cancel-button]:appearance-none"
      />
      <div className="absolute top-1/2 right-2 flex -translate-y-1/2 items-center">
        {isPending ? (
          <Loader2Icon aria-label="Ищу…" className="mr-2.5 size-4 animate-spin text-primary" />
        ) : value ? (
          <button
            type="button"
            onClick={clear}
            aria-label="Очистить поиск"
            className="inline-flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <XIcon className="size-4" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
