# Elsa Guardrailed Auto-Response Policy

Elsa is a constrained maintenance triage assistant. Elsa is not an unrestricted chatbot.

## Safety model

- Elsa suggestions are treated as untrusted output.
- A deterministic server-side policy engine decides whether a message may be auto-sent.
- Default behavior is conservative:
  - auto-send disabled by default in non-development environments,
  - low confidence holds for review,
  - emergency indicators block normal auto-send and alert admins.

## Delivery paths

- `SEND_AUTOMATICALLY`: message is normalized to an approved template family and sent.
- `HOLD_FOR_REVIEW`: suggestion is persisted for admin review only.
- `BLOCK_AND_ALERT_ADMIN`: no ordinary auto-send; urgent admin alert is created.

## Approved auto-send families

- acknowledgment,
- need-more-info follow-up,
- safe basic troubleshooting from allowlist,
- duplicate/in-progress acknowledgment.

Emergency auto-response uses a fixed approved template only (no free-form model text).

## Never auto-send examples

- gas, smoke, fire, sparking, exposed wires,
- active flooding, sewage backup, carbon monoxide concerns,
- legal/liability claims, reimbursement, injury wording,
- unsupported scheduling promises not grounded in request schedule data,
- confidence below threshold,
- troubleshooting steps not mapped to allowlist.

## Key configuration

- `elsa_enabled`
- `elsa_auto_send_enabled`
- `elsa_auto_send_confidence_threshold`
- `elsa_allowed_categories`
- `elsa_allowed_priorities`
- `elsa_blocked_keywords`
- `elsa_emergency_keywords`
- `elsa_max_questions`
- `elsa_max_steps`
- `elsa_admin_alert_recipients`
- `elsa_emergency_template_enabled`

Model provider runtime configuration:

- `GEMINI_API_KEY` enables remote model calls for Elsa suggestion generation.
- `GEMINI_MODEL` selects the model (defaults to `gemini-1.5-flash` for remote calls).
- If the provider is unavailable or response JSON is invalid, Elsa falls back to conservative heuristic suggestion generation and forces review.

Property/category/priority/request-level overrides are available via Elsa policy tables and admin endpoints.

## Audit/compliance

Every Elsa decision writes auditable metadata:

- request id and trigger event,
- actor (if available),
- model/prompt version,
- provider used (`remote` or `heuristic_fallback`),
- suggestion JSON,
- policy decision and flags,
- confidence and rationale,
- whether a message was sent and sent message id/content.

No secrets or hidden model chain-of-thought are stored.
