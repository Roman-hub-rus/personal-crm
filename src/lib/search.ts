// Search helpers shared by the database query and the UI highlighting.
// Matching is case-insensitive and treats "ё" as "е", so "Алена" finds "Алёна".

export const MAX_SEARCH_LENGTH = 100;

export function normalizeForSearch(text: string): string {
  return text.toLowerCase().replaceAll("ё", "е");
}

// Splits a query into words; every word must be found in the name.
export function searchWords(query: string): string[] {
  return normalizeForSearch(query.slice(0, MAX_SEARCH_LENGTH)).split(/\s+/).filter(Boolean).slice(0, 10);
}

export type TextPart = { text: string; match: boolean };

// Splits `text` into matched and unmatched parts for highlighting.
export function splitByMatches(text: string, words: string[]): TextPart[] {
  const normalized = normalizeForSearch(text);
  // Lowercasing can change length for some scripts; skip highlighting then.
  if (words.length === 0 || normalized.length !== text.length) {
    return [{ text, match: false }];
  }

  const marked = new Array<boolean>(text.length).fill(false);
  for (const word of words) {
    let from = normalized.indexOf(word);
    while (from !== -1) {
      marked.fill(true, from, from + word.length);
      from = normalized.indexOf(word, from + word.length);
    }
  }

  const parts: TextPart[] = [];
  for (let i = 0; i < text.length; i++) {
    const last = parts[parts.length - 1];
    if (last && last.match === marked[i]) {
      last.text += text[i];
    } else {
      parts.push({ text: text[i], match: marked[i] });
    }
  }
  return parts;
}
