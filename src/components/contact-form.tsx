"use client";

import { CircleCheckIcon, Loader2Icon, MailIcon, PhoneIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type ChangeEvent,
  type ReactNode,
} from "react";
import { toast } from "sonner";

import { createContact, updateContact } from "@/app/contacts/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  CONTACT_FIELDS,
  type ContactField,
  type ContactFormValues,
  type FieldErrors,
} from "@/lib/contact-input";
import { CONTACT_FREQUENCIES, FREQUENCY_NOT_SET_LABEL, FREQUENCY_OPTION_LABELS } from "@/lib/contact-frequency";
import { cn } from "@/lib/utils";

type ContactFormProps =
  | { mode: "create"; initialValues: ContactFormValues; cancelHref: string }
  | {
      mode: "edit";
      contactId: number;
      initialValues: ContactFormValues;
      updatedAtLabel: string;
      // Shown under the notes, above the bottom bar (e.g. the delete button)
      footer?: ReactNode;
    };

const SAVE_FAILED_MESSAGE =
  "Не удалось сохранить. Проверьте, что приложение и база данных запущены, и попробуйте ещё раз.";

export function ContactForm(props: ContactFormProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [values, setValues] = useState(props.initialValues);
  const [savedValues, setSavedValues] = useState(props.initialValues);
  const [updatedAtLabel, setUpdatedAtLabel] = useState(
    props.mode === "edit" ? props.updatedAtLabel : "",
  );
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isPending, startTransition] = useTransition();

  const isDirty = CONTACT_FIELDS.some((field) => values[field] !== savedValues[field]);

  // Warn before closing the tab with unsaved changes.
  useEffect(() => {
    if (!isDirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isDirty]);

  function setField(field: ContactField, value: string) {
    setValues((previous) => ({ ...previous, [field]: value }));
    if (errors[field]) {
      setErrors((previous) => ({ ...previous, [field]: undefined }));
    }
  }

  function showErrors(fieldErrors: FieldErrors = {}, message?: string) {
    setErrors(fieldErrors);
    if (message) toast.error(message);
    const firstInvalid = CONTACT_FIELDS.find((field) => fieldErrors[field]);
    if (firstInvalid) {
      formRef.current?.querySelector<HTMLElement>(`[name="${firstInvalid}"]`)?.focus();
    }
  }

  function save() {
    if (isPending) return;
    startTransition(async () => {
      try {
        if (props.mode === "create") {
          const result = await createContact(values);
          if (!result.ok) return showErrors(result.fieldErrors, result.message);
          toast.success(`Контакт «${result.name}» добавлен`);
          router.push(`/?added=${result.id}`);
          return;
        }

        const result = await updateContact(props.contactId, values);
        if (!result.ok) return showErrors(result.fieldErrors, result.message);
        setErrors({});
        setValues(result.values);
        setSavedValues(result.values);
        setUpdatedAtLabel(result.updatedAtLabel);
        toast.success("Изменения сохранены");
      } catch {
        toast.error(SAVE_FAILED_MESSAGE);
      }
    });
  }

  const fieldProps = (field: ContactField) => ({
    id: `contact-${field}`,
    name: field,
    value: values[field],
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setField(field, event.target.value),
    "aria-invalid": errors[field] ? true : undefined,
    "aria-describedby": errors[field] ? `contact-${field}-error` : undefined,
  });

  const savedPhone = savedValues.phone.trim();
  const savedEmail = savedValues.email.trim();

  return (
    <form
      ref={formRef}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
      onKeyDown={(event) => {
        // Keys from dialogs rendered in a portal bubble here too; they must not save the form.
        if (!event.currentTarget.contains(event.target as Node)) return;
        // Ctrl+Enter / Cmd+Enter saves from any field, including the notes.
        if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
          event.preventDefault();
          save();
        }
      }}
      className="flex flex-col gap-4"
    >
      <Card>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <Field field="name" label="Имя" required error={errors.name} className="sm:col-span-2">
            <Input
              {...fieldProps("name")}
              autoComplete="off"
              autoFocus={props.mode === "create"}
              placeholder="Например, Анна Петрова"
              className="h-11 text-base md:text-base"
            />
          </Field>

          <Field field="about" label="Кто это" error={errors.about} className="sm:col-span-2">
            <Input
              {...fieldProps("about")}
              autoComplete="off"
              placeholder="Например, дизайнер, подруга сестры"
              className="h-11"
            />
          </Field>

          <Field
            field="phone"
            label="Телефон"
            error={errors.phone}
            action={
              props.mode === "edit" && savedPhone ? (
                <LabelLink href={`tel:${savedPhone.replace(/[^\d+]/g, "")}`} icon={<PhoneIcon />}>
                  Позвонить
                </LabelLink>
              ) : null
            }
          >
            <Input
              {...fieldProps("phone")}
              type="tel"
              inputMode="tel"
              autoComplete="off"
              placeholder="+7 900 123-45-67"
              className="h-11"
            />
          </Field>

          <Field
            field="email"
            label="Почта"
            error={errors.email}
            action={
              props.mode === "edit" && savedEmail && !errors.email ? (
                <LabelLink href={`mailto:${savedEmail}`} icon={<MailIcon />}>
                  Написать
                </LabelLink>
              ) : null
            }
          >
            <Input
              {...fieldProps("email")}
              type="email"
              inputMode="email"
              autoComplete="off"
              placeholder="name@example.com"
              className="h-11"
            />
          </Field>

          <Field field="howWeMet" label="Откуда знакомы" error={errors.howWeMet} className="sm:col-span-2">
            <Textarea
              {...fieldProps("howWeMet")}
              rows={1}
              placeholder="Например, учились вместе в университете"
              className="min-h-11 resize-none py-2.5"
            />
          </Field>

          <Field field="frequency" label="Как часто общаться" error={errors.frequency}>
            <FrequencySelect
              value={values.frequency}
              onChange={(value) => setField("frequency", value)}
              invalid={Boolean(errors.frequency)}
            />
            <p id="contact-frequency-hint" className="text-[13px] leading-[1.45] text-muted-foreground text-pretty">
              Если дольше не общаться, контакт появится в блоке «Пора связаться»
            </p>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Field
            field="notes"
            label="Заметки"
            prominent
            hint="О чём говорили и о чём договорились. Новую заметку допишите в конец — например, с датой разговора."
            error={errors.notes}
          >
            <Textarea
              {...fieldProps("notes")}
              placeholder={"Например:\n8 октября — созвонились, договорились встретиться в субботу."}
              className="min-h-56 py-3 text-base leading-relaxed md:text-[15px]"
            />
          </Field>
        </CardContent>
      </Card>

      {props.mode === "edit" && props.footer}

      <div className="sticky bottom-0 z-10 -mx-5 flex items-center justify-between gap-3 border-t bg-background px-5 py-3">
        <p className="min-w-0 text-sm text-muted-foreground" aria-live="polite">
          {props.mode === "edit" &&
            (isDirty ? (
              <span className="flex items-center gap-2 text-foreground">
                <span aria-hidden className="size-2 shrink-0 rounded-full bg-primary" />
                <span>
                  <span className="sm:hidden">Не сохранено</span>
                  <span className="hidden sm:inline">Есть несохранённые изменения</span>
                </span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <CircleCheckIcon aria-hidden className="size-4 shrink-0 text-primary" />
                <span>
                  Сохранено<span className="hidden sm:inline"> · {updatedAtLabel}</span>
                </span>
              </span>
            ))}
        </p>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          {props.mode === "create" && (
            <Button asChild variant="ghost" size="lg">
              <Link href={props.cancelHref}>Отмена</Link>
            </Button>
          )}
          <Button
            type="submit"
            size="lg"
            disabled={isPending || (props.mode === "edit" && !isDirty)}
            title="Ctrl + Enter или ⌘ + Enter"
            className="min-w-32"
          >
            {isPending && <Loader2Icon className="animate-spin" />}
            {props.mode === "create"
              ? isPending
                ? "Добавляю…"
                : "Добавить контакт"
              : isPending
                ? "Сохраняю…"
                : "Сохранить"}
          </Button>
        </div>
      </div>
    </form>
  );
}

