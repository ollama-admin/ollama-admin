# Ollama Admin

Administration panel, chat client, and observability gateway for [Ollama](https://ollama.com). Manage multiple Ollama servers, monitor GPU usage, browse the model catalog, and chat with models — all from a single dockerized web app.

## Features

- **Multi-server management** — Add, monitor, and switch between multiple Ollama instances
- **Chat client** — Streaming responses, image upload, message editing, parameter presets, export to Markdown/JSON
- **Model comparator** — Side-by-side responses from two models simultaneously
- **Model catalog** — Browse and pull models from ollama.com without leaving the app
- **Admin panel** — Pull, delete, inspect, and copy models per server
- **Gateway logging** — Every request through the proxy is logged with tokens, latency, and status
- **Metrics dashboard** — Requests over time, tokens by model, latency, error rates
- **GPU monitoring** — Running models, VRAM usage, optional hardware metrics via gpu-agent sidecar
- **Configurable alerts** — Thresholds for GPU temperature, VRAM, error rate, and latency
- **API key management** — Generate and revoke API keys for programmatic access
- **Rate limiting** — Per-IP token bucket on proxy, chat, and compare endpoints
- **Authentication** — Optional NextAuth.js with credentials and GitHub OAuth
- **Internationalization** — English and Spanish, community-extensible
- **Accessibility** — WCAG 2.1 AA: keyboard navigation, ARIA labels, contrast ratios
- **UI density** — Compact, normal, and spacious modes
- **PostgreSQL support** — SQLite by default, PostgreSQL via `DATABASE_URL`

## Quick Start

```bash
# Clone and install
git clone https://github.com/ollama-admin/ollama-admin.git
cd ollama-admin
cp .env.example .env
npm install

# Setup database
npx prisma migrate dev

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — the setup wizard will guide you through connecting to Ollama.

## Docker

```bash
docker compose up -d
```

Open [http://localhost:3000](http://localhost:3000).

### With PostgreSQL

```bash
DATABASE_URL="postgresql://admin:password@postgres:5432/ollamaadmin" docker compose up -d
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `file:./ollama-admin.db` | SQLite or PostgreSQL connection string |
| `DEFAULT_OLLAMA_URL` | `http://ollama:11434` | Default Ollama server URL |
| `AUTH_ENABLED` | `false` | Enable NextAuth.js authentication |
| `ADMIN_USERNAME` | `admin` | Credentials provider username |
| `ADMIN_PASSWORD` | `admin` | Credentials provider password |
| `GITHUB_CLIENT_ID` | — | GitHub OAuth client ID |
| `GITHUB_CLIENT_SECRET` | — | GitHub OAuth client secret |
| `NEXTAUTH_SECRET` | `changeme` | NextAuth.js JWT secret |
| `LOG_RETENTION_DAYS` | `90` | Auto-purge logs older than N days |
| `LOG_STORE_PROMPTS` | `true` | Store prompt content in logs |
| `CATALOG_REFRESH_ENABLED` | `true` | Allow catalog refresh from ollama.com |
| `GPU_AGENT_ENABLED` | `false` | Enable GPU monitoring sidecar |

## API Reference

### Proxy Gateway

All requests through `/api/proxy/*` are logged and forwarded to Ollama.

```bash
# With API key
curl -H "Authorization: Bearer oa-your-key-here" \
  "http://localhost:3000/api/proxy/api/tags?serverId=SERVER_ID"
```

### REST Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET/POST | `/api/servers` | List / create servers |
| GET/PUT/DELETE | `/api/servers/[id]` | Get / update / delete server |
| GET/POST | `/api/chats` | List / create chats |
| POST | `/api/chats/[id]/messages` | Send message (SSE stream) |
| GET | `/api/chats/[id]/export` | Export chat (format=json\|markdown) |
| POST | `/api/compare` | Compare two models (SSE stream) |
| GET/POST | `/api/presets` | List / create parameter presets |
| GET/POST | `/api/api-keys` | List / create API keys |
| GET/POST | `/api/alerts` | List / create alert rules |
| GET | `/api/alerts/check` | Evaluate all active alerts |
| GET | `/api/metrics` | Aggregated metrics (days param) |
| GET | `/api/gpu` | GPU status for all servers |
| GET/PUT | `/api/settings` | Read / update app settings |
| GET/DELETE | `/api/logs` | List / purge logs |

## Testing

```bash
# Unit tests
npm test

# E2E tests (requires running dev server)
npm run test:e2e

# Type check
npx tsc --noEmit
```

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14+ (App Router) |
| ORM | Prisma (SQLite / PostgreSQL) |
| i18n | next-intl |
| Auth | NextAuth.js (optional) |
| Syntax highlighting | Shiki |
| Tests | Vitest (unit) + Playwright (e2e) |
| Containers | Docker + Docker Compose |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT
