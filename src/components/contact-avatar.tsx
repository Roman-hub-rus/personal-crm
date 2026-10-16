import { cn } from "@/lib/utils";

function initials(name: string): string {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "");
  return letters.join("") || "?";
}

// Monochrome in the list, lime on the contact's own page: the landing page uses one accent color.
export function ContactAvatar({ name, size = "md" }: { name: string; size?: "md" | "lg" }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-display font-semibold select-none",
        size === "md"
          ? "size-10 border border-line-strong bg-secondary text-[13px] text-ink-2"
          : "size-16 bg-primary text-xl text-primary-foreground",
      )}
    >
      {initials(name)}
    </span>
  );
}
