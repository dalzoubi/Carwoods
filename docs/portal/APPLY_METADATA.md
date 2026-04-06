# `properties.metadata` — public `/apply` tile shape

For **`apply_visible = true`** listings, the API exposes rows via `GET /api/public/apply-properties` only when **`metadata.apply`** is present and **`metadata.apply.applyUrl`** is non-empty (application URL / apply link).

## JSON shape (`metadata.apply`)

Matches the Vite [`publicApplyProperties.js`](../../src/publicApplyProperties.js) normalizer:

| Field | Type | Description |
|-------|------|-------------|
| `monthlyRentLabel` | string | e.g. `$1,895/mo` |
| `photoUrl` | string | Hero image URL |
| `harListingUrl` | string | Canonical HAR listing URL |
| `applyUrl` | string | `https://apply.link/...` |
| `detailLines` | string[] | Bullet lines under the address |

Optional overrides (else derived from columns):

| Field | Fallback |
|-------|----------|
| `addressLine` | `properties.street` |
| `cityStateZip` | `city`, `state`, `zip` formatted as `City, ST ZIP` |

**`metadata.apply.id`** (optional): display id for the tile; default is `prop-{uuid}`.

Admin **POST/PATCH** with **`har_listing_id`** triggers a **blocking** HAR fetch; on success `listing_source` is set to **`HAR_SYNC`** and `metadata.apply` is filled from HAR HTML (same logic as `scripts/fetchHarRentalApplyTiles.mjs`).
