export type JsonRecord = Record<string, unknown>;

export interface SemverParts {
  major: number;
  minor: number;
  patch: number;
}

export const SUPPORTED_ANCHOR_TYPES = ["rfc3161", "eth", "btc"] as const;

export type SupportedAnchorType = (typeof SUPPORTED_ANCHOR_TYPES)[number];

export interface AnchorValidationInput {
  type: string;
  reference: string;
  timestamp: string;
}

export function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function asNonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

export function isIsoTimestamp(value: string | undefined) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

export function isSha256Digest(value: string | undefined) {
  return typeof value === "string" && /^sha256:[a-f0-9]{64}$/i.test(value);
}

export function isLooseDigestLike(value: string | undefined) {
  return typeof value === "string" && /^sha256:[a-z0-9-]+$/i.test(value);
}

export function isSemverLike(value: string | undefined) {
  return typeof value === "string" && /^\d+\.\d+\.\d+$/.test(value);
}

export function hasSchemaDeclaration(
  schema: string | undefined,
  version: string | undefined,
) {
  return (schema?.startsWith("vaultmesh-proof-bundle/") ?? false) || (version?.length ?? 0) > 0;
}

export function parseSemver(value: string) {
  const match = value.match(/^(\d+)\.(\d+)\.(\d+)$/);

  if (!match) {
    return null;
  }

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  } satisfies SemverParts;
}

export function compareSemver(left: string, right: string) {
  const leftVersion = parseSemver(left);
  const rightVersion = parseSemver(right);

  if (!leftVersion || !rightVersion) {
    return 0;
  }

  if (leftVersion.major !== rightVersion.major) {
    return leftVersion.major - rightVersion.major;
  }

  if (leftVersion.minor !== rightVersion.minor) {
    return leftVersion.minor - rightVersion.minor;
  }

  return leftVersion.patch - rightVersion.patch;
}

export function pushUnique(values: string[], value: string) {
  if (!values.includes(value)) {
    values.push(value);
  }
}

export function isTimestampOrdered(
  earlier: string | undefined,
  later: string | undefined,
) {
  if (typeof earlier !== "string" || typeof later !== "string") {
    return false;
  }

  if (!isIsoTimestamp(earlier) || !isIsoTimestamp(later)) {
    return false;
  }

  return Date.parse(earlier) <= Date.parse(later);
}

export function isSupportedAnchorType(value: string): value is SupportedAnchorType {
  return (SUPPORTED_ANCHOR_TYPES as readonly string[]).includes(value);
}

export function isAnchorReferenceLike(value: string | undefined) {
  return typeof value === "string" && (value.includes("://") || value.includes(":"));
}

export function validateAnchorRecord(
  rootHash: string | undefined,
  anchor: AnchorValidationInput,
) {
  if (!isSupportedAnchorType(anchor.type)) {
    return {
      valid: false,
      details: `unsupported anchor type: ${anchor.type}`,
    };
  }

  const valid =
    isSha256Digest(rootHash) &&
    isAnchorReferenceLike(anchor.reference) &&
    isIsoTimestamp(anchor.timestamp);

  return {
    valid,
    details: valid
      ? `anchor reference format valid for ${anchor.type}`
      : "invalid root hash, anchor reference, or anchor timestamp",
  };
}

export function findDuplicateAnchorReference<
  T extends { anchorType: string; anchorRef: string },
>(anchors: T[]) {
  const seen = new Set<string>();

  for (const anchor of anchors) {
    const key = `${anchor.anchorType}::${anchor.anchorRef}`;
    if (seen.has(key)) {
      return anchor.anchorRef;
    }

    seen.add(key);
  }

  return undefined;
}

export function hasValidSignatureSignature(value: unknown) {
  const signature = asNonEmptyString(value);
  return signature === undefined || signature.startsWith("sig-valid-");
}

export function findMissingLineageReferences(
  value: unknown,
  declaredArtifactIds: Set<string>,
) {
  if (!Array.isArray(value)) {
    return [] as string[];
  }

  return value.filter(
    (entry): entry is string => typeof entry === "string" && !declaredArtifactIds.has(entry),
  );
}

export function hasValidLineageReferences(
  value: unknown,
  declaredArtifactIds: Set<string>,
) {
  return findMissingLineageReferences(value, declaredArtifactIds).length === 0;
}

export function isSupportedSchemaVersion(
  value: unknown,
  supportedSchemaMajorVersions: number[],
) {
  const schemaVersion = asNonEmptyString(value);

  if (!schemaVersion) {
    return true;
  }

  const parsed = parseSemver(schemaVersion);
  return parsed !== null && supportedSchemaMajorVersions.includes(parsed.major);
}

export function meetsMinimumProtocolVersion(
  supportedProtocolVersions: Iterable<string>,
  minimumProtocolVersion: string | undefined,
) {
  if (!minimumProtocolVersion) {
    return true;
  }

  const highestSupportedProtocolVersion = [...supportedProtocolVersions]
    .sort(compareSemver)
    .at(-1);

  if (!highestSupportedProtocolVersion) {
    return false;
  }

  return compareSemver(highestSupportedProtocolVersion, minimumProtocolVersion) >= 0;
}