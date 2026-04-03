import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadProtocolConformanceCase,
  parseExpectedProtocolResult,
  verifyProtocolConformanceCase,
} from "./protocol-conformance";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const corpusDir = path.resolve(__dirname, "../../../../tests/protocol-conformance");

function normalize(result: ReturnType<typeof parseExpectedProtocolResult>) {
  return {
    ...result,
    errors: [...result.errors].sort(),
    verifiedArtifacts: [...result.verifiedArtifacts].sort(),
    ...(result.witnesses ? { witnesses: [...result.witnesses].sort() } : {}),
  };
}

const scenarios = [
  "canonical-reference-bundle",
  "valid-minimal-bundle",
  "valid-multi-artifact-chain",
  "valid-witness-attested-bundle",
  "invalid-hash-mismatch",
  "missing-manifest-bundle",
  "invalid-signature",
  "indeterminate-offline",
  "invalid-protocol-version-unsupported",
  "invalid-manifest-malformed",
  "invalid-witness-quorum-unsatisfied",
  "invalid-schema-version-unsupported",
  "invalid-breaking-version-change",
  "invalid-witness-lineage-mismatch",
  "valid-approved-production-deployment",
  "invalid-approved-deployment-broken-chain",
] as const;

for (const caseName of scenarios) {
  test(`verifyProtocolConformanceCase matches corpus fixture ${caseName}`, async () => {
    const fixture = await loadProtocolConformanceCase(path.join(corpusDir, caseName));
    const expected = parseExpectedProtocolResult(fixture.expectedResultFile.raw);
    const actual = await verifyProtocolConformanceCase(fixture, {
      supportedProtocolVersions: ["1.0.0"],
      trustRegistryAvailable: false,
    });

    assert.deepEqual(normalize(actual), normalize(expected));
  });
}