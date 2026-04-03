// ──────────────────────────────────────────────────────────────────
// LEGACY COMPATIBILITY — JSON proof bundle input format
//
// This format contains artifact IDs, not artifact bodies. It cannot be
// losslessly converted to canonical file-bundle form because:
//   - artifacts.receipts/traces/etc are string[] of IDs, not file contents
//   - no artifact hashes are present
//   - no per-artifact signature-bearing JSON payloads exist
//
// Use this path for structural checks only. For canonical bundle
// verification with hash and signature assurance, use verify-canonical.ts.
//
// @see ADR-001-canonical-bundle-contract.md
// ──────────────────────────────────────────────────────────────────

import { normalizeProofBundleUri, type ProofBundleUri } from "../bundle-identity";

/**
 * Thrown by {@link parseProofBundle} when the raw input is not a valid proof
 * bundle structure. This signals a client-supplied input error (HTTP 400) as
 * opposed to an unexpected internal error (HTTP 500).
 */
export class MalformedBundleError extends Error {
  override readonly name = "MalformedBundleError";

  constructor(message: string) {
    super(message);
  }
}

export interface ProofBundleIssuer {
  id: string;
  name?: string;
  publicKeyFingerprint?: string;
}

export interface ProofBundleSubject {
  type: string;
  description: string;
  scope: string;
}

export interface ProofBundleTimestamps {
  eventTime?: string;
  issuedAt: string;
  expiresAt?: string;
}

export interface ProofBundleWitness {
  id: string;
  type: string;
  attestedAt: string;
}

export interface ProofBundleAnchor {
  anchorType: string;
  anchorRef: string;
  sealedAt: string;
}

export interface ProofBundleManifest {
  schema?: string;
  version?: string;
  bundleId: string;
  bundleUri: ProofBundleUri;
  createdAt: string;
  rootHash: string;
  producedBy?: string;
  receiptCount?: number;
  issuer?: ProofBundleIssuer;
  subject?: ProofBundleSubject;
  timestamps?: ProofBundleTimestamps;
}

export interface ProofBundleArtifacts {
  receipts: string[];
  traces: string[];
  witnessRecords: string[];
  proofObjects: string[];
}

export interface ProofBundleVerification {
  witnesses: ProofBundleWitness[];
  anchors: ProofBundleAnchor[];
}

export interface ProofBundle {
  manifest: ProofBundleManifest;
  artifacts: ProofBundleArtifacts;
  verification: ProofBundleVerification;
  tags?: string[];
  metadata?: Record<string, unknown>;
  raw?: Record<string, unknown>;
}

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string" && item.length > 0);
}

function normalizeWitness(value: unknown): ProofBundleWitness | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = asString(value.id);
  const type = asString(value.type) ?? "unknown";
  const attestedAt = asString(value.attestedAt) ?? asString(value.attested_at);

  if (!id || !attestedAt) {
    return null;
  }

  return { id, type, attestedAt };
}

function normalizeAnchor(value: unknown): ProofBundleAnchor | null {
  if (!isRecord(value)) {
    return null;
  }

  const anchorType = asString(value.anchorType) ?? asString(value.anchor_type) ?? asString(value.type);
  const anchorRef = asString(value.anchorRef) ?? asString(value.anchor_ref) ?? asString(value.reference);
  const sealedAt = asString(value.sealedAt) ?? asString(value.sealed_at) ?? asString(value.timestamp);

  if (!anchorType || !anchorRef || !sealedAt) {
    return null;
  }

  return { anchorType, anchorRef, sealedAt };
}

function normalizeIssuer(value: unknown): ProofBundleIssuer | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const id = asString(value.id);
  if (!id) {
    return undefined;
  }

  return {
    id,
    name: asString(value.name),
    publicKeyFingerprint:
      asString(value.publicKeyFingerprint) ?? asString(value.public_key_fingerprint),
  };
}

function normalizeSubject(value: unknown): ProofBundleSubject | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const type = asString(value.type);
  const description = asString(value.description);
  const scope = asString(value.scope);

  if (!type || !description || !scope) {
    return undefined;
  }

  return { type, description, scope };
}

function normalizeTimestamps(
  value: unknown,
  fallbackIssuedAt?: string,
): ProofBundleTimestamps | undefined {
  if (!isRecord(value)) {
    return fallbackIssuedAt ? { issuedAt: fallbackIssuedAt } : undefined;
  }

  const issuedAt = asString(value.issuedAt) ?? fallbackIssuedAt;
  if (!issuedAt) {
    return undefined;
  }

  return {
    eventTime: asString(value.eventTime),
    issuedAt,
    expiresAt: asString(value.expiresAt),
  };
}

export function parseProofBundle(raw: string | JsonRecord): ProofBundle {
  const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;

  if (!isRecord(parsed)) {
    throw new MalformedBundleError("Proof bundle must be a JSON object");
  }

  const bundleId =
    asString(parsed.id) ?? asString(parsed.bundleId) ?? asString(parsed.bundle_id);
  const createdAt =
    asString(parsed.createdAt) ??
    asString(parsed.created_at) ??
    asString(isRecord(parsed.timestamps) ? parsed.timestamps.issuedAt : undefined);
  const rootHash =
    asString(parsed.rootHash) ?? asString(parsed.root_hash) ?? asString(parsed.evidence_hash);

  if (!bundleId || !createdAt || !rootHash) {
    throw new MalformedBundleError("Proof bundle is missing required manifest fields");
  }

  const receipts = asStringArray(parsed.receipts);
  const traces = asStringArray(parsed.traces);
  const witnessRecords = asStringArray(parsed.witnessRecords ?? parsed.witness_records);
  const proofObjects = asStringArray(parsed.proofObjects ?? parsed.proof_objects);

  const manifest: ProofBundleManifest = {
    schema: asString(parsed.schema),
    version: asString(parsed.version),
    bundleId,
    bundleUri: normalizeProofBundleUri(
      bundleId,
      asString(parsed.bundleUri) ?? asString(parsed.bundle_uri) ?? asString(parsed.uri),
    ),
    createdAt,
    rootHash,
    producedBy: asString(parsed.producedBy) ?? asString(parsed.produced_by),
    receiptCount:
      typeof parsed.receiptCount === "number"
        ? parsed.receiptCount
        : receipts.length > 0
          ? receipts.length
          : undefined,
    issuer: normalizeIssuer(parsed.issuer),
    subject: normalizeSubject(parsed.subject),
    timestamps: normalizeTimestamps(parsed.timestamps, createdAt),
  };

  const verification: ProofBundleVerification = {
    witnesses: Array.isArray(parsed.witnesses)
      ? parsed.witnesses.map(normalizeWitness).filter((value): value is ProofBundleWitness => value !== null)
      : [],
    anchors: Array.isArray(parsed.anchors)
      ? parsed.anchors.map(normalizeAnchor).filter((value): value is ProofBundleAnchor => value !== null)
      : [],
  };

  return {
    manifest,
    artifacts: {
      receipts,
      traces,
      witnessRecords,
      proofObjects,
    },
    verification,
    tags: asStringArray(parsed.tags),
    metadata: isRecord(parsed.metadata) ? parsed.metadata : undefined,
    raw: parsed,
  };
}