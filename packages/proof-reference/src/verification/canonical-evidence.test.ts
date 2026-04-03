import assert from "node:assert/strict";
import test from "node:test";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { verifyCanonicalBundle } from "./verify-canonical";
import { buildCanonicalVerificationEvidence } from "./canonical-evidence";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const corpusDir = path.resolve(__dirname, "../../../../tests/protocol-conformance");

async function loadDirToFileMap(dir: string): Promise<Map<string, Buffer>> {
  const files = new Map<string, Buffer>();
  try { files.set("manifest.json", await readFile(path.join(dir, "manifest.json"))); } catch { /* */ }
  try {
    for (const e of await readdir(path.join(dir, "artifacts"), { withFileTypes: true })) {
      if (e.isFile()) files.set(`artifacts/${e.name}`, await readFile(path.join(dir, "artifacts", e.name)));
    }
  } catch { /* */ }
  try {
    for (const e of await readdir(path.join(dir, "witness"), { withFileTypes: true })) {
      if (e.isFile()) files.set(`witness/${e.name}`, await readFile(path.join(dir, "witness", e.name)));
    }
  } catch { /* */ }
  return files;
}

async function verifyCorpusCase(name: string) {
  const files = await loadDirToFileMap(path.join(corpusDir, name));
  return verifyCanonicalBundle({ files, source: "directory" });
}

// ── Valid result ──

test("evidence: valid bundle produces bounded claims", async () => {
  const result = await verifyCorpusCase("canonical-reference-bundle");
  const evidence = buildCanonicalVerificationEvidence(result);

  assert.equal(evidence.evidenceType, "canonical-verification-evidence");
  assert.equal(evidence.schemaVersion, "1.0.0");
  assert.equal(evidence.verifierMode, "canonical");
  assert.equal(evidence.status, "valid");
  assert.ok(evidence.verifiedAt);
  assert.ok(evidence.bundleUri);
  assert.ok(evidence.bundleDigest);
  assert.ok(evidence.verifiedArtifacts.length > 0);
  assert.deepEqual(evidence.errors, []);

  // Claims should include manifest and artifact integrity
  const claimTexts = evidence.claims.map(c => c.claim);
  assert.ok(claimTexts.some(c => c.includes("manifest")));
  assert.ok(claimTexts.some(c => c.includes("Artifact integrity")));
  assert.ok(claimTexts.some(c => c.includes("signatures")));

  // No overclaims
  assert.ok(!claimTexts.some(c => c.includes("compliant")));
  assert.ok(!claimTexts.some(c => c.includes("certified")));
  assert.ok(!claimTexts.some(c => c.includes("trusted")));
});

test("evidence: valid bundle always has v1 limits", async () => {
  const result = await verifyCorpusCase("canonical-reference-bundle");
  const evidence = buildCanonicalVerificationEvidence(result);

  assert.ok(evidence.limits.some(l => l.includes("trust registry")));
  assert.ok(evidence.limits.some(l => l.includes("anchor verification")));
  assert.ok(evidence.limits.some(l => l.includes("compliance")));
});

// ── Invalid result ──

test("evidence: invalid bundle preserves errors and bounded claims", async () => {
  const result = await verifyCorpusCase("invalid-hash-mismatch");
  const evidence = buildCanonicalVerificationEvidence(result);

  assert.equal(evidence.status, "invalid");
  assert.ok(evidence.errors.length > 0);

  const claimTexts = evidence.claims.map(c => c.claim);
  assert.ok(claimTexts.some(c => c.includes("failures")));
  // Should not claim signatures validated on invalid result
  assert.ok(!claimTexts.some(c => c === "All artifact signatures were validated"));
});

// ── Indeterminate result ──

test("evidence: indeterminate includes reason and bounded claim", async () => {
  const result = await verifyCorpusCase("indeterminate-offline");
  const evidence = buildCanonicalVerificationEvidence(result);

  assert.equal(evidence.status, "indeterminate");
  assert.ok(evidence.indeterminateReason);

  const claimTexts = evidence.claims.map(c => c.claim);
  assert.ok(claimTexts.some(c => c.includes("could not produce a definitive result")));
});

// ── Witness handling ──

test("evidence: no witnesses → no witness claim", async () => {
  const result = await verifyCorpusCase("valid-minimal-bundle");
  const evidence = buildCanonicalVerificationEvidence(result);

  assert.equal(evidence.witnesses, undefined);
  const claimTexts = evidence.claims.map(c => c.claim);
  assert.ok(!claimTexts.some(c => c.includes("witness")));
});

test("evidence: witnesses present → witness claim appears", async () => {
  const result = await verifyCorpusCase("valid-witness-attested-bundle");
  const evidence = buildCanonicalVerificationEvidence(result);

  assert.ok(evidence.witnesses);
  assert.ok(evidence.witnesses!.length > 0);
  const claimTexts = evidence.claims.map(c => c.claim);
  assert.ok(claimTexts.some(c => c.includes("witness")));
});

// ── Claims have supportedBy ──

test("evidence: every claim has non-empty supportedBy", async () => {
  const result = await verifyCorpusCase("canonical-reference-bundle");
  const evidence = buildCanonicalVerificationEvidence(result);

  for (const claim of evidence.claims) {
    assert.ok(claim.supportedBy.length > 0, `Claim "${claim.claim}" has empty supportedBy`);
  }
});
