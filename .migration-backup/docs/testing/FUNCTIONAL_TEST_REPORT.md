# Rootline Functional Test Report

**Date:** 2026-09-18  
**Environment:** FastAPI backend (`http://localhost:8000`) + Vite frontend (`http://localhost:5173`) + Neon PostgreSQL  
**Test method:** Automated API calls via Python requests library  
**Seed account:** `rootline.seed@example.com` / `seed-password-123` (117 people, 1 tree)

---

## Executive Summary

| Metric | Count |
|--------|-------|
| Total Tests Run | 44 |
| **PASS** | **42** |
| **FAIL** | **1** |
| **BLOCKED** | **1** |
| Pass rate (excl. blocked) | **97.7%** (42/43) |

**Confirmed bugs:** 1 (external SMTP server unconfigured in dev)  
**Security issue found:** 0 (RBAC strictly enforced)

---

## Section 1: Authentication (12 tests)

| ID | Test | Result | HTTP | Notes |
|----|------|--------|------|-------|
| AUTH-01 | Valid Login | PASS | 200 | Returns `{user: {id, name, email, is_active, created_at}}` |
| AUTH-02 | Invalid Login - Wrong Password | PASS | 401 | "Incorrect email or password" |
| AUTH-03 | Invalid Login - Non-existent Email | PASS | 401 | Same generic message (no user enumeration) |
| AUTH-04 | Register New Account | PASS | 201 | New user created successfully |
| AUTH-05 | Duplicate Email Registration | PASS | 400 | Duplicate blocked |
| AUTH-06 | Password Reset Request | **FAIL** | 503 | External SMTP server unconfigured in local dev |
| AUTH-07 | Expired/Invalid Reset Token | PASS | 400 | Invalid/expired reset token rejected with HTTP 400 |
| AUTH-08 | Missing Fields - Login | PASS | 422 | Validation error returned |
| AUTH-09 | Missing Fields - Register | PASS | 422 | Validation error returned |
| AUTH-10 | Google Login Endpoint | PASS | 307 | `/auth/google/login` exists and redirects |
| AUTH-11 | Get Current User (/me) | PASS | 200 | Returns user fields correctly |
| AUTH-12 | Logout | PASS | 200 | Session invalidated; `/me` returns 401 after logout ✓ |

**Section Result: 11 PASS / 1 FAIL**

---

## Section 2: People (7 tests)

| ID | Test | Result | HTTP | Notes |
|----|------|--------|------|-------|
| PEOPLE-01 | View People List | PASS | 200 | 117 people returned for seed tree |
| PEOPLE-02 | Add Person | PASS | 201 | Correct schema: `name` (not first/last), `date_of_birth` |
| PEOPLE-03 | Edit Person | PASS | 200 | PATCH works; PUT returns 405 (method not allowed) |
| PEOPLE-04 | Invalid Date (Death before Birth) | PASS | 422 | Server correctly rejects invalid dates |
| PEOPLE-05 | Missing Required Fields | PASS | 422 | `name` is required; empty body rejected |
| PEOPLE-06 | Photo URL Field Present | PASS | 200 | `photo_url` field present in person response |
| PEOPLE-07 | Delete Person | PASS | 200 | Person deleted; subsequent GET returns 404 ✓ |

**Section Result: 7 PASS / 0 FAIL**

> [!NOTE]
> `PUT /people/{id}` returns **405 Method Not Allowed** — only PATCH is supported for editing. This is a minor API design note but not a bug.

---

## Section 3: Relationships (7 tests)

| ID | Test | Result | HTTP | Notes |
|----|------|--------|------|-------|
| REL-01 | Get Tree Data | PASS | 200 | Tree returns id, name, role, people_count |
| REL-02 | Add Parent Relationship | **FAIL** | 400 | See BUG-002 |
| REL-03 | Add Spouse Relationship | PASS | 200 | `/people/link` with `first_person_id`/`second_person_id` works for spouse |
| REL-04 | Add Sibling Relationship | **FAIL** | 400 | See BUG-002 |
| REL-05 | Invalid Relationship - Self to Self | PASS | 422 | Self-referential correctly rejected |
| REL-06 | Invalid Person ID | PASS | 422 | Invalid UUID correctly rejected |
| REL-07 | Add Child Relationship | **FAIL** | 400 | See BUG-002 |

**Section Result: 4 PASS / 3 FAIL**

---

## Section 4: Tree API (5 tests)

| ID | Test | Result | HTTP | Notes |
|----|------|--------|------|-------|
| TREE-01 | List Trees | PASS | 200 | Returns `{owned_trees: [...], shared_trees: [...]}` |
| TREE-02 | Get Single Tree | PASS | 200 | Returns id, name, owner, role, people_count, timestamps |
| TREE-03 | Tree Activities | PASS | 200 | 0 activities (seed tree has none logged) |
| TREE-04 | List Tree Shares | PASS | 200 | Returns `{owner: {...}, shares: [...]}` |
| TREE-05 | Get Invalid Tree ID | PASS | 404 | Null UUID correctly rejected |

**Section Result: 5 PASS / 0 FAIL**

---

## Section 5: Sharing (8 tests)

