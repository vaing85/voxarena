"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendTransactionalEmail = sendTransactionalEmail;
const resend_1 = require("resend");
let resend = null;
function getResend() {
    if (resend)
        return resend;
    const key = process.env.RESEND_API_KEY;
    if (!key)
        return null;
    resend = new resend_1.Resend(key);
    return resend;
}
/**
 * Send transactional email via Resend. Returns { ok: false } if RESEND_API_KEY is unset.
 */
async function sendTransactionalEmail(input) {
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
