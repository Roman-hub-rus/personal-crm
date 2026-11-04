import "server-only";

import nodemailer from "nodemailer";

import { getMailFrom, getSmtpUrl } from "@/db/env";

// The name of the sender is in the code, the address is a setting.
const SENDER_NAME = "Личная CRM";

type Mail = { to: string; subject: string; html: string; text: string };

// Sends one email through the server from SMTP_URL: Mailpit on the computer and in the tests,
// the mail service on the server. The code is the same, the setting decides where the email goes.
export async function sendMail(mail: Mail) {
  const transport = nodemailer.createTransport(getSmtpUrl());
  try {
    await transport.sendMail({
      from: { name: SENDER_NAME, address: getMailFrom() },
      to: mail.to,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
    });
  } finally {
    transport.close();
  }
}
