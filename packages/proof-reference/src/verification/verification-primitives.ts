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

function stripTrailingEquals(value: string): string {
  let end = value.length;
  while (end > 0 && value.charCodeAt(end - 1) === 61) {
    end--;
  }
  return end === value.length ? value : value.slice(0, end);
}

function toBase64UrlFromBase64(value: string): string {
  let out = "";
  for (let i = 0; i < value.length; i++) {
    const ch = value.charAt(i);
    if (ch === "+") {
      out += "-";
    } else if (ch === "/") {
      out += "_";
    } else {
      out += ch;
    }
  }
  return out;
}

function isAsciiWhitespace(code: number): boolean {
  // Horizontal tab, line feed, vertical tab, form feed, carriage return, space.
  return (
    code === 0x09 ||
    code === 0x0a ||
    code === 0x0b ||
    code === 0x0c ||
    code === 0x0d ||
    code === 0x20
  );
}

function isAsciiAlphaNum(code: number): boolean {
  return (
    (code >= 0x41 && code <= 0x5a) || // A-Z
    (code >= 0x61 && code <= 0x7a) || // a-z
    (code >= 0x30 && code <= 0x39) // 0-9
  );
}

export function hasValidSignatureSignature(value: unknown) {
  const signature = asNonEmptyString(value);
  if (signature === undefined) {
    return true;
  }

  // Strict base64/base64url check: avoid accepting placeholder prefixes like
  // "sig-valid-*" which can be attacker-controlled and are not signatures.
  //
  // Note: We intentionally avoid regular expressions here. Some regex shapes
  // are flagged by CodeQL as potentially polynomial (ReDoS) on adversarial
  // input.

  // Compute trailing padding count (0..2), rejecting internal '='.
  let padCount = 0;
  for (let i = signature.length - 1; i >= 0; i--) {
    if (signature.charCodeAt(i) === 61) {
      padCount++;
      if (padCount > 2) {
        return false;
      }
      continue;
    }
    break;
  }

  if (padCount > 0 && signature.length % 4 !== 0) {
    return false;
  }

  const rawLen = signature.length - padCount;
  if (rawLen % 4 === 1) {
    return false;
  }

  let usesStdAlphabet = false; // + /
  let usesUrlAlphabet = false; // - _

  for (let i = 0; i < rawLen; i++) {
    const code = signature.charCodeAt(i);

    if (code === 61) {
      return false; // '=' only allowed at the end
    }
    if (isAsciiWhitespace(code)) {
      return false;
    }
    if (isAsciiAlphaNum(code)) {
      continue;
    }

    if (code === 43 || code === 47) {
      usesStdAlphabet = true;
      continue;
    }
    if (code === 45 || code === 95) {
      usesUrlAlphabet = true;
      continue;
    }

    return false;
  }

  // Do not allow mixed alphabets.
  if (usesStdAlphabet && usesUrlAlphabet) {
    return false;
  }

  // Normalize to padded base64 for decoding.
  let normalized = "";
  normalized = signature;
  if (usesUrlAlphabet) {
    let mapped = "";
    for (let i = 0; i < rawLen; i++) {
      const ch = signature.charAt(i);
      if (ch === "-") {
        mapped += "+";
      } else if (ch === "_") {
        mapped += "/";
      } else {
        mapped += ch;
      }
    }
    normalized = mapped;
  } else {
    normalized = signature.slice(0, rawLen);
  }

  // Add missing padding for unpadded inputs.
  const mod = normalized.length % 4;
  if (mod === 2) {
    normalized += "==";
  } else if (mod === 3) {
    normalized += "=";
  } else if (mod !== 0) {
    return false;
  }

  const decoded = Buffer.from(normalized, "base64");
  if (decoded.byteLength === 0) {
    return false;
  }

  const b64 = decoded.toString("base64");
  const b64NoPad = stripTrailingEquals(b64);
  const b64url = toBase64UrlFromBase64(b64);
  const b64urlNoPad = stripTrailingEquals(b64url);

  return (
    signature === b64 ||
    signature === b64NoPad ||
    signature === b64url ||
    signature === b64urlNoPad
  );
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
