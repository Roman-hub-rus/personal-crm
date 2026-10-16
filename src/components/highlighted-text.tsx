import { splitByMatches } from "@/lib/search";

export function HighlightedText({ text, words }: { text: string; words: string[] }) {
  return splitByMatches(text, words).map((part, index) =>
    part.match ? (
      <mark key={index} className="rounded-sm bg-primary/15 text-primary">
        {part.text}
      </mark>
    ) : (
      part.text
    ),
  );
}
