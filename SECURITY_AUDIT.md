# Rootline security review

This review covers the current frontend and FastAPI backend.

## Changes made

- Added configurable sliding-window rate limits:
  - Strict authentication limits per IP and account.
  - Exponential retry delays after failed authentication attempts.
  - Separate, looser read/write limits for authenticated users.
  - `Retry-After` headers on `429` responses.
  - The limiter does not trust a user-supplied forwarding header.
- Added strict request schemas:
  - Unknown JSON fields are rejected.
  - Names, notes, places, occupations, tokens, and IDs have bounds.
  - Email addresses are validated and normalized.
  - Relationship and gender values use allow-lists.
  - Impossible life dates are rejected.
- Removed the unused photo/image option from the UI and API schemas.
  - Existing database columns are left in place for non-destructive upgrades,
    but new API requests cannot write or return image data.
- Added generic production error responses for validation, database, and
  unexpected server errors. Detailed exceptions stay in server logs only.
- Replaced password-reset URL logging with SMTP delivery. If SMTP is not
  configured, the reset URL is not logged; local link logging requires an
  explicit non-production flag.
- Invalid UUIDs in bearer tokens now return `401` instead of causing an
  internal error.
- Added a root `.gitignore` covering environment files, local databases,
  Python caches, build output, and dependency folders.
- Upgraded React Router to `7.18.3`.

## Verification

- Frontend production build: passed.
- Python syntax compilation: passed.
- Frontend production dependency audit: **0 vulnerabilities**.
- Secret-pattern scan of the project and available Git history: no real
  credentials found. The only match in the source is an example key in a
  bundled skill document; no Git commits are present in this copy to audit.
- Backend `pip-audit`: attempted, but the environment could not complete the
  audit because the package firewall blocked `python-jose` metadata and the
  isolated audit environment could not build `pydantic-core` on Python 3.13.
  Run `pip-audit -r backend/requirements.txt` in CI or the deployment image
  before release.

## Deployment note

The current limiter stores counters in process memory. That is appropriate for
one backend instance and is safer than having no limit, but a multi-instance
deployment should move the limiter state to Redis so all instances share the
same counters. Keep `SECRET_KEY`, database credentials, and Google OAuth
secrets in the deployment secret manager, never in `.env` files committed to
the project.