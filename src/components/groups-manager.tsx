"use client";

import { CheckIcon, Loader2Icon, PencilIcon, Trash2Icon, XIcon } from "lucide-react";
import Link from "next/link";
import { type ChangeEvent, type KeyboardEvent, useState, useTransition } from "react";
import { toast } from "sonner";

import { createGroup, deleteGroup, renameGroup } from "@/app/groups/actions";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { homeHref } from "@/lib/contact-groups";
import { formatContactsCount } from "@/lib/format";
import type { GroupWithCount } from "@/lib/groups";

const FAILED_MESSAGE = "Не удалось сохранить. Проверьте, что приложение и база данных запущены, и попробуйте ещё раз.";

function sortByName<T extends { name: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.name.localeCompare(b.name, "ru"));
}

export function GroupsManager({ initialGroups }: { initialGroups: GroupWithCount[] }) {
  const [groups, setGroups] = useState(initialGroups);

  return (
    <div className="flex flex-col gap-7">
      <CreateGroupForm onCreated={(group) => setGroups((previous) => sortByName([...previous, group]))} />
      {groups.length === 0 ? (
        <p className="text-muted-foreground">Групп пока нет</p>
      ) : (
        <ul className="flex flex-col divide-y">
          {groups.map((group) => (
            <GroupRow
              key={group.id}
              group={group}
              onRenamed={(name) =>
                setGroups((previous) => sortByName(previous.map((g) => (g.id === group.id ? { ...g, name } : g))))
              }
              onDeleted={() => setGroups((previous) => previous.filter((g) => g.id !== group.id))}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function CreateGroupForm({ onCreated }: { onCreated: (group: GroupWithCount) => void }) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();

  function submit() {
    if (isPending) return;
    startTransition(async () => {
      try {
        const result = await createGroup(name);
        if (!result.ok) {
          setError(result.message);
          return;
        }
        setError(undefined);
        setName("");
        onCreated({ id: result.id, name: result.name, contactCount: 0 });
        toast.success(`Группа «${result.name}» создана`);
      } catch {
        toast.error(FAILED_MESSAGE);
      }
    });
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    setName(event.target.value);
    if (error) setError(undefined);
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className="flex flex-col gap-2"
    >
      <div className="flex gap-2">
        <Input
          value={name}
          onChange={handleChange}
          placeholder="Новая группа"
          aria-label="Новая группа"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "new-group-error" : undefined}
          className="h-11"
        />
        <Button type="submit" size="lg" disabled={isPending}>
          {isPending && <Loader2Icon className="animate-spin" />}
          Создать
        </Button>
      </div>
      {error && (
        <p id="new-group-error" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}

function GroupRow({
  group,
  onRenamed,
  onDeleted,
}: {
  group: GroupWithCount;
  onRenamed: (name: string) => void;
  onDeleted: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(group.name);
  const [error, setError] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();

  function cancel() {
    setEditing(false);
    setName(group.name);
    setError(undefined);
  }

  function save() {
    if (isPending) return;
    startTransition(async () => {
      try {
        const result = await renameGroup(group.id, name);
        if (!result.ok) {
          setError(result.message);
          return;
        }
        setEditing(false);
        setError(undefined);
        onRenamed(result.name);
        toast.success("Группа переименована");
      } catch {
        toast.error(FAILED_MESSAGE);
      }
    });
  }

  function remove() {
    if (isPending) return;
    startTransition(async () => {
      try {
        const result = await deleteGroup(group.id);
        if (!result.ok) {
          toast.error(result.message);
          return;
        }
        onDeleted();
        toast.success(`Группа «${result.name}» удалена`);
      } catch {
        toast.error(FAILED_MESSAGE);
      }
    });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      save();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      cancel();
    }
  }

  if (editing) {
    return (
      <li className="flex flex-wrap items-center gap-2 py-2.5">
        <Input
          autoFocus
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            if (error) setError(undefined);
          }}
          onKeyDown={handleKeyDown}
          aria-label="Название группы"
          aria-invalid={error ? true : undefined}
          className="h-11 min-w-0 flex-1"
        />
        <Button type="button" size="icon" variant="ghost" onClick={save} disabled={isPending} aria-label="Сохранить">
          {isPending ? <Loader2Icon className="animate-spin" /> : <CheckIcon />}
        </Button>
        <Button type="button" size="icon" variant="ghost" onClick={cancel} disabled={isPending} aria-label="Отмена">
          <XIcon />
        </Button>
        {error && <p className="w-full text-sm text-destructive">{error}</p>}
      </li>
    );
  }

  return (
    <li className="flex items-center justify-between gap-3 py-2.5">
      <Link href={homeHref({ groupId: group.id })} className="min-w-0 flex-1 truncate font-medium hover:underline">
        {group.name} <span className="text-muted-foreground">— {formatContactsCount(group.contactCount)}</span>
      </Link>
      <div className="flex shrink-0 items-center gap-1">
        <Button type="button" size="icon" variant="ghost" onClick={() => setEditing(true)} aria-label="Переименовать">
          <PencilIcon />
        </Button>
        <DeleteGroupButton name={group.name} isPending={isPending} onConfirm={remove} />
      </div>
    </li>
  );
}

function DeleteGroupButton({
  name,
  isPending,
  onConfirm,
}: {
  name: string;
  isPending: boolean;
  onConfirm: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <AlertDialog open={open} onOpenChange={(next) => !isPending && setOpen(next)}>
      <AlertDialogTrigger asChild>
        <Button type="button" size="icon" variant="ghost" aria-label="Удалить">
          <Trash2Icon />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="break-words">Удалить группу «{name}»?</AlertDialogTitle>
          <AlertDialogDescription>
            Люди из группы останутся в контактах — они просто выйдут из неё. Вернуть группу не получится.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Отмена</AlertDialogCancel>
          <Button type="button" variant="destructive" disabled={isPending} onClick={onConfirm}>
            {isPending && <Loader2Icon className="animate-spin" />}
            Удалить
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
