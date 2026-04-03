// ──────────────────────────────────────────────────────────────────
// CANONICAL — app-facing adapter for canonical file-bundle verification
//
// This adapter wraps verifyCanonicalBundle for use by Next.js app
// surfaces. It accepts a file map (from multipart upload or other
// sources) and returns a canonical response envelope.
//
// This is NOT the legacy JSON structural verification path.
// For legacy compatibility, see app-adapter.ts.
//
// @see ADR-001-canonical-bundle-contract.md
// ──────────────────────────────────────────────────────────────────

import {
  verifyCanonicalBundle,
  type CanonicalBundleInput,
  type CanonicalVerificationResult,
  type CanonicalVerifierOptions,
} from "./verify-canonical";

// ── Error codes for canonical verify route ──

export type CanonicalVerifyErrorCode =
  | "INVALID_CONTENT_TYPE"
  | "MISSING_MANIFEST"
  | "INVALID_MANIFEST_JSON"
  | "INVALID_MULTIPART_PAYLOAD"
  | "BUNDLE_TOO_LARGE"
  | "INTERNAL_ERROR";

// ── API response types ──

export type CanonicalVerifyApiSuccessResponse = {
  ok: true;
  verifierMode: "canonical";
  status: CanonicalVerificationResult["status"];
  protocolVersion: string;
  bundleUri: string;
  bundleDigest: string;
  verifiedArtifacts: string[];
  witnesses?: string[];
  errors: string[];
  indeterminateReason?: string;
  verifiedAt: string;
};

export type CanonicalVerifyApiErrorResponse = {
  ok: false;
  verifierMode: "canonical";
  error: string;
  code: CanonicalVerifyErrorCode;
  verifiedAt: string;
};

export type CanonicalVerifyApiResponse =
  | CanonicalVerifyApiSuccessResponse
  | CanonicalVerifyApiErrorResponse;

// ── Helpers ──

function makeErrorResponse(
  error: string,
  code: CanonicalVerifyErrorCode,
): CanonicalVerifyApiErrorResponse {
  return {
    ok: false,
    verifierMode: "canonical",
    error,
    code,
    verifiedAt: new Date().toISOString(),
  };
}

function makeSuccessResponse(
  result: CanonicalVerificationResult,
): CanonicalVerifyApiSuccessResponse {
  return {
    ok: true,
    verifierMode: "canonical",
    status: result.status,
    protocolVersion: result.protocolVersion,
    bundleUri: result.bundleUri,
    bundleDigest: result.bundleDigest,
    verifiedArtifacts: result.verifiedArtifacts,
    ...(result.witnesses && result.witnesses.length > 0
      ? { witnesses: result.witnesses }
      : {}),
    errors: result.errors,
    ...(result.indeterminateReason
      ? { indeterminateReason: result.indeterminateReason }
      : {}),
    verifiedAt: new Date().toISOString(),
  };
}

// ── Public API ──

/**
 * Verify a canonical proof bundle from a pre-constructed file map.
 *
 * @param files - Map of relative paths to raw file bytes, matching
 *   the canonical bundle layout (manifest.json, artifacts/*, witness/*)
 * @param options - Verifier configuration
 * @param bundleName - Name used for fallback URI/digest derivation
 */
export async function verifyCanonicalBundleRequest(
  files: Map<string, Buffer>,
  options?: CanonicalVerifierOptions,
  bundleName?: string,
): Promise<CanonicalVerifyApiResponse> {
  if (!files.has("manifest.json")) {
    return makeErrorResponse(
      "Missing manifest.json in uploaded bundle",
      "MISSING_MANIFEST",
    );
  }

  // Validate manifest is parseable JSON before passing to verifier
  try {
    JSON.parse(files.get("manifest.json")!.toString("utf-8"));
  } catch {
    return makeErrorResponse(
      "manifest.json is not valid JSON",
      "INVALID_MANIFEST_JSON",
    );
  }

  const input: CanonicalBundleInput = {
    files,
    source: "memory",
  };

  const result = await verifyCanonicalBundle(input, options, bundleName);
  return makeSuccessResponse(result);
}

/**
 * Create a canonical error response for transport-level failures
 * (e.g., wrong content type, payload too large).
 */
export { makeErrorResponse as createCanonicalErrorResponse };
