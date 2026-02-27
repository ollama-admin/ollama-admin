# Contributing to Ollama Admin

Thank you for your interest in contributing. This guide will get you up and running.

## Before you start

- Check [existing issues](https://github.com/ollama-tools/ollama-admin/issues) to avoid duplicates
- For large changes, open an issue first to discuss the approach
- For small fixes, feel free to open a PR directly

## Local development setup

### Requirements

- Node.js 20+
- Docker and Docker Compose
- A running Ollama instance

### Steps

1. Fork the repo and clone your fork
2. Install dependencies: `npm install`
3. Copy the env file: `cp .env.example .env.local`
4. Set up the database: `npx prisma migrate dev`
5. Start the dev server: `npm run dev`
6. Open `http://localhost:3000`

### With Docker

    docker compose -f docker-compose.dev.yml up

## Branch naming

| Type | Pattern | Example |
|---|---|---|
| New feature | feature/* | feature/gpu-monitoring |
| Bug fix | hotfix/* | hotfix/server-health-check |
| Refactor | refactor/* | refactor/gateway-layer |
| Documentation | docs/* | docs/api-reference |
| Tooling / deps | chore/* | chore/update-prisma |

## Commit messages

Follow [Conventional Commits](https://www.conventionalcommits.org):

    feat: add GPU monitoring panel
    fix: correct token count in gateway logs
    docs: update contributing guide
    chore: upgrade next.js to 14.2
    refactor: simplify server health check logic

## Opening a Pull Request

1. Make sure your branch is up to date with main
2. Run tests locally: `npm run test && npm run lint`
3. Open a PR against main with a clear description
4. Fill in the PR template completely
5. Wait for CI to pass and at least 1 review

## What gets reviewed

- Does it solve the problem described?
- Does it follow the existing code style?
- Are there tests for new functionality?
- Does it introduce unnecessary complexity?
- Are there any security concerns?

## Reporting bugs

Use the [bug report template](https://github.com/ollama-tools/ollama-admin/issues/new?template=bug_report.md).
Include logs whenever possible: `docker compose logs ollama-admin`

## Suggesting features

Use the [feature request template](https://github.com/ollama-tools/ollama-admin/issues/new?template=feature_request.md).
Big features should be discussed in [Discussions](https://github.com/ollama-tools/ollama-admin/discussions) first.