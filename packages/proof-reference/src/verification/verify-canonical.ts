/**
 * CANONICAL BUNDLE VERIFICATION
 *
 * This is the single authority path for proof bundle verification.
 * All canonical verification flows (CLI, tests, future API) should
 * route through {@link verifyCanonicalBundle}.
 *
 * Input is byte-oriented: a `Map<string, Buffer>` of relative file
 * paths to raw file bytes. JSON decoding happens only when a file is
 * known to be JSON (e.g. `manifest.json`). Hashes are computed over
 * stable bytes, never ambiguous text coercions.
 *
 * @see ADR-001-canonical-bundle-contract.md
 */

import { createHash } from "node:crypto";
import { normalizeProofBundleUri } from "../bundle-identity";
import {
  asNonEmptyString,
  hasValidLineageReferences,
  hasValidSignatureSignature,
  isLooseDigestLike,
  isRecord,
  isSemverLike,
  isSupportedSchemaVersion,
  meetsMinimumProtocolVersion,
  pushUnique,
} from "./verification-primitives";

// ── Public types ──

export interface CanonicalBundleInput {
  files: Map<string, Buffer>;
  source?: "directory" | "memory";
}

export interface CanonicalVerificationResult {
  status: "valid" | "invalid" | "indeterminate";
  protocolVersion: string;
  bundleUri: string;
  bundleDigest: string;
  errors: string[];
  verifiedArtifacts: string[];
  witnesses?: string[];
  indeterminateReason?: string;
}

export interface CanonicalVerifierOptions {
  supportedProtocolVersions?: string[];
  trustRegistryAvailable?: boolean;
  defaultProtocolVersion?: string;
  supportedSchemaMajorVersions?: number[];
}

// ── Internal types ──

interface ManifestArtifactEntry {
  id: string;
  type: string;
  path: string;
  hash: string;
}

interface NormalizedManifest {
  protocolVersion: string;
  bundleUri: string;
  bundleDigest: string;
  requiresTrustRegistry: boolean;
  compatibility?: {
    minimumProtocolVersion: string;
  };
  witnessPolicy?: {
    type: string;
    required: number;
    available: number;
  };
  artifacts: ManifestArtifactEntry[];
}

// ── Helpers ──

function parseJson(raw: string): unknown {
  return JSON.parse(raw) as unknown;
}

function sha256OfBuffer(data: Buffer): string {
  return `sha256:${createHash("sha256").update(data).digest("hex")}`;
}

function deriveFallbackBundleDigest(bundleName: string): string {
  return `sha256:${bundleName}`;
}

function deriveFallbackBundleUri(bundleName: string): string {
  return normalizeProofBundleUri(bundleName);
}

function buildResult(
  status: CanonicalVerificationResult["status"],
  protocolVersion: string,
  bundleUri: string,
  bundleDigest: string,
  errors: string[],
  verifiedArtifacts: string[],
  witnesses: string[],
  indeterminateReason?: string,
): CanonicalVerificationResult {
  return {
    status,
    protocolVersion,
    bundleUri,
    bundleDigest,
    errors,
    verifiedArtifacts,
    ...(witnesses.length > 0 ? { witnesses } : {}),
    ...(indeterminateReason ? { indeterminateReason } : {}),
  };
}

