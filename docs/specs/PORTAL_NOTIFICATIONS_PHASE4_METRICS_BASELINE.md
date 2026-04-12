# Phase 4 — notification metrics baseline and targets (proposal)

This document satisfies the Phase 4 deliverable **baseline metric collection and target-setting proposal** from `PORTAL_NOTIFICATIONS_ONBOARDING_AND_MAINTENANCE.md`.

## What is implemented

- **Operational windows** (near–real-time style counts): `1m`, `24h`, `7d`, `30d` via `GET /api/landlord/notification-metrics`.
  - Counters: `notification_deliveries` rows created, `portal_notifications` rows created, `notification_outbox` rows dispatched (`status = 'SENT'`, `processed_at` in window).
- **Daily rollup** (UTC calendar day on the database server, `GETUTCDATE()` boundary): last 30 days, merged from deliveries and in-app notifications.
- **Scope**: Admins see **global** counts. Landlords see rows tied to **properties they created** (`properties.created_by`), joined through `maintenance_requests` / outbox payload `request_id`.

## Baseline (pre-SLA)

Collect for **2–4 weeks** in production (or staging with realistic traffic):

| Metric | Source | Notes |
|--------|--------|--------|
| Deliveries created / window | `notification_deliveries` | Email/SMS pipeline volume |
| In-app notifications / window | `portal_notifications` | Center load |
| Outbox dispatched / window | `notification_outbox` | Processor throughput |
| Rejected email replies / day | `audit_log` where `entity_type = 'REQUEST_EMAIL_REPLY'` and `action = 'REJECTED'` | Abuse / misconfiguration |

Record p50/p95 **lag** between `notification_outbox.created_at` and `processed_at` in a future iteration (not in the initial API).

## Proposed initial targets (after baseline)

These are **draft**; replace with data-driven values after baseline.

| Area | Draft target | Rationale |
|------|----------------|-----------|
| Operational API freshness | ≤ 1 minute behind wall clock | Spec hybrid reporting goal |
| Outbox backlog | 95% of rows processed within 5 minutes of `created_at` under normal load | Avoid stuck notifications |
| Email reply rejection rate | Investigate if &gt; 1% of ingest attempts | Strict validation tradeoff |
| In-app vs email ratio | Track for UX tuning | Channel preference work later |

## Follow-ups

- Per-recipient **timezone** day boundaries for daily rollup (spec: user timezone).
- **Materialized** daily table + timer job if query cost grows.
- Wire **ACS** (or equivalent) to send **rejection notices** to failed inbound email senders (audit exists today; optional email stub logged until ACS template exists).
