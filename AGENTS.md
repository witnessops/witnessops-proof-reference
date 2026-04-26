# AGENTS.md

## Identity

This repo is the retained-reference home for WitnessOps proof and corpus material. It is a library/corpus repo — not an app, not a service, not a deployment target.

## Ownership

- `packages/proof-reference/src/verification/` — verifier core (canonical bundle verification, legacy structural checks, render model, shared primitives)
- `tests/protocol-conformance/` — frozen protocol corpus (16 cases, v1.2 contract)
- `scripts/` — corpus schema validator and executable runner

## Rules

- Keep the repo library/CLI/corpus only. Do not add live web/app surface code.
- Do not add receipt-only runtime lanes.
- Do not import `@public-surfaces/*`.
- Do not widen into producer-side deployment, incidents, or package lanes.
- Treat `proofs/**` as out of scope unless a later slice freezes it in.
- No external runtime dependencies. Dev tooling only.

## Codex Security review

Use [`docs/CODEX_SECURITY_THREAT_MODEL.md`](./docs/CODEX_SECURITY_THREAT_MODEL.md) as the seed context for Codex Security review.

Codex Security may identify findings and propose patches, but it does not authorize merge, release, verifier-semantic changes, corpus truth changes, production proof claims, signing authority, deploy, or customer-impacting changes.

For security-sensitive changes, preserve these boundaries:

- The repo remains library/CLI/corpus only; do not add live web/app/service surfaces.
- The verifier checks only the artifacts it is given and must not infer missing authority, execution, or evidence.
- `expected-result.json` remains the conformance truth for each corpus case.
- Conformance comparison must remain exact, deterministic, and failure-visible.
- Published corpus case names must not be renamed or removed without a separate compatibility decision.
- Directory or file loading must not escape the intended bundle boundary.
- External-seam fixtures must remain contained by default and must not require sibling private repositories for normal health.
- Do not add production secrets, customer data, signing keys, cloud credentials, private evidence bundles, or real production proof bundles to tests, examples, prompts, or fixtures.

## Corpus contract

- Case names in `tests/protocol-conformance/` are stable once published. Do not rename or remove published cases.
- `expected-result.json` is the verification truth for each case. The verifier must match it exactly.
- Changes to documentation examples must sync with corpus case updates in the same commit.
- Sanctioned exceptions: `manifest.json` may be absent or malformed only when the expected error is `FAILURE_MANIFEST_MISSING`, `FAILURE_BUNDLE_MALFORMED`, or `FAILURE_REQUIRED_FIELD_MISSING`.

## Validation

Every change must pass the full health chain:

```
pnpm build
pnpm lint
pnpm typecheck
pnpm test
pnpm protocol:validate-corpus
pnpm protocol:run-corpus
```

`pnpm test` runs unit tests first, then both corpus commands. Running all six explicitly is the canonical health check. See [commands.md](commands.md) for what each command proves.