function normalizeManifest(
  value: unknown,
  bundleName: string,
  defaultProtocolVersion: string,
): {
  manifest?: NormalizedManifest;
  errors: string[];
  protocolVersion: string;
  bundleUri: string;
  bundleDigest: string;
} {
  const errors: string[] = [];
  const fallbackBundleDigest = deriveFallbackBundleDigest(bundleName);
  const fallbackBundleUri = deriveFallbackBundleUri(bundleName);

  if (!isRecord(value)) {
    pushUnique(errors, "FAILURE_BUNDLE_MALFORMED");
    return {
      errors,
      protocolVersion: defaultProtocolVersion,
      bundleUri: fallbackBundleUri,
      bundleDigest: fallbackBundleDigest,
    };
  }

  const protocolVersionValue = asNonEmptyString(value.protocolVersion);
  const bundleUriValue =
    asNonEmptyString(value.bundleUri) ?? asNonEmptyString(value.bundle_uri);
  const bundleDigestValue = asNonEmptyString(value.bundleDigest);
  const artifactsValue = value.artifacts;

  const protocolVersion: string = isSemverLike(protocolVersionValue)
    ? protocolVersionValue!
    : defaultProtocolVersion;
  const bundleUri = normalizeProofBundleUri(bundleName, bundleUriValue);
  const bundleDigest: string = isLooseDigestLike(bundleDigestValue)
    ? bundleDigestValue!
    : fallbackBundleDigest;

  if (!isLooseDigestLike(bundleDigestValue)) {
    pushUnique(errors, "FAILURE_REQUIRED_FIELD_MISSING");
  }

  if (!Array.isArray(artifactsValue)) {
    pushUnique(errors, "FAILURE_BUNDLE_MALFORMED");
    return { errors, protocolVersion, bundleUri, bundleDigest };
  }

  const artifacts: ManifestArtifactEntry[] = [];

  for (const artifact of artifactsValue) {
    if (!isRecord(artifact)) {
      pushUnique(errors, "FAILURE_BUNDLE_MALFORMED");
      continue;
    }

    const id = asNonEmptyString(artifact.id);
    const type = asNonEmptyString(artifact.type);
    const artifactPath = asNonEmptyString(artifact.path);
    const hash = asNonEmptyString(artifact.hash);

    if (!id || !type || !artifactPath || !hash) {
      pushUnique(errors, "FAILURE_REQUIRED_FIELD_MISSING");
      continue;
    }

    artifacts.push({ id, type, path: artifactPath, hash });
  }

  const requiresTrustRegistry = value.requiresTrustRegistry === true;
  const compatibilityValue = value.compatibility;
  const witnessPolicyValue = value.witnessPolicy;
  let compatibility: NormalizedManifest["compatibility"];
  let witnessPolicy: NormalizedManifest["witnessPolicy"];

  if (compatibilityValue !== undefined) {
    if (!isRecord(compatibilityValue)) {
      pushUnique(errors, "FAILURE_BUNDLE_MALFORMED");
    } else {
      const minimumProtocolVersion = asNonEmptyString(
        compatibilityValue.minimumProtocolVersion,
      );

      if (!minimumProtocolVersion || !isSemverLike(minimumProtocolVersion)) {
        pushUnique(errors, "FAILURE_BUNDLE_MALFORMED");
      } else {
        compatibility = { minimumProtocolVersion };
      }
    }
  }

  if (witnessPolicyValue !== undefined) {
    if (!isRecord(witnessPolicyValue)) {
      pushUnique(errors, "FAILURE_BUNDLE_MALFORMED");
    } else {
      const type = asNonEmptyString(witnessPolicyValue.type);
      const required = witnessPolicyValue.required;
      const available = witnessPolicyValue.available;

      if (
        !type ||
        !Number.isInteger(required) ||
        !Number.isInteger(available) ||
        (required as number) < 1 ||
        (available as number) < 1
      ) {
        pushUnique(errors, "FAILURE_BUNDLE_MALFORMED");
      } else {
        witnessPolicy = {
          type,
          required: required as number,
          available: available as number,
        };
      }
    }
  }

  return {
    manifest: {
      protocolVersion,
      bundleUri,
      bundleDigest,
      requiresTrustRegistry,
      compatibility,
      witnessPolicy,
      artifacts,
    },
    errors,
    protocolVersion,
    bundleUri,
    bundleDigest,
  };
}

// ── Core canonical verifier ──

/**
 * Verifies a canonical proof bundle from a byte-oriented file map.
 *
 * @param input - Bundle files as `Map<string, Buffer>` where keys are
 *   relative paths (e.g. `"manifest.json"`, `"artifacts/receipt.json"`)
 * @param options - Verifier configuration
 * @param bundleName - Name used for fallback URI/digest derivation
 */
