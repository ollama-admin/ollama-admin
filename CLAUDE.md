# CLAUDE.md — Ollama Admin

## Project Overview

Ollama Admin is a web-based administration panel for managing one or more [Ollama](https://ollama.com) instances. It provides chat, model management, server monitoring, usage metrics, GPU monitoring, and a model discovery catalog — all behind an authentication layer with role-based access control.

### Key Features
- **Chat**: Streaming chat with Ollama models, conversation history, parameter presets, model comparison
- **Model Management**: List, pull, delete, copy models across servers; view model details (Modelfile, parameters, template)
- **Server Management**: Multi-server CRUD, health checks, active server switching
- **Discover**: Browse and pull models from the Ollama catalog (admin-only, live scraping from ollama.com)
- **Metrics & Logs**: Request logging with token counts and latency, usage dashboards, CSV export
- **GPU Monitoring**: Optional sidecar agent (Python) for real-time GPU stats via `nvidia-smi`
- **Alerts**: Configurable threshold alerts for latency and error rates
- **User Management**: Admin/user roles, user CRUD (admin-only)
- **API Keys**: Generate and manage API keys for programmatic access
- **Settings**: System-wide settings (theme, language, density)
- **Setup Wizard**: First-run onboarding that creates admin user and configures the first server

## Tech Stack

| Layer             | Technology                                    |
|-------------------|-----------------------------------------------|
| Framework         | Next.js 14+ (App Router)                      |
| Language          | TypeScript (strict mode)                      |
| ORM               | Prisma (SQLite default, PostgreSQL optional)   |
| Auth              | NextAuth.js v4 (JWT strategy, DB credentials) |
| i18n              | next-intl (en, es, ca, fr)                    |
| Styling           | Tailwind CSS                                  |
| Syntax highlight  | Shiki                                         |
| Data fetching     | SWR (client), fetch (server)                  |
| Tests             | Vitest (unit) + Playwright (e2e)              |
| Containers        | Docker + Docker Compose                       |
| Registry          | ghcr.io/ollama-admin                          |

## Architecture

### Gateway Pattern
All Ollama API requests go through `/api/proxy/[...path]` — never call Ollama directly from the client. The proxy handles server selection, logging, token counting, and error normalization.

### Auth & Middleware
- `middleware.ts` enforces auth on all routes except public paths (`/api/auth`, `/api/setup`, `/api/health`, `/setup`, `/auth`)
- Setup-not-completed redirects to `/setup` wizard
- `AUTH_DISABLED=true` bypasses login for local dev
- Admin-only guards on: `/admin/users`, `/api/users`, `/discover`, `/api/catalog`
- User model has roles: `admin` | `user`; first admin is created during setup wizard
- JWT strategy with bcrypt password hashing

### Multi-Server
Server configuration lives in the database (not just `.env`). Users can add/remove/test servers from the UI. Each chat and log entry is tied to a specific server.

### Model Catalog
The `/discover` page scrapes ollama.com for the model catalog. Results are cached in the `CatalogModel` table. Rate-limited to avoid hammering the source. Admin-only access.

### Database
- SQLite by default (`file:./ollama-admin.db`), PostgreSQL via `DATABASE_URL`
- `scripts/prisma-provider.js` dynamically sets the provider based on `DATABASE_URL`
- Prisma handles both databases transparently

## Project Structure

```
ollama-admin/
├── app/
│   ├── (admin)/admin/     # Admin pages: models, servers, users, logs, metrics, gpu, alerts
│   ├── (chat)/chat/       # Chat interface (list + [id] detail)
│   ├── (discover)/discover/ # Model catalog / discovery
│   ├── (setup)/setup/     # Onboarding wizard
│   ├── auth/signin/       # Login page
│   ├── settings/          # User settings
│   ├── api/               # API routes (see below)
│   ├── layout.tsx         # Root layout (providers, theme, i18n)
│   └── page.tsx           # Home / redirect
├── components/
│   ├── chat/              # Chat-specific components
│   ├── layout/            # App shell, sidebar, theme toggle
│   ├── providers/         # Theme, density context providers
│   └── ui/                # Reusable UI primitives (button, card, modal, table, etc.)
├── lib/
│   ├── auth.ts            # NextAuth configuration
│   ├── prisma.ts          # Prisma client singleton
│   ├── ollama.ts          # Ollama API client helpers
│   ├── logger.ts          # Structured logging for Docker
│   ├── rate-limit.ts      # In-memory rate limiter
│   ├── require-admin.ts   # Admin guard helper for API routes
│   ├── validate-api-key.ts # API key validation
│   └── constants.ts       # Shared constants
├── prisma/
│   ├── schema.prisma      # Database schema
│   └── migrations/        # Prisma migrations
├── messages/              # i18n translation files (en, es, ca, fr)
├── e2e/                   # Playwright E2E tests
├── gpu-agent/             # Python sidecar for GPU monitoring
├── scripts/               # Build/deploy helper scripts
├── docker-compose.yml
├── Dockerfile
└── .env.example
```

### Key API Routes

| Route                         | Purpose                          |
|-------------------------------|----------------------------------|
| `/api/proxy/[...path]`        | Gateway to Ollama API            |
| `/api/chats`                  | Chat CRUD                        |
| `/api/chats/[id]/messages`    | Chat message streaming           |
| `/api/chats/[id]/compare`     | Model comparison in chat         |
| `/api/admin/models`           | Model list/pull/delete/copy/show |
| `/api/servers`                | Server CRUD + health checks      |
| `/api/logs`                   | Request logs + export            |
| `/api/metrics`                | Usage metrics aggregation        |
| `/api/catalog`                | Model catalog (scraped)          |
| `/api/users`                  | User management (admin-only)     |
| `/api/presets`                | Chat parameter presets           |
| `/api/alerts`                 | Alert configuration              |
| `/api/api-keys`               | API key management               |
| `/api/gpu`                    | GPU stats from sidecar agent     |
| `/api/setup/*`                | Setup wizard endpoints           |
| `/api/settings`               | System settings                  |

### Database Models
- `Server` — Ollama server instances
- `User` — App users with roles
- `Chat` / `Message` — Chat conversations and messages
- `Log` — API request logs with token counts and latency
- `Preset` — Saved chat parameter configurations
- `CatalogModel` — Cached model catalog from ollama.com
- `Alert` — Monitoring alert rules
- `ApiKey` — API keys for programmatic access
- `Settings` — Key-value system settings

## Environment Variables

Reference `.env.example` for defaults. Key variables:

| Variable                  | Purpose                                           |
|---------------------------|---------------------------------------------------|
| `DATABASE_URL`            | SQLite (default) or PostgreSQL connection string   |
| `NEXTAUTH_SECRET`         | JWT signing secret (required in production)        |
| `NEXTAUTH_URL`            | App base URL                                       |
| `DEFAULT_OLLAMA_URL`      | Default Ollama server URL                          |
| `AUTH_DISABLED`            | `true` to bypass login (dev only)                 |
| `LOG_RETENTION_DAYS`      | Log retention period (default: 90)                |
| `LOG_STORE_PROMPTS`       | Store prompt content in logs (privacy)            |
| `CATALOG_REFRESH_ENABLED` | Allow catalog refresh from ollama.com             |
| `CATALOG_RATE_LIMIT_MS`   | Rate limit for catalog scraping (default: 2000)   |
| `GPU_AGENT_ENABLED`       | Enable GPU monitoring sidecar                     |

---

## Coding Standards

### Language
**All code, comments, commit messages, PR descriptions, and documentation MUST be in English.** No exceptions.

### Code Comments
Only add comments that are strictly necessary. Code should be self-documenting.

Allowed:
- Non-obvious business logic that can't be expressed through naming alone
- Workarounds with issue references (e.g., `// Workaround for Ollama issue #3822`)
- TODO markers for known pending work
- Legal/license headers

Forbidden:
- Comments that restate what the code does
- JSDoc on self-explanatory functions
- Section separators or decorative comments
- Commented-out code — delete it, git has history

### TypeScript & React
- TypeScript strict mode everywhere
- Prefer named exports over default exports
- Use `async/await` — no raw `.then()` chains
- All UI strings go through next-intl (`useTranslations`) — never hardcode user-facing text
- Handle all states explicitly: empty, loading, error, success
- Use loading skeletons instead of generic spinners
- Error messages must be actionable
- Follow existing file and folder conventions

### Testing
- **Unit tests**: Vitest — for utilities, helpers, API route handlers, business logic
- **E2E tests**: Playwright — for critical user flows
- Tests go next to the source file as `*.test.ts` / `*.test.tsx`, or under `__tests__/`
- When fixing a bug, write a test that reproduces the bug first, then fix it
- Run the full test suite before marking work as done

### Accessibility
Target WCAG 2.1 AA:
- Minimum 4.5:1 contrast ratio for normal text
- Full keyboard navigation on all interactive elements
- ARIA roles and labels on custom components

---

## Workflow Orchestration

### 1. Plan Mode Default
- Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions)
- If something goes sideways, STOP and re-plan immediately — don't keep pushing
- Use plan mode for verification steps, not just building
- Write detailed specs upfront to reduce ambiguity

