import assert from "node:assert/strict";
import test from "node:test";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  verifyCanonicalBundle,
  type CanonicalBundleInput,
} from "./verify-canonical";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const corpusDir = path.resolve(__dirname, "../../../../tests/protocol-conformance");
const refBundleDir = path.join(corpusDir, "canonical-reference-bundle");

// ── Helper: load a conformance case directory into a Map<string, Buffer> ──

async function loadDirToFileMap(dir: string): Promise<Map<string, Buffer>> {
  const files = new Map<string, Buffer>();

  // manifest.json
  try {
    files.set("manifest.json", await readFile(path.join(dir, "manifest.json")));
  } catch {
    // manifest may be intentionally missing
  }

  // artifacts/
  try {
    const entries = await readdir(path.join(dir, "artifacts"), { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile()) {
        files.set(
          `artifacts/${entry.name}`,
          await readFile(path.join(dir, "artifacts", entry.name)),
        );
      }
    }
  } catch {
    // no artifacts dir
  }

  // witness/
  try {
    const entries = await readdir(path.join(dir, "witness"), { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile()) {
        files.set(
          `witness/${entry.name}`,
          await readFile(path.join(dir, "witness", entry.name)),
        );
      }
    }
  } catch {
    // no witness dir
  }

  return files;
}

// ── Canonical verifier: in-memory input ──

test("verifyCanonicalBundle: valid canonical reference bundle (in-memory)", async () => {
  const files = await loadDirToFileMap(refBundleDir);
  const input: CanonicalBundleInput = { files, source: "memory" };

  const result = await verifyCanonicalBundle(input, {
    supportedProtocolVersions: ["1.0.0"],
  }, "canonical-reference-bundle");

  assert.equal(result.status, "valid");
  assert.deepEqual(result.errors, []);
  assert.deepEqual([...result.verifiedArtifacts].sort(), ["execution-receipt", "proof-object"]);
  assert.equal(result.protocolVersion, "1.0.0");
  assert.equal(result.bundleUri, "vm://bundle/canonical-reference-bundle");
});

// ── Canonical verifier: missing manifest ──

test("verifyCanonicalBundle: missing manifest returns invalid", async () => {
  const files = new Map<string, Buffer>();
  files.set("artifacts/some-artifact.json", Buffer.from('{"id":"a","type":"t"}'));

  const result = await verifyCanonicalBundle(
    { files, source: "memory" },
    {},
    "no-manifest",
  );

  assert.equal(result.status, "invalid");
  assert.ok(result.errors.includes("FAILURE_MANIFEST_MISSING"));
});

// ── Canonical verifier: malformed manifest ──

test("verifyCanonicalBundle: malformed manifest JSON returns invalid", async () => {
  const files = new Map<string, Buffer>();
  files.set("manifest.json", Buffer.from("not json"));

  const result = await verifyCanonicalBundle(
    { files, source: "memory" },
    {},
    "bad-manifest",
  );

  assert.equal(result.status, "invalid");
  assert.ok(result.errors.includes("FAILURE_BUNDLE_MALFORMED"));
});

// ── Canonical verifier: hash mismatch ──

test("verifyCanonicalBundle: artifact hash mismatch returns invalid", async () => {
  const files = new Map<string, Buffer>();
  files.set("manifest.json", Buffer.from(JSON.stringify({
    protocolVersion: "1.0.0",
    bundleUri: "vm://bundle/hash-test",
    bundleDigest: "sha256:aaaa000000000000000000000000000000000000000000000000000000000000",
    artifacts: [{
      id: "art-1",
      type: "execution-receipt",
      path: "artifacts/receipt.json",
      hash: "sha256:0000000000000000000000000000000000000000000000000000000000000000",
    }],
  })));
  files.set("artifacts/receipt.json", Buffer.from('{"id":"art-1","type":"execution-receipt"}'));

  const result = await verifyCanonicalBundle(
    { files, source: "memory" },
    { supportedProtocolVersions: ["1.0.0"] },
    "hash-test",
  );

  assert.equal(result.status, "invalid");
  assert.ok(result.errors.includes("FAILURE_HASH_MISMATCH"));
});

// ── Canonical verifier: unsupported protocol version ──

test("verifyCanonicalBundle: unsupported protocol version returns invalid", async () => {
  const files = new Map<string, Buffer>();
  files.set("manifest.json", Buffer.from(JSON.stringify({
    protocolVersion: "99.0.0",
    bundleUri: "vm://bundle/version-test",
    bundleDigest: "sha256:bbbb000000000000000000000000000000000000000000000000000000000000",
    artifacts: [],
  })));

  const result = await verifyCanonicalBundle(
    { files, source: "memory" },
    { supportedProtocolVersions: ["1.0.0"] },
    "version-test",
  );

  assert.equal(result.status, "invalid");
  assert.ok(result.errors.includes("FAILURE_PROTOCOL_VERSION_UNSUPPORTED"));
});

// ── Canonical verifier: directory vs memory equivalence ──

test("verifyCanonicalBundle: directory-loaded and memory-loaded produce same result", async () => {
  const dirFiles = await loadDirToFileMap(refBundleDir);

  const dirResult = await verifyCanonicalBundle(
    { files: dirFiles, source: "directory" },
    { supportedProtocolVersions: ["1.0.0"] },
    "canonical-reference-bundle",
  );

  const memResult = await verifyCanonicalBundle(
    { files: dirFiles, source: "memory" },
    { supportedProtocolVersions: ["1.0.0"] },
    "canonical-reference-bundle",
  );

  assert.deepEqual(dirResult, memResult);
});

// ── Canonical verifier: indeterminate when trust registry required ──

test("verifyCanonicalBundle: trust registry required yields indeterminate", async () => {
  const files = await loadDirToFileMap(refBundleDir);
  // Patch manifest to require trust registry
  const manifest = JSON.parse(files.get("manifest.json")!.toString("utf-8"));
  manifest.requiresTrustRegistry = true;
  files.set("manifest.json", Buffer.from(JSON.stringify(manifest)));

  const result = await verifyCanonicalBundle(
    { files, source: "memory" },
    { supportedProtocolVersions: ["1.0.0"], trustRegistryAvailable: false },
    "canonical-reference-bundle",
  );

  assert.equal(result.status, "indeterminate");
  assert.equal(result.indeterminateReason, "trust-registry-unavailable");
});
