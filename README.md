<p align="center">
  <img src="public/logo.svg" alt="Goodbye Shortcut" width="80" height="80" />
  <h1 align="center">Goodbye Shortcut</h1>
  <p align="center">
    <strong>The open source migration tool for teams moving from Shortcut to Linear.</strong>
    <br />
    No signup. No external migration service. Just paste your tokens and go.
  </p>
</p>

<p align="center">
  <a href="https://github.com/JeffOtano/goodbye-shortcut/actions/workflows/ci.yml">
    <img alt="CI" src="https://github.com/JeffOtano/goodbye-shortcut/actions/workflows/ci.yml/badge.svg" />
  </a>
  <a href="https://github.com/JeffOtano/goodbye-shortcut/actions/workflows/codeql.yml">
    <img alt="CodeQL" src="https://github.com/JeffOtano/goodbye-shortcut/actions/workflows/codeql.yml/badge.svg" />
  </a>
  <a href="#-quick-start">Quick Start</a> •
  <a href="#-features">Features</a> •
  <a href="#-how-it-works">How It Works</a> •
  <a href="#-contributing">Contributing</a>
</p>

## Why Goodbye Shortcut?

Migrating between project management tools sucks. Most solutions require:
- Signing up for yet another service
- Trusting a third party with your API tokens
- Paying for "enterprise" features
- Waiting for support tickets

**Goodbye Shortcut is different:**

- **100% open source** — Run it yourself, audit the code
- **No external migration service** — You run the app yourself
- **No signup** — Just paste your API tokens
- **No cost** — Free forever

---

## 🚀 Quick Start

```bash
git clone https://github.com/JeffOtano/goodbye-shortcut.git
cd goodbye-shortcut
npm install
npm run dev
```

