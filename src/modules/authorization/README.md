# Organizational Authorization Plan

## Purpose

This proposal introduces organizational scope and inheritance on top of the existing RBAC authentication service.

Existing RBAC answers:

> What action can a role perform?

The organizational authorization layer additionally answers:

> In which organizational unit can that role perform the action?

`SELF` means the user receives only the permissions directly assigned to the selected role.

`DESCENDANTS` means the user receives:

- Permissions directly assigned to the selected role.
- Permissions assigned to roles belonging to descendant organizational units.

A **resource** represents a protected route. A **permission** represents an action or HTTP method allowed on that resource. A **role-permission** record connects a role to a permission.

## Authorization Model

Authorization requires both checks to succeed:

1. The role must have permission to perform the requested action.
2. The role must be valid for the target organizational unit.

The authorization flow is:

1. user has active assignments?
2. any active role is OWNER? -> allow immediately
3. resource exists?
4. permission exists for that resource/action?
5. role scope valid for target unit?
6. effective permissions include the required permission?
7. allow or deny

At the app level, the meaning of the components is:

- `@RequirePermission` = route policy declaration
- `AuthorizationGuard` = request context extraction
- `AuthorizationService` = business rule enforcement
- `Role.scope` = SELF vs DESCENDANTS
- `OWNER` = global override for system admin / app owner

The practical flow is:

1. Resolve the requested route and HTTP method using the user object.
2. Find the required permission record.
3. Load the user's assigned roles.
4. If any active role is OWNER, allow immediately.
5. Find roles that contain the required permission.
6. Determine the target organizational unit.
7. Check whether the target unit is inside the role's scope.
8. Allow the request if at least one role passes both checks; otherwise deny it.

## Example

Assume this organizational structure:

```text
Head Office
├── Finance
│   ├── Accounts Payable
│   └── Payroll
└── Human Resources
```

The following roles exist:

- Finance Manager belongs to Finance and can approve payments.
- Accounts Payable Officer belongs to Accounts Payable and can manage invoices.
- Payroll Officer belongs to Payroll and can process payroll.
- HR Manager belongs to Human Resources and can manage employee records.

Alice is assigned only the Finance Manager role. With `DESCENDANTS` scope, Alice receives the Finance Manager permissions and permissions belonging to roles in Accounts Payable and Payroll. She does not receive HR Manager permissions because Human Resources is not a descendant of Finance.

With `SELF` scope, Alice receives only permissions assigned directly to Finance Manager, not permissions from roles in descendant units.

## Unit APIs

The authorization layer should provide operations to:

- Create a unit.
- Update a unit.
- List units.
- Retrieve the unit tree.
- Move a unit.
- Deactivate an organizational unit.

## Database Rules

Recommended constraints and validation include:

- `Unit.parentId` references `Unit.id`.
- An organizational unit cannot be its own parent.
- Hierarchy changes must not create cycles.
- `Role.unitId` references `Unit.id`.
- Role scope accepts only `SELF` or `DESCENDANTS`.
- A user cannot receive the same role assignment more than once.
- Organizational units containing child units or roles should not be deleted directly; deactivate them instead.

Cycle prevention and restrictions on deleting units with dependents require explicit enforcement; ordinary foreign keys do not prevent hierarchy cycles. Review database `onDelete` behavior against the no-direct-delete rule before applying schema changes.

## Relationship Cardinalities

The following describes model relationships. Relation fields are ORM navigation fields, not database columns. The foreign-key scalar fields are the columns.

- `User` 1:N `EmailVerificationToken`; the FK is `EmailVerificationToken.userId`.
- `Resource` 1:N `Permission`; the FK is `Permission.resourceId`.
- `Unit` 1:N `Role`; the FK is `Role.unitId`.
- `Unit` 1:N child `Unit`; each child has an optional `Unit.parentId` FK.
- `Role` N:M `Permission`, implemented through `RolePermission` (`roleId`, `permissionId`).
- `User` N:M `Role`, implemented through `RoleAssignment` (`userId`, `roleId`).
