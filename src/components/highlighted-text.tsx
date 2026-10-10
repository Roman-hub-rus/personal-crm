import { splitByMatches } from "@/lib/search";

export function HighlightedText({ text, words }: { text: string; words: string[] }) {
  return splitByMatches(text, words).map((part, index) =>
    part.match ? (
      <mark key={index} className="rounded-sm bg-amber-200/70 text-inherit dark:bg-amber-500/30">
        {part.text}
      </mark>
    ) : (
      part.text
    ),
  );
}
