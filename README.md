# witnessops-proof-reference

Canonical reference implementation and frozen test corpus for the WitnessOps proof-bundle verification protocol.

## What this repo is

A library and corpus repo. Not an app, not a service, not a deployment target.

It owns:

- **Verifier core** — `packages/proof-reference/src/verification/` — the canonical bundle verification implementation, legacy JSON structural checks, render model, and shared verification primitives
- **Protocol conformance corpus** — `tests/protocol-conformance/` — 16 frozen test cases with expected verifier outputs (protocol v1.2)
- **Corpus runners** — `scripts/validate-protocol-corpus.ts` (schema/layout validation) and `scripts/run-protocol-corpus.ts` (executable verifier comparison against expected results)

## What this repo is not

- Live web or app surface code
- Receipt-only runtime lanes
- Producer-side deployment, incidents, or package lanes
- `content/witnessops` or `content/vaultmesh`
- `proofs/**` (deferred to a later slice)
- A consumer of `@public-surfaces/*` — no such imports exist or are permitted
- A package with external runtime dependencies — dev tooling only (TypeScript, ESLint, tsx)

## Package exports

`@witnessops/proof-reference` exports three paths:

| Export path | Entry | Contents |
|---|---|---|
| `.` | `src/index.ts` | Re-exports verification + bundle-identity |
| `./verification` | `src/verification/index.ts` | Canonical verifier, legacy checks, render model, primitives |
| `./protocol-conformance` | `src/protocol-conformance.ts` | Corpus loader, expected-result parser, conformance runner |
| `./bundle-identity` | `src/bundle-identity.ts` | `vm://bundle/{id}` URI normalization |

## Protocol conformance corpus

Each case in `tests/protocol-conformance/` is a self-contained bundle with:

- `manifest.json` — bundle metadata and artifact declarations
- `artifacts/` — one or more JSON artifact files
- `expected-result.json` — the frozen verification output contract
- `witness/` — optional witness attestation files

Case names are stable once published. The `expected-result.json` is the single source of truth for what the verifier must produce for that case.

## Health

See [commands.md](commands.md) for the full validation chain with explanations.

Quick check:

```
pnpm build && pnpm lint && pnpm typecheck && pnpm test
```
