# Goodbye Shortcut - Implementation Plan

## Overview

Goodbye Shortcut is an open-source web application that helps teams migrate from Shortcut (formerly Clubhouse) to Linear. The tool supports three migration modes:

1. **One-Shot Migration** - Complete, immediate transfer of all data
2. **Team-by-Team Migration** - Gradual rollout, one team at a time
3. **Real-Time Sync** - Bidirectional sync allowing parallel operation during transition

---

## Architecture

### Design Philosophy

This is a **client-first, database-free** open-source tool:
- **No database required** - All state stored in browser localStorage
- **Easy to self-host** - Just deploy the Next.js app
- **Privacy-focused** - Your tokens stay in your browser
- **Zero infrastructure** - No Redis, no PostgreSQL, no queues

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (Next.js)                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │  Landing    │  │  Dashboard  │  │  Migration Wizard       │  │
│  │  Page       │  │             │  │  - Validate API tokens  │  │
│  │             │  │  - Status   │  │  - Select mode          │  │
│  │             │  │  - History  │  │  - Configure scope      │  │
│  │             │  │  - Logs     │  │  - Preview & execute    │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                                │
                    ┌───────────┴───────────┐
                    ▼                       ▼
          ┌─────────────────┐     ┌─────────────────┐
          │  Shortcut API   │     │  Linear API     │
          │  (REST)         │     │  (GraphQL)      │
          └─────────────────┘     └─────────────────┘
```

### Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Frontend | Next.js 16 (App Router) | React framework with SSR |
| Styling | Tailwind CSS + shadcn/ui | Modern, accessible UI |
| State | useSyncExternalStore + localStorage | Client-side state management |
| Auth | API key/token validation flow | Direct provider API access |
| Storage | Browser localStorage | Token, migration, and sync state storage |

---

## Data Model

### Shortcut Entities → Linear Entities

| Shortcut | Linear | Notes |
|----------|--------|-------|
| Workspace | Workspace | 1:1 mapping |
| Team | Team | Direct mapping |
| Project | Project | May need restructuring |
| Story | Issue | Core entity |
| Epic | Project or Label | Configurable |
| Iteration | Cycle | Sprint equivalent |
| Label | Label | Direct mapping |
| Workflow State | Workflow State | Not directly mapped in v1 |
| Member | User | By email matching |
| Comment | Comment | Preserve history |
| Attachment | Attachment | Re-upload required |

### Client-Side Storage Schema

```typescript
// Stored in localStorage
interface AppState {
  shortcutToken?: string;
  linearToken?: string;
  shortcutTeams?: Array<{ id: string; name: string }>;
  linearTeams?: Array<{ id: string; key: string; name: string }>;
  migrationHistory?: MigrationHistoryRecord[];
  syncSettings?: Partial<SyncSettings>;
  syncStatus?: 'IDLE' | 'RUNNING' | 'PAUSED' | 'ERROR';
  syncCursors?: { shortcutUpdatedAt?: string; linearUpdatedAt?: string };
  syncStats?: Partial<SyncStats>;
  syncEvents?: SyncEventRecord[];
}
```

---

## Feature Breakdown

### Phase 1: Foundation (Complete)

- [x] Project setup with Next.js 16
- [x] Landing page with feature overview
- [x] shadcn/ui components
- [x] App layout with sidebar navigation
- [x] Migration wizard UI
- [x] Setup and token validation flow
- [x] Sync dashboard page

### Phase 2: API Integration

- [x] Shortcut API client
- [x] Linear API client (using @linear/sdk)
- [x] Same-origin API proxy routes
- [x] Token storage in localStorage
- [x] Token validation and bootstrap metadata loading

### Phase 3: One-Shot Migration

- [x] Fetch all data from Shortcut
- [x] Transform data to Linear format
- [x] Import data to Linear
- [x] Progress tracking UI
- [x] Error handling and retry
- [x] Migration report generation

### Phase 4: Team-by-Team Migration

- [x] Team selection UI
- [x] Per-team migration
- [x] Pause/resume controls for continuous operations
- [x] Progress and history tracking per run

### Phase 5: Real-Time Sync

- [x] Webhook endpoints
- [x] Bidirectional sync logic
- [x] Conflict detection
- [x] Sync status dashboard
- [x] Signed webhook verification with replay protection
- [x] Environment-based webhook credentials for production deployments
- [x] Sync persistence (status/cursors/stats/events) in localStorage

---

## API Clients

### Shortcut Client (`src/lib/shortcut/client.ts`)

```typescript
class ShortcutClient {
  // Teams
  getTeams(): Promise<ShortcutTeam[]>

