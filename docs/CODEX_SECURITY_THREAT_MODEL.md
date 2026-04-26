# Codex Security Threat Model — witnessops-proof-reference

Status: `repo_prep_seed_for_codex_security`

This document is a repository-specific seed for Codex Security review and GitHub PR review. It is not a vulnerability report, not a scan result, and not proof that any production workflow occurred.

## Scope

This repository is the public reference implementation and frozen conformance corpus for the WitnessOps proof-bundle verification protocol.

It owns:

- verifier core under `packages/proof-reference/src/verification/`
- legacy structural checks, render model, bundle identity, and shared verification primitives
- protocol conformance corpus under `tests/protocol-conformance/`
- corpus validation and execution scripts under `scripts/`
- contained external-seam fixtures used only to prove bounded rejection behavior
- package exports for reference-verification and protocol-conformance consumers

## Out of scope

This repository does not own:

- live web or app surface code
- receipt-only runtime lanes
- producer-side deployment, incidents, or package lanes
- production workflow execution
- customer evidence custody
- signing-key custody or key-registry authority
- proof-engine package generation
- public website copy
- `proofs/**` unless a later slice explicitly freezes it in
- proof that an operational event happened outside the supplied bundle artifacts

Do not infer that a passing Codex Security review verifies any out-of-scope system.

## Authority boundaries

- `main` in `witnessops/witnessops-proof-reference` is the code authority for this reference repo.
- The conformance corpus truth for each case is `expected-result.json`.
- Published corpus case names are stable; do not rename or remove them casually.
- The verifier must match `expected-result.json` exactly for conformance cases.
- Codex Security may identify findings and suggest patches.
- Codex Security findings do not authorize merge, release, verifier-semantic changes, corpus truth changes, production proof claims, signing authority, deploy, or customer-impacting changes.
- Human maintainer review remains required for changes that affect verifier semantics, corpus cases, expected results, exported APIs, bundle identity, security posture, or public proof language.

## Primary review surfaces

Treat the following as first-class review surfaces:

1. `packages/proof-reference/src/verification/`
   - canonical bundle verification
   - manifest and artifact validation
   - error-code semantics
   - render model and public result shape
   - directory/archive loading behavior
   - contained external-seam rejection behavior

2. `tests/protocol-conformance/`
   - 16 frozen conformance cases
   - `expected-result.json` truth files
   - malformed, missing, rejected, and success-path cases
   - fixture naming and layout stability

3. `scripts/validate-protocol-corpus.ts`
   - corpus layout validation
   - schema-like expectations enforced before runner execution
   - failure behavior for invalid or ambiguous cases

4. `scripts/run-protocol-corpus.ts`
   - executable verifier comparison against expected results
   - exact-match behavior
   - deterministic result reporting

5. Package exports and public API surface
   - `.`
   - `./verification`
   - `./protocol-conformance`
   - `./bundle-identity`

6. External-seam fixtures
   - repo-contained negative seam fixtures
   - `VM_FOUNDRY_BUNDLE_DIR` or other environment overrides
   - rejection semantics for non-canonical producer-side bundle shapes

## Untrusted inputs

Review all handling of:

- bundle directories
- uploaded or loaded file maps
- `manifest.json`
- artifact paths and declared artifact references
- witness files
- `expected-result.json`
- bundle IDs and URI normalization inputs
- malformed JSON
- missing files
- duplicate or ambiguous artifact declarations
- path traversal or absolute-path-like artifact names
- environment override paths used for seam fixtures
- fixture content that may accidentally look like real customer evidence, secrets, credentials, signing keys, or production data

## Security invariants

The following must remain true unless an explicit design change is reviewed and approved:

- The repo remains library/CLI/corpus only; do not add live web/app/service surfaces.
- The verifier checks only the artifacts it is given and must not infer missing authority, execution, or evidence.
- A passing verifier result must not be treated as proof that an omitted operational event occurred.
- A passing verifier result must not imply signer authorization outside referenced key or authority material.
- `expected-result.json` remains the conformance truth for each corpus case.
- Conformance comparison must remain exact, deterministic, and failure-visible.
- Published corpus case names must not be renamed or removed without a separate compatibility decision.
- Missing or malformed manifest exceptions are allowed only where the expected error says so.
- Directory or file loading must not escape the intended bundle boundary.
- External-seam fixtures must remain contained by default and must not require sibling private repositories for normal health.
- No fixture, example, prompt, or test should contain real credentials, customer data, private evidence, signing keys, tokens, or production bundle material.
- Public APIs must not silently widen acceptance of non-canonical bundle shapes.

## High-priority finding classes

Treat the following as P1 for review purposes:

- verifier accepts malformed, incomplete, non-canonical, or path-escaping bundle content as valid
- conformance runner accepts output that does not exactly match `expected-result.json`
- public API or render model turns a rejected, inferred, or not-proven fact into a verified claim
- artifact path handling allows traversal, absolute-path escape, or unintended host-file reads
- environment override behavior makes CI depend on private sibling repos or untrusted external bundle paths by default
- corpus drift changes expected verification truth without clear case-level authority
- fixtures contain real secrets, customer evidence, signing keys, tokens, or production data
- package exports widen verifier behavior without tests and conformance updates
- error-code semantics are weakened or collapsed in a way that hides why verification failed

## Lower-priority but relevant finding classes

Review but do not automatically treat as P1 without demonstrated impact:

- generic dependency advisories not reachable through verifier or corpus execution paths
- cosmetic docs edits that do not change verifier semantics, corpus truth, or proof claims
- missing web-app security headers, because this repo is not a web app
- volumetric denial-of-service without a specific parser, loader, or corpus-amplification path

## Review instructions for Codex

When reviewing this repository:

- prefer small, surgical findings over broad refactors
- name the affected verifier file, corpus case, expected result, loader, script, fixture, or export
- include a concrete exploit path, bypass path, or semantic-drift path where possible
- do not weaken verifier semantics to make a test pass
- do not rewrite expected results unless the semantic change is explicit and separately justified
- do not add runtime dependencies or app/service surfaces
- do not use production credentials, signing keys, customer evidence, or private proof bundles as fixtures
- preserve the distinction between source code, corpus truth, supplied bundle artifacts, and production workflow reality
- preserve the full health chain as the validation baseline

## Suggested Codex Security scan configuration

Initial scan seed:

- repository: `witnessops/witnessops-proof-reference`
- branch: `main`
- history window: `180 days`
- environment family: `Node / pnpm / TypeScript library and corpus`
- setup command: `corepack enable && pnpm install --frozen-lockfile`
- validation command for proposed patches: `pnpm build && pnpm lint && pnpm typecheck && pnpm test && pnpm protocol:validate-corpus && pnpm protocol:run-corpus`
- agent secrets: none
- production credentials: prohibited
- customer data fixtures: prohibited
- private proof bundles: prohibited
- verifier semantic rewrites without maintainer authority: prohibited

## Closure condition for this prep artifact

This prep artifact is sufficient when:

- Codex Security scan context can be seeded from this file.
- `AGENTS.md` points reviewers to this file.
- A private-reporting `SECURITY.md` exists for the repo.
- No runtime code, verifier semantics, corpus cases, expected results, package exports, workflow behavior, secrets, production settings, or proof claims were changed by this prep pass.
