"use client";

import { Loader2Icon, SearchIcon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { Input } from "@/components/ui/input";
import { MAX_SEARCH_LENGTH } from "@/lib/search";
import { cn } from "@/lib/utils";

const DEBOUNCE_MS = 250;

// Search by name. The query lives in the URL (?q=...), the server does the filtering.
export function ContactSearch({ initialQuery, className }: { initialQuery: string; className?: string }) {
  const router = useRouter();
  const [value, setValue] = useState(initialQuery);
  const [isPending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  function applyQuery(query: string) {
    clearTimeout(timer.current);
    const trimmed = query.trim();
    const url = trimmed ? `/?${new URLSearchParams({ q: trimmed })}` : "/";
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
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
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
        className="h-10 pr-10 pl-9 text-base [&::-webkit-search-cancel-button]:appearance-none"
      />
      <div className="absolute top-1/2 right-1.5 flex -translate-y-1/2 items-center">
        {isPending ? (
          <Loader2Icon aria-label="Ищу…" className="mr-1.5 size-4 animate-spin text-muted-foreground" />
        ) : value ? (
          <button
            type="button"
            onClick={clear}
            aria-label="Очистить поиск"
            className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <XIcon className="size-4" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
