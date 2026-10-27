# AGENTS.md — read this first (any AI tool, any session)

Playlo: badminton games + court booking, Sirsa (India). Several AI tools take turns on this repo as free tiers run out. **You may be the 2nd, 5th or 20th agent. This file + `STATUS.md` are all the context you need to start.**

## Start in 60 seconds
1. Read `STATUS.md` (≈20 lines): what is done, **the current task**, blockers.
2. Open `docs/BUILD-PLAN.md`, find the task ID from STATUS, read **only that task**.
3. Read **only the doc sections that task links** (e.g. `docs/05-business-logic.md §2.4`). Never read all docs. The handbook is ~300 KB.
4. Write code. Run tests. Commit. Update `STATUS.md`. Stop or take the next task.

## Token discipline (most important rule)
Budget goes to **code and tests**, not prose.
- No long chat summaries, no restating docs, no progress essays. Reply in ≤5 lines unless asked.
- No new docs/logs. The only files you update for process: `STATUS.md` (≤5 lines per task) and a checkbox in `BUILD-PLAN.md`.
- Reuse tested code: copy from `docs/_verification/` (`domain/*.ts`, `validators/validators.ts`, `sql/integrity.sql`, `prisma/schema.prisma`). Do not rewrite it.
- Read files with line ranges / grep, not whole files. Don't re-read what you just wrote.
- Prefer small tasks finished and committed over big tasks half done.

## Handoff protocol (you may be cut off at any moment)
- **Commit after every task** (or every working sub-step): `feat(B1-07): short message`. Uncommitted work is lost to the next agent.
- Before starting a task set in `STATUS.md`: `Current: <ID> — started by <tool>`. When done, tick `[x]` in BUILD-PLAN, set `Current` to the next ID.
- If you stop mid-task: commit WIP, and write 1–3 lines in STATUS "Resume notes" (what's done, what's next, any trap). Nothing else.
- If tests fail and you can't fix them quickly: commit on a branch `wip/<ID>`, note it in STATUS, move on or stop.
- Never leave the main branch red.

## Ground rules (non-negotiable; reasons in docs)
1. **Money = integer paise**, calculated only in `packages/domain/fees.ts`. Never floats.
2. **No double bookings:** DB exclusion constraint (`docs/03 §5.1`). Don't remove or bypass.
3. **A booking is confirmed only by `confirmPayment()`** (`docs/05 §2.4`) — webhook, client verify and reconcile all call it.
4. **Authorise on the server:** permission + ownership on every by-ID access (`docs/04 §2–3`). Never trust the UI.
5. **Raw SQL:** tagged `$queryRaw`/`$executeRaw` only, identifiers double-quoted camelCase (`"startTime"`).
6. **Times:** store UTC `timestamptz`, intervals `[start,end)`, show IST. **No PII** in logs/analytics.
7. All user-visible text via i18n keys. Text contrast ≥ 4.5:1 using the tokens in `docs/06 §3.1`.
8. Don't build Phase 2/3 or "what not to build" items (`docs/01 §8`).
9. Don't invent decisions. If blocked by an open item (`docs/12`), use its **default** and note it in STATUS.

## Commands (fill in as the repo is created — B0-01)
```
pnpm install · pnpm dev · pnpm turbo run lint typecheck test · pnpm --filter @playlo/db prisma migrate deploy
Doc/SQL/domain checks:  cd docs/_verification && npm install && npm test
```

## Where things are
| Need | Go to |
|---|---|
| What to do next | `STATUS.md` → `docs/BUILD-PLAN.md` |
| Requirements / acceptance | `docs/01-product-requirements.md` (§3 IDs, §5 AC-xx) |
| Architecture / conventions | `docs/02-architecture.md` |
| Schema / constraints / state machines | `docs/03-data-model.md`, `docs/_verification/prisma/schema.prisma` |
| Procedures, permissions, errors | `docs/04-api-specification.md` |
| Booking, fees, games, refunds logic | `docs/05-business-logic.md` + `docs/_verification/domain/` |
| UI tokens, components, PWA, i18n | `docs/06-frontend-design-system.md` |
| Security, compliance | `docs/07-…` |
| Tests, CI, runbooks | `docs/08-…` (test catalogue T-01…T-15) |
| Why a decision was made | `docs/10-decision-log.md` |

## Definition of done (per task)
Code + tests for the task's acceptance line pass · lint/typecheck green · committed · STATUS updated. Tests required for: anything touching money, bookings, capacity, auth/permissions.

## Tool-specific entry files
`CLAUDE.md`, `GEMINI.md`, `.cursorrules`, `.github/copilot-instructions.md` only point here. Edit **this** file, not those.
