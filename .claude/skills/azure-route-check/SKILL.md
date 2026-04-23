---
name: azure-route-check
description: Detect Azure Functions route conflicts in apps/api before shipping. Catches static-vs-parameter path ambiguities (e.g. portal/notifications/delete vs portal/notifications/{id}) that can cause 404s or method routing to the wrong handler. Use when adding or changing an app.http route, or when an endpoint unexpectedly 404s.
---

# Azure Route Check

## Purpose

Prevent the recurring class of bug where a new static-path route like `portal/notifications/delete` silently 404s or is shadowed by a parameterized route like `portal/notifications/{id}` on the same prefix. Azure Functions' HTTP trigger does not always resolve static vs. parameter segments the way developers expect, especially when HTTP methods overlap.

## Inputs to read first

1. `apps/api/CLAUDE.md`
2. The `app.http` registration being added or changed
3. Every existing handler in `apps/api/src/functions/*.ts` whose `route:` shares the same prefix
4. `apps/api/host.json` — confirm no global routePrefix rewrites

## Workflow

1. **Identify the prefix**. Parse the new route's leading segments (everything before the first `{param}` or the last segment). E.g. `portal/notifications/delete` → prefix `portal/notifications`.
2. **Enumerate peer routes on that prefix**:
   ```bash
   grep -rn "route:" apps/api/src/functions | grep -E "portal/notifications(/|\")"
   ```
   For each match, also capture its `methods:` array.
3. **Classify each peer**:
   - **Collection**: `portal/notifications` (no trailing param)
   - **Item**: `portal/notifications/{id}`
   - **Static subpath**: `portal/notifications/delete`
   - **Parameterized subpath**: `portal/notifications/{id}/attachments`
4. **Check for conflict**. The new route is ambiguous if:
   - It's a **static subpath** and an **item** route exists with an overlapping method (the `{id}` will also match `delete` as a value)
   - It's an **item** route and a **static subpath** with the same method already exists
   - Two routes share the exact same path and method
5. **Recommend a safer pattern** if a conflict is found:
   - **Prefer**: add another HTTP verb on the existing collection route — e.g. bulk delete as `PATCH /api/portal/notifications` with `{ ids }` alongside the existing `GET`
   - **Or**: use a reserved segment under `{id}` — e.g. `PATCH …/notifications/mark-all-read` on `portal/notifications/{id}` (the handler treats `mark-all-read` as a sentinel id)
   - Avoid introducing a new static segment alongside `{id}` when any method overlaps
6. **After picking a pattern**, re-run the enumeration to confirm the (path, method) pair is now unique.

## Output format

```markdown
## Route plan

- **New route**: `POST /api/portal/notifications/archive`
- **Prefix**: `portal/notifications`

## Peer routes on prefix

| Path | Methods | File |
| --- | --- | --- |
| `portal/notifications` | GET, PATCH | `adminNotificationReport.ts` |
| `portal/notifications/{id}` | GET, PATCH, DELETE | `adminNotificationOverrides.ts` |

## Conflict analysis

- ⚠️ `POST /api/portal/notifications/archive` competes with `POST portal/notifications/{id}` (none on POST) — OK
- ⚠️ DELETE on `{id}` does not conflict with POST on static — OK

## Recommendation

Proceed with `POST /api/portal/notifications/archive`. No method overlap with parameterized routes.

## Verification

- After implementing, hit the route locally and confirm it reaches the intended handler, not the `{id}` one
- Run `npm run build:api` and `npm test --prefix apps/api`
```

## Guardrails

- Never claim "no conflict" without actually grepping peer routes — always produce the peer table
- If the user is debugging a 404, check route shadowing **before** diving into auth or CORS
- Do not change public route shapes without updating the SPA client and noting it in `docs/portal/` contracts