### 2. Subagent Strategy
- Use subagents liberally to keep main context window clean
- Offload research, exploration, and parallel analysis to subagents
- For complex problems, throw more compute at it via subagents
- One task per subagent for focused execution

### 3. Self-Improvement Loop
- After ANY correction from the user: update `tasks/lessons.md` with the pattern
- Write rules for yourself that prevent the same mistake
- Ruthlessly iterate on these lessons until mistake rate drops
- Review lessons at session start for relevant project

### 4. Verification Before Done
- Never mark a task complete without proving it works
- Diff behavior between main and your changes when relevant
- Ask yourself: "Would a staff engineer approve this?"
- Run tests, check logs, demonstrate correctness

### 5. Demand Elegance (Balanced)
- For non-trivial changes: pause and ask "is there a more elegant way?"
- If a fix feels hacky: "Knowing everything I know now, implement the elegant solution"
- Skip this for simple, obvious fixes — don't over-engineer
- Challenge your own work before presenting it

### 6. Autonomous Bug Fixing
- When given a bug report: just fix it. Don't ask for hand-holding
- Point at logs, errors, failing tests — then resolve them
- Zero context switching required from the user
- Go fix failing CI tests without being told how

## Git Discipline

### 7. Commit Often
- Make commits as you go — every logical step gets a commit
- Don't wait until the end to commit everything in one big chunk
- Commit after: completing a feature, fixing a bug, finishing a refactor, adding tests
- Small frequent commits > one giant commit

