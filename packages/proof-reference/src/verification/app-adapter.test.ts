import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  verifyAppProofBundle,
  verifyAppProofBundleFile,
  verifyAppProofBundleRequest,
} from "./app-adapter";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(__dirname, "__fixtures__");

async function loadFixture(name: string) {
  return readFile(path.join(fixturesDir, name), "utf-8");
}

test("verifyAppProofBundleFile preserves the proof-bundle verification contract", async () => {
  const raw = await loadFixture("proof-bundle.valid.json");
  const result = await verifyAppProofBundleFile(raw);

  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
  assert.ok(result.checks.length > 0);
});

test("verifyAppProofBundle decodes bytes and returns the same result shape", async () => {
  const raw = await loadFixture("proof-bundle.invalid.json");
  const bytes = new TextEncoder().encode(raw);
  const result = await verifyAppProofBundle(bytes.buffer);

  assert.equal(result.valid, false);
  assert.ok(result.errors.length > 0);
});

test("verifyAppProofBundleRequest delegates through the app adapter boundary", async () => {
  const raw = await loadFixture("proof-bundle.valid.json");
  const bytes = new TextEncoder().encode(raw);
  const result = await verifyAppProofBundleRequest({
    bundleData: bytes.buffer,
    filename: "proof-bundle.valid.json",
  });

  assert.equal(result.valid, true);
});