// ──────────────────────────────────────────────────────────────────
// LEGACY COMPATIBILITY — app-facing wrapper for JSON bundle verification
//
// This adapter wraps the legacy VPB structural verifier for use by
// Next.js app surfaces. It does NOT route through canonical bundle
// verification. Responses include assuranceLevel to signal this.
//
// @see ADR-001-canonical-bundle-contract.md
// ──────────────────────────────────────────────────────────────────

import { TextDecoder } from "node:util";
import {
  verifyProofBundle,
  verifyProofBundleFile,
  VPB_ASSURANCE_LEVEL,
  type VerificationResult,
} from "./verify-vpb";
import { parseProofBundle } from "./proof-bundle";

export interface AppVerifyRequest {
  bundleData: ArrayBuffer;
  filename?: string;
}

export type AppVerifyResponse = VerificationResult & {
  verifierMode: "legacy-json";
  assuranceLevel: typeof VPB_ASSURANCE_LEVEL;
  verifiedAt: string;
};

function withLegacyMeta(result: VerificationResult): AppVerifyResponse {
  return {
    ...result,
    verifierMode: "legacy-json",
    assuranceLevel: VPB_ASSURANCE_LEVEL,
    verifiedAt: new Date().toISOString(),
  };
}

export async function verifyAppProofBundleFile(raw: string): Promise<AppVerifyResponse> {
  return withLegacyMeta(await verifyProofBundleFile(raw));
}

export async function verifyAppProofBundle(bundleData: ArrayBuffer): Promise<AppVerifyResponse> {
  const raw = new TextDecoder().decode(new Uint8Array(bundleData));
  return verifyAppProofBundleFile(raw);
}

export async function verifyAppProofBundleRequest(
  request: AppVerifyRequest,
): Promise<AppVerifyResponse> {
  return verifyAppProofBundle(request.bundleData);
}

export async function verifyParsedAppProofBundle(raw: string): Promise<AppVerifyResponse> {
  return withLegacyMeta(await verifyProofBundle(parseProofBundle(raw)));
}