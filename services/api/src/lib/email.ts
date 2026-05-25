import { Resend } from "resend";

let resend: Resend | null = null;

function getResend(): Resend | null {
  if (resend) return resend;
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  resend = new Resend(key);
  return resend;
}

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

/**
 * Send transactional email via Resend. Returns { ok: false } if RESEND_API_KEY is unset.
 */
export async function sendTransactionalEmail(
  input: SendEmailInput
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const client = getResend();
  const from = process.env.RESEND_FROM;
  if (!client || !from) {
    return {
      ok: false,
      reason: "RESEND_API_KEY or RESEND_FROM not configured",
    };
  }
  const { error } = await client.emails.send({
    from,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
  });
  if (error) {
    return { ok: false, reason: error.message };
  }
  return { ok: true };
}
