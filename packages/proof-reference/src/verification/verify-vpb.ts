// ──────────────────────────────────────────────────────────────────
// LEGACY COMPATIBILITY — structural verification of JSON proof bundles
//
// This is NOT canonical bundle verification. It performs structural checks
// only: schema presence, manifest field validation, receipt/witness/anchor
// structure. It does not verify artifact hashes or content integrity.
//
// For canonical bundle verification with artifact-hash assurance,
// use verifyCanonicalBundle from verify-canonical.ts.
//
// @see ADR-001-canonical-bundle-contract.md
// ──────────────────────────────────────────────────────────────────

import { parseProofBundle, type ProofBundle } from "./proof-bundle";
import { verifyAnchor } from "./verify-anchor";
import { verifyContinuity } from "./verify-continuity";
import {
  findDuplicateAnchorReference,
  hasSchemaDeclaration,
  isIsoTimestamp,
  isSha256Digest,
  isSupportedAnchorType,
  isTimestampOrdered,
} from "./verification-primitives";

/**
 * Assurance level for legacy JSON bundle verification.
 * This path performs structural checks only — no artifact hash or
 * content integrity verification.
 */
export const VPB_ASSURANCE_LEVEL = "legacy-structure-check" as const;

export interface VerificationCheck {
  name: string;
  passed: boolean;
  detail?: string;
}

export interface VerificationResult {
  valid: boolean;
  checks: VerificationCheck[];
  errors: string[];
}

export async function verifyProofBundle(
  bundle: ProofBundle,
): Promise<VerificationResult> {
  const checks: VerificationCheck[] = [];
  const errors: string[] = [];

  const schemaValid = hasSchemaDeclaration(
    bundle.manifest.schema,
    bundle.manifest.version,
  );
  checks.push({
    name: "bundle schema",
    passed: schemaValid,
    detail: schemaValid
      ? bundle.manifest.schema ?? `version ${bundle.manifest.version}`
      : "missing proof bundle schema or version",
  });

  const manifestValid =
    bundle.manifest.bundleId.length > 0 &&
    isIsoTimestamp(bundle.manifest.createdAt) &&
    isSha256Digest(bundle.manifest.rootHash);
  checks.push({
    name: "manifest integrity",
    passed: manifestValid,
    detail: manifestValid
      ? `bundle ${bundle.manifest.bundleUri}`
      : "bundle id, created time, or root hash is invalid",
  });

  const receiptCount = bundle.artifacts.receipts.length;
  const receiptsPresent = receiptCount > 0;
  const receiptCountMatches =
    bundle.manifest.receiptCount === undefined ||
    bundle.manifest.receiptCount === receiptCount;
  checks.push({
    name: "receipt set",
    passed: receiptsPresent && receiptCountMatches,
    detail:
      receiptsPresent && receiptCountMatches
        ? `${receiptCount} receipt${receiptCount === 1 ? "" : "s"}`
        : "missing receipts or receipt count mismatch",
  });

  const continuity = verifyContinuity(
    bundle.artifacts.receipts.map((receiptId) => ({ id: receiptId })),
  );
  checks.push({
    name: "receipt continuity",
    passed: continuity.valid,
    detail: continuity.valid
      ? "receipt identifiers are unique"
      : `${continuity.brokenLinks.length} continuity issue(s) found`,
  });

  const issuedAt = bundle.manifest.timestamps?.issuedAt;
  const eventTime = bundle.manifest.timestamps?.eventTime;
  const witnessValid = bundle.verification.witnesses.every(
    (witness) => witness.id.length > 0 && witness.type.length > 0 && isIsoTimestamp(witness.attestedAt),
  );
  const witnessChronologyValid =
    !issuedAt ||
    bundle.verification.witnesses.every(
      (witness) => isTimestampOrdered(issuedAt, witness.attestedAt),
    );
  checks.push({
    name: "witness records",
    passed:
      bundle.verification.witnesses.length > 0 && witnessValid && witnessChronologyValid,
    detail:
      bundle.verification.witnesses.length > 0 && witnessValid && witnessChronologyValid
        ? `${bundle.verification.witnesses.length} witness evidence record${bundle.verification.witnesses.length === 1 ? "" : "s"}`
        : "missing witnesses or invalid witness timestamps",
  });

  if (eventTime && issuedAt) {
    const timestampOrderValid = isTimestampOrdered(eventTime, issuedAt);
    checks.push({
      name: "timestamp ordering",
      passed: timestampOrderValid,
      detail: timestampOrderValid
        ? "event time precedes issuance"
        : "event time occurs after issuance",
    });
  }

  const anchorResults = await Promise.all(
    bundle.verification.anchors.map(async (anchor, index, allAnchors) => {
      if (!isSupportedAnchorType(anchor.anchorType)) {
        return {
          valid: false,
          anchorType: "rfc3161" as const,
          details: `unsupported anchor type: ${anchor.anchorType}`,
        };
      }

      const duplicateReference = findDuplicateAnchorReference(allAnchors);
      const duplicate = duplicateReference !== undefined && duplicateReference === anchor.anchorRef;

      if (duplicate) {
        return {
          valid: false,
          anchorType: anchor.anchorType,
          details: `duplicate anchor reference: ${duplicateReference}`,
        };
      }

      return verifyAnchor(bundle.manifest.rootHash, {
        type: anchor.anchorType,
        reference: anchor.anchorRef,
        timestamp: anchor.sealedAt,
      });
    }),
  );
  const anchorsValid =
    anchorResults.length > 0 && anchorResults.every((result) => result.valid);
  checks.push({
    name: "anchor verification",
    passed: anchorsValid,
    detail: anchorsValid
      ? `${anchorResults.length} anchor${anchorResults.length === 1 ? "" : "s"} validated`
      : anchorResults.find((result) => !result.valid)?.details ?? "missing or invalid anchors",
  });

  const proofObjectCheckPassed =
    bundle.artifacts.proofObjects.length > 0 || bundle.artifacts.traces.length > 0;
  checks.push({
    name: "artifact lineage",
    passed: proofObjectCheckPassed,
    detail: proofObjectCheckPassed
      ? "proof object or trace lineage present"
      : "bundle does not yet expose trace or proof object lineage",
  });

  for (const check of checks) {
    if (!check.passed) {
      errors.push(check.detail ?? `${check.name} failed`);
    }
  }

  return {
    valid: errors.length === 0,
    checks,
    errors,
  };
}

export async function verifyProofBundleFile(raw: string): Promise<VerificationResult> {
  return verifyProofBundle(parseProofBundle(raw));
}

export type VpbBundle = ProofBundle;
export const verifyVpb = verifyProofBundle;
