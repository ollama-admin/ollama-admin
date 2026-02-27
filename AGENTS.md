# AGENTS.md — Ollama Admin

Guidelines for AI agents contributing to this project.

---

## Language

**All code, comments, commit messages, PR descriptions, documentation, and file names MUST be written in English.** No exceptions. The PRD is in Spanish for internal reference only — all implementation output is English.

---

## Code Comments

**Only add comments that are strictly necessary.** Code should be self-documenting through clear naming and structure.

Allowed comments:
- Non-obvious business logic that cannot be expressed through naming alone
- Workarounds with a reference to the issue they address (e.g., `// Workaround for Ollama issue #3822`)
- Legal/license headers if required
- TODO markers for known pending work (`// TODO: migrate to official registry endpoint when available`)

Forbidden:
- Comments that restate what the code does (e.g., `// increment counter` above `counter++`)
- JSDoc on self-explanatory functions
- Section separators or decorative comments
- Commented-out code — delete it, git has history

---

## Testing

**Every feature, bug fix, or refactor MUST include tests before it is considered complete.**

- **Unit tests**: Vitest — for utilities, helpers, API route handlers, and business logic
- **E2E tests**: Playwright — for critical user flows (onboarding wizard, chat, model management)
- Tests go next to the source file as `*.test.ts` / `*.test.tsx`, or under `__tests__/` if the directory is already established
- Run the full test suite before marking work as done. Do not submit code with failing tests
- When fixing a bug, write a test that reproduces the bug first, then fix it

---

## Tech Stack & Architecture

Follow the stack defined in the PRD:

| Layer | Technology |
|---|---|
| Framework | Next.js 14+ (App Router) |
| ORM | Prisma (SQLite default, PostgreSQL optional) |
| i18n | next-intl |
| Auth | NextAuth.js (optional, ENV-driven) |
| Syntax highlighting | Shiki |
| Tests | Vitest (unit) + Playwright (e2e) |
| Containers | Docker + Docker Compose |

### Key architectural decisions

- **Gateway pattern**: All Ollama requests go through `/api/proxy/*` for logging and metrics. Never call Ollama directly from the client.
- **Multi-server**: Server configuration lives in the database, not only in `.env`. The UI drives CRUD operations.
- **Catalog**: Model catalog is cached locally in the DB. Scraping layer is isolated so it can be swapped for an official API endpoint later.
- **Database**: SQLite by default (`file:./ollama-admin.db`), PostgreSQL via `DATABASE_URL` env var. Prisma handles both.

---

## Project Structure

```
ollama-admin/
├── app/
│   ├── (admin)/        # Admin pages: models, servers, logs, metrics, gpu
│   ├── (chat)/         # Chat interface
│   ├── (discover)/     # Model catalog / discovery
│   ├── (setup)/        # Onboarding wizard
│   └── api/            # API routes + gateway proxy
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── messages/
│   └── en.json         # i18n strings
├── data/
│   └── catalog-snapshot.json
├── gpu-agent/
│   ├── Dockerfile
│   └── main.py
├── docker-compose.yml
├── Dockerfile
└── .env.example
```

---

## Coding Standards

- Use TypeScript strict mode everywhere
- Prefer named exports over default exports
- Use `async/await` — no raw `.then()` chains
- All UI strings go through next-intl (`useTranslations`) — never hardcode user-facing text
- Handle all states explicitly in UI components: empty, loading, error, success
- Use loading skeletons instead of generic spinners
- Error messages must be actionable — tell the user what went wrong and what to do about it
- Follow existing file and folder conventions; do not create new patterns without justification
- Keep changes minimal and focused — do not refactor surrounding code unless it is part of the task
- Do not add features, abstractions, or error handling beyond what is requested

---

## Git & Workflow

### Branching

**Never commit or push directly to `main`.** Always work on a dedicated branch:

- `feature/<short-name>` — new functionality (e.g., `feature/chat-streaming`, `feature/discover-catalog`)
- `fix/<short-name>` — bug fixes (e.g., `fix/proxy-timeout`)
- `hotfix/<short-name>` — urgent production fixes
- `refactor/<short-name>` — code restructuring with no behavior change
- `test/<short-name>` — adding or improving tests

Create the branch from the latest `main` before starting work.

### Commits

- **Commit early, commit often.** Make small, incremental commits as you complete each piece of work — a new component, a utility function, a route handler, a test file. Do not accumulate large changes into a single commit.
- Write clear, concise commit messages in English
- One logical change per commit
- Do not commit `.env`, credentials, or secrets
- **Never commit `PRD.md`, `PRP.md`, or any product/planning documents.** These are internal reference files and must stay out of version control. Always check staged files before committing.

### Pull Requests

When the feature or fix is complete (code + tests passing):

1. Push the branch to the remote
2. Create a Pull Request against `main`
3. PR title: short and descriptive (under 70 characters)
4. PR body must include:
   - **Summary**: what was added/changed and why
   - **What's new**: bullet list of concrete additions (new pages, API routes, components, etc.)
   - **Test plan**: how to verify the changes work
5. Do not merge your own PR without review — leave it open for approval

---

## Accessibility

Target WCAG 2.1 AA from the start:
- Minimum 4.5:1 contrast ratio for normal text
- Full keyboard navigation on all interactive elements
- ARIA roles and labels on custom components
- Charts and GPU visualizations must not rely solely on color

---

## Environment Variables

Reference `.env.example` for the full list. Key ones:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | SQLite (default) or PostgreSQL connection string |
| `DEFAULT_OLLAMA_URL` | Default Ollama server URL |
| `AUTH_ENABLED` | Enable/disable NextAuth.js |
| `LOG_STORE_PROMPTS` | Store prompt content in logs (privacy) |
| `CATALOG_REFRESH_ENABLED` | Allow catalog refresh from ollama.com |
| `GPU_AGENT_ENABLED` | Enable GPU monitoring sidecar |
