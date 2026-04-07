# Maintenance Requests Feature — Bugs & Gaps Analysis

> **Purpose:** Comprehensive audit of the portal maintenance requests feature.  
> Below is a prompt you can give to Sonnet (or any LLM) to fix all identified issues.

---

## Prompt

You are working on the Carwoods tenant portal's **Maintenance Requests** feature. I have done a full end-to-end code audit and identified the following bugs and gaps. Please fix them all. The relevant files are:

**Frontend:**
- `src/components/PortalDashboard.jsx` — Dashboard with request stats, quick actions, recent requests
- `src/components/PortalRequests.jsx` — Requests page shell (split-pane layout)
- `src/components/portalRequests/usePortalRequests.js` — Central hook for all request state/actions
- `src/components/portalRequests/RequestListPane.jsx` — Request list sidebar
- `src/components/portalRequests/RequestDetailPane.jsx` — Request detail view
- `src/components/portalRequests/TenantRequestForm.jsx` — Tenant create-request form
- `src/components/portalRequests/usePortalRequests.test.jsx` — Hook tests
- `src/lib/portalApiClient.js` — API client functions
- `src/domain/constants.js` — Shared constants (Role, RequestStatus)
- `src/locales/{en,es,fr,ar}/translation.json` — i18n strings

**Backend:**
- `apps/api/src/functions/portalRequests.ts` — Portal request API endpoints
- `apps/api/src/functions/landlordRequests.ts` — Landlord/admin request API endpoints
- `apps/api/src/useCases/requests/cancelRequest.ts` — Cancel use case
- `apps/api/src/useCases/requests/updateRequestStatus.ts` — Status update use case
- `apps/api/src/lib/requestsRepo.ts` — DB queries for requests

---

### CRITICAL BUGS

#### BUG-1: Dashboard uses `current_status_id` (a UUID FK) instead of `status_code` for all status logic

`PortalDashboard.jsx` — both `countByStatus()` and `statusColor()` compare `r.current_status_id` against string constants like `'OPEN'`, `'IN_PROGRESS'`, `'CLOSED'`, `'RESOLVED'`. In production, `current_status_id` is a UUID foreign key to the `request_statuses` table (e.g., `"550e8400-e29b-41d4-a716-446655440000"`), NOT a human-readable code. The comparisons **never match**, so:
- **Every request falls into the `else` branch** of `countByStatus`, meaning ALL requests show as "Open" count — regardless of actual status.
- `statusColor()` returns `'default'` for everything.
- The recent-request chip label on line 306 (`label={req.current_status_id || 'OPEN'}`) displays a raw UUID.

**Fix:** Replace all occurrences of `current_status_id` with `status_code` in `countByStatus`, `statusColor`, and the Chip label. Use `req.status_name || req.status_code || 'Open'` for the chip label.

#### BUG-2: Cancelled requests counted as "open" in dashboard stats

`PortalDashboard.jsx` `countByStatus()` — the `else` clause catches everything that isn't `CLOSED`/`RESOLVED` or `IN_PROGRESS`, including `CANCELLED`. After fixing BUG-1 to use `status_code`, cancelled requests will still be bucketed as "open".

**Fix:** Add an explicit check for `CANCELLED` status. Either exclude cancelled from all counts, add a fourth "Cancelled" stat card, or bucket cancelled with resolved. At minimum, cancelled requests must NOT inflate the open count.

#### BUG-3: Fragile English-only string replacement for empty-state message

`PortalRequests.jsx` line 238:
```js
t('portalRequests.list.empty').replace('No requests found', 'Select a request to view details')
```
This does a `.replace()` on the *English* translation value. For Spanish/French/Arabic, the English substring is not found in the translated string, so the replacement silently fails, and the user sees "No se encontraron solicitudes" (the "no requests" message) even when requests exist but none is selected.

**Fix:** Add a dedicated i18n key `portalRequests.list.selectPrompt` (e.g., "Select a request to view details") in all four locale files. Use it directly instead of the `.replace()` hack.

#### BUG-4: Cancel success alert is never visible to the user

In `RequestDetailPane.jsx`, the cancel success alert (`cancelStatus === 'success'`) is rendered *inside* the cancel section, which is only shown when `CANCELLABLE_STATUS_CODES.has(status_code)`. After a successful cancel:
1. `cancelStatus` is set to `'success'`
2. `loadRequests({ keepSelection: true })` reloads and re-fetches detail
3. The request now has `status_code: 'CANCELLED'`
4. `CANCELLED` is NOT in `CANCELLABLE_STATUS_CODES`, so the entire cancel section (including the success alert) is hidden

The user never sees the success confirmation.

