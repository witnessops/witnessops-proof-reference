# witnessops-proof-reference

Canonical reference implementation and frozen test corpus for the WitnessOps proof-bundle verification protocol.

## Public role

This repository is the public protocol and reference-verification surface in the WitnessOps proof path.

It helps an external reader inspect how proof bundles are checked, how verifier output is shaped, and how protocol conformance is frozen against known cases.

Trust boundary: this repository is source code and test corpus. It is not, by itself, proof that a production workflow occurred.

A workflow claim is only treated as verified when the concrete proof bundle, manifest, artifacts, receipt, signer or key reference, and verifier result are present for that claim.

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
- Proof that an operational event happened outside the supplied bundle artifacts

## Package exports

`@witnessops/proof-reference` exports four paths:

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

## Verification boundary

The reference verifier can check the artifacts it is given. It does not infer missing authority, missing execution, or missing evidence.

Treat a result as bounded to the provided bundle inputs and verifier contract.

A passing verifier result can support claims about:

- bundle structure
- artifact references
- expected verifier output shape
- protocol conformance for frozen corpus cases
- checks implemented by the verifier core

A passing verifier result does not, by itself, prove:

- that an omitted operational event occurred
- that a human approval happened outside the bundle
- that a signer was authorized outside the referenced key or authority material
- that a production workflow completed if completion artifacts are absent
- that downstream presentation text is accurate

## Health

See [commands.md](commands.md) for the full validation chain with explanations.

Quick check:

```bash
pnpm build && pnpm lint && pnpm typecheck && pnpm test
```
