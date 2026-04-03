# Prerequisites: Entra External ID + Azure Communication Services Email

Complete these **before** wiring production auth and mail in `apps/api`.

## Microsoft Entra External ID

1. **Tenant** — External ID tenant (or equivalent CIAM configuration) dedicated to portal users.
2. **App registration(s)**:
   - **SPA** client for the Vite app (public client): redirect URIs for production (`https://carwoods.com/...`) and localhost dev.
   - **API** application exposing scopes (e.g. `api://.../access_as_user`) validated by Azure Functions.
3. **Identity providers** enabled per product need: Google, Apple, Microsoft account, local account (email/password), password reset, **email OTP / magic link** user flows as designed.
4. **Admin users** — group or role claims (e.g. `portal_admin`) issued in tokens or resolved via Microsoft Graph after token validation.
5. **Secrets** — client IDs are public; **no client secrets in the browser**. API uses tenant metadata / JWKS for validation; use managed identity or Key Vault for any confidential API credentials.

**Validation checklist**

- [ ] SPA can acquire tokens for the API scope in dev and prod origins.
- [ ] API rejects expired/invalid tokens with safe error bodies.
- [ ] Role/group for admin is stable in claims or derivable server-side.

## Azure Communication Services (Email)

1. **ACS resource** in subscription, placed in resource group **`carwoods.com`** (with other app resources).
2. **Email communication service** + **Azure-managed domain** or **custom domain** verified for sending.
3. **Connection string** or **managed identity** access from Functions to send mail (prefer managed identity where supported).
4. **From** addresses and **reply-to** policy agreed for transactional mail (invites, request events).

**Validation checklist**

- [ ] Test send from a staging domain/address.
- [ ] Bounce/complaint handling understood (at minimum: log failures; optional webhooks later).
- [ ] Rate limits and daily caps documented for the subscription.

## Cross-cutting

- [ ] All Azure resources provisioned under **`carwoods.com`** resource group per project policy.
- [ ] `.env.example` / Key Vault names documented in [ENV_CONTRACT.md](./ENV_CONTRACT.md).
