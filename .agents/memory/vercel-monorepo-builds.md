---
name: Vercel monorepo builds
description: Deployment constraints for the imported pnpm workspace when building outside Replit.
---

Vercel runs the workspace root build across all artifact packages, without Replit-only runtime variables such as PORT and BASE_PATH.

**Why:** The first deployment reached the build command and failed in unrelated workspace packages before producing the frontend bundle.

**How to apply:** Keep runtime validation in server entry points, but give Vite build configuration safe defaults for local dev-only values when those variables are absent during production builds.