  // Projects
  getProjects(): Promise<ShortcutProject[]>

  // Stories
  getAllStories(): Promise<ShortcutStory[]>
  searchStories(query: string): Promise<ShortcutStory[]>

  // Epics
  getEpics(): Promise<ShortcutEpic[]>

  // Iterations
  getIterations(): Promise<ShortcutIteration[]>

  // Labels & Workflows
  getLabels(): Promise<ShortcutLabel[]>
  getWorkflows(): Promise<ShortcutWorkflow[]>

  // Export all
  exportAll(): Promise<ShortcutExport>
}
```

### Linear Client (`src/lib/linear/client.ts`)

```typescript
class LinearClient {
  // Teams
  getTeams(): Promise<LinearTeam[]>
  createTeam(name: string, key: string): Promise<LinearTeam>

  // Projects
  getProjects(): Promise<LinearProject[]>
  createProject(name: string, teamIds: string[]): Promise<LinearProject>

  // Issues
  getIssues(teamId?: string): Promise<LinearIssue[]>
  createIssue(params: CreateIssueParams): Promise<LinearIssue>

  // Cycles
  getCycles(teamId: string): Promise<LinearCycle[]>
  createCycle(teamId: string, startsAt: Date, endsAt: Date): Promise<LinearCycle>

  // Labels
  getLabels(): Promise<LinearLabel[]>
  createLabel(name: string, color: string): Promise<LinearLabel>

  // Comments & Attachments
  createComment(issueId: string, body: string): Promise<void>
  createAttachment(issueId: string, url: string, title: string): Promise<void>
}
```

---

## UI/UX Flow

### Migration Wizard Steps

1. **Setup** - Enter and validate Shortcut + Linear API tokens
2. **Mode** - Choose migration type
3. **Configure** - Select teams and migration options
4. **Preview** - Review what will be migrated
5. **Migrate** - Execute with live progress
6. **Complete** - Summary and next steps

---

## Deployment

### Vercel (Recommended)

```bash
# Deploy to Vercel
vercel deploy

# Optional production webhook environment variables
GOODBYE_SHORTCUT_TOKEN=xxx
GOODBYE_LINEAR_TOKEN=xxx
GOODBYE_LINEAR_TEAM_ID=xxx
GOODBYE_SHORTCUT_WEBHOOK_SECRET=xxx
GOODBYE_LINEAR_WEBHOOK_SECRET=xxx
```

### Self-Hosted

```bash
# Build
npm run build

# Start
npm start
```

---

## Security

- API tokens stored in localStorage on the client
- Tokens transmitted via HTTPS only
- No server-side token persistence
- Same-origin proxy routes for browser API compatibility
- Optional webhook-triggered sync with signed delivery verification
- Replay protection for signed webhook deliveries
- Optional server-side webhook credentials via `GOODBYE_*` env vars
- Response hardening via timeout handling and secure HTTP headers

---

## Open Source

### License
MIT License - permissive, enterprise-friendly

### Contributing
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

---

## Current Status

### Complete
- [x] Project scaffolding
- [x] UI components and pages
- [x] API client libraries
- [x] State management
- [x] Migration engine
- [x] Team-by-team migration
- [x] Real-time sync engine
- [x] Webhook trigger endpoints
- [x] Webhook signature verification + replay protection
- [x] CI quality gate (lint/typecheck/test/build)

### Ongoing Hardening
- [ ] End-to-end integration tests against provider sandboxes
- [ ] Provider webhook signature fixtures from live payload captures
- [ ] Hosted deployment runbook and operational alerting
