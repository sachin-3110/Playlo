# Playlo

> **Chalo Khelein** — find your people, organise your game, get playing.

Playlo is a sports-networking and court-booking platform. **Launch market:** Sirsa, Haryana, India · **Launch sport:** badminton.

This repository currently holds the **Engineering & Product Handbook (v2.0, 27 Oct 2026)** — the complete specification someone else can pick up and build from. Application code is not yet in the repository.

## Start here

**→ [`docs/00-start-here.md`](./docs/00-start-here.md)** — what Playlo is, reading order by role, the decisions that need an owner's confirmation, and what changed from v1.

| # | Document | In one line |
|---|---|---|
| 00 | [Start here](./docs/00-start-here.md) | Orientation, reading order, owner decisions, glossary |
| 01 | [Product requirements](./docs/01-product-requirements.md) | Personas, requirements with IDs, acceptance criteria, metrics, analytics events |
| 02 | [System architecture](./docs/02-architecture.md) | Components, topology, conventions, NFR targets, resilience, cost |
| 03 | [Data model](./docs/03-data-model.md) | Validated Prisma schema, DB-enforced invariants, state machines, retention |
| 04 | [API specification](./docs/04-api-specification.md) | Procedures, permissions, rate limits, validators, errors, webhooks |
| 05 | [Business logic](./docs/05-business-logic.md) | Booking engine, fees, refunds, games, availability, reliability, sharing |
| 06 | [Frontend & design system](./docs/06-frontend-design-system.md) | Tokens (WCAG-checked), components, states, PWA, i18n, performance |
| 07 | [Security, privacy & compliance](./docs/07-security-privacy-compliance.md) | Controls, threat model, India compliance (DLT, GST/TDS, DPDP) |
| 08 | [Engineering operations](./docs/08-engineering-operations.md) | Environments, CI/CD, test catalogue, flags, alerts, runbooks |
| 09 | [Delivery plan](./docs/09-delivery-plan.md) | Effort model, scope options, timeline, spikes, gates, risks |
| 10 | [Decision log](./docs/10-decision-log.md) | ADRs, including what changed from v1 and why |
| 11 | [Audit report](./docs/11-audit-report.md) | 55 findings in the v1 plan, with severity, fix and verification |
| 12 | [Open items](./docs/12-open-items.md) | Everything still undecided or unverified, with owners and defaults |

## At a glance

- **Stack:** Next.js (TypeScript, App Router) · tRPC · Prisma · Postgres (Neon, PostGIS) · Upstash Redis/QStash · Razorpay (payments, Route) · MSG91 (OTP) · Cloudflare R2 · Tailwind v4 + shadcn/ui · PostHog, Sentry, Axiom.
- **Shape:** modular monolith — one deployable app with route groups (`/`, `/app`, `/venue`, `/admin`) and shared packages (`db`, `api`, `auth`, `validators`, `domain`, `ui`, `config`, `logger`).
- **Phasing:** 1a games-first → 1b booking and payments → 2 retention → 3 monetisation. See [delivery plan](./docs/09-delivery-plan.md).
- **Planned repository layout** (when code starts): see [architecture §5](./docs/02-architecture.md).

## Status of the documentation

Verified during the review: schema validity, integrity SQL against a real Postgres engine, domain logic and validators with tests, CI YAML syntax. **Not yet verified** (tracked as spikes and open items): live concurrency on Neon, PostGIS queries, Razorpay Route behaviour, vendor prices, tax and legal interpretations. Details in [audit report §6–7](./docs/11-audit-report.md).

Re-run the checks with `cd docs/_verification && npm install && npm test` ([details](./docs/_verification/README.md)). The original v1 documents are preserved unchanged in [`docs/_archive/`](./docs/_archive/).

## Contributing to the docs

Docs live with code: a change to behaviour, a contract or a decision updates the relevant document in the same PR. Record decisions in the [decision log](./docs/10-decision-log.md) and close items in the [open-items register](./docs/12-open-items.md). See [00-start-here §8](./docs/00-start-here.md).

## Working with AI agents (read before handing to anyone)

Several AI tools can take turns on this repo (when one hits its free limit, the next continues). Entry point for every tool: **[`AGENTS.md`](./AGENTS.md)** → **[`STATUS.md`](./STATUS.md)** → **[`docs/BUILD-PLAN.md`](./docs/BUILD-PLAN.md)** (ordered tasks, Phase 0 → 3). Tool-specific files (`CLAUDE.md`, `GEMINI.md`, `.cursorrules`, `.github/copilot-instructions.md`) just point there.

Rules that save tokens: read only the task's linked doc sections, reuse the tested code in `docs/_verification/`, commit after every task, update only `STATUS.md`, no extra docs or long summaries.

### Skills / plugins worth installing (if the tool supports them)
| Purpose | Skill (Claude Code names; equivalents exist in other tools) |
|---|---|
| Next.js / React correctness | `vercel:nextjs`, `vercel:react-best-practices`, `vercel:next-cache-components` |
| UI components | `vercel:shadcn`, `frontend-design` |
| Postgres / schema quality | `supabase:supabase-postgres-best-practices` |
| Tests first, bugs fast | `superpowers:test-driven-development`, `superpowers:systematic-debugging` |
| Finish + review | `simplify`, `code-review`, `superpowers:verification-before-completion` |
| Plans / parallel work | `superpowers:writing-plans`, `superpowers:executing-plans` |
| Accessibility / perf checks | `chrome-devtools-mcp:a11y-debugging`, `chrome-devtools-mcp:debug-optimize-lcp` |
| Deploy | `vercel:deploy`, `vercel:env` |

Without skills: any tool can follow `AGENTS.md` alone. Optional MCP servers that help: GitHub (PRs), Vercel, a Postgres/Neon MCP, a browser/Playwright MCP.
