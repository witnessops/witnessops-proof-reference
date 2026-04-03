import assert from "node:assert/strict";
import test from "node:test";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { verifyCanonicalBundleRequest, createCanonicalErrorResponse } from "./canonical-app-adapter";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const corpusDir = path.resolve(__dirname, "../../../../tests/protocol-conformance");

// ── Helper: load a conformance case directory into a Map<string, Buffer> ──

async function loadDirToFileMap(dir: string): Promise<Map<string, Buffer>> {
  const files = new Map<string, Buffer>();

  try {
    files.set("manifest.json", await readFile(path.join(dir, "manifest.json")));
  } catch {
    // manifest may be intentionally missing
  }

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

// ── Tests ──

test("verifyCanonicalBundleRequest: valid canonical reference bundle returns ok:true, status:valid", async () => {
  const files = await loadDirToFileMap(path.join(corpusDir, "canonical-reference-bundle"));
  const result = await verifyCanonicalBundleRequest(files);

  assert.equal(result.ok, true);
  assert.equal(result.verifierMode, "canonical");
  if (result.ok) {
    assert.equal(result.status, "valid");
    assert.equal(result.errors.length, 0);
    assert.ok(result.verifiedArtifacts.length > 0);
    assert.ok(result.verifiedAt);
  }
});

test("verifyCanonicalBundleRequest: valid bundle with witnesses returns witness IDs", async () => {
  const files = await loadDirToFileMap(path.join(corpusDir, "valid-witness-attested-bundle"));
  const result = await verifyCanonicalBundleRequest(files);

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.status, "valid");
    assert.ok(result.witnesses);
    assert.ok(result.witnesses.length > 0);
  }
});

test("verifyCanonicalBundleRequest: missing manifest returns ok:true with MISSING_MANIFEST from adapter", async () => {
  const files = new Map<string, Buffer>();
  files.set("artifacts/dummy.json", Buffer.from("{}"));
  const result = await verifyCanonicalBundleRequest(files);

  assert.equal(result.ok, false);
  assert.equal(result.verifierMode, "canonical");
  if (!result.ok) {
    assert.equal(result.code, "MISSING_MANIFEST");
    assert.ok(result.verifiedAt);
  }
});

test("verifyCanonicalBundleRequest: malformed manifest JSON returns INVALID_MANIFEST_JSON", async () => {
  const files = new Map<string, Buffer>();
  files.set("manifest.json", Buffer.from("not valid json {{{"));
  const result = await verifyCanonicalBundleRequest(files);

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.code, "INVALID_MANIFEST_JSON");
  }
});

test("verifyCanonicalBundleRequest: hash mismatch returns ok:true, status:invalid", async () => {
  const files = await loadDirToFileMap(path.join(corpusDir, "invalid-hash-mismatch"));
  const result = await verifyCanonicalBundleRequest(files);

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.status, "invalid");
    assert.ok(result.errors.length > 0);
  }
});

test("verifyCanonicalBundleRequest: indeterminate offline returns ok:true, status:indeterminate", async () => {
  const files = await loadDirToFileMap(path.join(corpusDir, "indeterminate-offline"));
  const result = await verifyCanonicalBundleRequest(files);

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.status, "indeterminate");
    assert.ok(result.indeterminateReason);
  }
});

test("createCanonicalErrorResponse: produces well-formed error", () => {
  const error = createCanonicalErrorResponse("test error", "INTERNAL_ERROR");

  assert.equal(error.ok, false);
  assert.equal(error.verifierMode, "canonical");
  assert.equal(error.error, "test error");
  assert.equal(error.code, "INTERNAL_ERROR");
  assert.ok(error.verifiedAt);
});

test("verifyCanonicalBundleRequest: all response fields have verifierMode canonical", async () => {
  const files = await loadDirToFileMap(path.join(corpusDir, "canonical-reference-bundle"));
  const result = await verifyCanonicalBundleRequest(files);
  assert.equal(result.verifierMode, "canonical");

  const emptyResult = await verifyCanonicalBundleRequest(new Map());
  assert.equal(emptyResult.verifierMode, "canonical");
});
