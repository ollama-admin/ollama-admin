<p align="center">
  <img src="public/logo.jpeg" alt="Ollama Admin" width="100" />
</p>
<h1 align="center">Ollama Admin</h1>
<p align="center">
  <strong>The infrastructure layer your Ollama servers are missing.</strong><br/><br/>
  Most Ollama UIs give you a chat box. Ollama Admin gives you visibility and control over what's actually happening on your GPUs: which models are loaded, how much VRAM they're consuming, how fast they're generating tokens, and whether your servers can handle one more model before running out of memory.<br/><br/>
  It's the difference between <em>using</em> Ollama and <em>operating</em> Ollama.
</p>
<p align="center">
  <a href="https://github.com/ollama-admin/ollama-admin/actions/workflows/ci.yml">
    <img src="https://github.com/ollama-admin/ollama-admin/actions/workflows/ci.yml/badge.svg" alt="CI" />
  </a>
  <a href="https://github.com/ollama-admin/ollama-admin/releases/latest">
    <img src="https://img.shields.io/github/v/release/ollama-admin/ollama-admin" alt="Latest release" />
  </a>
  <a href="https://github.com/ollama-admin/ollama-admin/pkgs/container/ollama-admin">
    <img src="https://img.shields.io/badge/docker-ghcr.io-blue?logo=docker" alt="Docker" />
  </a>
  <img src="https://img.shields.io/badge/license-MIT-green" alt="License" />
  <img src="https://img.shields.io/badge/TypeScript-strict-blue?logo=typescript" alt="TypeScript" />
</p>
<p align="center">
  <a href="#-why-ollama-admin">Why Ollama Admin</a> ·
  <a href="#-install">Install</a> ·
  <a href="#-gpu-monitoring">GPU Monitoring</a> ·
  <a href="#-the-observable-proxy">Observable Proxy</a> ·
  <a href="#-features">Features</a> ·
  <a href="#-api-reference">API</a> ·
  <a href="#-development">Development</a>
</p>

---

### Dashboard
<p align="center">
  <img src="public/1.png" alt="Dashboard — server status, requests, GPU summary, active models" width="100%" />
</p>

### Chat
<p align="center">
  <img src="public/2.png" alt="Chat — streaming conversation with model selection" width="100%" />
</p>

### GPU Monitoring
<p align="center">
  <img src="public/3.png" alt="GPU Monitoring — VRAM usage, utilization, temperature, model compatibility" width="100%" />
</p>

### Discover Models
<p align="center">
  <img src="public/4.png" alt="Discover — model catalog with GPU fit grades and estimated speed" width="100%" />
</p>

---

## 🎯 Why Ollama Admin?

If you're running Ollama on one GPU for personal use, you probably don't need this.

But if you're running **multiple servers**, sharing GPUs across a team, or need to know *who used what model, when, and how much* — there's nothing else that does this:

- **GPU-aware model management** — See real-time VRAM usage per GPU, which models are loaded in memory, and whether a new model will fit before you pull it. Supports NVIDIA, AMD, Intel, and Apple Silicon.
- **Observable API gateway** — Every request to Ollama flows through a proxy that logs tokens, latency, model, user, and IP. You get a metrics dashboard with throughput (tokens/s), latency percentiles, error rates, and usage by model — without touching Prometheus or Grafana.
- **Multi-server from one panel** — Add your Ollama instances, route requests to specific servers, and manage models across all of them. Your clients never need to know which server is behind the proxy.
- **Access control that actually works** — API keys per client/team, role-based access (admin/user), rate limiting per IP, and optional GitHub OAuth. Revoke one key without touching the others.

And yes, it also has a full-featured chat interface with streaming, model comparison, parameter presets, and conversation history — because you still need to actually *talk* to your models.

---

## 🚀 Install

