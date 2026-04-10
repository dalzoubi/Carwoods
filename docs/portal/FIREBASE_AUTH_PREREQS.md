# Prerequisites: Firebase Auth + Azure Communication Services Email

Complete these before wiring production auth and mail in `apps/api`.

## Firebase Authentication

1. **Project** — create a Firebase project dedicated to portal users.
2. **Authentication providers**:
   - Google
   - Apple
   - Microsoft
   - Facebook
   - Email/Password
3. **Enterprise sign-in (Entra org accounts)**:
   - Configure SAML or OIDC identity provider in Firebase Auth.
   - Point it at your Azure AD tenant metadata.
4. **Web app config**:
   - Copy `apiKey`, `authDomain`, and `projectId` to Vite env:
     - `VITE_FIREBASE_API_KEY`
     - `VITE_FIREBASE_AUTH_DOMAIN`
     - `VITE_FIREBASE_PROJECT_ID`
5. **API validation config**:
   - Set `FIREBASE_PROJECT_ID` in Function App settings.
   - Optional: set `FIREBASE_OPENID_METADATA_URL` if you need a custom metadata endpoint.

Validation checklist:

- [ ] SPA can sign in with each enabled provider in local and production origins.
- [ ] API rejects expired/invalid tokens with safe error bodies.
- [ ] Firebase ID token contains `sub` and `email` claims for social/email providers.
- [ ] `/api/portal/me` can resolve users by subject first and email fallback on first login.

## Azure Communication Services (Email)

1. **ACS resource** in subscription, placed in resource group `carwoods.com`.
2. **Email communication service** + Azure-managed or custom verified domain.
3. **Connection string** or managed identity access from Functions to send mail.
4. **From** addresses and **reply-to** policy agreed for transactional mail.

Validation checklist:

- [ ] Test send from a staging sender/domain.
- [ ] Bounce/complaint handling understood (minimum: log failures).
- [ ] Rate limits and daily caps documented for the subscription.

## Cross-cutting

- [ ] All Azure resources provisioned under `carwoods.com` resource group per project policy.
- [ ] `.env.example` and runtime settings documented in [ENV_CONTRACT.md](./ENV_CONTRACT.md).
