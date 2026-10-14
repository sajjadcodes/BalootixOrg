# Baloot Org Backend

# Setup Guide

This repository is the backend for Baloot Org.

## 1. Prerequisites

Before you start, make sure you have:

- Node.js 20+
- pnpm 9+
- PostgreSQL 14+ or a compatible managed Postgres instance
- A Git client
- Access to an email sending service (the project uses Resend)

You should also have a frontend app or a route that can handle the owner setup link, because the platform operator and every customer organization owner are created through a token link sent by email.

## 2. Clone the repository

```bash
git clone <your-repo-url>
cd balootix-org/backend
```

## 3. Install dependencies

```bash
pnpm install
```

## 4. Create your environment file

Copy the example environment file and fill it in:

```bash
cp .env.example .env
```

Example values:

```env
APP_PORT=4000
APP_URL=http://localhost:4000/api
FRONTEND_URL=http://localhost:3000
NODE_ENV=development

JWT_ACCESS_SECRET=replace-with-a-long-random-secret
JWT_REFRESH_SECRET=replace-with-a-long-random-secret

DATABASE_URL=postgresql://postgres:postgres@localhost:5432/balootorg

RESEND_API_KEY=your-resend-api-key
RESEND_FROM_EMAIL=noreply@yourdomain.com
```

Important notes:

- `DATABASE_URL` must point to a PostgreSQL database that this app can access.
- `APP_URL` is the API base URL used for email links.
- `FRONTEND_URL` is the frontend origin used for owner setup and other user-facing links.
- In production, JWT secrets must be at least 32 characters long and HTTPS URLs are required.

## 5. Prepare the database

Create a Postgres database if needed, then run the Prisma contract migration/init flow.

For a brand new empty dev database:

```bash
pnpm prisma db init --advance-ref db
```

For an existing database:

```bash
pnpm prisma db migrate --show
pnpm prisma db migrate --advance-ref db
```

Then verify the schema:

```bash
pnpm prisma db verify --log-level info
```

## 6. Run the app locally

Development mode:

```bash
pnpm start:dev
```

Production build:

```bash
pnpm build
pnpm start:prod
```

The API will start on the `APP_PORT` value (default `4000`).

## 7. Bootstrap the platform operator (global admin)

Baloot Org is a multi-tenant SaaS. There are two kinds of privileged accounts, and they are intentionally separate:

- **Global admin (you, the platform operator):** manages the whole system, creates customer organizations and manages their subscriptions. Backed by an active `GlobalAdmin` record. It does **not** own a customer organization and has no `OWNER` role.
- **Organization OWNER (your customer):** the first user of one customer organization (tenant). Backed by the reserved `OWNER` role inside that tenant only. Each organization has its own OWNER.

Every login account still lives in a tenant. The platform operator's account lives in the internal platform tenant (the oldest tenant), which only holds the operator and is never a customer organization.

Run once:

```bash
pnpm owner:bootstrap -- "you@example.com" "Platform Operator"
```

This creates the platform tenant if needed and emails a one-time setup link. It refuses to run again once an active global admin exists. The command compiles the bootstrap entry with TypeScript first so NestJS constructor injection works correctly. The API server does not need to be running, but the database must be reachable and `.env` must be configured. The raw token is only sent in email; the database stores only a hash.

The link points to the frontend owner-setup page, for example:

```text
http://localhost:3000/owner-setup?token=...
```

Open it and choose a password. Setup creates a verified user plus the `GlobalAdmin` record, which unlocks the `/platform-admin` APIs and the global dashboard.

If you bootstrapped before the global-admin split and your account has no `GlobalAdmin` record, grant it once (the user must be verified and in the platform tenant):

```bash
pnpm owner:grant-platform-admin -- "you@example.com"
```

It is safe to rerun for an already-active global admin and rejects customer-tenant users.

## 8. What the global admin can do

As the platform operator you can:

- create a customer organization with its subscription (`POST /platform-admin/tenants`)
- invite or re-invite the organization's OWNER by email
- list tenants and their users
- change tenant status (`ACTIVE`, `TRIAL`, `SUSPENDED`, `ARCHIVED`) and subscription plan, status and period
- create users in any tenant through `POST /auth/register` with a `tenantId`