function Field({
  field,
  label,
  required,
  prominent,
  hint,
  error,
  action,
  className,
  children,
}: {
  field: ContactField;
  label: string;
  required?: boolean;
  // Shown as a card title rather than a field label
  prominent?: boolean;
  hint?: string;
  error?: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex min-h-5 items-center justify-between gap-2">
        <Label
          htmlFor={`contact-${field}`}
          className={cn("gap-1 text-ink-2", prominent && "font-display text-lg font-semibold text-foreground")}
        >
          {label}
          {required && (
            <span aria-hidden className="text-primary">
              *
            </span>
          )}
        </Label>
        {action}
      </div>
      {hint && <p className="-mt-1 mb-1 text-sm text-muted-foreground text-pretty">{hint}</p>}
      {children}
      {error && (
        <p id={`contact-${field}-error`} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

// Radix Select does not allow an empty item value, so "Не задано" is "none" inside the select
// and "" in the form values.
const FREQUENCY_NOT_SET = "none";

function FrequencySelect({
  value,
  onChange,
  invalid,
}: {
  value: string;
  onChange: (value: string) => void;
  invalid: boolean;
}) {
  return (
    <Select
      value={value || FREQUENCY_NOT_SET}
      onValueChange={(next) => onChange(next === FREQUENCY_NOT_SET ? "" : next)}
    >
      <SelectTrigger
        id="contact-frequency"
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? "contact-frequency-hint contact-frequency-error" : "contact-frequency-hint"}
        className={cn(
          "w-full rounded-lg bg-background pr-3 pl-3.5 text-base data-[size=default]:h-11 focus-visible:ring-ring/20 md:text-sm dark:bg-background dark:hover:bg-background",
          !value && "text-muted-foreground",
        )}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent
        position="popper"
        sideOffset={8}
        className="w-(--radix-select-trigger-width) rounded-xl border border-input p-1 shadow-lg ring-0"
      >
        <SelectItem value={FREQUENCY_NOT_SET} className={itemClassName}>
          <span className="text-muted-foreground">{FREQUENCY_NOT_SET_LABEL}</span>
        </SelectItem>
        {CONTACT_FREQUENCIES.map((frequency) => (
          <SelectItem key={frequency} value={frequency} className={itemClassName}>
            {FREQUENCY_OPTION_LABELS[frequency]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

const itemClassName =
  "h-11 rounded-md pr-9 pl-3 text-base focus:bg-secondary sm:h-9 sm:text-sm [&_svg]:text-primary";

function LabelLink({ href, icon, children }: { href: string; icon: ReactNode; children: ReactNode }) {
  return (
    <a
      href={href}
      className="inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline hover:opacity-88 [&_svg]:size-3.5"
    >
      {icon}
      {children}
    </a>
  );
}
