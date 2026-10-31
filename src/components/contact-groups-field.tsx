"use client";

import { PlusIcon } from "lucide-react";
import { useState, type KeyboardEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { pickGroupByName, type GroupOption } from "@/lib/contact-groups";
import { cn } from "@/lib/utils";

export type GroupFieldValue = { groupIds: number[]; newGroups: string[] };

type Chip = { key: string; name: string } & ({ kind: "existing"; id: number } | { kind: "new"; name: string });

export function ContactGroupsField({
  allGroups,
  value,
  onChange,
  error,
}: {
  allGroups: GroupOption[];
  value: GroupFieldValue;
  onChange: (value: GroupFieldValue) => void;
  error?: string;
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [draftError, setDraftError] = useState<string | undefined>();

  const chips: Chip[] = [
    ...allGroups.map((group) => ({
      key: `existing-${group.id}`,
      name: group.name,
      kind: "existing" as const,
      id: group.id,
    })),
    ...value.newGroups.map((name) => ({ key: `new-${name}`, name, kind: "new" as const })),
  ].sort((a, b) => a.name.localeCompare(b.name, "ru"));

  function toggleExisting(id: number) {
    const next = value.groupIds.includes(id)
      ? value.groupIds.filter((groupId) => groupId !== id)
      : [...value.groupIds, id];
    onChange({ ...value, groupIds: next });
  }

  function removeNew(name: string) {
    onChange({ ...value, newGroups: value.newGroups.filter((pending) => pending !== name) });
  }

  function confirmDraft() {
    const picked = pickGroupByName(draft, allGroups);
    if (picked.kind === "error") {
      setDraftError(picked.message);
      return;
    }
    if (picked.kind === "existing") {
      if (!value.groupIds.includes(picked.id)) {
        onChange({ ...value, groupIds: [...value.groupIds, picked.id] });
      }
    } else if (!value.newGroups.some((pending) => pending.toLowerCase() === picked.name.toLowerCase())) {
      onChange({ ...value, newGroups: [...value.newGroups, picked.name] });
    }
    setDraft("");
    setDraftError(undefined);
    setAdding(false);
  }

  function closeDraft() {
    setAdding(false);
    setDraft("");
    setDraftError(undefined);
  }

  function handleDraftKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    // A plain Enter must not submit the contact form.
    if (event.key === "Enter") {
      event.preventDefault();
      confirmDraft();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      closeDraft();
    }
  }

  return (
    <div role="group" aria-label="Группы" className="flex flex-col gap-2">
      {chips.length === 0 && !adding && (
        <p className="text-sm text-muted-foreground">Групп пока нет — создайте первую</p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {chips.map((chip) => {
          const selected = chip.kind === "existing" ? value.groupIds.includes(chip.id) : true;
          return (
            <button
              key={chip.key}
              type="button"
              aria-pressed={selected}
              onClick={() => (chip.kind === "existing" ? toggleExisting(chip.id) : removeNew(chip.name))}
              className={cn(
                "inline-flex h-8 items-center rounded-full border px-3 text-sm font-medium transition-colors",
                selected
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:bg-card",
              )}
            >
              {chip.name}
            </button>
          );
        })}
        {adding ? (
          <div className="flex items-center gap-1.5">
            <Input
              autoFocus
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value);
                if (draftError) setDraftError(undefined);
              }}
              onKeyDown={handleDraftKeyDown}
              placeholder="Название группы"
              aria-label="Название новой группы"
              aria-invalid={draftError ? true : undefined}
              className="h-8 w-40 rounded-full px-3 text-sm"
            />
            <Button type="button" size="sm" onClick={confirmDraft}>
              Добавить
            </Button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex h-8 items-center gap-1 rounded-full border border-dashed border-border px-3 text-sm font-medium text-muted-foreground hover:bg-card"
          >
            <PlusIcon className="size-3.5" />
            Новая группа
          </button>
        )}
      </div>
      {(draftError ?? error) && <p className="text-sm text-destructive">{draftError ?? error}</p>}
    </div>
  );
}