Global admins pass every authorization check. Suspending or archiving a tenant blocks sign-in and token refresh for its users; global admins are exempt so they can always reach the platform dashboard.

### Onboarding a customer organization

1. Log in as the global admin.
2. Create the organization with the owner's email, display name and plan (`TRIAL` gives a 14-day trial; paid plans start a 30-day period).
3. The owner receives an email link to `/owner-setup?token=...` and sets a password. This creates their verified user, the organization's root unit and the reserved `OWNER` role.
4. The owner logs in as OWNER of their organization and manages their own org. If the email is lost or expires (30 minutes), re-send it with `POST /platform-admin/tenants/:tenantId/owner-invite` while the organization has no owner yet.

Billing is not automated yet. Plan, status and period are set manually by the global admin; no payment provider is integrated.

## 9. Seed authorization data for a tenant

If you want to initialize permissions and tenant-protected routes for a specific tenant, run:

```bash
pnpm authorization:seed -- <tenantId>
```

This is safe to rerun; it creates the tenant's relevant roles and permission links without duplicating them. The tenant OWNER bypasses permission checks, so seeding is only needed once the owner starts delegating roles to other users.

## 10. Useful scripts

These are the main commands in this project:

```bash
pnpm install
pnpm build
pnpm test
pnpm start
pnpm start:dev
pnpm owner:bootstrap -- <email> "Display Name"
pnpm owner:grant-platform-admin -- <platform-user-email>
pnpm authorization:seed -- <tenantId>
pnpm auth-tokens:cleanup
```

## 11. Token cleanup

Verification, password reset, and owner setup tokens are stored as hashes only. Unused tokens are retained for 7 days after expiry and consumed tokens for 30 days after use.

To clean them up from the scheduler or a maintenance job:

```bash
pnpm auth-tokens:cleanup
```

This requires `DATABASE_URL` and deletes records in batches of 500 safely.

## 12. Typical first-run flow

1. Install dependencies with `pnpm install`
2. Create `.env` from `.env.example`
3. Create or configure the PostgreSQL database
4. Run Prisma database init/migrate (every migration in `migrations/app` must be applied, including the per-tenant `Role.systemKey` change)
5. Start the backend with `pnpm start:dev`
6. Run `pnpm owner:bootstrap -- <email> "Display Name"`
7. Open the email link in your frontend and set your password
8. Log in as the global admin
9. Create a customer organization and invite its owner
10. The owner accepts the invite, logs in and manages their organization

## 13. Troubleshooting

- If the app fails on startup, confirm `DATABASE_URL`, `JWT_ACCESS_SECRET`, and `JWT_REFRESH_SECRET` are set correctly.
- If email links do not work, confirm `APP_URL` and `FRONTEND_URL` are valid and reachable.
- If Prisma migration commands fail, make sure Postgres is running and the connection string is valid.
- If bootstrap says a platform admin has already been provisioned, the platform operator already exists. Use `pnpm owner:grant-platform-admin` only to repair an older account.
- If creating an organization says the owner invite could not be sent, the organization was still created; fix email delivery and use the owner-invite endpoint.
- If a customer owner cannot be invited because "a user already exists with this email", user emails are globally unique across all tenants.

## 14. Important security note

Never commit real secrets to GitHub. Use `.env` for local secrets and store production values via your deployment platform's secret manager.

# Tenant Authorization Policy

## Purpose

This document defines the authorization policy for tenant-scoped access in Baloot Org.

The system answers two questions:

1. What action is allowed on a resource?
2. Under which tenant and unit scope is that permission valid?

This authorization model is tenant-aware by design. All authorization checks are evaluated within the current tenant context, and a role is only considered valid if it belongs to the same tenant as the target resource and the target unit.

## Core rules

### 1. Tenant boundary is mandatory

Every authorization decision must be scoped to the current tenant.

