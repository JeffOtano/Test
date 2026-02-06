# AGENTS.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Commands

- Install
  - npm install
- Develop (Next.js dev server at http://localhost:3000)
  - npm run dev
- Lint (uses eslint-config-next)
  - npm run lint
  - Auto-fix: npm run lint -- --fix
- Build (production)
  - npm run build
- Start (after build)
  - npm start
- Type-check (TypeScript, no emit)
  - npx tsc --noEmit
- Docker (from README)
  - Build: docker build -t goodbye-shortcut .
  - Run: docker run -p 3000:3000 goodbye-shortcut
- Tests
  - No test runner is configured (no test scripts present). If tests are added later (e.g., Vitest/Jest/Playwright), update this section with run/single-test examples.

## High-level architecture

- Framework and language
  - Next.js (App Router) with TypeScript. Styling via Tailwind CSS; UI components via shadcn/ui.
  - Path alias: import using @/* as defined in tsconfig.json.
- Key runtime principle
  - Client-first, database-free. User API tokens and app state are stored in browser localStorage; there is no server or external DB in this app.
- App structure (big picture)
  - src/app
    - page.tsx: Marketing/landing page and CTAs.
    - (app)/setup/page.tsx: Client component for collecting and persisting Shortcut and Linear tokens to localStorage.
    - (app)/migrate/page.tsx: Client component implementing the migration wizard: mode selection, preview, execute, and completion UI.
  - src/lib
    - db.ts: Thin localStorage wrapper for persisting tokens and simple app state. Safe on server via typeof window checks.
    - shortcut/client.ts: Axios-based REST client for Shortcut. Includes response interceptor for 429 rate-limit handling and a simple client-side throttle (checkRateLimit).
    - linear/client.ts: Wrapper around @linear/sdk for GraphQL calls. Exposes high-level helpers for teams, projects, cycles, labels, issues, comments, attachments.
    - migration/service.ts: Orchestrates end-to-end migration. High-level phases: fetch Shortcut data → create Linear labels → create projects (from epics) → create cycles (from iterations) → create issues (from stories) → finalize. Emits granular Progress updates and aggregates stats/errors.
  - src/components
    - ui/*: shadcn/ui primitives (button, card, badge, progress, etc.).
    - layout/sidebar.tsx: App chrome/navigation used by the setup/migrate flows.
  - src/types
    - Centralized type definitions for Shortcut and Linear entities and migration-related models.
- Data flow overview
  - Tokens are entered on /setup and persisted via db.ts to localStorage.
  - /migrate loads a preview (counts) by calling Shortcut client read endpoints.
  - runMigration(linearTeamId, onProgress) coordinates creation of Linear resources from Shortcut data and reports progress. Errors per item are collected; the UI surfaces partial successes and skipped items.
- Important implementation details for future changes
  - Any code accessing localStorage or window must run in a client component; mark files with 'use client' where needed and avoid server-side usage of browser-only APIs.
  - Shortcut client rate limiting: heavy operations should tolerate retries. The interceptor backs off on 429 using Retry-After; batch operations in migration/service.ts already process sequentially per entity type.
  - When creating Linear issues, optional relationships (project/cycle/labels) are resolved via maps built earlier in the migration.
  - linear/client.ts returns normalized POJOs from @linear/sdk entities to keep the UI and migration code decoupled from SDK internals.

## What’s not here (intentional)
- No server routes, databases, or authentication flows; the UX relies on user-provided API tokens and client-only execution.
- No automated tests configured at this time.

## Pointers from docs in this repo
- README.md
  - Quick start (clone → npm install → npm run dev) and self-hosting via Docker or Vercel.
- PLAN.md
  - Background on client-first architecture and phased migration design; aligns with the implementation reflected in src/lib and src/app.
