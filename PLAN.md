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
│  │  Page       │  │             │  │  - Connect accounts     │  │
│  │             │  │  - Status   │  │  - Select mode          │  │
│  │             │  │  - History  │  │  - Map fields           │  │
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
| Frontend | Next.js 14 (App Router) | React framework with SSR |
| Styling | Tailwind CSS + shadcn/ui | Modern, accessible UI |
| State | Zustand + localStorage | Client-side state management |
| Auth | NextAuth.js | OAuth for Shortcut & Linear |
| Storage | Browser localStorage | Token & migration state storage |

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
| Workflow State | Workflow State | Requires mapping |
| Member | User | By email matching |
| Comment | Comment | Preserve history |
| Attachment | Attachment | Re-upload required |

### Client-Side Storage Schema

```typescript
// Stored in localStorage

interface StoredTokens {
  shortcut?: {
    accessToken: string;
    workspaceId?: string;
    workspaceName?: string;
  };
  linear?: {
    accessToken: string;
    workspaceId?: string;
    workspaceName?: string;
  };
}

interface MigrationRecord {
  id: string;
  mode: 'ONE_SHOT' | 'TEAM_BY_TEAM' | 'REAL_TIME_SYNC';
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  config: MigrationConfig;
  progress: {
    total: number;
    completed: number;
    failed: number;
  };
  logs: MigrationLog[];
  startedAt: string;
  completedAt?: string;
}
```

---

## Feature Breakdown

### Phase 1: Foundation (Complete)

- [x] Project setup with Next.js 14
- [x] Landing page with feature overview
- [x] shadcn/ui components
- [x] App layout with sidebar navigation
- [x] Dashboard page
- [x] Migration wizard UI
- [x] Sync configuration page
- [x] Settings page
- [x] Login page

### Phase 2: API Integration

- [x] Shortcut API client
- [x] Linear API client (using @linear/sdk)
- [ ] OAuth flow implementation
- [ ] Token storage in localStorage

### Phase 3: One-Shot Migration

- [ ] Fetch all data from Shortcut
- [ ] Transform data to Linear format
- [ ] Import data to Linear
- [ ] Progress tracking UI
- [ ] Error handling and retry
- [ ] Migration report generation

### Phase 4: Team-by-Team Migration

- [ ] Team selection UI
- [ ] Per-team migration
- [ ] Pause/resume functionality
- [ ] Progress per team

### Phase 5: Real-Time Sync

- [ ] Webhook endpoints
- [ ] Bidirectional sync logic
- [ ] Conflict detection
- [ ] Sync status dashboard

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

1. **Connect** - OAuth into Shortcut and Linear
2. **Mode** - Choose migration type
3. **Mapping** - Configure field mappings
4. **Preview** - Review what will be migrated
5. **Migrate** - Execute with live progress
6. **Complete** - Summary and next steps

---

## Deployment

### Vercel (Recommended)

```bash
# Deploy to Vercel
vercel deploy

# Set environment variables in Vercel dashboard
NEXTAUTH_SECRET=xxx
SHORTCUT_CLIENT_ID=xxx
SHORTCUT_CLIENT_SECRET=xxx
LINEAR_CLIENT_ID=xxx
LINEAR_CLIENT_SECRET=xxx
```

### Self-Hosted

```bash
# Build
npm run build

# Start
npm start

# Or use Docker
docker build -t goodbye-shortcut .
docker run -p 3000:3000 goodbye-shortcut
```

---

## Security

- OAuth tokens stored in encrypted localStorage
- Tokens transmitted via HTTPS only
- No server-side token storage
- Session-based authentication with NextAuth.js
- CSRF protection built-in

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

### In Progress
- [ ] OAuth implementation
- [ ] Migration engine

### Planned
- [ ] Team-by-team migration
- [ ] Real-time sync
- [ ] Docker support