- A user can only use roles assigned within their tenant.
- A role can only grant permissions within its owning tenant.
- A resource and permission must belong to the same tenant as the target action.
- A role assignment is invalid if `user.tenantId !== role.tenantId`.

### 2. SELF means direct role permissions only

`SELF` means:

- the user receives only the permissions directly assigned to that role
- the authorization engine does not include permissions from sibling or child roles in the same unit
- the unit hierarchy is not used to expand permissions in `SELF` mode

This is intentionally narrower than a unit inheritance policy.

### 3. DESCENDANTS means direct + descendant-unit permissions

`DESCENDANTS` means:

- permissions directly assigned to the selected role are included
- permissions assigned to roles in descendant units are also included
- permissions from unrelated branches are excluded
- the role must still be valid for the target unit and tenant

### 4. OWNER is a reserved system override

The `OWNER` role is a reserved system-level role used for the owner of one customer organization (tenant).

- there is at most one `OWNER` role per tenant; it is unique per `(tenantId, systemKey)`
- it is created by the owner invite flow, never by normal role management
- it is not treated as an ordinary permission-bearing role
- it bypasses permission checks when the assignment is active and valid for the tenant
- it must not be inferred from generic role permissions or from all roles in a unit
- it is evaluated by identity and tenant validity, not by a broad unit membership check

The system should not allow any arbitrary role to become `OWNER` through normal business logic. `OWNER` must be explicitly reserved and created only by the owner-setup flow.

### 5. Global admin is separate from tenant ownership

A `GlobalAdmin` is the platform operator and is not a tenant role.

- it is not evaluated as a tenant-local role
- it can be granted platform-level access outside the tenant hierarchy
- it should not inherit tenant role permissions by default
- the one-time platform bootstrap creates a verified user and a `GlobalAdmin` record only; it creates no `OWNER` role
- customer organization owners are created by the global admin through `POST /platform-admin/tenants`, and each gets their own tenant-scoped `OWNER` role
- for an older bootstrap account without a `GlobalAdmin` record, `pnpm owner:grant-platform-admin -- <platform-user-email>` grants platform access to a verified platform-tenant user

This separation keeps platform administration distinct from tenant-level authorization.

## Authorization model

Authorization requires both conditions to pass:

1. the user has an active, valid role assignment for the current tenant
2. the selected role or effective permission set authorizes the requested action in the target unit scope

The runtime flow is:

1. load the current authenticated user
2. resolve the tenant from the request context
3. ensure the tenant is active and valid
4. resolve the target resource and requested action
5. resolve the relevant permission record within the same tenant
6. load the user's active role assignments for that tenant
7. if any active assignment is `OWNER`, allow immediately
8. filter to roles attached to the same tenant and to valid units
9. evaluate role scope against the target unit
10. collect effective permissions based on `SELF` or `DESCENDANTS`
11. allow only if the required permission exists in the effective set

## Scope semantics

### `SELF`

`SELF` means only the permissions directly assigned to the selected role are considered.

Example:

- Role A in Unit X has permission `READ` on `Invoice`
- Role B in Unit X has permission `CREATE` on `Invoice`
- User holds Role A only
- With `SELF`, the user only receives `READ` from Role A and does not inherit from Role B or from other roles in the same unit

### `DESCENDANTS`

`DESCENDANTS` means the selected role is evaluated together with descendant roles in the unit tree.

Example:

- Unit Head Office
  - Finance
    - Accounts Payable
    - Payroll
- Role `Finance Manager` in Finance includes permission `APPROVE_PAYMENT`
- Role `Payroll Officer` in Payroll includes permission `PROCESS_PAYROLL`
- User assigned to `Finance Manager` with `DESCENDANTS`
- User receives `APPROVE_PAYMENT` and descendant-role permissions from units under Finance

## Permission and resource model

A resource represents a protected route or entity boundary.
A permission represents a specific allowed action on that resource.
A role-permission record links a role to a permission.

A permission is valid only when all of the following are true:

- the resource belongs to the same tenant
- the permission belongs to the same tenant
- the permission is attached to the role in the same tenant
- the role is active and valid for the target unit

## Tenant, subscription and status rules

The platform should treat tenant status as a core access gate.

- `Tenant.status` indicates the tenant health/state
- a tenant in an inactive or suspended state should not authorize normal business actions unless explicitly allowed
- subscription state should be evaluated separately from tenant approval state
- a tenant may exist without a valid active subscription, but access gating must reject non-allowed usage according to policy

The tenant lifecycle should define which states are active for business operations, and the authorization layer should enforce them consistently.

Currently enforced: users of a `SUSPENDED` or `ARCHIVED` tenant cannot log in or refresh tokens (global admins are exempt). Subscription state is recorded and managed by the global admin but does not gate access yet.

### Platform-admin API

All routes require a logged-in global admin.

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/platform-admin/tenants` | List tenants (paginated) |
| `GET` | `/platform-admin/tenants/:tenantId` | Get one tenant |
| `GET` | `/platform-admin/tenants/:tenantId/users` | List the tenant's users |
| `POST` | `/platform-admin/tenants` | Create a tenant with its subscription and email the owner invite. Body: `name`, `slug`, `ownerEmail`, `ownerDisplayName`, optional `plan` (default `TRIAL`) |
| `POST` | `/platform-admin/tenants/:tenantId/owner-invite` | Re-send the owner invite (only while the tenant has no owner). Body: `ownerEmail`, `ownerDisplayName` |
| `PATCH` | `/platform-admin/tenants/:tenantId/status` | Set tenant status. Body: `status` |
| `GET` | `/platform-admin/tenants/:tenantId/subscription` | Read the subscription |
| `PATCH` | `/platform-admin/tenants/:tenantId/subscription` | Update `plan`, `status` and/or `currentPeriodEnd` |

The platform tenant itself cannot be managed through these routes. `GET /auth/me` and the login response include `tenantId` and `isGlobalAdmin`. `POST /auth/register` creates the user in the caller's tenant; only global admins may pass a different `tenantId`.

## Unit and role policy

The unit model is the organizational boundary for permission evaluation.

- each role belongs to a tenant and a unit
- each role has an effective scope: `SELF` or `DESCENDANTS`
- the role must belong to the same tenant as the requesting user
- the target unit must be valid within the same tenant
- a target unit outside the relevant scope must fail authorization even if the action exists on the role

## Practical enforcement order

The recommended enforcement order is:

1. resolve current user and tenant
2. confirm tenant is valid and active
3. resolve route/resource and action
4. resolve permission in tenant scope
5. load active role assignments for the tenant
6. if any active role is `OWNER`, allow immediately
7. evaluate role validity and unit scope
8. compute effective permissions using `SELF` or `DESCENDANTS`
9. deny when the required permission is absent

## Database guidance for the authorization layer

These rules should be enforced in the data model and app logic:

- `Unit.parentId` references `Unit.id`
- an organizational unit cannot be its own parent
- hierarchy changes must not create cycles
- `Role.unitId` references `Unit.id`
- `Role.scope` accepts only `SELF` or `DESCENDANTS`
- `RoleAssignment` must be unique per `tenantId`, `userId`, and `roleId`
- a tenant-scoped role assignment must never cross tenants
- deleting units with child units or roles should be prevented by policy, not only by basic foreign keys

Cycle prevention and unit-deletion rules require explicit enforcement beyond a simple foreign-key relation.

## Prisma database recovery

- For a new, empty dev database, run `pnpm prisma db init --advance-ref db`.
- For an existing database, preview the changes with `pnpm prisma db migrate --show`, then apply them with `pnpm prisma db migrate --advance-ref db`.
- Seed a tenant's protected routes and required permissions with `pnpm authorization:seed -- <tenantId>`. It is safe to rerun; tenants create their own roles and permission links.
- If you edit a migration, re-emit it with `node migrations/app/<migration>/migration.ts` before applying it. Plan each contract change only once.
- If a migration hash keeps changing, check whether its backfill updates `updatedAt`; use stable SQL so each emit produces the same migration.
- Check the final schema with `pnpm prisma db verify --log-level info`.

## Authentication token retention

Verification, password-reset, and owner-setup token rows contain only token hashes. Cleanup retains unused tokens until 7 days after expiry and consumed tokens for 30 days after use. Run `pnpm auth-tokens:cleanup` daily from the deployment scheduler; the command deletes in batches of 500 and can safely overlap another run. It requires `DATABASE_URL` and does not run an in-process timer.

## Public API response contract

JSON success responses use this envelope. `code` matches the HTTP status, and `data` is the endpoint payload:

```json
{
  "success": true,
  "code": 200,
  "message": "Successful request!",
  "data": {}
}
```

Paginated list endpoints place `items` and `pagination` inside `data`. Pagination includes `page`, `pageSize`, `total`, `totalPages`, `hasPreviousPage`, and `hasNextPage`. Requests default to page 1 and 25 items, and page size is capped at 100. Each endpoint documents its supported filter and sort fields through its query validation; unsupported sort/filter fields return 400.

Errors use the same status/code relationship and never include stack traces or internal exception details:

```json
{
  "success": false,
  "code": 404,
  "message": "Resource not found"
}
```

`message` is human-readable and may vary by error. Clients should branch on the HTTP status or `code`, not parse message text. Validation messages are currently joined into a single string. Unexpected server errors always return code 500 and the generic `Internal server error` message.

### Platform-admin tenant summaries (target contract, not yet exposed)

The summary and dashboard shapes below are defined as types but are not returned by any endpoint yet; the tenant list currently returns only the public tenant fields (`id`, `slug`, `name`, `status`, timestamps).

Platform-admin tenant lists use the same paginated envelope. Each tenant item contains its public tenant identity and lifecycle `status`, a nullable `subscription` summary (`plan`, subscription `status`, `currentPeriodStart`, `currentPeriodEnd`, and `cancelAt`), and a `usage` summary. Usage counts include total and verified users, total and active units, and total and active roles. These are counts, not entitlements or billing quantities.

The dashboard payload contains `generatedAt`, total tenant count, tenant counts by lifecycle status, subscription counts by subscription status, tenants without a subscription, aggregate usage, and the paginated tenant list. Tenant lifecycle status and subscription status remain distinct; a missing subscription is represented as `null` and counted separately. Payment-provider identifiers and payment details are intentionally excluded.

```json
{
  "id": "tenant-id",
  "slug": "northwind",
  "name": "Northwind",
  "status": "ACTIVE",
  "subscription": {
    "plan": "GROWTH",
    "status": "ACTIVE",
    "currentPeriodStart": "2026-10-01T00:00:00.000Z",
    "currentPeriodEnd": "2026-11-01T00:00:00.000Z",
    "cancelAt": null
  },
  "usage": {
    "userCount": 42,
    "verifiedUserCount": 39,
    "unitCount": 8,
    "activeUnitCount": 7,
    "roleCount": 12,
    "activeRoleCount": 11
  }
}
```

## Relationship cardinalities

The following describes the model relationships. The relation fields are ORM navigation fields; the foreign-key scalar fields are the actual database columns.

- `User` 1:N `EmailVerificationToken`; FK is `EmailVerificationToken.userId`
- `Resource` 1:N `Permission`; FK is `Permission.resourceId`
- `Unit` 1:N `Role`; FK is `Role.unitId`
- `Unit` 1:N child `Unit`; optional FK is `Unit.parentId`
- `Role` N:M `Permission`, implemented through `RolePermission` (`roleId`, `permissionId`)
- `User` N:M `Role`, implemented through `RoleAssignment` (`userId`, `roleId`)
- `Tenant` 1:N `User`, `Unit`, `Role`, `Resource`, `Permission`, `RoleAssignment`, `RolePermission`, `Subscription`, and related tenant-owned records

## Summary

The authorization design is intentionally strict:

- tenant-scoped by default
- `SELF` = direct role only
- `DESCENDANTS` = direct + descendant unit permissions
- `OWNER` = reserved override handled separately from ordinary role permissions
- platform admin is deliberately isolated from tenant auth
- authorization is enforced only after tenant, unit, role, scope, and permission validity are all confirmed
