// ──────────────────────────────────────────────────────────────────
// VERIFICATION RENDER MODEL — single truth contract for all surfaces
//
// This is the normalized shape that CLI, UI, and exports all consume.
// The verifier produces results. Adapters transform them into this
// model. The UI renders it without semantic transformation.
//
// Rule: if a sentence appears on screen, it must come from the
// verifier, a stable ID-to-label mapping, or the evidence artifact.
// The UI does not invent check summaries.
//
// @see ADR-001-canonical-bundle-contract.md
// ──────────────────────────────────────────────────────────────────

// ── Check IDs ──

export const CHECK_IDS = {
  MANIFEST_INTEGRITY: "vm.verify.manifest_integrity.v1",
  RECEIPT_CHAIN: "vm.verify.receipt_chain.v1",
  WITNESS_ATTESTATIONS: "vm.verify.witness_attestations.v1",
  ANCHOR_PRESENCE: "vm.verify.anchor_presence.v1",
  ARTIFACT_HASH: "vm.verify.artifact_hash.v1",
  SIGNATURE_VALIDATION: "vm.verify.signature_validation.v1",
  WITNESS_QUORUM: "vm.verify.witness_quorum.v1",
  PROTOCOL_VERSION: "vm.verify.protocol_version.v1",
  SCHEMA_VERSION: "vm.verify.schema_version.v1",
  BUNDLE_DIGEST_BINDING: "vm.verify.bundle_digest_binding.v1",
  LINEAGE_VALIDATION: "vm.verify.lineage_validation.v1",
} as const;

export const CHECK_LABELS: Record<string, string> = {
  [CHECK_IDS.MANIFEST_INTEGRITY]: "Manifest integrity",
  [CHECK_IDS.RECEIPT_CHAIN]: "Receipt chain",
  [CHECK_IDS.WITNESS_ATTESTATIONS]: "Witness attestations",
  [CHECK_IDS.ANCHOR_PRESENCE]: "Evidence anchors",
  [CHECK_IDS.ARTIFACT_HASH]: "Artifact hash verification",
  [CHECK_IDS.SIGNATURE_VALIDATION]: "Signature validation",
  [CHECK_IDS.WITNESS_QUORUM]: "Witness quorum",
  [CHECK_IDS.PROTOCOL_VERSION]: "Protocol version",
  [CHECK_IDS.SCHEMA_VERSION]: "Schema version",
  [CHECK_IDS.BUNDLE_DIGEST_BINDING]: "Bundle digest binding",
  [CHECK_IDS.LINEAGE_VALIDATION]: "Lineage validation",
};

// ── Types ──

export interface VerificationCheckResult {
  /** Stable check identifier (e.g., "vm.verify.manifest_integrity.v1") */
  id: string;
  /** Human label derived from CHECK_LABELS */
  label: string;
  /** Check outcome */
  status: "pass" | "fail" | "indeterminate";
  /** One-line summary of what was found */
  summary: string;
  /** Detailed findings (expandable in UI) */
  details?: string[];
  /** Files or fields this check verified against */
  basis?: string[];
  /** Command to reproduce this check independently */
  reproduce?: string;
  /** What failure of this check would mean */
  failureMode?: string;
}

export interface RenderModelClaim {
  claim: string;
  supportedBy: string[];
}

export interface RenderModelLinks {
  deploymentReceipt?: string;
  verificationEvidence?: string;
  incidentReceipt?: string;
  customerProofPackage?: string;
}

export interface VerificationRenderModel {
  /** "legacy-json" or "canonical" */
  verifierMode: "legacy-json" | "canonical";
  /** "legacy-structure-check" or "canonical-verification" */
  assuranceLevel: "legacy-structure-check" | "canonical-verification";
  /** Overall verification outcome */
  status: "valid" | "invalid" | "indeterminate";
  /** Bundle identity */
  bundleUri?: string;
  bundleDigest?: string;
  protocolVersion?: string;
  /** When verification was performed */
  verifiedAt?: string;
  /** Evidence-derived claims */
  claims: RenderModelClaim[];
  /** Explicit v1 limits */
  limits: string[];
  /** Individual verification checks */
  checks: VerificationCheckResult[];
  /** Linked artifacts */
  links?: RenderModelLinks;
}

// ── Helper ──

export function labelForCheckId(id: string): string {
  return CHECK_LABELS[id] ?? id;
}
