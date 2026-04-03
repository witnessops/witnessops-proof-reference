import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseProofBundle, verifyProofBundleFile } from "./index";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(__dirname, "__fixtures__");

async function loadFixture(name: string) {
  return readFile(path.join(fixturesDir, name), "utf-8");
}

function getCheck(result: Awaited<ReturnType<typeof verifyProofBundleFile>>, name: string) {
  const check = result.checks.find((candidate) => candidate.name === name);
  assert.ok(check, `expected check "${name}" to be present`);
  return check;
}

test("parseProofBundle normalizes legacy proof bundle fields", async () => {
  const raw = await loadFixture("proof-bundle.legacy.json");
  const bundle = parseProofBundle(raw);

  assert.equal(bundle.manifest.bundleId, "pb_01legacyfixture");
  assert.equal(bundle.manifest.bundleUri, "vm://bundle/pb_01legacyfixture");
  assert.equal(bundle.manifest.createdAt, "2026-03-13T11:00:00.000Z");
  assert.equal(
    bundle.manifest.rootHash,
    "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
  );
  assert.equal(bundle.artifacts.witnessRecords[0], "witness_record_legacy_001");
  assert.equal(bundle.artifacts.proofObjects[0], "proof_object_legacy_001");
  assert.deepEqual(bundle.verification.witnesses, [
    {
      id: "qin-legacy-1",
      type: "runtime-witness",
      attestedAt: "2026-03-13T11:00:05.000Z",
    },
  ]);
  assert.deepEqual(bundle.verification.anchors, [
    {
      anchorType: "eth",
      anchorRef: "eth:0xabc123",
      sealedAt: "2026-03-13T11:00:06.000Z",
    },
  ]);
});

test("verifyProofBundleFile accepts a canonical valid proof bundle fixture", async () => {
  const raw = await loadFixture("proof-bundle.valid.json");
  const result = await verifyProofBundleFile(raw);

  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(
    result.checks.map((check) => check.name),
    [
      "bundle schema",
      "manifest integrity",
      "receipt set",
      "receipt continuity",
      "witness records",
      "timestamp ordering",
      "anchor verification",
      "artifact lineage",
    ],
  );
  assert.ok(result.checks.every((check) => check.passed));
});

test("verifyProofBundleFile reports contract failures for an invalid proof bundle fixture", async () => {
  const raw = await loadFixture("proof-bundle.invalid.json");
  const result = await verifyProofBundleFile(raw);

  assert.equal(result.valid, false);
  assert.ok(result.errors.length >= 5);
  assert.ok(
    result.errors.includes("bundle id, created time, or root hash is invalid"),
  );
  assert.ok(
    result.errors.includes("missing receipts or receipt count mismatch"),
  );
  assert.ok(
    result.errors.includes("missing witnesses or invalid witness timestamps"),
  );
  assert.ok(result.errors.includes("event time occurs after issuance"));
  assert.ok(
    result.errors.includes(
      "invalid root hash, anchor reference, or anchor timestamp",
    ),
  );
  assert.ok(
    result.errors.includes(
      "bundle does not yet expose trace or proof object lineage",
    ),
  );
});

test("parseProofBundle rejects fixtures missing required manifest fields", async () => {
  const raw = await loadFixture("proof-bundle.missing-manifest.json");

  assert.throws(
    () => parseProofBundle(raw),
    /Proof bundle is missing required manifest fields/,
  );
});

test("parseProofBundle rejects malformed JSON fixtures", async () => {
  const raw = await loadFixture("proof-bundle.malformed.json");

  assert.throws(() => parseProofBundle(raw), SyntaxError);
  await assert.rejects(() => verifyProofBundleFile(raw), SyntaxError);
});

test("parseProofBundle rejects non-object top-level payloads", async () => {
  const raw = await loadFixture("proof-bundle.non-object.json");

  assert.throws(() => parseProofBundle(raw), /Proof bundle must be a JSON object/);
  await assert.rejects(
    () => verifyProofBundleFile(raw),
    /Proof bundle must be a JSON object/,
  );
});

test("verifyProofBundleFile rejects witness attestations that predate issuance", async () => {
  const raw = await loadFixture("proof-bundle.invalid-witness-chronology.json");
  const result = await verifyProofBundleFile(raw);

  assert.equal(result.valid, false);
  assert.ok(
    result.errors.includes("missing witnesses or invalid witness timestamps"),
  );
  const witnessCheck = result.checks.find((check) => check.name === "witness records");
  assert.ok(witnessCheck);
  assert.equal(witnessCheck?.passed, false);
  const timestampCheck = result.checks.find((check) => check.name === "timestamp ordering");
  assert.ok(timestampCheck);
  assert.equal(timestampCheck?.passed, true);
});

test("parseProofBundle and verifyProofBundleFile accept alternate normalized field shapes", async () => {
  const raw = await loadFixture("proof-bundle.alt-shape-valid.json");
  const bundle = parseProofBundle(raw);
  const result = await verifyProofBundleFile(raw);

  assert.equal(bundle.manifest.bundleId, "pb_01altshapevalid");
  assert.equal(bundle.manifest.bundleUri, "vm://bundle/pb_01altshapevalid");
  assert.equal(bundle.manifest.createdAt, "2026-03-13T15:00:00.000Z");
  assert.equal(
    bundle.manifest.rootHash,
    "sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
  );
  assert.equal(bundle.manifest.issuer?.publicKeyFingerprint,
    "sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
  );
  assert.deepEqual(bundle.verification.witnesses, [
    {
      id: "qin-alt-1",
      type: "unknown",
      attestedAt: "2026-03-13T15:00:05.000Z",
    },
  ]);
  assert.deepEqual(bundle.verification.anchors, [
    {
      anchorType: "btc",
      anchorRef:
        "btc:000000000000000000000000000000000000000000000000000000000000abcd",
      sealedAt: "2026-03-13T15:00:06.000Z",
    },
  ]);
  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
});

