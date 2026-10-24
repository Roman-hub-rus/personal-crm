"use client";

import { CheckIcon, Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { markContacted, undoMarkContacted } from "@/app/contacts/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const MARK_FAILED_MESSAGE =
  "Не удалось сохранить. Проверьте, что приложение и база данных запущены, и попробуйте ещё раз.";

// "Связались" in the "Пора связаться" rows and in the card header: works right away, without "Сохранить",
// and can be undone for 5 seconds from the message.
export function MarkContactedButton({
  contactId,
  name,
  className,
}: {
  contactId: number;
  name: string;
  className?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  async function undo(markedAt: string, previous: string | null) {
    try {
      const result = await undoMarkContacted(contactId, markedAt, previous);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      router.refresh();
    } catch {
      toast.error(MARK_FAILED_MESSAGE);
    }
  }

  function mark() {
    if (isPending) return;
    startTransition(async () => {
      try {
        const result = await markContacted(contactId);
        if (!result.ok) {
          toast.error(result.message);
          return;
        }
        toast.success(`Отмечено: ${result.name}`, {
          duration: 5000,
          action: { label: "Отменить", onClick: () => undo(result.markedAt, result.previous) },
          classNames: {
            actionButton:
              "h-11! rounded-full! bg-primary! px-3.5! text-sm! font-semibold! text-primary-foreground! sm:h-[30px]! sm:px-3! sm:text-[13px]!",
          },
        });
        router.refresh();
      } catch {
        toast.error(MARK_FAILED_MESSAGE);
      }
    });
  }

  return (
    <Button
      type="button"
      variant="outline"
      aria-label={`Связались — ${name}`}
      disabled={isPending}
      onClick={mark}
      className={cn("shrink-0", className)}
    >
      {isPending ? <Loader2Icon className="animate-spin" /> : <CheckIcon strokeWidth={2.5} />}
      Связались
    </Button>
  );
}
