import assert from "node:assert/strict";
import test from "node:test";
import {
  findDuplicateAnchorReference,
  findMissingLineageReferences,
  hasSchemaDeclaration,
  isAnchorReferenceLike,
  isSupportedAnchorType,
  isSupportedSchemaVersion,
  isTimestampOrdered,
  meetsMinimumProtocolVersion,
  validateAnchorRecord,
} from "./verification-primitives";

test("timestamp ordering helper validates chronological order", () => {
  assert.equal(
    isTimestampOrdered("2026-03-14T12:00:00Z", "2026-03-14T12:00:01Z"),
    true,
  );
  assert.equal(
    isTimestampOrdered("2026-03-14T12:00:01Z", "2026-03-14T12:00:00Z"),
    false,
  );
});

test("anchor helpers validate type and reference shape", () => {
  assert.equal(isSupportedAnchorType("eth"), true);
  assert.equal(isSupportedAnchorType("ipfs"), false);
  assert.equal(isAnchorReferenceLike("eth:0xabc123"), true);
  assert.equal(isAnchorReferenceLike("plain-reference"), false);

  assert.deepEqual(
    validateAnchorRecord("sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", {
      type: "eth",
      reference: "eth:0xabc123",
      timestamp: "2026-03-14T12:00:00Z",
    }),
    {
      valid: true,
      details: "anchor reference format valid for eth",
    },
  );

  assert.deepEqual(
    validateAnchorRecord("sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", {
      type: "ipfs",
      reference: "ipfs://cid",
      timestamp: "2026-03-14T12:00:00Z",
    }),
    {
      valid: false,
      details: "unsupported anchor type: ipfs",
    },
  );
});

test("anchor helper detects duplicate anchor references", () => {
  assert.equal(
    findDuplicateAnchorReference([
      { anchorType: "eth", anchorRef: "eth:0x1" },
      { anchorType: "btc", anchorRef: "btc:0x2" },
      { anchorType: "eth", anchorRef: "eth:0x1" },
    ]),
    "eth:0x1",
  );
});

test("lineage helpers report missing references", () => {
  const missing = findMissingLineageReferences(
    ["receipt-001", "missing-proof-object"],
    new Set(["receipt-001", "proof-object-001"]),
  );

  assert.deepEqual(missing, ["missing-proof-object"]);
});

test("schema and compatibility helpers evaluate shared version rules", () => {
  assert.equal(hasSchemaDeclaration("vaultmesh-proof-bundle/1", undefined), true);
  assert.equal(hasSchemaDeclaration(undefined, "1.0.0"), true);
  assert.equal(hasSchemaDeclaration(undefined, undefined), false);

  assert.equal(isSupportedSchemaVersion("1.2.0", [1]), true);
  assert.equal(isSupportedSchemaVersion("2.0.0", [1]), false);

  assert.equal(meetsMinimumProtocolVersion(["1.0.0", "1.2.0"], "1.1.0"), true);
  assert.equal(meetsMinimumProtocolVersion(["1.0.0"], "2.0.0"), false);
});