Then open [localhost:3000](http://localhost:3000):

1. Get your [Shortcut API Token](https://app.shortcut.com/settings/account/api-tokens)
2. Get your [Linear API Key](https://linear.app/settings/api)
3. Paste them in the app
4. Click migrate

**That's it.**

For production webhook mode, copy environment variables:

```bash
cp .env.example .env.local
```

To verify production readiness locally:

```bash
npm run lint
npm run typecheck
npm run test:run
npm run build
```

Run infrastructure schema bootstrap (for production mode):

```bash
npm run infra:init
```

---

## ✨ Features

### Migration Modes

| Mode | Description | Best For |
|------|-------------|----------|
| **One-Shot** | Migrate everything at once | Teams ready to switch |
| **Team-by-Team** | Migrate gradually | Large organizations |
| **Real-Time Sync** | Live bidirectional synchronization | Parallel rollout and cutover |

### What Gets Migrated

| Shortcut | → | Linear |
|:---------|:-:|:-------|
| Stories | → | Issues |
| Epics | → | Projects |
| Iterations | → | Cycles |
| Labels | → | Labels |
| Comments | → | Comments |
| External Links | → | Attachments |
| Estimates | → | Estimates |

### Operational Safeguards

- Dry run mode for safe planning before writing to Linear
- Idempotent re-runs that reuse existing Labels/Projects/Cycles/Issues when possible
- Per-entity stats and error reporting (attempted/created/reused/failed)
- Team-targeted runs for staged migration rollout
- Persisted migration history and downloadable JSON run reports
- Retry failed stories directly from migration results

### Real-Time Sync

- Dedicated Sync dashboard at `/sync` with start/pause/resume/stop controls
- Direction modes: `Shortcut -> Linear`, `Linear -> Shortcut`, `Bidirectional`
- Conflict policies: `Newest Wins`, `Shortcut Wins`, `Linear Wins`, `Manual`
- Cursor-based incremental sync using `updated_at` and `updatedAt`
- Continuous polling sync engine with configurable interval
- Signed webhook verification with replay protection (when webhook secrets are configured)
- Webhook trigger endpoints:
  - `POST /api/webhooks/shortcut`
  - `POST /api/webhooks/linear`

---

## 🔐 Production Webhook Security

For production, configure webhook secrets and run sync with server-side credentials:

| Variable | Required | Purpose |
|----------|----------|---------|
| `GOODBYE_PRODUCTION_MODE` | Recommended (`true` for durable mode) | Enables queue-backed webhook processing |
| `GOODBYE_POSTGRES_URL` | Required in durable mode | Postgres for cursors/jobs/events |
| `GOODBYE_REDIS_URL` | Required in durable mode | Redis for BullMQ queue + locks |
| `GOODBYE_SHORTCUT_TOKEN` | Yes (for webhook-only operation) | Shortcut API token for sync jobs |
| `GOODBYE_LINEAR_TOKEN` | Yes (for webhook-only operation) | Linear API key for sync jobs |
| `GOODBYE_LINEAR_TEAM_ID` | Yes (for webhook-only operation) | Target Linear team |
| `GOODBYE_SHORTCUT_WEBHOOK_SECRET` | Recommended | Verifies Shortcut `Payload-Signature` |
| `GOODBYE_LINEAR_WEBHOOK_SECRET` | Recommended | Verifies Linear `Linear-Signature` |
| `GOODBYE_WEBHOOK_SHARED_SECRET` | Optional | Shared fallback secret for both providers |
| `GOODBYE_LINEAR_WEBHOOK_TOLERANCE_MS` | Optional | Timestamp drift tolerance for Linear signed events (default: 300000ms) |
| `GOODBYE_SYNC_WORKER_CONCURRENCY` | Optional | Concurrent durable sync workers |
| `GOODBYE_SYNC_SCHEDULER_ENABLED` | Optional | Enables periodic scheduler enqueue |
| `GOODBYE_SYNC_SCHEDULER_INTERVAL_SECONDS` | Optional | Polling interval for scheduler jobs |

Behavior:
- If webhook secrets are configured, unsigned/invalid webhook deliveries are rejected.
- Linear signed events must include a fresh `webhookTimestamp`.
- Replay attempts are rejected within a rolling TTL window.
- Webhook endpoints enforce per-IP rate limiting to reduce abuse and burst failures.
- If `GOODBYE_*` credentials are configured, per-request token headers are optional.
- In durable mode, webhooks return `202` and process asynchronously via queue workers.

---

## 🔒 How It Works

```
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│   Shortcut   │──────▶│ Your Browser │──────▶│    Linear    │
│     API      │       │  (the app)   │       │     API      │
└──────────────┘       └──────────────┘       └──────────────┘
                              │
                              ▼
                       localStorage
                    (tokens stay here)
```

**Your tokens are not stored by this app.** The app calls provider APIs directly (via same-origin proxy routes when needed).

---

## 🏠 Self-Hosting

### Vercel (One Click)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/JeffOtano/goodbye-shortcut)

### Docker

```bash
docker compose up --build
```

This starts:
- `app` (Next.js server)
- `worker` (durable sync job processor)
- `scheduler` (optional periodic sync enqueuer)
- `postgres` (durable cursor/job/event store)
- `redis` (durable queue + locks)

### Manual

```bash
npm run build
npm start
```

For durable production mode, run these in separate processes:

```bash
npm run worker:sync
npm run worker:scheduler
```

---

## 🧱 Durable Production Mode

Set `GOODBYE_PRODUCTION_MODE=true` with `GOODBYE_POSTGRES_URL` and `GOODBYE_REDIS_URL`.

When enabled:
- Webhook routes enqueue durable sync jobs instead of running inline.
- Worker process executes jobs with retries/backoff.
- Cursors and job/event history are stored in Postgres.
- Redis provides queue durability and worker coordination.

This mode is recommended for teams that need:
- high reliability under webhook bursts
- resumable/retryable server-side sync
- auditable sync job history

---

## 🛠 Tech Stack

| | Technology |
|-|------------|
| Framework | Next.js 16 |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Components | shadcn/ui |
| Storage | localStorage |

---

## 🤝 Contributing

We'd love your help making Goodbye Shortcut even better!

```bash
# 1. Fork the repo
# 2. Clone your fork
git clone https://github.com/YOUR_USERNAME/goodbye-shortcut.git

# 3. Create a branch
git checkout -b my-feature

# 4. Make your changes and commit
git commit -m "Add my feature"

# 5. Push and open a PR
git push origin my-feature
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines.

Project standards:
- [Code of Conduct](CODE_OF_CONDUCT.md)
- [Security Policy](SECURITY.md)
- [Support](SUPPORT.md)
- [Release Process](RELEASE.md)
- [Changelog](CHANGELOG.md)

---

## 📄 License

MIT — do whatever you want. See [LICENSE](LICENSE).

---

<p align="center">
  <sub>Built for teams ready to say goodbye to Shortcut.</sub>
</p>
