// ──────────────────────────────────────────────────────────────────
// RENDER MODEL ADAPTERS — transform verifier output into render model
//
// Canonical and legacy verifiers produce different result shapes.
// These adapters normalize both into VerificationRenderModel so
// CLI, UI, and exports consume the same truth.
// ──────────────────────────────────────────────────────────────────

import type { CanonicalVerificationResult } from "./verify-canonical";
import type { VerificationResult as LegacyVerificationResult } from "./verify-vpb";
import {
  CHECK_IDS,
  CHECK_LABELS,
  type VerificationCheckResult,
  type VerificationRenderModel,
} from "./render-model";

// ── V1 limits (always present) ──

const V1_LIMITS = [
  "Does not perform trust registry resolution",
  "Does not perform anchor verification in v1",
  "Does not imply compliance, certification, or regulatory approval",
];

const LEGACY_LIMITS = [
  "This is legacy structural verification — not canonical hash-level verification",
  ...V1_LIMITS,
];

// ── Canonical adapter ──

export function canonicalResultToRenderModel(
  result: CanonicalVerificationResult,
  options?: { bundleName?: string },
): VerificationRenderModel {
  const checks: VerificationCheckResult[] = [];

  // Protocol version
  checks.push({
    id: CHECK_IDS.PROTOCOL_VERSION,
    label: CHECK_LABELS[CHECK_IDS.PROTOCOL_VERSION]!,
    status: result.errors.includes("FAILURE_PROTOCOL_VERSION_UNSUPPORTED") ? "fail" : "pass",
    summary: `Protocol version: ${result.protocolVersion}`,
    basis: ["manifest.json"],
    reproduce: `vm-verify-canonical ./${options?.bundleName ?? "bundle"}/`,
    failureMode: "Unsupported protocol version would prevent verification",
  });

  // Artifact hash verification
  const hashFailed = result.errors.includes("FAILURE_HASH_MISMATCH");
  const artifactMissing = result.errors.includes("FAILURE_ARTIFACT_MISSING");
  checks.push({
    id: CHECK_IDS.ARTIFACT_HASH,
    label: CHECK_LABELS[CHECK_IDS.ARTIFACT_HASH]!,
    status: hashFailed || artifactMissing ? "fail" : "pass",
    summary: hashFailed
      ? "Artifact hash mismatch detected"
      : artifactMissing
        ? "One or more artifacts missing"
        : `${result.verifiedArtifacts.length} artifact(s) verified`,
    details: result.verifiedArtifacts.map((a) => `Verified: ${a}`),
    basis: ["manifest.json", "artifacts/*"],
    reproduce: `vm-verify-canonical ./${options?.bundleName ?? "bundle"}/`,
    failureMode: "Hash mismatch means artifact bytes differ from manifest declaration",
  });

  // Signature validation
  const sigFailed = result.errors.includes("FAILURE_SIGNATURE_INVALID");
  checks.push({
    id: CHECK_IDS.SIGNATURE_VALIDATION,
    label: CHECK_LABELS[CHECK_IDS.SIGNATURE_VALIDATION]!,
    status: sigFailed ? "fail" : "pass",
    summary: sigFailed ? "Invalid signature detected" : "All signatures validated",
    basis: ["artifacts/*"],
    failureMode: "Invalid signature means artifact cannot be authenticated",
  });

  // Bundle digest binding
  const digestFailed = result.errors.includes("FAILURE_DIGEST_MISMATCH");
  checks.push({
    id: CHECK_IDS.BUNDLE_DIGEST_BINDING,
    label: CHECK_LABELS[CHECK_IDS.BUNDLE_DIGEST_BINDING]!,
    status: digestFailed ? "fail" : "pass",
    summary: `Bundle digest: ${result.bundleDigest}`,
    basis: ["manifest.json", "artifacts/*"],
    failureMode: "Digest mismatch means artifact does not belong to this bundle",
  });

  // Witness attestations
  const witnessInvalid = result.errors.includes("FAILURE_WITNESS_INVALID");
  const witnessCount = result.witnesses?.length ?? 0;
  checks.push({
    id: CHECK_IDS.WITNESS_ATTESTATIONS,
    label: CHECK_LABELS[CHECK_IDS.WITNESS_ATTESTATIONS]!,
    status: witnessInvalid ? "fail" : witnessCount > 0 ? "pass" : "indeterminate",
    summary: witnessInvalid
      ? "Invalid witness attestation"
      : witnessCount > 0
        ? `${witnessCount} witness(es) validated`
        : "No witness files present",
    details: result.witnesses?.map((w) => `Witness: ${w}`),
    basis: witnessCount > 0 ? ["witness/*"] : undefined,
    failureMode: "Invalid witness means attestation cannot be trusted",
  });

  // Witness quorum
  const quorumFailed = result.errors.includes("FAILURE_WITNESS_QUORUM_UNSATISFIED");
  if (witnessCount > 0 || quorumFailed) {
    checks.push({
      id: CHECK_IDS.WITNESS_QUORUM,
      label: CHECK_LABELS[CHECK_IDS.WITNESS_QUORUM]!,
      status: quorumFailed ? "fail" : "pass",
      summary: quorumFailed ? "Witness quorum not satisfied" : "Witness quorum satisfied",
      basis: ["manifest.json", "witness/*"],
      failureMode: "Quorum failure means insufficient independent attestations",
    });
  }

  // Claims
  const claims = [];
  if (result.status === "valid" || result.verifiedArtifacts.length > 0) {
    claims.push({ claim: "Artifact integrity verified against canonical manifest (SHA-256 over raw bytes)", supportedBy: ["bundleDigest", "verifiedArtifacts"] });
  }
  if (result.status === "valid") {
    claims.push({ claim: "All artifact signatures validated", supportedBy: ["verifiedArtifacts"] });
  }
  if (witnessCount > 0 && !witnessInvalid) {
    claims.push({ claim: "Independent witness attestations evaluated", supportedBy: ["witnesses"] });
  }
  if (result.status === "invalid") {
    claims.push({ claim: "Canonical verification completed with one or more failures", supportedBy: ["errors"] });
  }
  if (result.status === "indeterminate") {
    claims.push({ claim: "Canonical verification could not produce a definitive result", supportedBy: ["indeterminateReason"] });
  }

  return {
    verifierMode: "canonical",
    assuranceLevel: "canonical-verification",
    status: result.status,
    bundleUri: result.bundleUri,
    bundleDigest: result.bundleDigest,
    protocolVersion: result.protocolVersion,
    verifiedAt: new Date().toISOString(),
    claims,
    limits: [...V1_LIMITS],
    checks,
  };
}