**Fix:** Move the cancel success feedback outside the `CANCELLABLE_STATUS_CODES` guard — for example, show it as a Snackbar, or display it in the detail header area unconditionally when `cancelStatus === 'success'`.

#### BUG-5: `loadRequestDetails` failure inside `loadRequests` incorrectly marks the list as errored

In `usePortalRequests.js`, `loadRequestDetails(nextSelected)` is called inside the `try` block of `loadRequests()` (line 188). If the detail fetch throws (e.g., network error on the detail/messages/attachments calls), the error is caught by the outer `catch`, which sets `requestsStatus` to `'error'` — hiding the already-successfully-loaded request list and showing a generic "Unable to load request data" error.

**Fix:** Wrap the `loadRequestDetails` and `loadAuditForRequest` calls in their own try-catch inside `loadRequests`, with a separate detail-specific error state. A detail load failure should not invalidate the list.

---

### STATE MANAGEMENT BUGS (stale state leaks between request selections)

#### BUG-6: `cancelStatus` / `cancelError` not reset when selecting a different request

If a user attempts (and fails) to cancel Request A, then selects Request B, the cancel error from Request A is still displayed on Request B's detail pane.

#### BUG-7: `managementUpdateStatus` / `managementUpdateError` not reset on selection change

Same pattern — management update success/error messages from a previous request leak to the next.

#### BUG-8: `messageStatus` / `messageError` not reset on selection change

Message send error from previous request shows on newly selected request.

#### BUG-9: `attachmentStatus` / `attachmentError` not reset on selection change

Upload error/success from previous request leaks.

#### BUG-10: `suggestionStatus` / `suggestionText` / `suggestionError` not reset on selection change

AI suggestion results from a previous request are displayed when viewing a different request.

#### BUG-11: `messageForm.is_internal` checkbox leaks between requests

The management "internal message" checkbox state persists across request selection changes.

**Fix for BUG-6 through BUG-11:** Add a `useEffect` or callback in `usePortalRequests` that resets all per-request transient state (cancel, management update, message, attachment, suggestion statuses/errors/forms) whenever `selectedRequestId` changes.

---

### FRONTEND GAPS

#### GAP-1: No status filter on the requests list

`RequestListPane` shows a flat list with no filtering. Users with many requests cannot filter by Open / In Progress / Cancelled / Resolved. Add a filter chip row or toggle above the list.

#### GAP-2: Request list items lack status chips with color coding

`RequestListPane` shows status only as plain secondary text. The dashboard's recent-requests section uses colored `Chip` components. The list pane should match, showing status chips with `statusColor()`.

#### GAP-3: Detail pane missing timestamps

`RequestDetailPane` shows title, description, ID, and status — but not `created_at` or `updated_at`. These are basic fields users need.

#### GAP-4: Detail pane missing category and priority

The detail pane omits category and priority information even though they're submitted during creation and available in the API response (via `category_id` and `priority_id`, joined to lookup tables).

#### GAP-5: Messages show raw `sender_user_id` (UUID) instead of a display name

`RequestDetailPane` line 312: `{msg.sender_user_id}` displays a UUID. Should show sender name or email. The backend would need to join users or the frontend needs a user-name lookup.

#### GAP-6: Messages lack timestamps

Message thread items show sender and body but no `created_at` timestamp. Conversations are hard to follow without timestamps.

#### GAP-7: No success feedback after sending a message

After `onMessageSubmit` succeeds, `messageStatus` is set to `'success'`, but `messageStatusMessage` only handles `'error'` — there's no success alert shown to confirm the message was sent.

#### GAP-8: Management "Status code" is a free-text field

The management status update form uses a plain `TextField` with a placeholder `"OPEN, IN_PROGRESS, CLOSED"`. This is error-prone — managers must type exact status codes. Should be a `<Select>` dropdown populated from the available status codes (which the backend can provide, or can be defined in frontend constants).

#### GAP-9: Management status placeholder is incomplete

The placeholder `"OPEN, IN_PROGRESS, CLOSED"` omits valid statuses: `NOT_STARTED`, `ACKNOWLEDGED`, `CANCELLED`, `RESOLVED`. Even if it remains a text field, the placeholder should list all valid options.

#### GAP-10: No deep-linking from dashboard to specific request

Dashboard recent-request cards all link to `/portal/requests` without passing the request ID. The user must manually find and click the request in the list. Should pass `?id=<requestId>` or route state.

#### GAP-11: Attachments not downloadable/viewable

Attachment list shows filename and media type but provides no download link or image preview. Attachments are useless if they can't be viewed.

#### GAP-12: No loading state for request detail

When selecting a request from the list, there's no loading indicator in the detail pane while `loadRequestDetails` fetches the three endpoints (detail, messages, attachments). The pane shows stale data or is empty during the load.

