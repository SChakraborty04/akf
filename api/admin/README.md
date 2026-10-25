# SHG+ — Admin API (Design & Architecture)

This folder contains the planned scaffolding for the **Admin API**, to be fully implemented in Phase 2.

## Architectural Separation

The user API (`/v1/*`) is focused on the offline-first field PWA:
- Scoped to the authenticated operator's active SHG group (`group_id`).
- High read frequency (cached in IndexedDB/PWA state).
- Simple atomic transactions (savings meetings, loan disbursements, shape-stamp repayments).

The **Admin API** (`/admin/*`) serves backend supervisors, federation managers, and MIS coordinators:
- Cross-group administration (multiple SHG groups across villages).
- Master configuration (stamp values, default interest rates, shape denominations).
- User and role provisioning (granting operator or viewer access to field staff).
- Audit trail, portfolio health reports, and regulatory reporting (NRLM / NABARD standards).

## Shared Data Model

Both APIs share the same PostgreSQL / Neon schema defined in `src/db/schema.ts`:
- `groups`: Multi-tenant root entity.
- `cycles`: Annual lending cycles.
- `users`: Operators, viewers, and future admin accounts.
- `members`: Member KYC and socio-economic demographics.
- `loan_shapes`: Configurable shape denominations (pentagon, circle, triangle, star, sun).
- `deposits` & `deposit_items`: Meeting savings records.
- `loans` & `loan_stamps`: Disbursed principal and stamp compositions.
- `repayments` & `repayment_stamps`: Waterfall collections.
- `ledger_entries`: Central immutable audit ledger.

## Planned Route Endpoints

### 1. SHG Group Management
- `GET /admin/groups`: List all SHG groups with high-level summary metrics (active loans, total savings, member count).
- `POST /admin/groups`: Provision a new SHG group with name, village, meeting day, stamp value, and interest rates.
- `GET /admin/groups/:id`: Retrieve detailed group configuration and active cycles.
- `PATCH /admin/groups/:id`: Update group settings (e.g. changing stamp value from ₹50 to ₹100 for the next cycle).

### 2. Cycle Operations
- `POST /admin/groups/:id/cycles`: Start a new cycle (e.g. Cycle #4).
- `POST /admin/groups/:id/cycles/close`: Close/reconcile the current cycle and archive accounts.

### 3. Master Shape & Stamp Denominations
- `GET /admin/shapes`: List system-wide master stamp shapes.
- `POST /admin/groups/:id/shapes`: Configure custom shape denominations for a specific group.

### 4. User Provisioning & Account Management
- `POST /admin/users`: Create operator or viewer login credentials for an SHG group.
- `POST /admin/users/:id/unlock`: Unlock an account locked out due to failed password attempts.
- `POST /admin/users/:id/reset-password`: Issue temporary password or force password change.
- `PATCH /admin/users/:id`: Toggle account active status or change roles.

### 5. MIS & Analytical Reporting
- `GET /admin/reports/portfolio`: Portfolio at Risk (PAR), collection efficiency %, and overdue tracking.
- `GET /admin/reports/export`: Export meeting records, repayment ledgers, and demographic data as CSV / Excel for MIS.
