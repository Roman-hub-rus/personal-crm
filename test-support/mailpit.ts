// Reads the emails that landed in Mailpit, the mail catcher that tests (and the owner's computer) send to.
// Shared by Vitest and Playwright. Every test uses its own addresses, so emails are looked up by recipient
// and the mailbox is never emptied: the owner's own emails from manual checks are in it too.

const MAILPIT_URL = process.env.MAILPIT_URL ?? "http://127.0.0.1:8025";

export type CaughtEmail = {
  id: string;
  from: { name: string; address: string };
  to: string[];
  subject: string;
  html: string;
  text: string;
};

type MessageSummary = { ID: string };
type MessageDetails = {
  ID: string;
  From: { Name: string; Address: string };
  To: { Address: string }[];
  Subject: string;
  HTML: string;
  Text: string;
};

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${MAILPIT_URL}${path}`);
  if (!response.ok) {
    throw new Error(`Mailpit answered ${response.status} for ${path}. Is it running? (docker compose up -d)`);
  }
  return (await response.json()) as T;
}

// All emails sent to this address, oldest first.
export async function findEmails(to: string): Promise<CaughtEmail[]> {
  const query = encodeURIComponent(`to:"${to}"`);
  const found = await getJson<{ messages: MessageSummary[] }>(`/api/v1/search?query=${query}&limit=200`);
  const emails: CaughtEmail[] = [];
  for (const summary of found.messages) {
    const message = await getJson<MessageDetails>(`/api/v1/message/${summary.ID}`);
    emails.push({
      id: message.ID,
      from: { name: message.From.Name, address: message.From.Address },
      to: message.To.map((recipient) => recipient.Address),
      subject: message.Subject,
      html: message.HTML,
      text: message.Text,
    });
  }
  // Mailpit lists the newest first.
  return emails.reverse();
}

// Waits until at least `count` emails to this address have arrived (SMTP delivery is quick but not instant).
export async function waitForEmails(to: string, count = 1, timeoutMs = 10_000): Promise<CaughtEmail[]> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const emails = await findEmails(to);
    if (emails.length >= count) return emails;
    if (Date.now() > deadline) {
      throw new Error(`Expected ${count} email(s) to ${to} in Mailpit, found ${emails.length}.`);
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

// The sign-in link from the text version of an email.
export function extractSignInLink(email: CaughtEmail): string {
  const match = email.text.match(/https?:\/\/\S+/);
  if (!match) throw new Error(`No link found in the email "${email.subject}".`);
  return match[0];
}

// A new address for every call, so tests never see each other's emails or share the sending limit.
export function uniqueEmail(name = "user"): string {
  return `${name}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}
