import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";
import path from "node:path";
import {
  loadProtocolConformanceCase,
  parseExpectedProtocolResult,
  verifyProtocolConformanceCase,
  type ProtocolVerificationResult,
} from "@witnessops/proof-reference/protocol-conformance";

const repoRoot = path.resolve(__dirname, "..");
const corpusRoot = path.join(repoRoot, "tests", "protocol-conformance");

function normalize(result: ProtocolVerificationResult) {
  return {
    ...result,
    errors: [...result.errors].sort(),
    verifiedArtifacts: [...result.verifiedArtifacts].sort(),
    ...(result.witnesses ? { witnesses: [...result.witnesses].sort() } : {}),
  };
}

async function main() {
  const entries = await readdir(corpusRoot, { withFileTypes: true });
  const cases = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  if (cases.length === 0) {
    console.error("ERROR: No protocol conformance cases found.");
    process.exit(1);
  }

  const failures: string[] = [];

  for (const caseName of cases) {
    const fixture = await loadProtocolConformanceCase(path.join(corpusRoot, caseName));
    const expected = parseExpectedProtocolResult(fixture.expectedResultFile.raw);
    const actual = await verifyProtocolConformanceCase(fixture, {
      supportedProtocolVersions: ["1.0.0"],
      trustRegistryAvailable: false,
    });

    try {
      assert.deepEqual(normalize(actual), normalize(expected));
    } catch {
      failures.push(
        [
          `ERROR [${caseName}]: actual verifier result does not match expected-result.json`,
          `expected=${JSON.stringify(normalize(expected))}`,
          `actual=${JSON.stringify(normalize(actual))}`,
        ].join("\n"),
      );
    }
  }

  if (failures.length > 0) {
    for (const failure of failures) {
      console.log(failure);
    }

    process.exit(1);
  }

  console.log(`Protocol corpus execution passed for ${cases.length} case(s).`);
}

void main();
