# commands.md — Health validation chain

The canonical "is this repo healthy?" sequence. Run all six in order. If any fails, the repo is not healthy.

## Commands

### `pnpm build`

Compiles the `@witnessops/proof-reference` package with TypeScript. Proves the verifier core and all exported modules compile without errors.

A failure here means a type error or missing import in the library source.

### `pnpm lint`

Runs ESLint across the entire workspace with `--max-warnings=0`. Proves no lint violations exist anywhere — source, scripts, or tests.

A failure here means a code style or correctness rule was violated.

### `pnpm typecheck`

Runs `tsc` against the workspace root `tsconfig.json`. Proves the workspace-level type resolution is clean, including scripts and cross-package references.

A failure here means a type error in scripts or workspace config that `pnpm build` (which only checks the package) might miss.

### `pnpm test`

Runs the full test suite: unit tests (71 cases via `node --test`), then `protocol:validate-corpus`, then `protocol:run-corpus`. This is the single command that exercises everything.

A failure here means either a unit test broke, the corpus layout is invalid, or the verifier output diverged from expected results.

### `pnpm protocol:validate-corpus`

Validates the schema and layout of all 16 protocol conformance cases. Checks that every case has valid `expected-result.json`, valid `manifest.json` (where required), correct artifact references, consistent metadata, and no unknown keys or files.

A failure here means the corpus structure is malformed — not that the verifier is wrong, but that the test data itself is broken.

### `pnpm protocol:run-corpus`

Executes the canonical verifier against all 16 corpus cases and asserts that the actual output matches `expected-result.json` for each case (after normalizing sort order).

A failure here means the verifier produces different results than the frozen expected output. Either the verifier has a bug or the expected result needs updating (and that update must be justified).

## Quick health check

```
pnpm build && pnpm lint && pnpm typecheck && pnpm test
```

`pnpm test` already includes both corpus commands, so this four-command chain covers the full six.
