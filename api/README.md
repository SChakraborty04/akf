# SHG+ — User Backend API

Production-ready backend API for the **SHG+ Self Help Group Management Application**. Built on **Hono + Drizzle ORM + PostgreSQL / Neon Serverless**, deployable to Cloudflare Workers or Node/Bun containers.

---

## 1. Architectural Overview

```
akf/
├── api/                     <-- Backend API Service
│   ├── src/
│   │   ├── db/
│   │   │   ├── schema.ts    <-- PostgreSQL Drizzle schema (groups, members, loans, repayments, deposits, ledger)
│   │   │   ├── client.ts    <-- Neon HTTP driver for fast reads + Neon Pool for ACID transactions
│   │   │   └── seed.ts      <-- Seed data generator matching PWA initial state
│   │   ├── lib/             <-- Business maths & security utilities
│   │   │   ├── interest.ts  <-- Exact port of PWA interest schedule & waterfall logic
│   │   │   ├── password.ts  <-- Web Crypto PBKDF2-SHA256 password hashing
│   │   │   ├── tokens.ts    <-- HS256 JWT access tokens & rotating refresh tokens
│   │   │   └── idempotency.ts <-- Client UUID deduplication for offline retries
│   │   ├── middleware/      <-- Bearer JWT authentication & operator role guard
│   │   ├── services/        <-- Domain services (deposits, loans, repayments, ledger, summary)
│   │   ├── routes/          <-- User API endpoints (/v1/*)
│   │   ├── admin/           <-- Admin API router scaffold (/admin/*)
│   │   ├── app.ts           <-- Hono app factory with CORS, error handling & routes
│   │   └── index.ts         <-- Cloudflare Worker entry point
│   ├── admin/               <-- Dedicated Admin API architecture & design documentation
│   ├── drizzle/             <-- Versioned SQL migration files
│   ├── scripts/             <-- CLI utilities (seed.ts)
│   └── tests/               <-- Bun test suite with in-process PGlite PostgreSQL (28 tests)
└── pwa/                     <-- React + Vite PWA frontend
```

---

## 2. Database Schema Design

The schema is normalized for multi-tenant SHG operations, scoped by `group_id`:

| Table | Purpose | Matches PWA Entity |
|---|---|---|
| `groups` | SHG profile, meeting day, stamp value (₹50), monthly interest rate (2%), repayment rate (2%) | `groupProfile` |
| `cycles` | Lending cycles (e.g. Cycle #3: 50 weeks) | `groupProfile.cycle*` |
| `users` | Operator and viewer logins with bcrypt/PBKDF2 passwords, failed attempt lockouts, sessions | `AuthContext` |
| `refresh_tokens` | Rotating SHA-256 hashed refresh tokens with token-reuse revocation | Session management |
| `loan_shapes` | Physical geometric stamp denominations (`pentagon` ₹500, `circle` ₹1,000, `triangle` ₹3,000, `star` ₹5,000, `sun` ₹10,000) | `loanShapes` |
| `members` | SHG member profiles, household number (`hh_no`), socio-economic and asset demographics | `members` / `MemberDetailModal` |
| `deposits` | Meeting savings collections with total stamp count and total amount | `deposits` |
| `deposit_items` | Member-level contributions (0–5 stamps per meeting) | `deposit.memberDeposits` |
| `loans` | Loan disbursements with human-friendly reference `L-0001` and active/paid status | `loans` |
| `loan_stamps` | Shape stamps that make up the loan principal | `loan.stamps` |
| `repayments` | Loan repayments with interest-first waterfall split (`interest_deducted`, `principal_deducted`) | `repayments` |
| `repayment_stamps` | 2% shape stamps used to pay interest and principal | `repayment.stamps` |
| `ledger_entries` | Immutable audit log of all financial movements (deposits, loans, repayments) | `ledger` |

---

## 3. Financial Calculations & Business Logic

The backend strictly matches the PWA's business logic (`pwa/src/utils/calculations.js`) with zero floating-point drift:

### A. Elapsed Months
- `calculateElapsedMonths(startDate, asOfDate)`
- Same month count is **1**.
- If even one day of the next month has started, it rounds up to a full month (e.g. `2026-01-15` to `2026-02-16` = **2 months**).

### B. Accrued Interest
- Simple interest computed on **original loan principal** at 2%/month:
  $$\text{Accrued Interest} = \text{round}\left(\frac{\text{principal} \times 200 \times \text{elapsedMonths}}{10000}\right)$$

### C. Repayment Waterfall
Repayments deduct accrued interest **first**, remainder reduces principal:
1. $\text{Interest Deducted} = \min(\text{Amount Paid}, \text{Unpaid Accrued Interest})$
2. $\text{Principal Deducted} = \max(0, \text{Amount Paid} - \text{Interest Deducted})$
3. When $\text{Remaining Principal} \le 0$, the loan is marked as `paid` and closed.
4. Overpayments exceeding total due are rejected with `422 OVERPAYMENT`.

### D. Available Balance
$$\text{Available Balance} = (\text{Total Savings} + \text{Total Repayments}) - \text{Total Loans Disbursed}$$

---

## 4. API Endpoints Reference (`/v1/*`)

All user endpoints (except `/v1/auth/login` and `/v1/auth/refresh`) require a `Bearer <token>` in the `Authorization` header.

### Auth
- `POST /v1/auth/login` — Authenticate operator/viewer; returns JWT access token + rotating refresh token.
- `POST /v1/auth/refresh` — Exchange refresh token for a new access token and rotated refresh token.
- `POST /v1/auth/logout` — Revoke device refresh token.
- `POST /v1/auth/logout-all` — Revoke all active sessions for the user.
- `GET /v1/auth/me` — Current user profile and group info.
- `PATCH /v1/auth/me` — Update full name or language preference (`en` / `hi`).
- `POST /v1/auth/change-password` — Change password and invalidate other sessions.

### Group & Master Data
- `GET /v1/group` — SHG profile, cycle progress, stamp value, meeting day, member count.
- `GET /v1/group/shapes` — Configured loan shape stamps with face value and repayment (2%) value.
- `GET /v1/members` — List all active members ordered by household number.
- `GET /v1/members/:id` — Member KYC + 3-card financial overview (total savings, active loans, total repaid).

### Deposits (Meeting Savings)
- `GET /v1/deposits?from=&to=&memberId=&page=&limit=` — List deposits with member breakdown.
- `GET /v1/deposits/:id` — Single deposit details.
- `POST /v1/deposits` — Record meeting savings with stamps per member. Supports `clientId` for offline idempotency.

### Loans
- `GET /v1/loans?from=&to=&memberId=&status=&page=&limit=` — Loans list with live interest calculation.
- `GET /v1/loans/:id?asOf=YYYY-MM-DD` — Loan detail + month-by-month interest schedule + repayment history.
- `POST /v1/loans` — Disburse loan by shape stamps (`sun`, `star`, etc.). Supports `clientId` for offline idempotency.

### Repayments
- `GET /v1/repayments?from=&to=&memberId=&loanId=&page=&limit=` — Repayments list with waterfall breakdown.
- `POST /v1/repayments/preview` — Read-only dry run calculating interest deduction and remaining principal.
- `POST /v1/repayments` — Record repayment using 2% shape stamps. Auto-marks loan paid upon completion. Supports `clientId`.

### Ledger & Dashboard
- `GET /v1/ledger?from=&to=&memberId=&type=&page=&limit=` — Credit/debit transaction feed with summary totals.
- `GET /v1/dashboard` — 4-quadrant summary (`totalSaving`, `totalLoan`, `avlBalance`, `interestReceivable`) + 5 recent transactions.
- `GET /v1/snapshot` — Complete offline dataset in a single call for PWA IndexedDB cache sync.

---

## 5. Admin API (`api/admin` & `/admin/*`)

As requested, the **Admin API** has a dedicated folder and scaffold:
- Architecture and design documented in [`admin/README.md`](file:///Volumes/Marq_1%20TB/akf/api/admin/README.md).
- Scaffolded router in [`src/admin/routes.ts`](file:///Volumes/Marq_1%20TB/akf/api/src/admin/routes.ts).
- Mounted at `/admin/*` in `src/app.ts` (with `GET /admin/health`).
- Covers multi-group federation, user provisioning, custom shapes, cycle rollovers, and MIS reporting.

---

## 6. Development & Testing

### Prerequisites
- [Bun](https://bun.sh) (v1.2+) or Node.js (v20+)

### Commands
```bash
# Type-check TypeScript
bun run typecheck

# Run test suite with in-process PostgreSQL (28 tests)
bun test

# Seed database with PWA demo data (Lakshi Group, 12 members, 5 shapes)
bun run seed

# Run local Cloudflare Worker development server
bun run dev

# Deploy to Cloudflare Workers
bun run deploy
```
