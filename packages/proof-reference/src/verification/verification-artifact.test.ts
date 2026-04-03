import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { verifyCanonicalBundle } from "./verify-canonical";
import { canonicalResultToRenderModel } from "./render-model-adapters";
import {
  renderModelToVerificationArtifact,
  signVerificationArtifact,
  verifyVerificationArtifactSignature,
  canonicalizeArtifactForSigning,
} from "./verification-artifact";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const corpusDir = path.resolve(__dirname, "../../../../tests/protocol-conformance");

const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const privatePem = privateKey.export({ type: "pkcs8", format: "pem" }) as string;
const publicPem = publicKey.export({ type: "spki", format: "pem" }) as string;

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

test("renderModelToVerificationArtifact: produces valid artifact from canonical result", async () => {
  const files = await loadDirToFileMap(path.join(corpusDir, "canonical-reference-bundle"));
  const result = await verifyCanonicalBundle({ files, source: "directory" });
  const model = canonicalResultToRenderModel(result, { bundleName: "test" });
  const artifact = renderModelToVerificationArtifact(model, { verifier: "vm-verify-canonical" });

  assert.equal(artifact.version, "vm.verification.v1");
  assert.equal(artifact.verification.mode, "canonical");
  assert.equal(artifact.verification.status, "valid");
  assert.ok(artifact.renderModelHash.startsWith("sha256:"));
  assert.ok(artifact.verification.checks.length > 0);
  assert.equal(artifact.signature, undefined);
});

test("renderModelToVerificationArtifact: check IDs preserved exactly", async () => {
  const files = await loadDirToFileMap(path.join(corpusDir, "canonical-reference-bundle"));
  const result = await verifyCanonicalBundle({ files, source: "directory" });
  const model = canonicalResultToRenderModel(result, { bundleName: "test" });
  const artifact = renderModelToVerificationArtifact(model, { verifier: "vm-verify-canonical" });

  for (const check of artifact.verification.checks) {
    const modelCheck = model.checks.find((c) => c.id === check.id);
    assert.ok(modelCheck, `Check ID ${check.id} must exist in render model`);
    assert.equal(check.status, modelCheck.status);
  }
});

test("renderModelHash is deterministic", async () => {
  const files = await loadDirToFileMap(path.join(corpusDir, "canonical-reference-bundle"));
  const result = await verifyCanonicalBundle({ files, source: "directory" });
  const model = canonicalResultToRenderModel(result, { bundleName: "test" });

  const a1 = renderModelToVerificationArtifact(model, { verifier: "v", verifiedAt: "2026-01-01T00:00:00Z" });
  const a2 = renderModelToVerificationArtifact(model, { verifier: "v", verifiedAt: "2026-01-01T00:00:00Z" });

  assert.equal(a1.renderModelHash, a2.renderModelHash);
});

test("signVerificationArtifact: adds signature", async () => {
  const files = await loadDirToFileMap(path.join(corpusDir, "canonical-reference-bundle"));
  const result = await verifyCanonicalBundle({ files, source: "directory" });
  const model = canonicalResultToRenderModel(result, { bundleName: "test" });
  const artifact = renderModelToVerificationArtifact(model, { verifier: "test" });
  const signed = signVerificationArtifact(artifact, privatePem, "test-key");

  assert.ok(signed.signature);
  assert.equal(signed.signature!.algorithm, "ed25519");
  assert.equal(signed.signature!.publicKeyId, "test-key");
});

test("verifyVerificationArtifactSignature: valid signature verifies", async () => {
  const files = await loadDirToFileMap(path.join(corpusDir, "canonical-reference-bundle"));
  const result = await verifyCanonicalBundle({ files, source: "directory" });
  const model = canonicalResultToRenderModel(result, { bundleName: "test" });
  const artifact = renderModelToVerificationArtifact(model, { verifier: "test" });
  const signed = signVerificationArtifact(artifact, privatePem, "test-key");
  const check = verifyVerificationArtifactSignature(signed, publicPem);

  assert.equal(check.valid, true);
});

test("verifyVerificationArtifactSignature: tampered artifact fails", async () => {
  const files = await loadDirToFileMap(path.join(corpusDir, "canonical-reference-bundle"));
  const result = await verifyCanonicalBundle({ files, source: "directory" });
  const model = canonicalResultToRenderModel(result, { bundleName: "test" });
  const artifact = renderModelToVerificationArtifact(model, { verifier: "test" });
  const signed = signVerificationArtifact(artifact, privatePem, "test-key");

  const tampered = { ...signed, verification: { ...signed.verification, status: "invalid" as const } };
  const check = verifyVerificationArtifactSignature(tampered, publicPem);
  assert.equal(check.valid, false);
});

test("canonicalizeArtifactForSigning: excludes signature field", async () => {
  const files = await loadDirToFileMap(path.join(corpusDir, "canonical-reference-bundle"));
  const result = await verifyCanonicalBundle({ files, source: "directory" });
  const model = canonicalResultToRenderModel(result, { bundleName: "test" });
  const artifact = renderModelToVerificationArtifact(model, { verifier: "test" });
  const signed = signVerificationArtifact(artifact, privatePem, "test-key");

  const serialized = canonicalizeArtifactForSigning(signed).toString("utf-8");
  assert.ok(!serialized.includes('"signature"'));
});
