This is a lightweight Next.js scaffold for testing Baloot backend authentication, owner bootstrap, and dashboard flows.

## Getting Started

1) Install dependencies:

```bash
pnpm install
```

2) Configure frontend environment:

```bash
cp .env.example .env
```

`NEXT_PUBLIC_API_BASE_URL` should point to your backend API root (for example `http://localhost:4000/api`).

3) Run the development server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Included scaffold pages

- `/login`: tests `POST /auth/login`
- `/owner-setup`: completes the emailed setup invitation using `POST /auth/owner-setup`; both the platform operator and customer-organization owners use this flow
- `/dashboard`: loads current user (`GET /auth/me`) and renders:
  - Platform-admin dashboard when `/auth/me` returns `isGlobalAdmin: true`
  - Organization dashboard for a customer organization's OWNER account
  - Platform admin can create organizations and invite owners, update organization status and subscriptions, resend owner invitations, and add users to a selected organization
  - Organization users are listed in the signed-in user's organization; tenant owners can add users to that organization

The app uses cookie-based auth and sends requests with `credentials: "include"`.

## Notes

- Ensure backend CORS allows `FRONTEND_URL=http://localhost:3000`.
- If the platform dashboard does not load, check that the signed-in account has an active `GlobalAdmin` record; its `/auth/me` response must include `isGlobalAdmin: true`.
- Billing controls update subscription records manually; no payment provider is connected.
