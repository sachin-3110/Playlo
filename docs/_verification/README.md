# Verification harness

Executable checks that back the claims made in the handbook. **This is not application code** — it is the evidence behind statements such as "the integrity SQL rejects overlapping bookings" or "the fee identities hold for every ₹1 up to ₹2 000". When the application repository is created, move these files into it (the domain modules and validators are written to be adopted as-is).

## Run

Requires Node.js ≥ 22.18 (runs TypeScript directly), Python 3, and network access for `npm install`.

```bash
cd docs/_verification
npm install
npm test
```

| Script | What it proves | Source |
|---|---|---|
| `npm run test:schema` | The Prisma schema in [03 §4](../03-data-model.md) is valid (Prisma 6) | `prisma/schema.prisma` |
| `npm run test:sql` | Generates DDL from the schema, applies `sql/integrity.sql` ([03 §5.1](../03-data-model.md)) on an embedded Postgres (PGlite + `btree_gist`) and runs 21 checks: overlap rejection, adjacency allowed, expiry frees a slot, **late revival rejected after re-sale**, fee identities, atomic capacity, one successful payment per booking, append-only audit log, advisory-lock function, booking-number format | `sql/` |
| `npm run test:domain` | 16 tests for fees, refunds, reliability, availability ([05](../05-business-logic.md)) | `domain/` |
| `npm run test:validators` | 7 tests for the Zod 4 validators ([04 §6](../04-api-specification.md)) | `validators/` |
| `npm run test:docs` | Every internal link and anchor resolves; every `NN §X.Y` reference points at a real heading; test, runbook, ADR, spike and open-item IDs referenced are defined; every Mermaid diagram parses | `tools/` |

`workflows/ci.yml` is the CI workflow from [08 §4](../08-engineering-operations.md); it was checked for YAML validity but **not executed** (it needs GitHub Actions and the real repository).

## What this does *not* prove

- Behaviour under **real concurrent connections** (PGlite is single-connection). The *constraint semantics* are proven; the contention behaviour on Neon through the pooler is Spike S2 / test T-01 in [08 §5.1](../08-engineering-operations.md).
- **PostGIS** queries (the engine used has no PostGIS) — Spike S3.
- Razorpay, MSG91, Neon, Vercel or any other provider's live behaviour.
- The service-layer reference code in the handbook (`initiateHold`, `confirmPayment`, `joinGame`, middleware): those are specifications, not executed code.

If you change a number, rule or schema in the handbook, change the corresponding file here in the same commit and re-run `npm test`.
