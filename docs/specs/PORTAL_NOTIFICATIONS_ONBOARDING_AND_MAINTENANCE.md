# Spec: Portal notifications (onboarding + maintenance)

## 1) Context

- Problem statement: The portal currently needs a unified, compliant notification system for onboarding and maintenance request communications, including user-authored and AI-authored messages, across email, in-app notification center, and SMS.
- Why now: Faster response loops and reliable onboarding require consistent multi-channel delivery, clear auditability, and role-based controls without introducing notification noise.
- Related docs/issues/links:
  - `docs/specs/SPEC_TEMPLATE.md`
  - `docs/specs/PORTAL_REQUEST_UPLOAD_ATTACHMENTS.md`
  - `docs/portal/IMPLEMENTATION_PROMPT.md`
  - `AGENTS.md`

## 2) Scope

- In scope:
  - Implement notification channels:
    - Email
    - In-app notification center
    - SMS
  - Onboarding events:
    - Account onboarded welcome notification
    - Email verification notification
  - Maintenance messaging events:
    - User-authored message notifications
    - AI-authored message notifications
  - Recipient rules:
    - User-authored message: notify the opposite primary party only (tenant -> manager side; manager -> tenant side), plus optional CC list.
    - AI-authored message: notify all parties (tenant, manager side, optional CC list).
  - Optional CC list:
    - Editable by managers and admins.
    - Override support per property and per request.
  - Preferences and overrides:
    - User global defaults in profile.
    - Fine-grained per-property and per-request controls.
    - Manager/admin override capability.
  - Mandatory notification category:
    - Security + compliance notifications are non-disableable.
    - Terms of Use and Privacy Notice must reflect mandatory-notification behavior.
  - SMS policy:
    - SMS is sent only for high-priority/urgent maintenance events.
    - Urgency uses existing request priority plus AI auto-detection.
    - On conflict, AI urgency decision wins automatically, updates request status, and is audited.
  - Cooldown and quiet hours:
    - Per-user per-request cooldown of 15 minutes.
    - Global quiet-hours default: 8:00 PM to 6:00 AM Central.
    - Per-user quiet-hours override via profile.
    - During quiet hours, delay SMS only; send email and in-app immediately.
    - Urgent SMS bypasses quiet hours.
  - Delivery and retry:
    - Provider selection: Azure Communication Services for email and SMS.
    - Onboarding notifications are queued and retried.
    - Retry schedule is hybrid exponential starting at 5 minutes and doubling (5m, 10m, 20m, ...).
    - Failed-attempt threshold is configurable and counts initial send + retries; default threshold for alerting is 3 failures.
    - Trigger admin alert after threshold is reached.
  - Localization:
    - Use recipient profile preferred language when available.
    - Fallback to English if not set.
    - Supported languages must match current site languages.
  - Notification content and routing:
    - Email/SMS links deep-link directly to exact maintenance request thread.
    - In-app notifications auto-mark read when linked thread is opened.
    - Message preview uses short AI summary:
      - Max 160 characters
      - Language matches recipient profile (fallback English)
      - Include urgent/emergency label when applicable
  - Email replies:
    - Reply-to-thread enabled for email.
    - SMS remains notification-only.
    - Inbound email validation is strict: sender match + token + request membership checks.
    - Validation failure behavior: reject reply, notify sender, and log admin audit event.
  - Attachment mentions in notifications:
    - Include secure expiring links to attachments.
    - Link expiry is 24 hours.
    - Opening link always requires portal authentication.
  - Audit, retention, and reporting:
    - Retain notification/audit history for 90 days (configurable).
    - Provide admin + property manager audit UI visibility.
    - Property manager visibility is strictly scoped to assigned properties.
    - Store AI confidence score + model metadata for urgency/summarization decisions.
    - Metrics dashboard defaults to last 24 hours, with last 7 days, last 30 days, and custom windows.
    - Reporting mode is hybrid:
      - Operational metrics near-real-time (<=1 minute latency target)
      - Daily analytics rollups by user timezone day boundaries
  - Rollout:
    - Launch to all users at once.
    - Baseline metrics first, then define concrete SLA targets.
- Out of scope:
  - Marketing campaign notifications.
  - Two-way SMS conversations.
  - Push/mobile app notifications.
  - Cross-system BI warehousing beyond core operational and daily analytics views.

## 3) Users and stories