#### GAP-13: Export CSV button has no loading indicator

`exportStatus === 'loading'` is tracked but the button text stays "Export CSV" while exporting. Should show "Exporting..." or a spinner.

#### GAP-14: Audit tab shows raw data

- `event.created_at` is displayed as a raw ISO string — should be formatted.
- `event.actor_user_id` is a UUID — should show a human-readable name.
- Before/after JSON is dumped as raw `<pre>` blocks — could use a diff view or at least highlight changed fields.

#### GAP-15: No mobile back-to-list navigation

On mobile, list and detail are stacked vertically. After selecting a request, the user must scroll back up to see the list. Add a "Back to list" button or auto-scroll on mobile.

#### GAP-16: File input DOM state not reset after successful upload

After successful upload, `attachmentFile` is set to `null` but the actual `<input type="file">` element retains the old file selection. The component should reset the input via a `key` prop or ref.

#### GAP-17: No upload progress indicator for large files

Video uploads can be up to 100 MB. The only feedback is "Saving..." text. Should show a progress bar or percentage.

---

### SHARED CONSTANTS GAP

#### GAP-18: `RequestStatus` in `src/domain/constants.js` is wrong and unused

```js
export const RequestStatus = {
  OPEN: 'open',
  IN_PROGRESS: 'in-progress',
  RESOLVED: 'resolved',
  CLOSED: 'closed',
};
```

These are lowercase with hyphens, but the actual backend status codes are uppercase with underscores (`OPEN`, `IN_PROGRESS`, `NOT_STARTED`, `ACKNOWLEDGED`, `CANCELLED`, `CLOSED`, `RESOLVED`). This enum is not used anywhere in the frontend, but it's misleading. Update it to match the actual backend codes and use it in `countByStatus`, `statusColor`, `CANCELLABLE_STATUS_CODES`, and the management status dropdown.

---

### TEST GAPS

#### GAP-19: No tests for dashboard status counting logic

`PortalDashboard.jsx`'s `countByStatus` and `statusColor` have zero test coverage. Given BUG-1 and BUG-2, these functions clearly need tests. Add unit tests that verify:
- Correct counting when requests include CANCELLED, NOT_STARTED, ACKNOWLEDGED statuses
- Correct color mapping for all status codes
- That `status_code` (not `current_status_id`) is used

#### GAP-20: No component-level tests for `PortalRequests`, `RequestDetailPane`, `RequestListPane`, `TenantRequestForm`

Only `usePortalRequests.test.jsx` (hook tests) exist. No rendering tests for:
- List rendering with various request states
- Detail pane rendering with cancel/management/message/attachment sections
- Form validation in `TenantRequestForm`
- Responsive behavior (desktop vs mobile)

#### GAP-21: Hook test doesn't cover cancel flow

`usePortalRequests.test.jsx` doesn't test `onCancelRequest` at all — no test for successful cancel, failed cancel, or verifying the list refreshes after cancel.

#### GAP-22: Hook test doesn't cover management update flow

No test for `onUpdateRequest` — the management status/vendor/notes update path is completely uncovered.

#### GAP-23: Hook test doesn't cover message posting

No test for `onMessageSubmit`.

---

### IMPLEMENTATION PRIORITIES

**Phase 1 — Critical bugs (must fix):**
1. BUG-1: Switch `current_status_id` → `status_code` in dashboard
2. BUG-2: Exclude CANCELLED from open count (add stat or bucket with resolved)
3. BUG-3: Replace `.replace()` i18n hack with dedicated key
4. BUG-4: Make cancel success visible
5. BUG-5: Isolate detail-load errors from list status
6. BUG-6 through BUG-11: Reset per-request transient state on selection change
7. GAP-18: Fix `RequestStatus` constants

**Phase 2 — High-value UX gaps:**
8. GAP-3, GAP-4: Add timestamps, category, priority to detail pane
9. GAP-5, GAP-6: Show sender name and timestamps in messages
10. GAP-7: Add message send success feedback
11. GAP-8, GAP-9: Convert status code to dropdown, list all valid statuses
12. GAP-10: Deep-link from dashboard to specific request
13. GAP-12: Add detail loading state

**Phase 3 — Polish:**
14. GAP-1, GAP-2: Status filter and chips in list pane
15. GAP-11: Attachment download/preview
16. GAP-13, GAP-14, GAP-15, GAP-16, GAP-17: Various UX improvements

**Phase 4 — Test coverage:**
17. GAP-19 through GAP-23: Add missing tests

Please follow the project conventions in AGENTS.md: use i18n for all new strings (all 4 locales), use MUI theme tokens (no hardcoded hex), use logical CSS properties, and run `npx vitest run` + `npx eslint src/` after changes.
