<p align="center">
  <img src="public/logo.jpeg" alt="Ollama Admin" width="120" />
</p>

<h1 align="center">Ollama Admin</h1>

<p align="center">
  Administration panel, chat client, and observability gateway for <a href="https://ollama.com">Ollama</a>.<br/>
  Manage multiple Ollama servers, monitor GPU usage, browse the model catalog, and chat with models — all from a single dockerized web app.
</p>

<p align="center">
  <a href="#install">Install</a> · <a href="#features">Features</a> · <a href="#screenshots">Screenshots</a> · <a href="#api-reference">API</a> · <a href="#gpu-agent">GPU Agent</a> · <a href="#contributing">Contributing</a>
</p>

---

## Install

**One command. That's it.**

```bash
curl -fsSL https://raw.githubusercontent.com/ollama-admin/ollama-admin/main/scripts/install.sh | bash
```

Open [http://localhost:3000](http://localhost:3000) — the setup wizard will guide you through connecting to Ollama.

<details>
<summary><strong>Custom port, Ollama URL, or version</strong></summary>

```bash
# Custom port and remote Ollama
OLLAMA_ADMIN_PORT=8080 DEFAULT_OLLAMA_URL=http://192.168.1.50:11434 \
  curl -fsSL https://raw.githubusercontent.com/ollama-admin/ollama-admin/main/scripts/install.sh | bash

# Pin to a specific version
OLLAMA_ADMIN_VERSION=0.1.0 \
  curl -fsSL https://raw.githubusercontent.com/ollama-admin/ollama-admin/main/scripts/install.sh | bash
```

</details>

<details>
<summary><strong>Docker Compose (manual)</strong></summary>

```bash
git clone https://github.com/ollama-admin/ollama-admin.git
cd ollama-admin
docker compose up -d --build
```

</details>

<details>
<summary><strong>With PostgreSQL</strong></summary>

```bash
DATABASE_URL="postgresql://admin:password@postgres:5432/ollamaadmin" docker compose up -d
```

Uncomment the `postgres` service in `docker-compose.yml` for a self-contained setup.

</details>

---

## Features

### Chat & Models

| Feature | Description |
|---|---|
| **Chat client** | Streaming responses, image upload (multimodal), message editing, keyboard shortcuts |
| **Parameter presets** | Save and reuse temperature, top-k, top-p, context size, system prompts |
| **Model comparator** | Side-by-side streaming from two models simultaneously with token/latency stats |
| **Chat export** | Export conversations to JSON or Markdown |
| **Model catalog** | Browse and pull models from ollama.com without leaving the app |

### Administration

| Feature | Description |
|---|---|
| **Multi-server management** | Add, monitor, and switch between multiple Ollama instances |
| **Model management** | Pull, delete, copy, and inspect models per server |
| **Gateway logging** | Every request through the proxy is logged with tokens, latency, and status |
| **Metrics dashboard** | Requests over time, tokens by model, latency percentiles, error rates |
| **GPU monitoring** | Running models, VRAM usage, temperature via gpu-agent sidecar |
| **Configurable alerts** | Thresholds for GPU temperature, VRAM, error rate, and latency |

### Security & Access

| Feature | Description |
|---|---|
| **Authentication** | Optional NextAuth.js with credentials and GitHub OAuth |
| **API key management** | Generate `oa-` prefixed keys, revoke, authenticate programmatic access |
| **Rate limiting** | Per-IP token bucket on proxy, chat, and compare endpoints |

### UX

| Feature | Description |
|---|---|
| **Setup wizard** | Guided onboarding with auto-detection of Ollama instances |
| **Internationalization** | English and Spanish, community-extensible |
| **Accessibility** | WCAG 2.1 AA: keyboard navigation, ARIA labels, contrast ratios |
| **UI density** | Compact, normal, and spacious modes |
| **Themes** | Light and dark with system detection |

---

## Screenshots

> Screenshots coming soon. Run the app to see it in action!

---

## Architecture

```
┌──────────────────────────────────────────────────────┐
│                    Ollama Admin                       │
│                                                      │
│  ┌─────────┐  ┌──────────┐  ┌───────────┐          │
│  │  Chat   │  │  Admin   │  │  Discover │          │
│  │  Client │  │  Panel   │  │  Catalog  │          │
│  └────┬────┘  └────┬─────┘  └─────┬─────┘          │
│       │             │              │                 │
│  ┌────┴─────────────┴──────────────┴──────┐         │
│  │         Next.js API Routes             │         │
│  │    (Gateway Proxy + Logging + Auth)    │         │
│  └────┬───────────────────────┬───────────┘         │
│       │                       │                      │
│  ┌────┴────┐            ┌─────┴─────┐               │
│  │ Prisma  │            │  Ollama   │               │
│  │ SQLite/ │            │  Server(s)│               │
│  │ Postgres│            └───────────┘               │
│  └─────────┘                                         │
└──────────────────────────────────────────────────────┘
          │
     ┌────┴────┐
     │  GPU    │  (optional, separate server)
     │  Agent  │
     └─────────┘
```

### Pages

| Route | Description |
|---|---|
| `/setup` | First-run wizard with Ollama auto-detection |
| `/` | Dashboard: servers, active models, recent requests, GPU status |
| `/chat` | Conversation list with search |
| `/chat/[id]` | Chat with streaming, parameters, and export |
| `/compare` | Side-by-side model comparison |
| `/discover` | Model catalog from ollama.com with direct pull |
| `/admin/models` | Model management per server |
| `/admin/servers` | Server CRUD and health monitoring |
| `/admin/logs` | Request logs with filters and export |
| `/admin/metrics` | Usage graphs and performance analytics |
| `/admin/gpu` | GPU status, VRAM, and temperature |
| `/admin/alerts` | Alert rules and triggered warnings |
| `/settings` | Theme, density, language, API keys, rate limits, database info |
| `/auth/signin` | Login page (when auth is enabled) |

---

## GPU Agent

The GPU Agent is a lightweight sidecar that exposes GPU metrics over HTTP. Install it on any server with an NVIDIA or AMD GPU — it doesn't need to be on the same machine as Ollama Admin.

### Install

```bash
curl -fsSL https://raw.githubusercontent.com/ollama-admin/ollama-admin/main/scripts/install-gpu-agent.sh | bash
```

Then in Ollama Admin, go to server settings and set the GPU Agent URL to `http://<gpu-server-ip>:11435`.

### Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/gpu` | Array of GPU objects (name, memory, temperature, utilization) |
| GET | `/health` | Health check with detected backend (`nvidia` or `amd`) |

### Supported backends

- **NVIDIA** — via `nvidia-smi` (requires NVIDIA Container Toolkit for Docker)
- **AMD** — via `rocm-smi`

See [gpu-agent/README.md](gpu-agent/README.md) for full documentation.

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `file:./ollama-admin.db` | SQLite or PostgreSQL connection string |
| `DEFAULT_OLLAMA_URL` | `http://localhost:11434` | Default Ollama server URL |
| `AUTH_ENABLED` | `false` | Enable NextAuth.js authentication |
| `ADMIN_USERNAME` | `admin` | Credentials provider username |
| `ADMIN_PASSWORD` | `admin` | Credentials provider password |
| `GITHUB_CLIENT_ID` | — | GitHub OAuth client ID |
| `GITHUB_CLIENT_SECRET` | — | GitHub OAuth client secret |
| `NEXTAUTH_SECRET` | auto-generated | NextAuth.js JWT secret |
| `LOG_RETENTION_DAYS` | `90` | Auto-purge logs older than N days |
| `LOG_STORE_PROMPTS` | `true` | Store prompt content in logs |
| `CATALOG_REFRESH_ENABLED` | `true` | Allow catalog refresh from ollama.com |
| `CATALOG_RATE_LIMIT_MS` | `2000` | Rate limit between catalog scrapes |
| `GPU_AGENT_ENABLED` | `false` | Enable GPU monitoring sidecar |

---

## API Reference

### Proxy Gateway

All requests through `/api/proxy/*` are logged and rate-limited, then forwarded to Ollama. Authenticate with an API key:

```bash
curl -H "Authorization: Bearer oa-your-key-here" \
  "http://localhost:3000/api/proxy/api/tags?serverId=SERVER_ID"
```

### REST Endpoints

<details>
<summary><strong>Servers</strong></summary>

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/servers` | List all servers |
| POST | `/api/servers` | Create a server |
| GET | `/api/servers/[id]` | Get server details |
| PUT | `/api/servers/[id]` | Update server |
| DELETE | `/api/servers/[id]` | Delete server |
| GET | `/api/servers/[id]/health` | Server health check |
| GET | `/api/servers/[id]/test` | Test connection |

</details>

<details>
<summary><strong>Chat & Messages</strong></summary>

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/chats` | List conversations |
| POST | `/api/chats` | Create conversation |
| GET | `/api/chats/[id]` | Get conversation |
| PUT | `/api/chats/[id]` | Update conversation |
| DELETE | `/api/chats/[id]` | Delete conversation |
| POST | `/api/chats/[id]/messages` | Send message (SSE stream) |
| GET | `/api/chats/[id]/export` | Export (`format=json\|markdown`) |

</details>

<details>
<summary><strong>Model Comparison</strong></summary>

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/compare` | Compare two models side-by-side (SSE stream) |

</details>

<details>
<summary><strong>Model Management</strong></summary>

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/admin/models` | List installed models |
| POST | `/api/admin/models/pull` | Pull a model |
| POST | `/api/admin/models/delete` | Delete a model |
| POST | `/api/admin/models/copy` | Copy a model |
| POST | `/api/admin/models/show` | Model details (parameters, template) |
| GET | `/api/admin/models/running` | Currently loaded models |

</details>

<details>
<summary><strong>Catalog</strong></summary>

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/catalog` | Browse cached model catalog |
| POST | `/api/catalog/seed` | Refresh catalog from ollama.com |

</details>

<details>
<summary><strong>Monitoring & Logs</strong></summary>

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/metrics` | Aggregated metrics (`?days=7`) |
| GET | `/api/gpu` | GPU status for all servers |
| GET | `/api/logs` | List request logs (filterable) |
| DELETE | `/api/logs` | Purge logs before a date |
| GET | `/api/logs/export` | Export logs |
| GET | `/api/alerts` | List alert rules |
| POST | `/api/alerts` | Create alert rule |
| GET | `/api/alerts/check` | Evaluate all active alerts |

</details>

<details>
<summary><strong>Settings & Keys</strong></summary>

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/settings` | Read app settings |
| PUT | `/api/settings` | Update app settings |
| GET | `/api/presets` | List parameter presets |
| POST | `/api/presets` | Create preset |
| PUT | `/api/presets/[id]` | Update preset |
| DELETE | `/api/presets/[id]` | Delete preset |
| GET | `/api/api-keys` | List API keys (masked) |
| POST | `/api/api-keys` | Generate new API key |
| PUT | `/api/api-keys/[id]` | Toggle key active/inactive |
| DELETE | `/api/api-keys/[id]` | Revoke API key |

</details>

<details>
<summary><strong>Setup</strong></summary>

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/setup/status` | Check if setup is complete |
| POST | `/api/setup/complete` | Mark setup as done |
| POST | `/api/setup/test-connection` | Test Ollama connection |

</details>

---

## Development

### Prerequisites

- Node.js 20+
- An Ollama instance running locally or remotely

### Setup

```bash
git clone https://github.com/ollama-admin/ollama-admin.git
cd ollama-admin
cp .env.example .env
npm install
npx prisma migrate dev
npm run dev
```

### Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm start` | Start production server |
| `npm run lint` | ESLint |
| `npm test` | Unit tests (Vitest) |
| `npm run test:ui` | Test UI dashboard |
| `npm run test:coverage` | Test coverage report |
| `npm run test:e2e` | E2E tests (Playwright) |
| `npm run db:studio` | Prisma Studio (DB browser) |
| `npm run db:migrate` | Run database migrations |

### Testing

```bash
# Unit tests (76 tests across 14 files)
npm test

# E2E tests (requires running dev server)
npm run test:e2e

# Type check
npx tsc --noEmit
```

---

## CI/CD

| Workflow | Trigger | What it does |
|---|---|---|
| **CI** | Pull requests to `main` | Lint, test, type-check, Docker build (no push) |
| **Release** | Merge to `main` | Test, build multi-arch images (amd64+arm64), push to ghcr.io, git tag, GitHub Release |

### Docker Images

```bash
docker pull ghcr.io/ollama-admin/ollama-admin:latest
docker pull ghcr.io/ollama-admin/ollama-admin-gpu-agent:latest
```

### Versioning

This project follows [Semantic Versioning](https://semver.org/). Every merge to `main` produces tagged images:

| Tag | Example | Description |
|---|---|---|
| `latest` | `:latest` | Most recent release |
| Exact | `:0.1.0` | Immutable version |
| Minor | `:0.1` | Latest patch within minor |
| Major | `:0` | Latest within major |
| SHA | `:sha-a1b2c3d` | Commit traceability |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router, standalone output) |
| Language | TypeScript |
| ORM | Prisma (SQLite / PostgreSQL) |
| Auth | NextAuth.js (credentials + GitHub OAuth) |
| i18n | next-intl (en, es) |
| Styling | Tailwind CSS |
| Icons | Lucide React |
| Syntax highlighting | Shiki |
| Unit tests | Vitest + jsdom |
| E2E tests | Playwright |
| CI/CD | GitHub Actions → GitHub Container Registry |
| GPU Agent | Python, FastAPI, nvidia-smi / rocm-smi |
| Containers | Docker (multi-stage, multi-arch) |

---

## Database

SQLite by default (zero config). Switch to PostgreSQL by setting `DATABASE_URL`:

```bash
DATABASE_URL="postgresql://user:pass@host:5432/ollamaadmin"
```

The Docker entrypoint auto-detects the provider and runs migrations on startup.

### Schema

| Model | Purpose |
|---|---|
| `Server` | Ollama instances (URL, name, GPU agent URL, active status) |
| `Chat` | Conversations with model, server, and parameters |
| `Message` | Messages with role, content, images, token counts, latency |
| `Log` | Gateway request logs (endpoint, tokens, latency, status, IP) |
| `Preset` | Reusable parameter configurations |
| `CatalogModel` | Cached model catalog from ollama.com |
| `Settings` | Key-value application settings |

---

## Privacy

- `LOG_STORE_PROMPTS=false` disables storing prompt/response content (only metadata: tokens, latency, model)
- Logs have configurable retention with automatic purge
- Catalog refresh uses strict rate limiting to avoid overloading ollama.com
- Without auth enabled, do not expose Ollama Admin to the internet

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on setup, branch naming, commit messages, and PR requirements.

---

## License

MIT
