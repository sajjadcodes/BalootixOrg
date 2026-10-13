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

The `OWNER` role is a reserved system-level role used for the tenant owner or platform bootstrap case.

- it is not treated as an ordinary permission-bearing role
- it bypasses permission checks when the assignment is active and valid for the tenant
- it must not be inferred from generic role permissions or from all roles in a unit
- it is evaluated by identity and tenant validity, not by a broad unit membership check

The system should not allow any arbitrary role to become `OWNER` through normal business logic. `OWNER` must be explicitly reserved and managed in the bootstrap flow.

### 5. Global admin is separate from tenant ownership

A `GlobalAdmin` is a platform-level actor and is not a tenant role.

- it is not evaluated as a tenant-local role
- it can be granted platform-level access outside the tenant hierarchy
- it should not inherit tenant role permissions by default

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

### Platform-admin tenant summaries

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