- As a tenant, I want timely notifications about maintenance thread activity so I can respond quickly.
- As a property manager, I want configurable recipients and scoped visibility so I can manage communication responsibly.
- As an admin, I want override controls and auditable actions so compliance and operations are enforceable.
- As an end user, I want language-aware concise messages and sane quiet-hour behavior so notifications are useful and not disruptive.
- As security/compliance stakeholders, we want mandatory compliance notifications, strict inbound validation, and retention controls.

## 4) Constraints and assumptions

- Technical constraints:
  - Use ACS for email/SMS delivery integration.
  - Ensure idempotent send processing and per-channel delivery status tracking.
  - Enforce cooldowns and quiet-hours logic before channel fan-out.
  - Ensure deep-link routes resolve users to authorized request-thread views.
- Product/design constraints:
  - Notification center behavior must align with portal UX patterns.
  - Read-state behavior must auto-resolve on linked-thread open.
  - Profile settings must expose global defaults plus per-scope override UX.
- Security/privacy constraints:
  - Strict inbound email reply validation.
  - Always require portal auth for attachment links.
  - SMS requires explicit user opt-in before any sends.
  - Manager/admin opt-out overrides require audit reason.
  - Mandatory compliance notifications cannot be disabled.
- Assumptions:
  - Request priority model exists and can be updated by automation.
  - User profiles store language preference and timezone (or can be extended).
  - Role and property assignment data is available for scoping checks.

## 5) Acceptance criteria

1. Given a new account is onboarded,
   When onboarding notifications are triggered,
   Then the user receives welcome and email verification notifications using configured channels and language fallback rules.

2. Given onboarding delivery failures occur,
   When attempts fail and threshold is reached (configurable; default 3 counting initial + retries),
   Then an admin alert is emitted and failure is auditable.

3. Given a tenant sends a maintenance message,
   When notification fan-out executes,
   Then manager-side recipients and configured CC list are notified, and the tenant is not redundantly notified for their own message event.

4. Given a manager/admin sends a maintenance message,
   When fan-out executes,
   Then tenant-side recipients and configured CC list are notified, and sender-side duplicate notification is suppressed by recipient rules.

5. Given an AI-authored maintenance message,
   When fan-out executes,
   Then all parties (tenant, manager side, optional CC list) are notified.

6. Given AI urgency detection conflicts with manual priority,
   When AI marks urgency,
   Then AI decision wins, request status is updated, and the action is fully audited.

7. Given a non-urgent maintenance event occurs during quiet hours,
   When notifications are generated,
   Then email and in-app send immediately and SMS is delayed.

8. Given an urgent maintenance event occurs during quiet hours,
   When notifications are generated,
   Then urgent SMS bypasses quiet hours and sends immediately.

9. Given repeated messages arrive in the same request thread,
   When cooldown checks run,
   Then per-user per-request per-channel sends respect a 15-minute cooldown window.

10. Given a user has not explicitly opted into SMS,
    When a qualifying SMS event occurs,
    Then no SMS is sent.

11. Given reply-to-thread email is received,
    When strict validation passes,
    Then message is appended to the correct request thread.

12. Given reply-to-thread email validation fails,
    When processing occurs,
    Then the message is rejected, sender is notified, and an admin-auditable event is recorded.

13. Given notification content includes attachments,
    When secure links are generated,
    Then links expire at 24 hours and require authenticated portal access.

14. Given a user opens a linked in-app notification thread,
    When the thread loads successfully,
    Then the associated notification is automatically marked as read.

15. Given audit/reporting interfaces are opened,
    When admins or property managers query events,
    Then admins see authorized global scope and property managers see only assigned-property scope.

16. Given AI summarization/urgency services are unavailable,
    When notification generation proceeds,
    Then the system fails open and continues delivery with non-blocking fallback behavior.

## 6) Validation plan

- Automated checks (include exact commands):
  - `npx vitest run`
  - `npx eslint src/`
  - API/service tests for:
    - recipient resolution
    - quiet-hours + urgent bypass logic
    - cooldown enforcement
    - opt-in/opt-out + override auditing
    - retry/backoff and alert threshold behavior
    - strict inbound reply validation
    - deep-link authorization checks
  - Localization tests for language selection and English fallback.
  - Metrics pipeline tests for near-real-time and daily rollup behavior.
