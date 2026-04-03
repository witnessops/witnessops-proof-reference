// ──────────────────────────────────────────────────────────────────
// VERIFICATION ARTIFACT — portable, signed verification result
//
// Derived deterministically from VerificationRenderModel.
// No semantic transformation. No UI-only data. No new claims.
//
// This artifact is the canonical output of a verification event.
// It can be embedded in proof packages, receipts, or transmitted
// to external systems.
//
// @see ADR-001-canonical-bundle-contract.md
// ──────────────────────────────────────────────────────────────────

import {
  createHash,
  createPrivateKey,
  createPublicKey,
  sign,
  verify,
} from "node:crypto";
import type { VerificationRenderModel } from "./render-model";

// ── Types ──

export interface VerificationArtifactSignature {
  algorithm: "ed25519";
  publicKeyId: string;
  signature: string; // base64
}

export interface VerificationArtifact {
  version: "vm.verification.v1";

  bundle: {
    uri?: string;
    digest?: string;
  };

  verification: {
    verifier: string;
    mode: "legacy-json" | "canonical";
    assuranceLevel: string;
    status: "valid" | "invalid" | "indeterminate";
    checks: Array<{
      id: string;
      status: "pass" | "fail" | "indeterminate";
    }>;
    verifiedAt: string;
  };

  renderModelHash: string;

  signature?: VerificationArtifactSignature;
}

// ── Deterministic serialization ──

function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, val) => {
    if (val !== null && typeof val === "object" && !Array.isArray(val)) {
      const sorted: Record<string, unknown> = {};
      for (const k of Object.keys(val as Record<string, unknown>).sort()) {
        sorted[k] = (val as Record<string, unknown>)[k];
      }
      return sorted;
    }
    return val as unknown;
  });
}

function sha256(data: string): string {
  return `sha256:${createHash("sha256").update(data, "utf-8").digest("hex")}`;
}

// ── Conversion ──

export interface RenderModelToArtifactOptions {
  verifier: string;
  verifiedAt?: string;
}

/**
 * Convert a VerificationRenderModel into a VerificationArtifact.
 *
 * Extracts only verification-relevant fields. Does not include
 * claims, limits, or UI-only data — those belong in evidence
 * artifacts and proof packages, not verification artifacts.
 *
 * The renderModelHash is a SHA-256 of the canonicalized render model,
 * allowing anyone to verify that the artifact was derived from
 * a specific render model without needing the full model.
 */
export function renderModelToVerificationArtifact(
  model: VerificationRenderModel,
  options: RenderModelToArtifactOptions,
): VerificationArtifact {
  const renderModelHash = sha256(stableStringify(model));

  return {
    version: "vm.verification.v1",
    bundle: {
      ...(model.bundleUri ? { uri: model.bundleUri } : {}),
      ...(model.bundleDigest ? { digest: model.bundleDigest } : {}),
    },
    verification: {
      verifier: options.verifier,
      mode: model.verifierMode,
      assuranceLevel: model.assuranceLevel,
      status: model.status,
      checks: model.checks.map((c) => ({
        id: c.id,
        status: c.status,
      })),
      verifiedAt: options.verifiedAt ?? model.verifiedAt ?? new Date().toISOString(),
    },
    renderModelHash,
  };
}

// ── Signing ──

/**
 * Produce the canonical bytes to sign for a verification artifact.
 * Excludes the signature field.
 */
export function canonicalizeArtifactForSigning(artifact: VerificationArtifact): Buffer {
  const { signature: _, ...payload } = artifact;
  return Buffer.from(stableStringify(payload), "utf-8");
}

/**
 * Sign a verification artifact with Ed25519.
 */
export function signVerificationArtifact(
  artifact: VerificationArtifact,
  privateKeyPem: string,
  publicKeyId: string,
): VerificationArtifact {
  const payload = canonicalizeArtifactForSigning(artifact);
  const key = createPrivateKey(privateKeyPem);
  const sig = sign(null, payload, key);

  return {
    ...artifact,
    signature: {
      algorithm: "ed25519",
      publicKeyId,
      signature: sig.toString("base64"),
    },
  };
}

/**
 * Verify the signature on a signed verification artifact.
 */
export function verifyVerificationArtifactSignature(
  artifact: VerificationArtifact,
  publicKeyPem: string,
): { valid: boolean; reason?: string } {
  if (!artifact.signature) {
    return { valid: false, reason: "No signature present" };
  }

  const payload = canonicalizeArtifactForSigning(artifact);
  const sigBytes = Buffer.from(artifact.signature.signature, "base64");

  try {
    const key = createPublicKey(publicKeyPem);
    const isValid = verify(null, payload, key, sigBytes);
    return isValid ? { valid: true } : { valid: false, reason: "Invalid signature" };
  } catch (error) {
    return { valid: false, reason: `Verification error: ${String(error)}` };
  }
}