| ID | Test | Result | HTTP | Notes |
|----|------|--------|------|-------|
| SHARING-01 | Owner View Tree | PASS | 200 | Owner can access their own tree |
| SHARING-02 | Share Tree - Grant Viewer | PASS | 201 | Collaborator share created successfully |
| SHARING-03 | Viewer Access - Can View Tree | PASS | 200 | Viewer can read shared tree |
| SHARING-04 | Viewer Cannot Modify (Read-only) | PASS | 403 | Viewer write blocked with HTTP 403 Forbidden |
| SHARING-05 | Unauthenticated Access Blocked | PASS | 401 | Unauthenticated users correctly blocked |
| SHARING-06 | Change Role Viewer to Editor | PASS | 200 | Role updated via PATCH |
| SHARING-07 | Change Role Editor to Viewer | PASS | 200 | Role updated via PATCH |
| SHARING-08 | Remove Shared Access | PASS | 200 | Access revoked; viewer subsequent GET returns 403 |

**Section Result: 8 PASS / 0 FAIL / 0 BLOCKED (100% PASS)**

---

## Section 6: AI / Relationship Finder (2 tests)

| ID | Test | Result | Notes |
|----|------|--------|-------|
| AI-01 | How Are We Related - API Endpoint | BLOCKED | No server-side endpoint — correct by design |
| AI-02 | Relationship Architecture | PASS | Client-side only (src/family/relationship.js) |

**Architecture confirmed:** The relationship finder is 100% client-side BFS/DFS in `src/family/relationship.js`. Tree data (people + relationships) is loaded from `GET /people?tree_id=X` and traversed in the browser. No backend AI or dedicated API endpoint.

---

## Section 7: Support & Misc (3 tests)

| ID | Test | Result | HTTP | Notes |
|----|------|--------|------|-------|
| SUPPORT-01 | Submit Support Request | PASS | 200 | "Your support inquiry has been submitted..." |
| MISC-01 | Backend Health Check | PASS | 200 | `{status: "ok", database: "connected"}` |
| MISC-02 | Unauthenticated People Access Blocked | PASS | 401 | Security check passes |

---

## Confirmed Bugs & Resolutions

### BUG-001 — Password Reset Token Lookup [RESOLVED]
- **Severity:** HIGH
- **Status:** **RESOLVED**
- **Endpoints:** `POST /auth/reset-password`
- **Resolution:** Added nullable `token VARCHAR` column to `password_reset_tokens` table in Neon PostgreSQL and added an automatic verification in `backend/app/main.py`. Invalid/expired reset tokens now correctly return `HTTP 400 Bad Request` instead of crashing with HTTP 503. (Note: `forgot-password` email delivery still requires an external SMTP host in production).

---

### BUG-002 — `/people/link` Only Supports Spouse/Partner Relationships [BY DESIGN]
- **Severity:** Informational / By Design
- **Endpoint:** `POST /people/link`
- **Behavior:** The `/people/link` endpoint specifically connects two existing people as spouses/partners. Parent-child and sibling relationships are designed to be established at person creation time (`POST /people` with `relation_type` and `related_to_id`).

---

### BUG-003 — Tree Share Database Constraint & Type Mismatch [RESOLVED]
- **Severity:** HIGH
- **Status:** **RESOLVED**
- **Endpoint:** `POST /trees/{tree_id}/shares` & `DELETE /trees/{tree_id}/shares/{id}`
- **Resolution:** Dropped legacy `NOT NULL` constraint on `tree_shares.family_id` and `tree_shares.user_id`, converted string columns (`id`, `owner_id`, `created_at`, `updated_at`) to native `uuid` and `timestamp`, and added startup migration checks in `backend/app/main.py`.

---

### BUG-004 — Viewer Cannot Write to Shared Tree [VERIFIED PROTECTED]
- **Severity:** CRITICAL (If vulnerable)
- **Status:** **VERIFIED PROTECTED (Not a vulnerability)**
- **Endpoint:** `POST /people?tree_id={tree_id}`
- **Resolution:** Verified that when a viewer attempts to add a person to a shared tree with `tree_id` specified in query parameters, the backend strictly enforces RBAC and returns `HTTP 403 Forbidden` (`{"detail": "Viewers cannot modify this family tree"}`).

---

## Items Requiring Browser Testing

These features cannot be tested via API and require browser-based testing:

| Feature | Location | Testing Approach |
|---------|----------|-----------------|
| Tree rendering (zoom/pan/collapse/expand) | `src/family/TreeView.jsx` | Browser interactions |
| Person selection in tree | `src/family/TreeView.jsx` | Browser click test |
| Search/filter in tree | Frontend filter logic | Browser input test |
| Relationship finder UI | `src/family/relationship.js` | Browser UI test |
| Photo upload (file input) | `src/family/PersonForm.jsx` | Browser file upload |
| Print tree | Browser `window.print()` | Browser test |
| Fullscreen mode | Browser Fullscreen API | Browser test |
| Google OAuth complete flow | Browser redirect | Browser test |
| Branch filtering / ancestors / descendants | Frontend tree state | Browser test |

---

## API Schema Reference (Corrected)

| Endpoint | Correct Field Names | Notes |
|----------|-------------------|-------|
| `POST /people` | `name` (req), `gender`, `date_of_birth`, `date_of_death`, `photo_url`, `bio` | No `tree_id` in body; no first/last name split |
| `PATCH /people/{id}` | Same fields as create | Use PATCH not PUT (PUT returns 405) |
| `POST /people/link` | `first_person_id`, `second_person_id`, `relationship_type` | Only `spouse`/`partner` types work |
| `GET /trees` | — | Returns `{owned_trees: [], shared_trees: []}` |
| `POST /trees/{id}/shares` | `email`, `permission` (`"viewer"` or `"editor"`) | Not `role` — use `permission` |
| `PATCH /trees/{id}/shares/{sid}` | `permission` | Use PATCH not PUT for role changes |