export async function verifyCanonicalBundle(
  input: CanonicalBundleInput,
  options: CanonicalVerifierOptions = {},
  bundleName = "unknown-bundle",
): Promise<CanonicalVerificationResult> {
  const defaultProtocolVersion = options.defaultProtocolVersion ?? "1.0.0";
  const supportedProtocolVersions = new Set(
    options.supportedProtocolVersions ?? [defaultProtocolVersion],
  );
  const supportedSchemaMajorVersions =
    options.supportedSchemaMajorVersions ?? [1];
  const trustRegistryAvailable = options.trustRegistryAvailable ?? false;
  const fallbackBundleDigest = deriveFallbackBundleDigest(bundleName);

  // ── Load manifest ──

  const manifestBuffer = input.files.get("manifest.json");

  if (!manifestBuffer) {
    return buildResult(
      "invalid",
      defaultProtocolVersion,
      deriveFallbackBundleUri(bundleName),
      fallbackBundleDigest,
      ["FAILURE_MANIFEST_MISSING"],
      [],
      [],
    );
  }

  let manifestValue: unknown;
  try {
    manifestValue = parseJson(manifestBuffer.toString("utf-8"));
  } catch {
    return buildResult(
      "invalid",
      defaultProtocolVersion,
      deriveFallbackBundleUri(bundleName),
      fallbackBundleDigest,
      ["FAILURE_BUNDLE_MALFORMED"],
      [],
      [],
    );
  }

  const manifestResult = normalizeManifest(
    manifestValue,
    bundleName,
    defaultProtocolVersion,
  );
  const manifest = manifestResult.manifest;

  if (!manifest) {
    return buildResult(
      "invalid",
      manifestResult.protocolVersion,
      manifestResult.bundleUri,
      manifestResult.bundleDigest,
      manifestResult.errors,
      [],
      [],
    );
  }

  if (manifestResult.errors.length > 0) {
    return buildResult(
      "invalid",
      manifest.protocolVersion,
      manifest.bundleUri,
      manifest.bundleDigest,
      manifestResult.errors,
      [],
      [],
    );
  }

  // ── Protocol version checks ──

  if (!supportedProtocolVersions.has(manifest.protocolVersion)) {
    return buildResult(
      "invalid",
      manifest.protocolVersion,
      manifest.bundleUri,
      manifest.bundleDigest,
      ["FAILURE_PROTOCOL_VERSION_UNSUPPORTED"],
      [],
      [],
    );
  }

  if (
    !meetsMinimumProtocolVersion(
      supportedProtocolVersions,
      manifest.compatibility?.minimumProtocolVersion,
    )
  ) {
    return buildResult(
      "invalid",
      manifest.protocolVersion,
      manifest.bundleUri,
      manifest.bundleDigest,
      ["FAILURE_BREAKING_VERSION_CHANGE"],
      [],
      [],
    );
  }

  // ── Artifact verification ──

  const errors: string[] = [];
  const verifiedArtifacts: string[] = [];
  const witnessIds: string[] = [];
  const declaredArtifactIds = new Set(
    manifest.artifacts.map((artifact) => artifact.id),
  );

  for (const artifact of manifest.artifacts) {
    const artifactBuffer = input.files.get(artifact.path);

    if (!artifactBuffer) {
      pushUnique(errors, "FAILURE_ARTIFACT_MISSING");
      continue;
    }

    let artifactValue: unknown;
    try {
      artifactValue = parseJson(artifactBuffer.toString("utf-8"));
    } catch {
      pushUnique(errors, "FAILURE_BUNDLE_MALFORMED");
      continue;
    }

    if (!isRecord(artifactValue)) {
      pushUnique(errors, "FAILURE_BUNDLE_MALFORMED");
      continue;
    }

    const artifactId = asNonEmptyString(artifactValue.id);
    const artifactType = asNonEmptyString(artifactValue.type);

    if (artifactId !== artifact.id || artifactType !== artifact.type) {
      pushUnique(errors, "FAILURE_CONTRACT_VIOLATION");
      continue;
    }

    pushUnique(verifiedArtifacts, artifact.type);

    if (
      !isSupportedSchemaVersion(
        artifactValue.schemaVersion,
        supportedSchemaMajorVersions,
      )
    ) {
      pushUnique(errors, "FAILURE_SCHEMA_VERSION_UNSUPPORTED");
      continue;
    }

    // Hash computed over raw bytes, not decoded text
    if (sha256OfBuffer(artifactBuffer) !== artifact.hash) {
      pushUnique(errors, "FAILURE_HASH_MISMATCH");
      continue;
    }

    if (!hasValidSignatureSignature(artifactValue.signature)) {
      pushUnique(errors, "FAILURE_SIGNATURE_INVALID");
      continue;
    }

    const artifactBundleDigest = asNonEmptyString(artifactValue.bundleDigest);
    if (artifactBundleDigest && artifactBundleDigest !== manifest.bundleDigest) {
      pushUnique(errors, "FAILURE_DIGEST_MISMATCH");
      continue;
    }

    if (
      !hasValidLineageReferences(artifactValue.lineage, declaredArtifactIds)
    ) {
      pushUnique(errors, "FAILURE_CONTRACT_VIOLATION");
    }
  }

  // ── Witness verification ──

  // Collect witness files from the file map (any file under witness/)
  const witnessFiles: Array<{ relativePath: string; buffer: Buffer }> = [];
  for (const [filePath, buffer] of input.files) {
    if (filePath.startsWith("witness/")) {
      witnessFiles.push({ relativePath: filePath, buffer });
    }
  }
  // Sort for deterministic ordering
  witnessFiles.sort((a, b) => a.relativePath.localeCompare(b.relativePath));

  for (const witnessFile of witnessFiles) {
    let witnessValue: unknown;
    try {
      witnessValue = parseJson(witnessFile.buffer.toString("utf-8"));
    } catch {
      pushUnique(errors, "FAILURE_WITNESS_INVALID");
      continue;
    }

    if (!isRecord(witnessValue)) {
      pushUnique(errors, "FAILURE_WITNESS_INVALID");
      continue;
    }

    const id = asNonEmptyString(witnessValue.id);
    const type = asNonEmptyString(witnessValue.type);
    const bundleDigest = asNonEmptyString(witnessValue.bundleDigest);

    if (
      !id ||
      !type ||
      bundleDigest !== manifest.bundleDigest ||
      !hasValidSignatureSignature(witnessValue.signature)
    ) {
      pushUnique(errors, "FAILURE_WITNESS_INVALID");
      continue;
    }

    pushUnique(witnessIds, id);

    if (
      !hasValidLineageReferences(witnessValue.lineage, declaredArtifactIds)
    ) {
      pushUnique(errors, "FAILURE_WITNESS_LINEAGE_MISMATCH");
    }
  }

  if (
    manifest.witnessPolicy &&
    witnessIds.length < manifest.witnessPolicy.required
  ) {
    pushUnique(errors, "FAILURE_WITNESS_QUORUM_UNSATISFIED");
  }

  // ── Final result ──

  if (errors.length > 0) {
    return buildResult(
      "invalid",
      manifest.protocolVersion,
      manifest.bundleUri,
      manifest.bundleDigest,
      errors,
      verifiedArtifacts,
      witnessIds,
    );
  }

  if (manifest.requiresTrustRegistry && !trustRegistryAvailable) {
    return buildResult(
      "indeterminate",
      manifest.protocolVersion,
      manifest.bundleUri,
      manifest.bundleDigest,
      [],
      verifiedArtifacts,
      witnessIds,
      "trust-registry-unavailable",
    );
  }

  return buildResult(
    "valid",
    manifest.protocolVersion,
    manifest.bundleUri,
    manifest.bundleDigest,
    [],
    verifiedArtifacts,
    witnessIds,
  );
}
