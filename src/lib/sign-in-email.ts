// The sign-in email: a pure function from the link to the subject and the two versions of the body.
// No "server-only": nothing here touches the server, so it is easy to test and to look at.

// Mail programs do not understand CSS variables, so the email repeats the values of the design tokens
// (src/app/globals.css) as plain constants. This is the only place that breaks "colors only via tokens".
const COLORS = {
  background: "#0e0f0d", // --landing-bg
  surface: "#171815", // --landing-surface
  line: "#232521", // --landing-line
  ink: "#f3f4ef", // --landing-ink
  muted: "#a8aaa2", // --landing-muted
  accent: "#beea63", // --landing-accent (oklch(0.88 0.17 125) in sRGB)
  onAccent: "#0e0f0d", // --primary-foreground
};

export const SIGN_IN_EMAIL_SUBJECT = "Вход в Личную CRM";
const LIFETIME_TEXT = "Ссылка работает 15 минут";
const IGNORE_TEXT = "Если вы не запрашивали вход - просто проигнорируйте письмо";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function buildSignInEmail(link: string) {
  const href = escapeHtml(link);
  const html = `<!doctype html>
<html lang="ru">
  <body style="margin:0;padding:24px;background:${COLORS.background};color:${COLORS.ink};font-family:Arial,Helvetica,sans-serif;">
    <div style="max-width:480px;margin:0 auto;padding:32px;background:${COLORS.surface};border:1px solid ${COLORS.line};border-radius:12px;">
      <h1 style="margin:0 0 16px;font-size:22px;line-height:1.2;color:${COLORS.ink};">${SIGN_IN_EMAIL_SUBJECT}</h1>
      <p style="margin:0 0 24px;font-size:16px;line-height:1.5;color:${COLORS.ink};">Нажмите кнопку, чтобы войти.</p>
      <p style="margin:0 0 24px;">
        <a href="${href}" style="display:inline-block;padding:12px 28px;background:${COLORS.accent};color:${COLORS.onAccent};font-size:16px;font-weight:bold;text-decoration:none;border-radius:8px;">Войти</a>
      </p>
      <p style="margin:0 0 8px;font-size:14px;line-height:1.5;color:${COLORS.muted};">${LIFETIME_TEXT}, и только один раз.</p>
      <p style="margin:0;font-size:14px;line-height:1.5;color:${COLORS.muted};">${IGNORE_TEXT}.</p>
    </div>
  </body>
</html>`;

  const text = [
    SIGN_IN_EMAIL_SUBJECT,
    "",
    "Откройте ссылку, чтобы войти:",
    link,
    "",
    `${LIFETIME_TEXT}, и только один раз.`,
    `${IGNORE_TEXT}.`,
  ].join("\n");

  return { subject: SIGN_IN_EMAIL_SUBJECT, html, text };
}