test("parseProofBundle preserves the canonical producedBy manifest field", () => {
  const bundle = parseProofBundle({
    schema: "vaultmesh-proof-bundle/1",
    version: "1",
    bundleId: "pb_01producerfield",
    createdAt: "2026-03-14T11:21:08.000Z",
    rootHash: "sha256:3d7e2b1c9a54a1f0c3c9a7e4b7c8d1e9c4b8f2a17dce54a11e0c7b4d9af31c62",
    producedBy: "vaultmesh.attest.v1",
    receipts: ["receipt_001"],
    proofObjects: ["proof_object_001"],
    witnesses: [
      {
        id: "qin-1",
        type: "runtime-witness",
        attestedAt: "2026-03-14T11:21:09.000Z",
      },
    ],
    anchors: [
      {
        anchorType: "eth",
        anchorRef: "eth:0xproducerfield",
        sealedAt: "2026-03-14T11:21:10.000Z",
      },
    ],
  });

  assert.equal(bundle.manifest.producedBy, "vaultmesh.attest.v1");
  assert.equal(bundle.manifest.bundleUri, "vm://bundle/pb_01producerfield");
});

test("parseProofBundle normalizes legacy produced_by into producedBy", () => {
  const bundle = parseProofBundle({
    schema: "vaultmesh-proof-bundle/1",
    version: "1",
    bundle_id: "pb_01producerlegacy",
    created_at: "2026-03-14T11:21:08.000Z",
    root_hash: "sha256:7d7e2b1c9a54a1f0c3c9a7e4b7c8d1e9c4b8f2a17dce54a11e0c7b4d9af31c62",
    produced_by: "VaultMesh Attest",
    receipts: ["receipt_001"],
    proof_objects: ["proof_object_001"],
    witnesses: [
      {
        id: "qin-1",
        type: "runtime-witness",
        attested_at: "2026-03-14T11:21:09.000Z",
      },
    ],
    anchors: [
      {
        anchor_type: "eth",
        anchor_ref: "eth:0xproducerlegacy",
        sealed_at: "2026-03-14T11:21:10.000Z",
      },
    ],
  });

  assert.equal(bundle.manifest.producedBy, "VaultMesh Attest");
  assert.equal(bundle.manifest.bundleUri, "vm://bundle/pb_01producerlegacy");
});

test("verifyProofBundleFile rejects duplicate anchors", async () => {
  const raw = await loadFixture("proof-bundle.duplicate-anchors.json");
  const result = await verifyProofBundleFile(raw);

  assert.equal(result.valid, false);
  assert.ok(
    result.errors.includes(
      "duplicate anchor reference: https://tsa.example.test/tokens/duplicate-anchor",
    ),
  );
  assert.equal(getCheck(result, "anchor verification")?.passed, false);
});

test("verifyProofBundleFile rejects unsupported anchor types", async () => {
  const raw = await loadFixture("proof-bundle.unsupported-anchor.json");
  const result = await verifyProofBundleFile(raw);

  assert.equal(result.valid, false);
  assert.ok(result.errors.includes("unsupported anchor type: ipfs"));
  assert.equal(getCheck(result, "anchor verification")?.passed, false);
});

test("verifier check messaging stays stable for targeted fixtures", async () => {
  const scenarios = [
    {
      fixture: "proof-bundle.valid.json",
      expected: {
        "bundle schema": { passed: true, detail: "vaultmesh-proof-bundle/1" },
        "manifest integrity": { passed: true, detail: "bundle vm://bundle/pb_01validfixture" },
        "receipt set": { passed: true, detail: "2 receipts" },
        "receipt continuity": {
          passed: true,
          detail: "receipt identifiers are unique",
        },
        "witness records": { passed: true, detail: "1 witness evidence record" },
        "timestamp ordering": {
          passed: true,
          detail: "event time precedes issuance",
        },
        "anchor verification": { passed: true, detail: "1 anchor validated" },
        "artifact lineage": {
          passed: true,
          detail: "proof object or trace lineage present",
        },
      },
    },
    {
      fixture: "proof-bundle.invalid-witness-chronology.json",
      expected: {
        "witness records": {
          passed: false,
          detail: "missing witnesses or invalid witness timestamps",
        },
        "timestamp ordering": {
          passed: true,
          detail: "event time precedes issuance",
        },
        "anchor verification": { passed: true, detail: "1 anchor validated" },
      },
    },
    {
      fixture: "proof-bundle.duplicate-anchors.json",
      expected: {
        "anchor verification": {
          passed: false,
          detail:
            "duplicate anchor reference: https://tsa.example.test/tokens/duplicate-anchor",
        },
      },
    },
    {
      fixture: "proof-bundle.unsupported-anchor.json",
      expected: {
        "anchor verification": {
          passed: false,
          detail: "unsupported anchor type: ipfs",
        },
      },
    },
  ] as const;

  for (const scenario of scenarios) {
    const result = await verifyProofBundleFile(await loadFixture(scenario.fixture));

    for (const [name, expected] of Object.entries(scenario.expected)) {
      const check = getCheck(result, name);
      assert.equal(check.passed, expected.passed, `${scenario.fixture} ${name} passed`);
      assert.equal(check.detail, expected.detail, `${scenario.fixture} ${name} detail`);
    }
  }
});
