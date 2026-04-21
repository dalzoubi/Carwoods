# SMS opt-in compliance (CTIA / Telnyx toll-free verification)

This document describes the explicit, web-based SMS opt-in flow the Carwoods
portal uses for transactional/operational SMS, the data we persist for audit,
and the STOP/HELP inbound handling. It is the source-of-truth we submit to
carriers/Telnyx during toll-free verification.

## TL;DR

- **Scope:** transactional/operational SMS only — maintenance updates, lease
  notices, account alerts, support replies. **No marketing.**
- **Opt-in:** web only, inside the authenticated portal at
  `https://carwoods.com/portal/profile`. **No keyword opt-in** (e.g. START).
- **Opt-out:** STOP keyword reply (handled via webhook) or toggle-off + save
  in the profile page.
- **Source-of-truth:** backend. Frontend toggle alone does not imply consent.

## Portal UX (`src/components/PortalProfile.jsx`)

The profile page has a toggle labeled exactly **"Enable SMS Notifications from
Carwoods"** with the supporting description:

> Receive account-related alerts such as maintenance updates, lease notices,
> and account activity.

Turning the toggle on opens a modal dialog titled *Enable SMS Notifications
from Carwoods* with the exact disclosures:

> By enabling SMS notifications, you agree to receive transactional text
> messages from Carwoods related to your account, including maintenance
> updates, lease notices, and account alerts.
>
> Message frequency varies. Message and data rates may apply.
>
> Reply STOP to opt out at any time. Reply HELP for help.
>
> Consent is not a condition of purchase. Messages are only sent based on
> your activity and notification settings.

Dialog buttons are **Cancel** and **Enable & Save**.

- Cancel ⇒ reverts toggle to off, no consent captured.
- Enable & Save ⇒ marks consent "pending" in the UI; the payload is only
  persisted when the user clicks the page's Save profile button AND the save
  succeeds.

Below the toggle we render a persistent static disclosure block with the same
text plus the HELP reply text:

> Carwoods: For help, reply HELP or contact support@carwoods.com. Log in to
> your account to manage notification settings: https://carwoods.com/portal/profile.
> Message frequency varies. Message and data rates may apply.

Status chips under the toggle reflect one of: opted in, opted out, or
unavailable on current plan.

### Phone change ⇒ re-consent

If the user edits the phone number while opted-in, the UI immediately:

1. Flips the toggle off and clears local consent state.
2. Shows an info alert explaining the reset and pointing the user to re-opt-in.

The backend also enforces this: if `phone` differs from the prior stored
value AND the user was previously opted in, the opt-in is cleared unless the
request contains a fresh `sms_opt_in_consent` block — see below.

## Backend persistence

### Schema (`infra/db/migrations/038_sms_opt_in_consent_audit.sql`)

Adds to `user_notification_preferences`:

| Column                  | Type                  | Notes                                                  |
|------------------------|----------------------|--------------------------------------------------------|
| `sms_opt_in_at`        | `DATETIMEOFFSET`      | When the user confirmed the dialog + save succeeded.   |
| `sms_opt_in_source`    | `NVARCHAR(64)`        | e.g. `WEB_PORTAL_PROFILE`.                             |
| `sms_opt_in_version`   | `NVARCHAR(32)`        | Version of the consent disclosure text shown.          |
| `sms_opt_in_ip`        | `NVARCHAR(64)`        | Best-effort client IP from `x-forwarded-for`.           |
| `sms_opt_in_user_agent`| `NVARCHAR(512)`       | Best-effort `User-Agent` header.                       |
| `sms_opt_in_phone`     | `NVARCHAR(64)`        | Phone number the consent is tied to.                    |
| `sms_opt_out_at`       | `DATETIMEOFFSET`      | When user opted out (profile save or STOP).             |
| `sms_opt_out_source`   | `NVARCHAR(64)`        | `WEB_PORTAL_PROFILE` or `INBOUND_SMS_KEYWORD`.          |

### API contract

`PATCH /api/portal/profile` accepts a new optional `sms_opt_in_consent`
object. When `sms_opt_in` transitions from `false` → `true`, this block MUST
be present, otherwise the backend silently keeps the prior opt-out state
(defensive — the response carries `sms_consent.phone_change_reset` when the
change was caused by a phone edit).

```json
{
  "notification_preferences": {
    "sms_enabled": true,
    "sms_opt_in": true
  },
  "sms_opt_in_consent": {
    "confirmed": true,
    "source": "WEB_PORTAL_PROFILE",
    "version": "2026-04-21.v1"
  }
}
```

`source` and `version` default to the canonical constants in
`apps/api/src/domain/smsConsent.ts` / `src/smsConsentConstants.js` when the
client omits them. IP and User-Agent are captured server-side from request
headers.

### Use-case flow (`apps/api/src/useCases/users/updateProfile.ts`)

1. Validate shape; `sms_opt_in=true` requires a phone number.
2. Snapshot prior `user_notification_preferences` to detect transitions.
3. Update the core `users` row.
4. Compute the effective opt-in:
   - If phone changed AND a prior opt-in existed AND no fresh
     `sms_opt_in_consent` is present → effective opt-in is `false`.
   - Otherwise pass through the requested state.
