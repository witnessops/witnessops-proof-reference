# VaultMesh Protocol Conformance Corpus v1.2

This corpus freezes the first public conformance cases for VaultMesh proof-bundle verification.

Each case contains:

- a frozen bundle layout
- representative manifest and artifact files
- an `expected-result.json` object aligned to the public verifier contract

Run the corpus validator with:

`pnpm protocol:validate-corpus`

Run the executable verifier comparison with:

`pnpm protocol:run-corpus`

## Canonical fixture layout

Each corpus case lives at:

`tests/protocol-conformance/<case-name>/`

Case names MUST use lowercase kebab-case.

Allowed case entries are:

- `artifacts/`
- `expected-result.json`
- `manifest.json`
- `witness/`

Additional top-level files or directories are not part of the frozen v1 layout.

## Required files

Every case MUST contain:

- `artifacts/`
- `expected-result.json`

Every case SHOULD contain:

- `manifest.json`

The only sanctioned exception is a negative case whose expected errors include `FAILURE_MANIFEST_MISSING`.

The corpus validator also allows a manifest file to remain structurally malformed when the expected errors include `FAILURE_BUNDLE_MALFORMED` and/or `FAILURE_REQUIRED_FIELD_MISSING`.

## Artifact directory rules

- `artifacts/` MUST exist and MUST contain at least one `.json` file.
- Every file under `artifacts/` MUST be referenced by `manifest.json` when a manifest is present.
- Every manifest artifact path MUST point to `artifacts/*.json` inside the same case directory.
- Manifest artifact entries MUST declare `id`, `type`, `path`, and `hash`.

## Witness directory rules

- `witness/` is optional.
- When present, `witness/` MUST contain one or more `.json` files.
- Cases with `witness/` MUST declare `witnesses` in `expected-result.json`.
- The `witnesses` array length MUST match the number of witness files.

## Expected result schema

`expected-result.json` freezes the public verifier-output contract used by the corpus.

Required fields:

- `status`: `valid`, `invalid`, or `indeterminate`
- `protocolVersion`: semver-like string such as `1.0.0`
- `bundleUri`: canonical bundle URI such as `vm://bundle/valid-minimal-bundle`
- `bundleDigest`: `sha256:`-prefixed digest string
- `errors`: array of canonical failure codes
- `verifiedArtifacts`: array of artifact types accepted by the verifier

Optional fields:

- `witnesses`: array of witness identifiers for witness-attested cases
- `indeterminateReason`: required only when `status` is `indeterminate`

Status rules:

- `valid` cases MUST use an empty `errors` array.
- `invalid` cases MUST declare at least one failure code.
- `indeterminate` cases MUST declare `indeterminateReason`.

## Manifest rules

When present, `manifest.json` is frozen to this minimal v1 contract:

- `protocolVersion`
- `bundleUri`
- `bundleDigest`
- `artifacts`

Optional manifest fields already used by the frozen v1 corpus are:

- `requiresTrustRegistry`: boolean flag for cases that become indeterminate without registry access
- `compatibility`: object with `minimumProtocolVersion` for explicit breaking-compatibility requirements
- `witnessPolicy`: object with `type`, `required`, and `available` for witness quorum cases

Artifact payloads MAY declare `schemaVersion`. When a required artifact uses an unsupported schema version, the verifier MUST return `FAILURE_SCHEMA_VERSION_UNSUPPORTED`.

The manifest `protocolVersion`, `bundleUri`, and `bundleDigest` MUST match `expected-result.json`.

For sanctioned malformed-manifest cases, the corpus validator only requires `manifest.json` to remain a JSON object and keeps any present `protocolVersion` aligned to `expected-result.json`.

When `manifest.json` is absent or omits `bundleUri` or `bundleDigest`, the executable runner derives synthetic canonical values from the case directory name.

## Naming and drift control

- Keep case names stable once published.
- Add new cases rather than silently reshaping existing ones unless the protocol contract itself changes.
- When a docs example changes verification meaning, update the matching corpus case in the same change set.
- When a corpus case changes expected verification output, update the human-readable docs example in the same change set.

## Case mapping

| Corpus case | Docs example |
| --- | --- |
| `valid-minimal-bundle` | `proof-bundles/conformance-examples` Example 1 |
| `valid-multi-artifact-chain` | `proof-bundles/conformance-examples` Example 2 |
| `valid-witness-attested-bundle` | `proof-bundles/conformance-examples` Example 3 |
| `invalid-hash-mismatch` | `proof-bundles/conformance-examples` Example 4 |
| `missing-manifest-bundle` | `proof-bundles/conformance-examples` Example 5 |
| `invalid-signature` | `proof-bundles/conformance-examples` Example 6 |
| `indeterminate-offline` | `proof-bundles/conformance-examples` Example 7 |
| `invalid-protocol-version-unsupported` | `proof-bundles/conformance-examples` Example 8 |
| `invalid-manifest-malformed` | `proof-bundles/conformance-examples` Example 9 |
| `invalid-witness-quorum-unsatisfied` | `proof-bundles/conformance-examples` Example 10 |
| `invalid-schema-version-unsupported` | `proof-bundles/conformance-examples` Example 11 |
| `invalid-breaking-version-change` | `proof-bundles/conformance-examples` Example 12 |
| `invalid-witness-lineage-mismatch` | `proof-bundles/conformance-examples` Example 13 |

## Corpus rule

When a docs example changes verification meaning, the corresponding corpus case MUST be updated in the same change set.

When a corpus case changes expected verification output, the human-readable docs example MUST be updated in the same change set.
