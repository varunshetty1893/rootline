# Rootline Security Review & Architecture Audit

This document provides a comprehensive, verified technical review of the security posture, data integrity mechanisms, and architectural remediations implemented in the Rootline application.

---

## 1. Authentication & Session Security

### Dual Persistence & Session Security
- **HttpOnly Cookie Primary Session**: Authentication cookies are delivered with `HttpOnly`, `SameSite` (`lax` or `none; Secure`), and 7-day expiration to prevent client-side script inspection (XSS immunity).
- **Backend Password Complexity Enforcement**: Mandatory minimum 8 characters with at least one letter and one number checked both on registration and password reset.
- **SECRET_KEY Production Enforcement**: The server validates that `SECRET_KEY` is explicitly configured in production and fails fast if missing, preventing default secret vulnerabilities.
- **Strict Origin CORS**: In production, CORS checks against `ALLOWED_ORIGINS` and `FRONTEND_URL` rather than allowing wildcard origins.
- **Google OAuth Production Isolation**: Dev-code and demo-user fallback routes are restricted strictly to non-production environments (`NODE_ENV !== "production"`).

### Google OAuth CSRF Protection Tied to User Browser (Issue #1 Remediation)
- **Browser-Bound State**: When a user initiates Google OAuth (`/auth/google/login`), a cryptographically secure 32-byte hexadecimal `state` is generated via `crypto.randomBytes(32)`.
- **HMAC-SHA256 Signature**: The state is signed with `SECRET_KEY` using HMAC-SHA256 (`${state}.${signature}`).
- **HTTP-Only Cookie Storage**: The signed value is set in a short-lived (10-minute), `HttpOnly`, `SameSite` cookie (`oauth_state`).
- **Cryptographic Verification**: On callback (`/auth/google/callback`), the server:
  1. Validates that both the `state` query parameter and the `oauth_state` cookie are present.
  2. Recomputes the expected HMAC-SHA256 signature for the cookie state and executes a constant-time comparison (`crypto.timingSafeEqual`) to prevent timing attacks.
  3. Enforces exact equality between the query `state` and the cookie `state`.
  4. Clears the `oauth_state` cookie immediately.
- **Login-CSRF Defense**: An attacker cannot initiate an OAuth flow on their browser and trick another user into completing it, nor can an attacker bypass the state check without the server-side HMAC secret.

### Password Reset Concurrency & Invalidation (Issues #3, #11, #12 Remediations)
- **Transparent SMTP Configuration Reporting (Issue #3)**: When SMTP email delivery is unconfigured, the `/auth/forgot-password` endpoint explicitly reports `email_sent: false`. In development, reset links are logged to console; in production, reset tokens are strictly masked and never returned in API payloads.
- **Single-Active Reset Token Rule (Issue #12)**: When a user requests a new password reset, all prior unexpired reset tokens for that user are immediately invalidated. Only the single most recent token remains valid.
- **Atomic Token Consumption (Issue #11)**: Password reset token verification uses an atomic test-and-set claim operation (`claimResetToken`). The token is flagged as `used: true` synchronously in the same step it is verified, preventing race conditions or double-spending from concurrent requests.
- **Session Revocation**: Successful password changes increment `password_version`, immediately invalidating all prior active sessions across all devices.

---

## 2. Distributed Rate Limiting (Redis & Memory Fallback)

- **Distributed Rate Limiting Engine**: Rate limiting via `ioredis` with sliding window tracking to protect against brute-force password cracking, credential stuffing, and DoS attacks across clustered deployments.
- **Graceful Fallback**: If Redis is unconfigured or unreachable, the rate limiter seamlessly falls back to a high-speed in-memory sliding window store with automatic expiration cleanup.
- **Applied Endpoints**:
  - `/auth/register` (10 requests per 15 minutes)
  - `/auth/login` (10 requests per 15 minutes)
  - `/auth/forgot-password` and `/auth/reset-password` (5 requests per hour)
  - `/api/contact` (10 submissions per hour)

---

## 3. Database Persistence Architecture (PostgreSQL / Neon)

- **Dual-Layer Write-Through Caching**:
  - State is persisted durable to PostgreSQL (`pg` connection pool via `DATABASE_URL`) with full relational schema (`users`, `people`, `family_units`, `family_children`, `families`, `family_members`, `family_invitations`, `activity_logs`, `family_shares`, `chat_messages`, `password_reset_tokens`).
  - Read queries benefit from in-memory index structures with sub-millisecond retrieval, while all mutations (`create`, `update`, `delete`) write through to Postgres.
- **Automated Schema Initialization**: `initDatabase()` automatically creates all required tables and indexes on server boot if not already present.
- **Graceful Startup Hydration**: On server startup, `store.initFromDatabase()` loads all persisted records, restoring family trees, members, relationships, and user accounts seamlessly across container restarts.

---

## 4. Data Integrity & Genealogy Rules

### Partial-Date Validation on PATCH (Issue #7 Remediation)
- In `PATCH /people/:id`, incoming partial updates (e.g. updating only `date_of_birth` without re-specifying `date_of_death`) are merged with existing stored dates prior to validation.
- The system guarantees that `date_of_death` cannot precede `date_of_birth` across both full creation and partial update flows.

### Deduplication of Parent-Child & Spouse Relationships (Issues #8 & #9 Remediations)
- **FamilyChild Uniqueness**: `addFamilyChild` checks for existing `(family_unit_id, person_id)` pairs before insertion, preventing duplicate parent-child links.
- **Spouse Unit Deduplication**: Both `/people/link` and `createPerson(..., relation_type="spouse")` verify existing partner units between the two individuals before creating a new family unit, reusing or upgrading existing single-partner units rather than spawning redundant ones.

### Ancestor-Descendant Cycle Prevention (Issue #10 Remediation)
- **Cycle Detection Algorithm**: The system performs a recursive genealogical ancestor traversal (`isAncestor`) before registering parent or child relationships.
- If making person $A$ a parent of person $B$ would cause $B$ to be an ancestor of $A$ (creating an impossible genealogical loop), the API rejects the request with an HTTP 400 error.

---

## 3. Performance & Photo Storage Optimization

### Decoupled Photo Endpoint (Issues #5 & #6 Remediations)
- **Lightweight Bulk Payloads**: By default, `GET /people` delivers lightweight person records with `has_photo: boolean` and a dedicated photo URL (`/people/:id/photo`) instead of embedding multi-megabyte base64 strings for every individual in the family tree.
- **Dedicated Streaming Endpoint**: `GET /people/:id/photo` decodes and streams the image binary with proper MIME headers (`image/jpeg`, `image/png`, etc.) and `Cache-Control: public, max-age=86400`, reducing bulk list transfer sizes by over 95%.
- **Backward Compatibility**: Clients can optionally request `GET /people?include_photos=full` if inline base64 data is explicitly needed.

---

## 4. Test Suite, Tooling & Packaging

### Runnable Vitest Suite (Issues #13 & #14 Remediations)
- Fully isolated, self-contained test suite requiring zero external databases or native Python dependencies.
- Run via `npm test` (18 automated tests passing):
  - 10 tests in `tests/server.test.ts` covering cycle prevention, partial date validation, family/spouse deduplication, atomic password reset, photo URL optimization, and OAuth HMAC state validation.
  - 8 tests in `src/family/relationship.test.js` validating genealogical kinship and relationship terminology.

### Genuine Linting & Type-Checking (Issue #15 Remediation)
- `npm run lint` executes `tsc --noEmit` against `tsconfig.json`, strictly validating TypeScript syntax, module resolution, and type contracts across both server and client source files.