5. Persist consent capture columns whenever the effective opt-in is true and
   either (a) there was no prior opt-in, or (b) the phone change invalidated
   the prior one.
6. Persist opt-out columns when a prior opt-in is being turned off.
7. Audit log entries:
   - `SMS_OPT_IN_ENABLED` — new opt-in with full before/after.
   - `SMS_OPT_IN_DISABLED` — user turned off SMS (or inbound STOP).
   - `SMS_OPT_IN_PHONE_CHANGE_RESET` — phone edit invalidated consent.

All audit rows go to the shared `audit_log` table via `writeAudit()`.

## Inbound STOP / HELP webhook

`POST /api/public/inbound-sms` (`apps/api/src/functions/inboundSmsWebhook.ts`)
handles Telnyx inbound-message events. Authentication is a shared secret via
`x-carwoods-sms-ingest-secret` (`INBOUND_SMS_INGEST_SECRET` env var).

- STOP variants (`STOP`, `STOPALL`, `UNSUBSCRIBE`, `CANCEL`, `END`, `QUIT`):
  look up the user by digits-only phone, flip their preference off, write an
  `SMS_OPT_IN_DISABLED` audit row, and send the canonical confirmation reply:

  > Carwoods: You are opted out and will not receive further messages.
  > Log in at https://carwoods.com/portal/profile to re-enable SMS
  > notifications.

- HELP / INFO: send the canonical HELP reply (see above). No DB state change.

- Anything else: log-and-ack. **We never persist opt-in from inbound SMS**;
  keyword-based opt-in is explicitly out of scope per carrier policy.

### Integration points

- Telnyx Messaging Profile → `inbound.received` webhook URL:
  `{FUNCTION_HOST}/api/public/inbound-sms` with the shared secret header.
- Telnyx typically auto-replies to STOP at the network level; this handler
  is a defensive backstop plus the authoritative audit log.
- If the SMS provider handles STOP/HELP entirely (no webhook delivery), the
  portal-driven opt-out path still works via the profile toggle.

## Outbound message conventions

All outbound SMS is prefixed with `Carwoods:` (see `buildSmsBody` in
`apps/api/src/lib/processNotificationDeliveryBatch.ts`). Admin test SMS
(`apps/api/src/functions/adminNotificationTest.ts`) auto-prepends `Carwoods:`
if missing so it cannot be mistaken for marketing during carrier review. The
admin test UI is labeled *Test SMS (internal / admin-only)* with a warning
hint to only target numbers that have explicitly opted in for testing.

## Consent version bumping

When the consent disclosure text changes, bump `SMS_OPT_IN_VERSION` in both:

- `apps/api/src/domain/smsConsent.ts`
- `src/smsConsentConstants.js`

Future opt-in rows will carry the new version; existing rows keep their
original version so audit history remains accurate.

## Files changed

### Backend
- `apps/api/src/domain/smsConsent.ts` — new consent constants + keyword helpers.
- `apps/api/src/lib/notificationPolicyRepo.ts` — new consent columns and
  `SmsConsentCapture`/opt-out params on `updateUserNotificationPreference`.
- `apps/api/src/lib/usersRepo.ts` — new `findUserByPhoneDigits` for webhook.
- `apps/api/src/useCases/users/updateProfile.ts` — consent capture,
  phone-change reset, audit entries, returns
  `phoneChangeInvalidatedSmsConsent`.
- `apps/api/src/functions/portalProfile.ts` — parses `sms_opt_in_consent`,
  forwards IP + UA, adds `sms_consent.phone_change_reset` to response.
- `apps/api/src/functions/inboundSmsWebhook.ts` — new webhook endpoint.
- `apps/api/src/functions/adminNotificationTest.ts` — branded SMS body and
  clearer internal/admin-only copy.
- `apps/api/src/index.ts` — register `inboundSmsWebhook`.

### Database
- `infra/db/migrations/038_sms_opt_in_consent_audit.sql` — consent columns.

### Frontend
- `src/smsConsentConstants.js` — consent version + source constants.
- `src/components/PortalProfile.jsx` — new toggle label, description, dialog
  with exact disclosures, static disclosure block, help text, pending-consent
  indicator, phone-change reset behaviour.
- `src/locales/{en,es,fr,ar}/translation.json` — new keys plus updated
  dialog, toggle, and admin test copy.

### Tests
- `apps/api/test/updateProfile.test.mjs` — opt-in capture, opt-out, phone
  change reset.
- `apps/api/test/smsConsentKeywords.test.mjs` — STOP/HELP keyword detection,
  brand/disclosure invariants, webhook payload parsing.
- `src/components/PortalProfile.test.jsx` — dialog text + consent payload,
  cancel path, phone-change reset, static disclosure visibility.

## Follow-ups (explicitly out of scope here)

- Admin-facing audit viewer for SMS consent rows (rely on existing
  `audit_log` UI / query tools for now).
- Marketing/campaign SMS: must go through a separate, distinct opt-in flow
  with its own disclosures. Not part of the transactional pipeline.
- Privacy page wording changes: intentionally deferred per task brief.