- Manual checks:
  - End-to-end onboarding flow with delivery failures and admin alert.
  - Tenant/manager/admin message permutations (user-authored and AI-authored).
  - Quiet-hours behavior with timezone overrides.
  - Notification center read-state auto-transition.
  - Attachment-link access with authenticated vs unauthenticated sessions.
  - Role-scoped audit UI and filtering.

## 7) Implementation plan

- Step 1: Define notification event taxonomy and recipient resolution rules for onboarding and maintenance.
- Step 2: Implement channel fan-out orchestration with ACS email/SMS adapters and in-app delivery persistence.
- Step 3: Implement preferences model (global + per-property + per-request) with manager/admin override + audit reason capture.
- Step 4: Implement urgency engine integration (priority + AI), status update behavior, and full audit capture (confidence + model metadata).
- Step 5: Implement cooldown, quiet-hours, urgent bypass, and SMS consent gates.
- Step 6: Implement onboarding queue processing, exponential retry schedule, configurable threshold counting (initial + retries), and admin alerting.
- Step 7: Implement deep-link generation, in-app read-state auto-mark, and strict inbound email reply pipeline.
- Step 8: Implement secure attachment-link generation with 24-hour expiry and required auth checks.
- Step 9: Implement audit/reporting surfaces with strict role/property scoping and hybrid metrics updates.
- Step 10: Update Terms of Use and Privacy Notice language to reflect mandatory security/compliance notifications and consent behaviors.

## 8) Phased execution plan

- Phase 1 (Core foundation):
  - Event taxonomy and recipient routing.
  - In-app notification center persistence and read-state support.
  - ACS integration baseline for email and SMS.
  - Deep links to exact maintenance thread.
  - Language selection/fallback in templates.

- Phase 2 (Policy and compliance controls):
  - Profile/global and per-scope preferences.
  - Manager/admin override controls and audit reason.
  - SMS explicit opt-in enforcement.
  - Mandatory security/compliance notification enforcement.
  - Terms/Privacy updates.

- Phase 3 (Operational intelligence and resilience):
  - AI urgency + summarization pipeline.
  - AI-wins status updates with audit metadata.
  - Quiet-hours + urgent bypass + cooldown enforcement.
  - Fail-open behavior for AI outages.
  - Onboarding queue retries with configurable threshold and admin alerting.

- Phase 4 (Hardening and reporting):
  - Strict inbound email reply validation + rejection workflows.
  - Secure expiring attachment links with auth requirements.
  - Admin/manager scoped audit timeline UI.
  - Hybrid reporting (<=1 minute operational + daily rollups by user timezone).
  - Baseline metric collection and target-setting proposal.

## 9) Risks and mitigations

- Risk: Over-notification from complex routing and multi-channel fan-out.
  - Mitigation: cooldown enforcement, per-scope preference controls, and sender-side suppression logic.
- Risk: AI urgency false positives/negatives affecting SMS and status.
  - Mitigation: audit confidence + model metadata, configurable policy switches, and fail-open safeguards.
- Risk: Compliance issues from SMS consent and mandatory notification handling.
  - Mitigation: explicit opt-in gates, immutable compliance category rules, legal-document alignment.
- Risk: Unauthorized data exposure through links or inbound replies.
  - Mitigation: strict auth checks, expiring links, strict inbound validation, and rejection + audit flows.
- Risk: Property manager data overexposure in audit tools.
  - Mitigation: strict property-scoped query enforcement and access tests.

## 10) Rollback plan

- If regressions occur:
  - Disable non-critical notification fan-out paths via feature flags where available.
  - Keep mandatory security/compliance notifications operational.
  - Revert AI urgency override behavior to manual-priority-only fallback.
  - Disable reply-to-thread ingestion if validation or abuse issues arise.
  - Preserve audit logs and delivery history for incident analysis.

## 11) Traceability and completion

- Files changed:
  - `docs/specs/PORTAL_NOTIFICATIONS_ONBOARDING_AND_MAINTENANCE.md`
- Tests run and results:
  - Spec-only change in this task (no code/tests executed).
- Acceptance criteria status:
  - AC-1 through AC-16 defined.
- Follow-ups:
  - Confirm legal review language for Terms of Use and Privacy Notice updates.
  - Confirm exact fallback summary text behavior when AI is unavailable.
  - Define post-baseline target values for delivery/read/response/opt-out metrics.
