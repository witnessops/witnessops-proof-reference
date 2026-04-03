// ──────────────────────────────────────────────────────────────────
// CANONICAL — verification evidence artifact
//
// Transforms a CanonicalVerificationResult into a stable, portable
// evidence artifact with bounded claims and explicit limits.
//
// Claims are derived only from what the canonical verifier actually
// checked. They must not imply compliance, certification, trust
// registry resolution, or anchor confirmation.
//
// @see ADR-001-canonical-bundle-contract.md
// ──────────────────────────────────────────────────────────────────

import type { CanonicalVerificationResult } from "./verify-canonical";

// ── Types ──

export interface EvidenceClaim {
  claim: string;
  supportedBy: string[];
}

export interface CanonicalVerificationEvidence {
  evidenceType: "canonical-verification-evidence";
  schemaVersion: "1.0.0";
  verifierMode: "canonical";
  verifiedAt: string;
  bundleUri: string;
  bundleDigest: string;
  status: CanonicalVerificationResult["status"];
  protocolVersion: string;
  verifiedArtifacts: string[];
  witnesses?: string[];
  errors: string[];
  indeterminateReason?: string;
  claims: EvidenceClaim[];
  limits: string[];
}

// ── V1 limits (always present) ──

const V1_LIMITS: string[] = [
  "Does not perform trust registry resolution",
  "Does not perform anchor verification in v1",
  "Does not imply compliance, certification, or regulatory approval",
];

// ── Claim derivation ──

function deriveClaims(result: CanonicalVerificationResult): EvidenceClaim[] {
  const claims: EvidenceClaim[] = [];

  // Manifest was parsed and validated (always true if we got a result)
  claims.push({
    claim: "Canonical bundle manifest was parsed and validated",
    supportedBy: ["protocolVersion", "bundleUri", "bundleDigest"],
  });

  if (result.status === "valid" || result.verifiedArtifacts.length > 0) {
    claims.push({
      claim: "Artifact integrity was verified against the canonical manifest using SHA-256 over raw file bytes",
      supportedBy: ["bundleDigest", "verifiedArtifacts"],
    });
  }

  if (result.status === "valid") {
    claims.push({
      claim: "All artifact signatures were validated",
      supportedBy: ["verifiedArtifacts"],
    });
  }

  if (result.witnesses && result.witnesses.length > 0) {
    claims.push({
      claim: "Independent witness attestations were evaluated",
      supportedBy: ["witnesses"],
    });

    if (result.status === "valid") {
      claims.push({
        claim: "Witness quorum was satisfied (if policy declared)",
        supportedBy: ["witnesses"],
      });
    }
  }

  if (result.status === "invalid") {
    claims.push({
      claim: "Canonical verification completed with one or more failures",
      supportedBy: ["errors"],
    });
  }

  if (result.status === "indeterminate") {
    claims.push({
      claim: "Canonical verification could not produce a definitive result",
      supportedBy: ["indeterminateReason"],
    });
  }

  return claims;
}

// ── Builder ──

/**
 * Build a canonical verification evidence artifact from a verification result.
 *
 * Claims are bounded to what the canonical verifier actually checked.
 * Limits explicitly state what v1 does not cover.
 */
export function buildCanonicalVerificationEvidence(
  result: CanonicalVerificationResult,
): CanonicalVerificationEvidence {
  return {
    evidenceType: "canonical-verification-evidence",
    schemaVersion: "1.0.0",
    verifierMode: "canonical",
    verifiedAt: new Date().toISOString(),
    bundleUri: result.bundleUri,
    bundleDigest: result.bundleDigest,
    status: result.status,
    protocolVersion: result.protocolVersion,
    verifiedArtifacts: result.verifiedArtifacts,
    ...(result.witnesses && result.witnesses.length > 0
      ? { witnesses: result.witnesses }
      : {}),
    errors: result.errors,
    ...(result.indeterminateReason
      ? { indeterminateReason: result.indeterminateReason }
      : {}),
    claims: deriveClaims(result),
    limits: [...V1_LIMITS],
  };
}
