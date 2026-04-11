# Spec: Portal request upload attachments

## 1) Context

- Problem statement: Currently, tenants can only provide a subject and text description for service requests. They cannot upload photos or videos, which makes troubleshooting harder and slows accurate diagnosis of what is required to resolve the issue.
- Why now: The request workflow needs richer context so tenants, landlords, and admins can triage and resolve issues faster with less back-and-forth.
- Related docs/issues/links:
  - `docs/specs/SPEC_TEMPLATE.md`
  - `docs/specs/EXAMPLE_PORTAL_REQUESTS_STATUS_FILTER.md`
  - `docs/portal/IMPLEMENTATION_PROMPT.md`

## 2) Scope

- In scope:
  - Allow both tenants and landlord/admin users to upload request attachments.
  - Allow uploads during both new request creation and existing request detail updates.
  - Display all request attachments in a single shared area with uploader identity (role) and timestamp.
  - Support images and videos only.
  - Enforce limits:
    - Max image size: 10 MB.
    - Max video size: 50 MB.
    - Max video duration: 10 seconds.
    - Max attachments per request: 3.
  - Show upload instructions adjacent to the attach button.
  - Support drag-and-drop uploads, upload progress, per-file errors, and retry for failed uploads.
  - Support image thumbnails and inline video preview.
  - Support download and share actions from the portal UI.
  - Support delete behavior:
    - Tenant can delete own attachments.
    - Landlord/admin can delete any attachment.
  - Access rules for view/download/share align with request visibility permissions ("same people who can view the request").
  - Generate signed, expiring share links for unauthenticated contractor access.
  - Block executable and non-media MIME types.
  - Sanitize filenames before storage.
  - Store attachments in private storage only (no public object URLs).
  - Retain attachments while parent request exists and purge attachments if request is deleted.
  - Add database-backed attachment configuration with:
    - Global defaults.
    - Optional per-landlord overrides (future-friendly for subscription tiers).
  - Add admin-only maintenance controls under `Configurations` as a new tab:
    - Attachment limits (max files, max image size, max video size, max video duration).
    - Allowed MIME types/extensions.
    - Share-link defaults (enabled/disabled and expiry duration).
    - Malware-scan requirement toggle.
  - Require save confirmation and audit logging for any attachment configuration changes.
  - Apply configuration changes immediately to new uploads only (no retroactive impact on existing attachments).
- Out of scope:
  - Attachment version history.
  - Annotations/markup on attachments.
  - Image editing.
  - OCR/transcription.
  - Automatic contractor assignment.
  - External CDN optimization.

## 3) Users and stories

- As a tenant, I want to attach photos/videos when creating or updating a request so that support can diagnose issues faster.
- As a landlord/admin, I want to upload additional media on an existing request so that resolution context is complete in one place.
- As a landlord/admin, I want to share a secure temporary link with contractors so that external workers can view relevant media without requiring portal authentication.
- As a request participant, I want all attachments shown in one timeline area with uploader and timestamp so that request history is easy to follow.

## 4) Constraints and assumptions

- Technical constraints:
  - Keep portal UX patterns consistent with existing portal shell/components.
  - Use existing stack and avoid new dependencies unless required and approved.
  - Enforce attachment count/size/type limits in both UI and API.
  - Video duration validation should be enforced before upload completion and re-validated server-side where feasible.
- Product/design constraints:
  - Upload instructions must be visible near the attach control.
  - Attachment list must include uploader name and timestamp.
  - Create and detail flows should present a consistent attachment experience.
  - Delete requires explicit confirmation dialog.
- Security/privacy constraints:
  - Reject executable or non-media MIME types.
  - Filenames must be sanitized before persistence and display.
  - Storage must remain private; no long-lived public links.
  - Share links must be signed and expiring.
  - Apply request-level authorization checks for view/download/share/delete.
  - Run malware scanning if a vetted public package/integration can be added safely.
