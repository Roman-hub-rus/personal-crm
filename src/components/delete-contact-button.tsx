"use client";

import { Loader2Icon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { deleteContact } from "@/app/contacts/actions";
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

const DELETE_FAILED_MESSAGE =
  "Не удалось удалить. Проверьте, что приложение и база данных запущены, и попробуйте ещё раз.";

type DeleteContactButtonProps = {
  contactId: number;
  name: string;
  // Where to go after deleting: the list or the search results the card was opened from.
  afterDeleteHref: string;
};

export function DeleteContactButton({ contactId, name, afterDeleteHref }: DeleteContactButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function leave(href: string) {
    router.push(href);
    // deleteContact does not revalidate, so load the list afresh.
    router.refresh();
  }

  function confirmDelete() {
    if (isPending) return;
    startTransition(async () => {
      try {
        const result = await deleteContact(contactId);
        if (!result.ok) {
          toast.error(result.message);
          leave("/");
          return;
        }
        toast.success(`Контакт «${result.name}» удалён`);
        leave(afterDeleteHref);
      } catch {
        toast.error(DELETE_FAILED_MESSAGE);
      }
    });
  }

  return (
    // The dialog stays open while deleting: it can't be closed halfway.
    <AlertDialog open={open} onOpenChange={(next) => !isPending && setOpen(next)}>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="destructive" size="lg" className="self-start">
          <Trash2Icon />
          Удалить контакт
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="break-words">Удалить контакт «{name}»?</AlertDialogTitle>
          <AlertDialogDescription>
            Карточка и все заметки удалятся насовсем — вернуть их не получится.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Отмена</AlertDialogCancel>
          <Button type="button" variant="destructive" disabled={isPending} onClick={confirmDelete}>
            {isPending && <Loader2Icon className="animate-spin" />}
            {isPending ? "Удаляю…" : "Удалить"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
