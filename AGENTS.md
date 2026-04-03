# AGENTS.md

This repo is the retained-reference home for WitnessOps proof and corpus material.

## Rules

- Keep the repo library/CLI/corpus only.
- Do not add live web/app surface code.
- Do not add receipt-only runtime lanes.
- Do not import `@public-surfaces/*`.
- Do not widen into producer-side deployment, incidents, or package lanes.
- Treat `proofs/**` as out of scope unless a later slice freezes it in.

## Validation

- `pnpm build`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm protocol:validate-corpus`
- `pnpm protocol:run-corpus`
