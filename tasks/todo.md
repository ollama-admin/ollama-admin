# Dashboard Redesign — Operations Dashboard

**Branch:** `develop`
**Version bump:** minor (new feature → 0.11.0)

## Goal

Replace the minimal 3-card dashboard with a proper real-time operations dashboard:
bento grid layout, KPI strip, live request chart, server status with VRAM, top models,
running models, and a live activity feed.

---

## Plan

### Phase 1 — API layer
- [ ] **1.1** Add `/api/dashboard` route — single endpoint that aggregates all dashboard data:
  - Today's request count + yesterday's (for delta %)
  - Today's total tokens (prompt + completion)
  - Today's avg latency + p95 latency
  - Today's error count + error rate %
  - Requests per hour for the last 24h (for the area chart)
  - Top 5 models by requests today
  - Server list with health status + version (reuse existing `/api/servers/[id]/health`)
  - Running models per server (from Ollama `/api/ps` via proxy)
  - GPU info per server (from existing `/api/gpu`)

### Phase 2 — Dashboard components
- [ ] **2.1** `KpiCard` component — stat card with label, big number, delta badge (▲▼ vs yesterday), optional sub-label. Reuses existing `Card`.
- [ ] **2.2** `RequestsChart` component — area chart of requests/hour for last 24h. Wraps existing `RealtimeChart` with proper data mapping.
- [ ] **2.3** `ServerStatusPanel` component — list of servers, each with: online/offline dot, name, Ollama version, VRAM progress bar (reuses `ProgressBar`), running model count.
- [ ] **2.4** `TopModelsChart` component — horizontal bar chart (pure SVG, no library) of top 5 models by requests today, with request count label.
- [ ] **2.5** `RunningModelsPanel` component — cards for each model currently in VRAM: model name, server, VRAM size, expires_at countdown, unload button.
- [ ] **2.6** `ActivityFeed` component — last 8 log entries, polling every 15s, fade-in animation on new entries. Shows: status badge, model, latency, server, time.

### Phase 3 — Dashboard page rebuild
- [ ] **3.1** Rewrite `app/page.tsx`:
  - Fetch `/api/dashboard` on mount (SWR with 30s refresh)
  - Bento grid layout: KPI strip (top) + two-column middle + activity feed (bottom)
  - Proper loading skeletons for each section
  - Handle empty state (no servers) — keep existing EmptyState
- [ ] **3.2** Add i18n keys for all new strings in all 4 locales (en, es, ca, fr)

### Phase 4 — Polish & tests
- [ ] **4.1** Verify light + dark mode contrast on all new components
- [ ] **4.2** Verify responsive layout at 375px, 768px, 1024px, 1440px
- [ ] **4.3** Write unit tests for the `/api/dashboard` route (Vitest)
- [ ] **4.4** Run full CI gate: `npm test` + `npx next lint` + `npm run build`
- [ ] **4.5** Bump version to 0.11.0

---

## Layout Sketch

```
┌─────────────────────────────────────────────────────────┐
│  KPI: Servers  │  Models  │  Req Today  │  Tokens  │ Latency │
├─────────────────────────────────────┬───────────────────┤
│                                     │                   │
│   Requests/hour (area chart, 24h)   │  Server Status    │
│                                     │  + VRAM bars      │
├──────────────────────┬──────────────┴───────────────────┤
│  Top 5 Models Today  │  Running Models in VRAM           │
│  (horizontal bars)   │  (cards with expiry + unload)     │
├─────────────────────────────────────────────────────────┤
│  Activity Feed (last 8 requests, polling 15s)           │
└─────────────────────────────────────────────────────────┘
```

---

## API Design — `/api/dashboard`

```ts
GET /api/dashboard

Response:
{
  kpis: {
    serversOnline: number,
    serversTotal: number,
    modelsAvailable: number,
    requestsToday: number,
    requestsYesterday: number,
    tokensToday: number,
    avgLatencyMs: number,
    p95LatencyMs: number,
    errorCount: number,
    errorRate: string,        // "2.4"
  },
  requestsPerHour: { hour: string, count: number }[],  // last 24 buckets
  topModels: { model: string, count: number }[],       // top 5 today
  servers: {
    id: string,
    name: string,
    url: string,
    status: "online" | "offline",
    version?: string,
    runningModels: { name: string, size_vram: number, expires_at: string }[],
    gpu?: { memoryTotal: number, memoryUsed: number, utilization: number }[],
  }[],
}
```

---

## Design Tokens (existing CSS vars + additions)

No new design tokens needed — uses existing `--primary`, `--muted`, `--border`,
`--success`, `--destructive`, `--background`, `--card` variables.

Color mapping for dashboard widgets:
- Requests line: `hsl(var(--primary))` (blue)
- Success rate: `hsl(var(--success))` (green)
- Error rate: `hsl(var(--destructive))` (red)
- Latency warning: `#f59e0b` (amber) when p95 > 2000ms
- VRAM bar: `hsl(var(--primary))` → amber → red based on % used

---

## Key Constraints

- **No new npm libraries** — use existing `RealtimeChart`, `ProgressBar`, `Card`, `Badge`, `Skeleton`
- **Top models chart**: pure SVG horizontal bars (no recharts/chart.js needed)
- **Polling strategy**: SWR `refreshInterval: 30000` for main data; activity feed at 15s
- **i18n**: all user-visible strings go through `useTranslations("dashboard")`
- **Accessibility**: all charts have `role="img" aria-label`, progress bars have `aria-valuenow`
- **Reduced motion**: animations gated on `prefers-reduced-motion` media query

---

## Files to Create / Modify

| File | Action |
|------|--------|
| `app/api/dashboard/route.ts` | CREATE — new aggregated endpoint |
| `app/page.tsx` | REWRITE — new bento layout |
| `components/dashboard/kpi-card.tsx` | CREATE |
| `components/dashboard/requests-chart.tsx` | CREATE |
| `components/dashboard/server-status-panel.tsx` | CREATE |
| `components/dashboard/top-models-chart.tsx` | CREATE |
| `components/dashboard/running-models-panel.tsx` | CREATE |
| `components/dashboard/activity-feed.tsx` | CREATE |
| `messages/en.json` | UPDATE — add new keys |
| `messages/es.json` | UPDATE |
| `messages/ca.json` | UPDATE |
| `messages/fr.json` | UPDATE |
| `app/api/dashboard/route.test.ts` | CREATE — unit tests |
| `package.json` | UPDATE — bump to 0.11.0 |

---

## Review

_To be filled after implementation._