### 8. Commit Hygiene
- Atomic commits: one commit = one logical change. Don't mix refactors with features.
- Message format: `type(scope): short description` (e.g. `fix(auth): handle expired token redirect`)
- Valid types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `style`
- Use the commit body if the "why" isn't obvious from the title
- Never commit with generic messages: "fix", "update", "changes", "wip"
- **Do not add Co-Authored-By or Signed-off-by trailers** to commit messages

### 9. Pre-Push Gate (CRITICAL)
- **Before ANY push**, run the full local CI pipeline:
  1. `npm test` — all unit tests must pass
  2. `npx next lint` — no lint errors
  3. `npm run build` — production build must succeed with no type errors
- Fix every single failure — do NOT push until everything passes clean
- This is non-negotiable. A push with failing checks is never acceptable.

### 10. Push & PR Policy
- Commit locally freely as you progress
- Push when the user asks or when work is complete — but only after the Pre-Push Gate (rule 9) passes
- If there are multiple WIP commits, offer to squash before pushing
- When the user asks to create a PR: create it, write a clear title and description, and **always send back the PR URL**
- PR description should summarize: what changed, why, and how to test it

### 11. Branch Strategy
- If starting new work that doesn't belong on the current branch, create a proper branch before committing
- Use the right prefix: `feature/*`, `fix/*`, `hotfix/*`, `refactor/*`, `test/*`
- Branch names must describe what's being done — no phases, no generic names
- Don't create new branches if the current one already makes sense for the work
- If you detect you're on `main`/`master` and the change is non-trivial: warn before committing

### 12. Versioning
Before creating the final commit of a branch, bump the version in `package.json`:
- **patch** (0.5.0 -> 0.5.1): bug fixes, small tweaks
- **minor** (0.5.0 -> 0.6.0): new features, new pages, new API endpoints
- **major** (0.5.0 -> 1.0.0): breaking changes, major rewrites

Run `npm version <patch|minor|major> --no-git-tag-version` and include the updated files in the commit.

**CI automation**: On merge to `main`, the `release.yml` workflow reads the version from `package.json`, creates a git tag `v<version>`, publishes Docker images to `ghcr.io`, and creates a GitHub Release with auto-generated notes. The workflow **fails if the tag already exists** — so every PR to `main` must include a version bump.

## Task Management

1. **Plan First**: Write plan to `tasks/todo.md` with checkable items
2. **Verify Plan**: Check in before starting implementation
3. **Track Progress**: Mark items complete as you go
4. **Explain Changes**: High-level summary at each step
5. **Document Results**: Add review section to `tasks/todo.md`
6. **Capture Lessons**: Update `tasks/lessons.md` after corrections

## Core Principles

- **Simplicity First**: Make every change as simple as possible. Minimal code impact.
- **No Laziness**: Find root causes. No temporary fixes. Senior developer standards.
- **Minimal Impact**: Changes should only touch what's necessary. Avoid introducing bugs.
