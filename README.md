# witnessops-proof-reference

Dedicated retained-reference home for WitnessOps proof and corpus material.

## Scope

- `packages/proof-reference/src/verification` is the reference verifier core.
- `tests/protocol-conformance` is the frozen protocol corpus.
- `scripts/run-protocol-corpus.ts` and `scripts/validate-protocol-corpus.ts` are the corpus runners.

## Not here

- receipt-only runtime lanes
- live web/app surface code
- `content/witnessops`
- `content/vaultmesh`
- producer-side deployment/incidents/packages lanes
- `proofs/**` for now

## Validation

- `pnpm build`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm protocol:validate-corpus`
- `pnpm protocol:run-corpus`