**Prerequisites:** [Docker](https://docs.docker.com/get-docker/) and Docker Compose. An [Ollama](https://ollama.com) instance running locally or on your network.

| I want to… | Use |
|---|---|
| Try it quickly on my machine | [Option 1 — One-liner](#option-1--one-liner-recommended) |
| Deploy to a server with full control | [Option 2 — Docker Compose](#option-2--docker-compose) |
| Install on a server with no internet | [Option 3 — Offline bundle](#option-3--offline--air-gapped-bundle) |
| Contribute or build from source | [Option 4 — Local development](#option-4--local-development) |

---

### Option 1 — One-liner (recommended)

```bash
curl -fsSL https://raw.githubusercontent.com/ollama-admin/ollama-admin/main/scripts/install.sh | bash
```

Creates `~/ollama-admin/`, pulls the image from ghcr.io, and starts the container. Open [http://localhost:3000](http://localhost:3000) — the setup wizard takes it from there.

<details>
<summary>Custom port, Ollama URL, or version</summary>

```bash
# Custom port and remote Ollama server
OLLAMA_ADMIN_PORT=8080 \
DEFAULT_OLLAMA_URL=http://192.168.1.50:11434 \
  curl -fsSL https://raw.githubusercontent.com/ollama-admin/ollama-admin/main/scripts/install.sh | bash

# Pin to a specific version
OLLAMA_ADMIN_VERSION=0.11.0 \
  curl -fsSL https://raw.githubusercontent.com/ollama-admin/ollama-admin/main/scripts/install.sh | bash
```

</details>

---

### Option 2 — Docker Compose

For production deployments or when you need full control over the configuration.

```bash
git clone https://github.com/ollama-admin/ollama-admin.git
cd ollama-admin
cp .env.example .env   # edit as needed
docker compose up -d
```

Open [http://localhost:3000](http://localhost:3000).

<details>
<summary>With PostgreSQL (recommended for production)</summary>

Uncomment the `postgres` service in `docker-compose.yml`, then:

```bash
DATABASE_URL="postgresql://admin:password@postgres:5432/ollamaadmin" \
  docker compose up -d
```

The entrypoint auto-detects the provider and runs migrations on startup.

</details>

<details>
<summary>With GPU Agent — NVIDIA</summary>

Uncomment the `gpu-agent` service in `docker-compose.yml`:

```yaml
gpu-agent:
  image: ghcr.io/ollama-admin/ollama-admin-gpu-agent:latest
  runtime: nvidia
  environment:
    NVIDIA_VISIBLE_DEVICES: all
    GPU_BACKEND: nvidia
  ports:
    - "11435:11435"
  restart: unless-stopped
```

Set `GPU_AGENT_ENABLED=true` in `.env`, then `docker compose up -d`.

</details>

<details>
<summary>With GPU Agent — AMD</summary>

```yaml
gpu-agent:
  image: ghcr.io/ollama-admin/ollama-admin-gpu-agent:latest
  environment:
    GPU_BACKEND: amd
  devices:
    - /dev/kfd:/dev/kfd
    - /dev/dri:/dev/dri
  group_add:
    - video
    - render
  ports:
    - "11435:11435"
  restart: unless-stopped
```

Set `GPU_AGENT_ENABLED=true` in `.env`, then `docker compose up -d`.

</details>

---

### Option 3 — Offline / Air-gapped bundle

For servers with no internet access, private registries (Harbor, Nexus), or high-security environments. You need two machines: one with internet to create the bundle, and the target server.

**Step 1 — on a machine with internet access, clone the repo and create the bundle:**

```bash
git clone https://github.com/ollama-admin/ollama-admin.git
cd ollama-admin

# Web app only
bash scripts/bundle.sh --version 0.11.0

# Web app + GPU agent
bash scripts/bundle.sh --version 0.11.0 --with-gpu-agent --gpu-backend nvidia
```

This pulls the Docker images, packages them into `ollama-admin-bundle-0.11.0.tar.gz` alongside the installer script, and prints the SHA256 checksum.

**Step 2 — transfer the bundle to your server** (USB, scp, internal file share, whatever works):

```bash
scp ollama-admin-bundle-0.11.0.tar.gz user@your-server:/tmp/
```

**Step 3 — on the target server, extract and run the installer (no internet required):**

```bash
cd /tmp
tar -xzf ollama-admin-bundle-0.11.0.tar.gz
cd ollama-admin-bundle-0.11.0

# Basic install
bash install-offline.sh --bundle /tmp/ollama-admin-bundle-0.11.0.tar.gz

# With GPU agent and custom settings
bash install-offline.sh \
  --bundle /tmp/ollama-admin-bundle-0.11.0.tar.gz \
  --port 8080 \
  --ollama-url http://192.168.1.50:11434 \
  --with-gpu-agent \
  --gpu-backend nvidia \
  --nextauth-url https://ollama.mycompany.internal
```

The script runs `docker load` on the images, generates a `docker-compose.yml`, and starts the services. No internet required at any point on the target server.

<details>
<summary>All offline installer flags</summary>

| Flag | Default | Description |
|---|---|---|
| `--bundle <path>` | required | Path to the bundle tar.gz |
| `--install-dir <dir>` | `$HOME/ollama-admin` | Installation directory |
| `--port <port>` | `3000` | Web app port |
| `--ollama-url <url>` | `http://host.docker.internal:11434` | Ollama server URL |
| `--with-gpu-agent` | off | Enable GPU agent service |
| `--gpu-port <port>` | `11435` | GPU agent port |
| `--gpu-backend <nvidia\|amd>` | `nvidia` | GPU type |
| `--nextauth-secret <str>` | auto-generated | JWT signing secret |
| `--nextauth-url <url>` | `http://localhost:<port>` | Public app URL (set this for reverse proxy / HTTPS) |

</details>

---

### Option 4 — Local development

```bash
git clone https://github.com/ollama-admin/ollama-admin.git
cd ollama-admin
cp .env.example .env
npm install
npx prisma migrate dev
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Requires Node.js 20+ and an Ollama instance.

---

## 🖥 GPU Monitoring

This is the core of what makes Ollama Admin different. The GPU Agent is a lightweight Python sidecar that exposes real-time GPU metrics over HTTP. Deploy it on any machine with a GPU — it does not need to be co-located with Ollama Admin.

### What you see

| Metric | Description |
|---|---|
| **VRAM usage** | Used / total memory per GPU — know exactly how much room you have for another model |
| **Models in memory** | Which models are currently loaded and consuming VRAM |
| **Temperature** | Real-time GPU temperature with configurable threshold alerts |
| **Utilization** | GPU compute utilization percentage |
| **Power draw** | Current power consumption per GPU |
| **Tokens/s** | Throughput calculated from request logs — per model, per server |

### Supported hardware

| Backend | Detection | Requirements |
|---|---|---|
| **NVIDIA** | `nvidia-smi` | NVIDIA Container Toolkit (Docker) or drivers |
| **AMD** | `rocm-smi` | ROCm drivers |
| **Intel** | `xpu-smi` | Intel GPU drivers |
| **Apple Silicon** | `system_profiler` | macOS only |

### Install the GPU Agent

```bash
# One-liner (online)
curl -fsSL https://raw.githubusercontent.com/ollama-admin/ollama-admin/main/scripts/install-gpu-agent.sh | bash
```

<details>
<summary>Other install methods</summary>

**Offline (air-gapped):**
Include the GPU agent in your bundle (Step 1 above with `--with-gpu-agent`), then pass `--with-gpu-agent` to `install-offline.sh`.

**Python standalone:**

```bash
cd gpu-agent
pip install -r requirements.txt
GPU_BACKEND=nvidia python main.py   # or: amd, intel, apple, auto
```

</details>

Runs on port `11435` by default. Connect it in Ollama Admin → **Admin → Servers** → edit a server → set **GPU Agent URL** to `http://<gpu-server-ip>:11435`.

### Alerts

Set threshold-based alerts for GPU temperature, VRAM usage, error rates, and latency. Get warned before your GPU runs out of memory or overheats — from **Admin → Alerts**.

### Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/gpu` | Array of GPU objects — name, memory, temperature, utilization, power draw |
| `GET` | `/health` | `{"status":"ok","backend":"nvidia"}` |

See [gpu-agent/README.md](gpu-agent/README.md) for full documentation.

---

## 📡 The Observable Proxy

All Ollama traffic goes through `/api/proxy` — never directly from clients to Ollama. This is what turns your Ollama instance into a managed, auditable API gateway.

**Why this matters:**

- **Full visibility** — every request is logged with model, tokens, latency, status code, user, and IP. You always know who is using what, when, and how much.
- **Multi-client support** — point any app (LangChain, Open WebUI, custom scripts, CI pipelines) at the proxy instead of Ollama directly. All traffic flows through one place.
- **Per-client API keys** — create a separate `oa-` key for each app or team. Revoke one key without touching the others. See usage broken down by key in the metrics dashboard.
- **Rate limiting** — per-IP token bucket prevents any single client from saturating your GPU.
- **Privacy control** — set `LOG_STORE_PROMPTS=false` to log only metadata (tokens, latency) without storing prompt content.
- **Multi-server routing** — pass `?serverId=` to route a request to a specific Ollama instance. Your clients never need to know which server is behind the proxy.

```bash
# List models on a specific server
curl -H "Authorization: Bearer oa-your-key-here" \
  "http://localhost:3000/api/proxy/api/tags?serverId=SERVER_ID"

# Streaming generation — works as a drop-in for the Ollama API
curl -H "Authorization: Bearer oa-your-key-here" \
  -d '{"model":"llama3","prompt":"Hello"}' \
  "http://localhost:3000/api/proxy/api/generate?serverId=SERVER_ID"
```

Generate API keys from **Settings → API Keys**.

---

## 🔍 Model Catalog & Management

Browse the full Ollama model catalog from inside the app, pull models to any connected server, and manage everything without touching the terminal.

| Action | Where |
|---|---|
| Browse & pull models from ollama.com | `/discover` (admin only) |
| Inspect Modelfile, parameters, template | `/admin/models` |
| Delete, copy, unload models | `/admin/models` |
| See running models per server | `/admin/gpu` |
| Track pull progress in real-time | `/admin/models` |

---

## ✨ Features

### 💬 Chat & Models

| Feature | Description |
|---|---|
| **Streaming chat** | Real-time responses with SSE, multimodal image input, message editing and regeneration |
| **Model comparison** | Side-by-side streaming from two models with token counts and latency stats |
| **Parameter presets** | Save and reuse temperature, top-k, top-p, context size, and system prompts |
| **Conversation history** | Search, browse, and export past conversations to JSON or Markdown |

### 🛠 Tools

| Tool | Description |
|---|---|
| **OCR / Vision** | Extract text from images using any multimodal model (PNG, JPG, WebP up to 20 MB) |
| **Embeddings** | Generate text embeddings and calculate cosine similarity between two inputs |

### 🔐 Security & Access

| Feature | Description |
|---|---|
| **Role-based access control** | `admin` and `user` roles; admin-only pages for servers, models, users, logs, metrics, catalog |
| **User management** | Create, edit, activate/deactivate users; bcrypt password hashing |
| **API keys** | Generate `oa-` prefixed keys for programmatic access; revoke at any time |
| **Rate limiting** | Per-IP token bucket on the proxy, chat, and compare endpoints |
| **GitHub OAuth** | Optional OAuth provider alongside credentials login |

### 🎨 UX

| Feature | Description |
|---|---|
| **Theme** | Light, dark, and system-auto with live switching |
| **UI density** | Compact, normal, and spacious modes |
| **Setup wizard** | Guided first-run with Ollama auto-detection, model download, and admin creation |
| **Accessibility** | WCAG 2.1 AA: keyboard navigation, ARIA labels, 4.5:1 contrast ratios |

---

## 🏁 First-time setup

After starting Ollama Admin for the first time, open [http://localhost:3000](http://localhost:3000). The setup wizard walks you through:

1. **Connect to Ollama** — enter your Ollama URL or let it auto-detect `localhost:11434`
2. **Pull a model** — optionally download a first model (or skip and do it later)
3. **Configure** — set server name, theme, and log retention
4. **Create admin** — set your username and password

After the wizard completes, you land on the dashboard. You can add more servers and users from the admin panel.

---

## ⚙️ Configuration

Copy `.env.example` to `.env` and adjust as needed.

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `file:./ollama-admin.db` | SQLite path or PostgreSQL connection string |
| `NEXTAUTH_SECRET` | auto-generated | JWT signing secret — **set a strong value in production** |
| `NEXTAUTH_URL` | `http://localhost:3000` | Public app URL — must match your deployment URL |
| `DEFAULT_OLLAMA_URL` | `http://localhost:11434` | Default Ollama server URL |
| `AUTH_DISABLED` | `false` | Bypass login entirely — **dev only, never in production** |
| `LOG_RETENTION_DAYS` | `90` | Auto-purge logs older than N days (`0` = never purge) |
| `LOG_STORE_PROMPTS` | `true` | Store full prompt/response content; set `false` for metadata-only logging |
| `CATALOG_REFRESH_ENABLED` | `true` | Allow admins to refresh the model catalog from ollama.com |
| `CATALOG_RATE_LIMIT_MS` | `2000` | Minimum ms between catalog scrape requests |
| `GPU_AGENT_ENABLED` | `false` | Show GPU monitoring UI and enable `/api/gpu` |
| `GITHUB_CLIENT_ID` | — | GitHub OAuth client ID (optional) |
| `GITHUB_CLIENT_SECRET` | — | GitHub OAuth client secret (optional) |

---

## 🏗 Architecture

```
┌──────────────────────────────────────────────────────────┐
│                      Ollama Admin                        │
│                                                          │
│  ┌──────────┐  ┌───────────┐  ┌──────────┐  ┌───────┐  │
│  │  Chat /  │  │  Admin    │  │ Discover │  │ Tools │  │
│  │  Compare │  │  Panel    │  │ Catalog  │  │ OCR / │  │
│  └────┬─────┘  └─────┬─────┘  └────┬─────┘  │ Embed │  │
│       │               │             │         └───┬───┘  │
│  ┌────┴───────────────┴─────────────┴─────────────┴───┐  │
│  │         Next.js API Routes                         │  │
│  │   /api/proxy  ·  auth  ·  logging  ·  rate-limit  │  │
│  └────┬──────────────────────────────────┬────────────┘  │
│       │                                  │               │
│  ┌────┴────────┐                  ┌───────┴──────┐        │
│  │   Prisma    │                  │    Ollama    │        │
│  │ SQLite /    │                  │  Server(s)   │        │
│  │ PostgreSQL  │                  └──────────────┘        │
│  └─────────────┘                                          │
└──────────────────────────────────────────────────────────┘
          │
     ┌────┴─────────────────────┐
     │  GPU Agent (optional)    │
     │  Python · FastAPI        │
     │  NVIDIA · AMD · Intel    │
     │  Apple Silicon           │
     └──────────────────────────┘
```

All Ollama traffic goes through the `/api/proxy` gateway — never directly from the browser to Ollama. This enables per-request logging, token counting, rate limiting, and multi-server routing from a single entry point.

### Pages

| Route | Description |
|---|---|
| `/setup` | First-run wizard — Ollama connection, model pull, admin creation |
| `/` | Dashboard — server status, active models, request graph, GPU summary |
| `/chat` | Conversation list with search |
| `/chat/[id]` | Streaming chat with parameters, presets, and export |
| `/compare` | Side-by-side model comparison |
| `/discover` | Model catalog from ollama.com with direct pull (admin only) |
| `/tools/ocr` | OCR and image analysis via vision models |
| `/tools/embeddings` | Text embedding generation and similarity |
| `/admin/models` | Model management (pull, delete, copy, inspect, unload) |
| `/admin/servers` | Server CRUD and health monitoring |
| `/admin/users` | User management and role assignment |
| `/admin/logs` | Request logs with filters, pagination, and export |
| `/admin/metrics` | Usage graphs and performance analytics |
| `/admin/gpu` | GPU status, VRAM, and temperature |
| `/admin/alerts` | Alert rules and triggered warnings |
| `/settings` | Theme, density, language, API keys, rate limits, database info |

---

## 📡 API Reference

<details>
<summary><strong>Proxy Gateway</strong></summary>

All Ollama traffic is routed through `/api/proxy/[...path]` — never directly from the browser or external apps.

| Method | Endpoint | Description |
|---|---|---|
| `ANY` | `/api/proxy/[...path]` | Forward request to Ollama; requires API key or active user session |

Generate API keys from **Settings → API Keys**.

</details>

<details>
<summary><strong>Servers</strong></summary>

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/servers` | List all servers |
| `POST` | `/api/servers` | Create a server |
| `GET` | `/api/servers/[id]` | Get server details |
| `PUT` | `/api/servers/[id]` | Update server |
| `DELETE` | `/api/servers/[id]` | Delete server |
| `GET` | `/api/servers/[id]/health` | Health check |
| `GET` | `/api/servers/[id]/test` | Test Ollama connection |

</details>

<details>
<summary><strong>Chat & Messages</strong></summary>

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/chats` | List conversations |
| `POST` | `/api/chats` | Create conversation |
| `GET` | `/api/chats/[id]` | Get conversation with messages |
| `PUT` | `/api/chats/[id]` | Update title or parameters |
| `DELETE` | `/api/chats/[id]` | Delete conversation |
| `POST` | `/api/chats/[id]/messages` | Send message — SSE stream |
| `POST` | `/api/chats/[id]/compare` | Compare two models — SSE stream |
| `GET` | `/api/chats/[id]/export` | Export (`?format=json\|markdown`) |

</details>

<details>
<summary><strong>Model Management</strong></summary>

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/admin/models` | List installed models |
| `POST` | `/api/admin/models/pull` | Pull a model |
| `GET` | `/api/admin/models/pull/status` | Poll pull progress |
| `POST` | `/api/admin/models/delete` | Delete a model |
| `POST` | `/api/admin/models/copy` | Copy a model |
| `POST` | `/api/admin/models/show` | Model details (Modelfile, parameters, template) |
| `GET` | `/api/admin/models/running` | Currently loaded models |

</details>

<details>
<summary><strong>Catalog</strong></summary>

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/catalog` | Browse cached model catalog |
| `POST` | `/api/catalog/seed` | Refresh catalog from ollama.com (admin only) |

</details>

<details>
<summary><strong>Monitoring & Logs</strong></summary>

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/dashboard` | Dashboard summary stats |
| `GET` | `/api/metrics` | Aggregated metrics (`?days=7`) |
| `GET` | `/api/gpu` | GPU status for all configured servers |
| `GET` | `/api/logs` | Request logs — filterable by server, model, date, status |
| `DELETE` | `/api/logs` | Purge logs before a given date |
| `GET` | `/api/logs/export` | Export logs (`?format=csv\|json`) |
| `GET` | `/api/alerts` | List alert rules |
| `POST` | `/api/alerts` | Create alert rule |
| `GET` | `/api/alerts/check` | Evaluate all active alerts |

</details>

<details>
<summary><strong>Users & API Keys</strong></summary>

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/users` | List users (admin only) |
| `POST` | `/api/users` | Create user (admin only) |
| `GET` | `/api/users/[id]` | Get user (admin only) |
| `PUT` | `/api/users/[id]` | Update user or toggle active (admin only) |
| `DELETE` | `/api/users/[id]` | Delete user (admin only) |
| `GET` | `/api/api-keys` | List API keys (values masked) |
| `POST` | `/api/api-keys` | Generate new API key |
| `PUT` | `/api/api-keys/[id]` | Toggle key active/inactive |
| `DELETE` | `/api/api-keys/[id]` | Revoke and delete key |

</details>

<details>
<summary><strong>Settings & Presets</strong></summary>

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/settings` | Read app settings |
| `PUT` | `/api/settings` | Update app settings |
| `GET` | `/api/presets` | List parameter presets |
| `POST` | `/api/presets` | Create preset |
| `PUT` | `/api/presets/[id]` | Update preset |
| `DELETE` | `/api/presets/[id]` | Delete preset |

</details>

<details>
<summary><strong>Setup & Health</strong></summary>

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/setup/status` | Check if setup is complete |
| `POST` | `/api/setup/admin` | Create admin user |
| `POST` | `/api/setup/server` | Configure initial Ollama server |
| `POST` | `/api/setup/complete` | Mark setup as done |
| `POST` | `/api/setup/test-connection` | Test Ollama connectivity |
| `GET` | `/api/health` | App health check |

</details>

---

## 🛠 Development

### Prerequisites

- Node.js 20+
- An Ollama instance (local or remote)

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
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Production build |
| `npm start` | Start production server |
| `npm run lint` | ESLint |
| `npm test` | Unit tests (Vitest) |
| `npm run test:coverage` | Coverage report |
| `npm run test:e2e` | E2E tests (Playwright) |
| `npm run db:studio` | Prisma Studio — visual DB browser |
| `npm run db:push` | Push schema changes to DB |

### Database

SQLite is the default (zero config). Switch to PostgreSQL by setting `DATABASE_URL`:

```bash
DATABASE_URL="postgresql://user:pass@host:5432/ollamaadmin"
```

The Docker entrypoint and dev setup both auto-detect the provider and run migrations automatically.

### Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router, standalone output) |
| Language | TypeScript (strict) |
| ORM | Prisma — SQLite / PostgreSQL |
| Auth | NextAuth.js v4 — credentials + GitHub OAuth |
| i18n | next-intl — 9 locales |
| Styling | Tailwind CSS |
| Icons | Lucide React |
| Syntax highlighting | Shiki |
| Unit tests | Vitest + jsdom |
| E2E tests | Playwright |
| CI/CD | GitHub Actions → ghcr.io |
| GPU Agent | Python, FastAPI, uvicorn |

### CI/CD

| Workflow | Trigger | Actions |
|---|---|---|
| **CI** | Pull requests to `main` | Lint, test, type-check, Docker build (no push) |
| **Release** | Merge to `main` | Test, build multi-arch (amd64 + arm64), push to ghcr.io, tag, GitHub Release |

Docker images are tagged as `:latest`, `:0.11.0`, `:0.11`, `:0`, and `:sha-<commit>`.

---

## 🔧 Troubleshooting

<details>
<summary><strong>"Connection refused" when adding an Ollama server</strong></summary>

- Verify Ollama is running: `ollama list`
- Inside Docker on Mac/Windows, use `http://host.docker.internal:11434` instead of `localhost`
- On Linux, use the host's actual IP: `ip route show default | awk '{print $3}'`
- Check firewall: `sudo ufw allow 11434/tcp`

</details>

<details>
<summary><strong>GPU not detected</strong></summary>

- Confirm NVIDIA drivers work: `nvidia-smi`
- Set `GPU_AGENT_ENABLED=true` in `.env` and restart
- Check GPU Agent logs: `docker compose logs gpu-agent`
- Confirm the GPU Agent URL is set in **Admin → Servers → edit server**

</details>

<details>
<summary><strong>Setup wizard redirects loop / database locked</strong></summary>

- SQLite is single-writer; ensure only one instance is running
- Delete stale WAL file: `rm ollama-admin.db-wal ollama-admin.db-shm`
- Use PostgreSQL for concurrent or multi-replica deployments

</details>

<details>
<summary><strong>Chat responses are slow or timing out</strong></summary>

- Confirm the model is loaded: **Admin → GPU** shows running models
- Check Ollama logs: `docker logs <ollama-container>`
- Smaller quantisations (e.g. `q4_K_M`) are significantly faster than full-precision

</details>

<details>
<summary><strong>Logs not appearing</strong></summary>

- `LOG_STORE_PROMPTS=false` stores only metadata (tokens, latency), not content
- Confirm the proxy endpoint is being used (`/api/proxy/*`) — direct Ollama calls are not logged

</details>

---

## 🤝 Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.

```bash
# Quick contributor setup
git clone https://github.com/ollama-admin/ollama-admin.git
cd ollama-admin && npm install && npm run dev

# Run full checks before submitting
npm test && npx next lint && npm run build
```

Good first issues are labelled [`good-first-issue`](https://github.com/ollama-admin/ollama-admin/issues?q=label%3Agood-first-issue) on GitHub.

---

## 🔒 Privacy

- Set `LOG_STORE_PROMPTS=false` to log only metadata (tokens, latency, model) — prompt and response content is never written to the database
- Logs are auto-purged after `LOG_RETENTION_DAYS` days
- Catalog refresh is rate-limited to avoid hammering ollama.com
- Do not expose Ollama Admin to the internet without enabling authentication

---

## 📄 License

[MIT](LICENSE)