- Assumptions:
  - Existing auth and request authorization logic can be reused for attachment permission checks.
  - Existing request data model can be extended with attachment metadata (`id`, `type`, `filename`, `size`, `duration`, `uploadedBy`, `createdAt`, `storageKey`, optional `shareExpiresAt`).
  - Contractors access shared files only through signed links, not through authenticated portal roles.
  - Attachment configuration model can be represented with global + landlord-override records and resolved at runtime by effective policy.

## 5) Acceptance criteria

1. Given a tenant or landlord/admin is creating a new request,
  When they attach valid image/video files within limits,
   Then attachments are uploaded and visible in the request attachment area after creation.
2. Given a tenant or landlord/admin is viewing an existing request,
  When they add valid image/video files within limits,
   Then new files appear in the same unified attachment area with uploader name and timestamp.
3. Given a file violates constraints (type, image size >10 MB, video size >50 MB, video duration >10 seconds, or max attachment count reached),
  When upload is attempted,
   Then the file is rejected with a clear per-file error message and no invalid file is stored.
4. Given upload failures occur for one or more files,
  When the user views the failed files,
   Then each failed file provides a retry action and upload progress is shown during retry.
5. Given attachments exist on a request,
  When the request page renders,
   Then users can see image thumbnails, inline video previews, and click-to-download actions.
6. Given a tenant attempts to delete an attachment they uploaded,
  When they confirm deletion,
   Then that attachment is deleted.
7. Given a landlord/admin attempts to delete any attachment,
  When they confirm deletion,
   Then the attachment is deleted regardless of uploader.
8. Given a user who can view the request accesses attachments,
  When they view/download files,
   Then access is granted; and users without request access are denied.
9. Given a landlord/admin generates a share link,
  When they share it with an unauthenticated contractor,
   Then the contractor can access the file only until link expiry, after which access is denied.
10. Given a request is deleted,
  When retention cleanup runs,
    Then associated attachments are purged from storage and are no longer retrievable.
11. Given upload controls are shown,
  When users interact with attachment UI,
    Then they have drag-and-drop support, visible upload instructions near attach button, progress indicators, and consistent error messaging.

12. Given an admin opens `Configurations` > attachment configuration tab,
    When they view settings,
    Then they can view/edit global defaults and optional per-landlord overrides for limits, MIME allowlist, share-link defaults, and malware-scan toggle.

13. Given an admin attempts to save attachment configuration changes,
    When they confirm the save action,
    Then changes are persisted to the database and an audit log entry records who changed what and when.

14. Given attachment configuration is updated,
    When users perform new uploads afterward,
    Then new uploads enforce updated rules immediately while existing stored attachments remain unaffected.

## 6) Validation plan

- Automated checks (include exact commands):
  - `npx vitest run`
  - `npx eslint src/`
  - Add API/unit/integration tests for attachment validation, permission enforcement, and signed-link expiry behavior in relevant portal/API packages.
- Feature tests to add/update:
  - Upload success tests (create flow and detail flow).
  - File limit validation tests (count, size, duration, MIME).
  - Delete permission tests (tenant own-only, landlord/admin any).
  - Signed share-link generation and expiry tests.
  - Access control tests for authorized vs unauthorized users.
  - Admin config CRUD tests for global defaults and per-landlord overrides.
  - Audit log test for config change events (actor, timestamp, before/after values).
  - Effective policy resolution tests (landlord override wins over global default).
- Manual checks:
  - Desktop and mobile request screens.
  - Light mode and dark mode.
  - Arabic/RTL layout integrity for attachment list and controls.
  - Drag-and-drop behavior and retry flow.
  - Timestamp and uploader rendering correctness.
  - Download and share UX from request detail.

## 7) Implementation plan

- Step 1: Define/extend attachment metadata model and API contracts for upload/list/delete/share.
- Step 2: Implement backend attachment endpoints and storage integration with private access controls.
- Step 3: Implement server-side validation (MIME, size, count, duration, authorization) and filename sanitization.
- Step 4: Add optional malware scan integration if a vetted public package/service is selected.
- Step 5: Implement signed, expiring share-link generation for contractor use.
- Step 6: Add request-deletion cascade/purge behavior for attachment cleanup.
- Step 7: Build portal attachment UI for create + detail flows with unified attachment area, instructions, previews, progress, retry, and delete confirmation.
- Step 8: Add i18n keys in `en`, `es`, `fr`, and `ar` for all new labels/messages/errors.
- Step 9: Add/adjust automated tests and run validation suite.

## 8) Phased delivery plan

- Phase 1 (MVP): core attachment workflow
  - Upload in both create + detail screens.
  - Unified attachment area with uploader + timestamp.
  - Type/size/count limits, filename sanitization, private storage.
  - Download support and delete permissions (tenant own, landlord/admin any).
  - Basic drag-and-drop, progress, and per-file error states.
- Phase 2 (Hardening): secure sharing + policy enforcement
  - Signed/expiring share links for unauthenticated contractors.
  - Server-side duration validation for videos (<=10 seconds).
  - Retention cleanup on request deletion plus orphan reconciliation safeguards.
  - Expanded authorization and negative-path test coverage.
- Phase 3 (UX polish): resilience and usability
  - Retry UX refinements for unstable networks.
  - Thumbnail/video preview polish and accessibility pass.
  - More precise user guidance copy near attach controls (localized).
  - Operational telemetry for upload failures and share-link usage.
- Phase 4 (Admin-configurable policy): database-backed controls
  - Add attachment configuration persistence (global defaults + per-landlord overrides).
  - Add admin-only `Configurations` tab for policy maintenance.
  - Include save confirmation workflow for policy updates.
  - Enforce audit-log capture for all policy changes.
  - Ensure updated policy applies immediately to new upload attempts only.

## 9) Risks and mitigations

- Risk: Client-side duration checks can be bypassed.
  - Mitigation: Re-validate duration server-side before finalizing upload.
- Risk: Signed-link sharing could leak data if TTL is too long.
  - Mitigation: Use short default TTL, audit link usage, and allow revocation if needed.
- Risk: Malware scan integration may increase latency/cost.
  - Mitigation: Use asynchronous scanning pipeline or quarantine strategy if implemented.
- Risk: Attachment cleanup drift could leave orphaned files.
  - Mitigation: Add delete cascade plus scheduled reconciliation job for orphan cleanup.
- Risk: UX complexity increases failure modes on mobile networks.
  - Mitigation: Provide per-file status, retry controls, and clear user feedback.
- Risk: Misconfigured limits/MIME settings could block legitimate uploads.
  - Mitigation: Add validated ranges, sane defaults, and explicit save confirmation.
- Risk: Policy precedence confusion (global vs landlord override).
  - Mitigation: Define deterministic precedence and show effective values in admin UI.

## 10) Rollback plan

- If deployment fails or causes regressions:
  - Disable attachment upload/share UI via feature flag (if introduced).
  - Revert attachment feature commits while preserving unrelated request portal improvements.
  - Keep existing text-only request flow operational.
  - Run storage reconciliation for partially uploaded/orphaned objects if rollback occurs mid-deploy.

## 11) Traceability and completion

- Files changed:
  - `docs/specs/PORTAL_REQUEST_UPLOAD_ATTACHMENTS.md`
- Tests run and results:
  - Spec-only change in this task (no code/tests executed).
- Acceptance criteria status:
  - AC-1: defined
  - AC-2: defined
  - AC-3: defined
  - AC-4: defined
  - AC-5: defined
  - AC-6: defined
  - AC-7: defined
  - AC-8: defined
  - AC-9: defined
  - AC-10: defined
  - AC-11: defined
- Follow-ups (if any):
  - Decide concrete share-link TTL defaults and revocation strategy.
  - Confirm malware scan package/service choice and operational cost guardrails.