// ── Legacy adapter ──

export function legacyResultToRenderModel(
  result: LegacyVerificationResult,
  bundle: {
    bundleUri?: string;
    rootHash?: string;
    schema?: string;
    receiptCount?: number;
    witnessCount?: number;
    anchorCount?: number;
    hasLedgerAnchor?: boolean;
  },
): VerificationRenderModel {
  const checks: VerificationCheckResult[] = [];

  // Map legacy checks to stable IDs
  const checkByName = new Map(result.checks.map((c) => [c.name, c]));

  const manifestCheck = checkByName.get("manifest integrity");
  checks.push({
    id: CHECK_IDS.MANIFEST_INTEGRITY,
    label: CHECK_LABELS[CHECK_IDS.MANIFEST_INTEGRITY]!,
    status: manifestCheck?.passed ? "pass" : "fail",
    summary: manifestCheck?.detail ?? (manifestCheck?.passed ? "Manifest is valid" : "Manifest validation failed"),
    basis: ["manifest.json"],
    failureMode: "Invalid manifest means bundle structure cannot be verified",
  });

  const receiptCheck = checkByName.get("receipt set");
  checks.push({
    id: CHECK_IDS.RECEIPT_CHAIN,
    label: CHECK_LABELS[CHECK_IDS.RECEIPT_CHAIN]!,
    status: receiptCheck?.passed ? "pass" : "fail",
    summary: receiptCheck?.detail ?? `${bundle.receiptCount ?? 0} receipts`,
    basis: ["receipts"],
    failureMode: "Missing receipts break the evidence chain",
  });

  const witnessCheck = checkByName.get("witness records");
  checks.push({
    id: CHECK_IDS.WITNESS_ATTESTATIONS,
    label: CHECK_LABELS[CHECK_IDS.WITNESS_ATTESTATIONS]!,
    status: witnessCheck?.passed ? "pass" : (bundle.witnessCount ?? 0) > 0 ? "fail" : "indeterminate",
    summary: witnessCheck?.detail ?? `${bundle.witnessCount ?? 0} witnesses`,
    basis: (bundle.witnessCount ?? 0) > 0 ? ["witnesses"] : undefined,
    failureMode: "Invalid witness records reduce verification confidence",
  });

  const anchorCount = bundle.anchorCount ?? 0;
  checks.push({
    id: CHECK_IDS.ANCHOR_PRESENCE,
    label: CHECK_LABELS[CHECK_IDS.ANCHOR_PRESENCE]!,
    status: anchorCount > 0 || bundle.hasLedgerAnchor ? "pass" : "indeterminate",
    summary: `${anchorCount} anchors${bundle.hasLedgerAnchor ? " + ledger" : ""}`,
    basis: anchorCount > 0 ? ["anchors"] : undefined,
    failureMode: "Missing anchors mean bundle is not externally pinned",
  });

  // Claims
  const claims = [];
  if (result.valid) {
    claims.push({ claim: "Bundle manifest is structurally valid", supportedBy: ["rootHash", "schema"] });
    if ((bundle.receiptCount ?? 0) > 0) {
      claims.push({ claim: "Execution receipt chain is present", supportedBy: ["receipts"] });
    }
    if ((bundle.witnessCount ?? 0) > 0) {
      claims.push({ claim: "Independent witness attestations are present", supportedBy: ["witnesses"] });
    }
  }

  return {
    verifierMode: "legacy-json",
    assuranceLevel: "legacy-structure-check",
    status: result.valid ? "valid" : "invalid",
    bundleUri: bundle.bundleUri,
    bundleDigest: bundle.rootHash,
    protocolVersion: bundle.schema,
    verifiedAt: new Date().toISOString(),
    claims,
    limits: [...LEGACY_LIMITS],
    checks,
  };
}
