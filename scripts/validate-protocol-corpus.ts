import fs from "node:fs";
import path from "node:path";

type ValidationIssue = {
  caseName: string;
  message: string;
};

type ExpectedResult = {
  status: "valid" | "invalid" | "indeterminate";
  protocolVersion: string;
  bundleUri: string;
  bundleDigest: string;
  errors: string[];
  verifiedArtifacts: string[];
  witnesses?: string[];
  indeterminateReason?: string;
};

type ManifestArtifact = {
  id: string;
  type: string;
  path: string;
  hash: string;
};

type Manifest = {
  protocolVersion: string;
  bundleUri: string;
  bundleDigest: string;
  artifacts: ManifestArtifact[];
  requiresTrustRegistry?: boolean;
  compatibility?: {
    minimumProtocolVersion: string;
  };
  witnessPolicy?: {
    type: string;
    required: number;
    available: number;
  };
};

const repoRoot = path.resolve(__dirname, "..");
const corpusRoot = path.join(repoRoot, "tests", "protocol-conformance");
const allowedCaseEntries = new Set([
  "artifacts",
  "expected-result.json",
  "manifest.json",
  "witness",
]);
const allowedExpectedResultKeys = new Set([
  "status",
  "protocolVersion",
  "bundleUri",
  "bundleDigest",
  "errors",
  "verifiedArtifacts",
  "witnesses",
  "indeterminateReason",
]);
const allowedManifestKeys = new Set([
  "protocolVersion",
  "bundleUri",
  "bundleDigest",
  "artifacts",
  "requiresTrustRegistry",
  "compatibility",
  "witnessPolicy",
]);
const allowedManifestArtifactKeys = new Set(["id", "type", "path", "hash"]);
const sanctionedMalformedManifestErrors = new Set([
  "FAILURE_BUNDLE_MALFORMED",
  "FAILURE_REQUIRED_FIELD_MISSING",
]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isDigestLike(value: string) {
  return /^sha256:[a-z0-9-]+$/i.test(value);
}

function isSemverLike(value: string) {
  return /^\d+\.\d+\.\d+$/.test(value);
}

function readJsonFile(filePath: string, issues: ValidationIssue[], caseName: string) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown JSON parse error";
    issues.push({
      caseName,
      message: `Invalid JSON in ${path.relative(repoRoot, filePath).replace(/\\/g, "/")}: ${message}`,
    });
    return null;
  }
}

function listCaseDirectories(root: string) {
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function listFiles(root: string) {
  if (!fs.existsSync(root)) {
    return [];
  }

  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort();
}

function validateNoUnknownKeys(
  value: Record<string, unknown>,
  allowedKeys: Set<string>,
  label: string,
  issues: ValidationIssue[],
  caseName: string,
) {
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) {
      issues.push({ caseName, message: `${label} contains unsupported key ${key}` });
    }
  }
}

function validateExpectedResult(caseName: string, value: unknown, issues: ValidationIssue[]) {
  if (!isPlainObject(value)) {
    issues.push({ caseName, message: "expected-result.json must contain a JSON object" });
    return null;
  }

  validateNoUnknownKeys(value, allowedExpectedResultKeys, "expected-result.json", issues, caseName);

  const status = value.status;
  const protocolVersion = value.protocolVersion;
  const bundleUri = value.bundleUri;
  const bundleDigest = value.bundleDigest;
  const errors = value.errors;
  const verifiedArtifacts = value.verifiedArtifacts;
  const witnesses = value.witnesses;
  const indeterminateReason = value.indeterminateReason;

  if (status !== "valid" && status !== "invalid" && status !== "indeterminate") {
    issues.push({ caseName, message: "expected-result.json status must be valid, invalid, or indeterminate" });
  }

  if (!isNonEmptyString(protocolVersion) || !isSemverLike(protocolVersion)) {
    issues.push({ caseName, message: "expected-result.json protocolVersion must be a semver-like string" });
  }

  if (!isNonEmptyString(bundleUri)) {
    issues.push({ caseName, message: "expected-result.json bundleUri must be a non-empty string" });
  }

  if (!isNonEmptyString(bundleDigest) || !isDigestLike(bundleDigest)) {
    issues.push({ caseName, message: "expected-result.json bundleDigest must be a sha256-prefixed string" });
  }

  if (!isStringArray(errors)) {
    issues.push({ caseName, message: "expected-result.json errors must be an array of strings" });
  }

  if (!isStringArray(verifiedArtifacts)) {
    issues.push({ caseName, message: "expected-result.json verifiedArtifacts must be an array of strings" });
  }

  if (witnesses !== undefined && !isStringArray(witnesses)) {
    issues.push({ caseName, message: "expected-result.json witnesses must be an array of strings when present" });
  }

  if (status === "valid" && isStringArray(errors) && errors.length > 0) {
    issues.push({ caseName, message: "valid cases must not declare expected errors" });
  }

  if (status === "invalid" && isStringArray(errors) && errors.length === 0) {
    issues.push({ caseName, message: "invalid cases must declare at least one expected error" });
  }

  if (status === "indeterminate") {
    if (!isNonEmptyString(indeterminateReason)) {
      issues.push({ caseName, message: "indeterminate cases must declare indeterminateReason" });
    }
  } else if (indeterminateReason !== undefined) {
    issues.push({ caseName, message: "indeterminateReason is only allowed for indeterminate cases" });
  }

  if (isStringArray(errors) && new Set(errors).size !== errors.length) {
    issues.push({ caseName, message: "expected-result.json errors must not contain duplicates" });
  }

  if (isStringArray(verifiedArtifacts) && new Set(verifiedArtifacts).size !== verifiedArtifacts.length) {
    issues.push({ caseName, message: "expected-result.json verifiedArtifacts must not contain duplicates" });
  }

  if (isStringArray(witnesses) && new Set(witnesses).size !== witnesses.length) {
    issues.push({ caseName, message: "expected-result.json witnesses must not contain duplicates" });
  }

  return value as ExpectedResult;
}

function validateManifest(caseName: string, value: unknown, issues: ValidationIssue[], caseDir: string) {
  if (!isPlainObject(value)) {
    issues.push({ caseName, message: "manifest.json must contain a JSON object" });
    return null;
  }

  validateNoUnknownKeys(value, allowedManifestKeys, "manifest.json", issues, caseName);

  const protocolVersion = value.protocolVersion;
  const bundleUri = value.bundleUri;
  const bundleDigest = value.bundleDigest;
  const artifacts = value.artifacts;
  const requiresTrustRegistry = value.requiresTrustRegistry;
  const compatibility = value.compatibility;
  const witnessPolicy = value.witnessPolicy;

  if (!isNonEmptyString(protocolVersion) || !isSemverLike(protocolVersion)) {
    issues.push({ caseName, message: "manifest.json protocolVersion must be a semver-like string" });
  }

  if (!isNonEmptyString(bundleUri)) {
    issues.push({ caseName, message: "manifest.json bundleUri must be a non-empty string" });
  }

  if (!isNonEmptyString(bundleDigest) || !isDigestLike(bundleDigest)) {
    issues.push({ caseName, message: "manifest.json bundleDigest must be a sha256-prefixed string" });
  }

  if (!Array.isArray(artifacts) || artifacts.length === 0) {
    issues.push({ caseName, message: "manifest.json artifacts must be a non-empty array" });
    return null;
  }

  if (requiresTrustRegistry !== undefined && typeof requiresTrustRegistry !== "boolean") {
    issues.push({ caseName, message: "manifest.json requiresTrustRegistry must be a boolean when present" });
  }

  if (compatibility !== undefined) {
    if (!isPlainObject(compatibility)) {
      issues.push({ caseName, message: "manifest.json compatibility must be an object when present" });
    } else {
      const minimumProtocolVersion = compatibility.minimumProtocolVersion;

      if (!isNonEmptyString(minimumProtocolVersion) || !isSemverLike(minimumProtocolVersion)) {
        issues.push({ caseName, message: "manifest.json compatibility.minimumProtocolVersion must be a semver-like string" });
      }
    }
  }

  if (witnessPolicy !== undefined) {
    if (!isPlainObject(witnessPolicy)) {
      issues.push({ caseName, message: "manifest.json witnessPolicy must be an object when present" });
    } else {
      const policyType = witnessPolicy.type;
      const requiredValue = witnessPolicy.required;
      const availableValue = witnessPolicy.available;
      const required =
        typeof requiredValue === "number" && Number.isInteger(requiredValue)
          ? requiredValue
          : undefined;
      const available =
        typeof availableValue === "number" && Number.isInteger(availableValue)
          ? availableValue
          : undefined;

      if (!isNonEmptyString(policyType)) {
        issues.push({ caseName, message: "manifest.json witnessPolicy.type must be a non-empty string" });
      }

      if (required === undefined || required < 1) {
        issues.push({ caseName, message: "manifest.json witnessPolicy.required must be a positive integer" });
      }

      if (available === undefined || available < 1) {
        issues.push({ caseName, message: "manifest.json witnessPolicy.available must be a positive integer" });
      }

      if (
        required !== undefined &&
        available !== undefined &&
        required > available
      ) {
        issues.push({ caseName, message: "manifest.json witnessPolicy.required must be less than or equal to available" });
      }
    }
  }

  const normalizedArtifacts: ManifestArtifact[] = [];
  const seenIds = new Set<string>();
  const seenPaths = new Set<string>();

  for (const [index, artifact] of artifacts.entries()) {
    if (!isPlainObject(artifact)) {
      issues.push({ caseName, message: `manifest.json artifacts[${index}] must be an object` });
      continue;
    }

    validateNoUnknownKeys(artifact, allowedManifestArtifactKeys, `manifest.json artifacts[${index}]`, issues, caseName);

    const id = artifact.id;
    const type = artifact.type;
    const artifactPath = artifact.path;
    const hash = artifact.hash;

    if (!isNonEmptyString(id)) {
      issues.push({ caseName, message: `manifest.json artifacts[${index}].id must be a non-empty string` });
    }

    if (!isNonEmptyString(type)) {
      issues.push({ caseName, message: `manifest.json artifacts[${index}].type must be a non-empty string` });
    }

    if (!isNonEmptyString(artifactPath) || !artifactPath.startsWith("artifacts/") || !artifactPath.endsWith(".json")) {
      issues.push({ caseName, message: `manifest.json artifacts[${index}].path must point into artifacts/*.json` });
    }

    if (!isNonEmptyString(hash) || !isDigestLike(hash)) {
      issues.push({ caseName, message: `manifest.json artifacts[${index}].hash must be a sha256-prefixed string` });
    }

    if (isNonEmptyString(id) && seenIds.has(id)) {
      issues.push({ caseName, message: `manifest.json reuses artifact id ${id}` });
    }

    if (isNonEmptyString(id)) {
      seenIds.add(id);
    }

    if (isNonEmptyString(artifactPath) && seenPaths.has(artifactPath)) {
      issues.push({ caseName, message: `manifest.json reuses artifact path ${artifactPath}` });
    }

    if (isNonEmptyString(artifactPath)) {
      seenPaths.add(artifactPath);
      const resolvedPath = path.resolve(caseDir, artifactPath);

      if (!resolvedPath.startsWith(caseDir + path.sep)) {
        issues.push({ caseName, message: `manifest.json artifact path escapes the case directory: ${artifactPath}` });
      } else if (!fs.existsSync(resolvedPath)) {
        issues.push({ caseName, message: `manifest.json references missing file ${artifactPath}` });
      }
    }

    if (
      isNonEmptyString(id) &&
      isNonEmptyString(type) &&
      isNonEmptyString(artifactPath) &&
      isNonEmptyString(hash)
    ) {
      normalizedArtifacts.push({ id, type, path: artifactPath, hash });
    }
  }

  return {
    protocolVersion: isNonEmptyString(protocolVersion) ? protocolVersion : "",
    bundleDigest: isNonEmptyString(bundleDigest) ? bundleDigest : "",
    bundleUri: isNonEmptyString(bundleUri) ? bundleUri : "",
    artifacts: normalizedArtifacts,
    requiresTrustRegistry:
      typeof requiresTrustRegistry === "boolean" ? requiresTrustRegistry : undefined,
    compatibility:
      isPlainObject(compatibility) && isNonEmptyString(compatibility.minimumProtocolVersion)
        ? { minimumProtocolVersion: compatibility.minimumProtocolVersion }
        : undefined,
    witnessPolicy:
      isPlainObject(witnessPolicy) &&
      isNonEmptyString(witnessPolicy.type) &&
      typeof witnessPolicy.required === "number" &&
      Number.isInteger(witnessPolicy.required) &&
      typeof witnessPolicy.available === "number" &&
      Number.isInteger(witnessPolicy.available)
        ? {
            type: witnessPolicy.type,
            required: witnessPolicy.required,
            available: witnessPolicy.available,
          }
        : undefined,
  } satisfies Manifest;
}

function validateCase(caseName: string, issues: ValidationIssue[]) {
  const caseDir = path.join(corpusRoot, caseName);
  const entries = fs.readdirSync(caseDir, { withFileTypes: true });

  if (!/^[a-z0-9-]+$/.test(caseName)) {
    issues.push({ caseName, message: "Case directory names must use lowercase kebab-case" });
  }

  for (const entry of entries) {
    if (!allowedCaseEntries.has(entry.name)) {
      issues.push({ caseName, message: `Unsupported case entry ${entry.name}` });
    }
  }

  const expectedResultPath = path.join(caseDir, "expected-result.json");
  const artifactsDir = path.join(caseDir, "artifacts");
  const manifestPath = path.join(caseDir, "manifest.json");
  const witnessDir = path.join(caseDir, "witness");

  if (!fs.existsSync(expectedResultPath)) {
    issues.push({ caseName, message: "Missing required file expected-result.json" });
    return;
  }

  if (!fs.existsSync(artifactsDir) || !fs.statSync(artifactsDir).isDirectory()) {
    issues.push({ caseName, message: "Missing required artifacts directory" });
    return;
  }

  const expectedResult = validateExpectedResult(
    caseName,
    readJsonFile(expectedResultPath, issues, caseName),
    issues,
  );

  if (!expectedResult) {
    return;
  }

  const artifactFiles = listFiles(artifactsDir);

  if (artifactFiles.length === 0) {
    issues.push({ caseName, message: "artifacts directory must contain at least one JSON file" });
  }

  for (const fileName of artifactFiles) {
    if (!fileName.endsWith(".json")) {
      issues.push({ caseName, message: `artifacts directory contains non-JSON file ${fileName}` });
    }
  }

  if (fs.existsSync(witnessDir)) {
    if (!fs.statSync(witnessDir).isDirectory()) {
      issues.push({ caseName, message: "witness must be a directory when present" });
    } else {
      const witnessFiles = listFiles(witnessDir);

      if (witnessFiles.length === 0) {
        issues.push({ caseName, message: "witness directory must not be empty" });
      }

      for (const fileName of witnessFiles) {
        if (!fileName.endsWith(".json")) {
          issues.push({ caseName, message: `witness directory contains non-JSON file ${fileName}` });
        }
      }

      if (expectedResult && !expectedResult.witnesses) {
        issues.push({ caseName, message: "Cases with a witness directory must declare witnesses in expected-result.json" });
      }

      if (expectedResult?.witnesses && expectedResult.witnesses.length !== witnessFiles.length) {
        issues.push({ caseName, message: "expected-result.json witnesses count must match witness directory file count" });
      }
    }
  } else if (expectedResult?.witnesses) {
    issues.push({ caseName, message: "expected-result.json witnesses requires a witness directory" });
  }

  const manifestExists = fs.existsSync(manifestPath);

  if (!manifestExists) {
    if (!expectedResult) {
      return;
    }

    const isSanctionedMissingManifestCase =
      expectedResult.status === "invalid" && expectedResult.errors.includes("FAILURE_MANIFEST_MISSING");

    if (!isSanctionedMissingManifestCase) {
      issues.push({ caseName, message: "manifest.json is required unless the case expects FAILURE_MANIFEST_MISSING" });
    }

    return;
  }

  const rawManifest = readJsonFile(manifestPath, issues, caseName);
  const allowsMalformedManifest = expectedResult.errors.some((error) =>
    sanctionedMalformedManifestErrors.has(error),
  );

  if (allowsMalformedManifest) {
    if (!isPlainObject(rawManifest)) {
      issues.push({ caseName, message: "manifest.json must be a JSON object even for malformed-manifest cases" });
      return;
    }

    validateNoUnknownKeys(rawManifest, allowedManifestKeys, "manifest.json", issues, caseName);

    const rawProtocolVersion = rawManifest.protocolVersion;

    if (rawProtocolVersion !== undefined) {
      if (!isNonEmptyString(rawProtocolVersion) || !isSemverLike(rawProtocolVersion)) {
        issues.push({ caseName, message: "manifest.json protocolVersion must be semver-like when present" });
      } else if (rawProtocolVersion !== expectedResult.protocolVersion) {
        issues.push({ caseName, message: "manifest.json protocolVersion must match expected-result.json when present" });
      }
    }

    const rawBundleUri = rawManifest.bundleUri;

    if (rawBundleUri !== undefined) {
      if (!isNonEmptyString(rawBundleUri)) {
        issues.push({ caseName, message: "manifest.json bundleUri must be a non-empty string when present" });
      } else if (rawBundleUri !== expectedResult.bundleUri) {
        issues.push({ caseName, message: "manifest.json bundleUri must match expected-result.json when present" });
      }
    }

    return;
  }

  const manifest = validateManifest(caseName, rawManifest, issues, caseDir);

  if (!manifest) {
    return;
  }

  if (manifest.protocolVersion !== expectedResult.protocolVersion) {
    issues.push({ caseName, message: "manifest.json protocolVersion must match expected-result.json" });
  }

  if (manifest.bundleUri !== expectedResult.bundleUri) {
    issues.push({ caseName, message: "manifest.json bundleUri must match expected-result.json" });
  }

  if (manifest.bundleDigest !== expectedResult.bundleDigest) {
    issues.push({ caseName, message: "manifest.json bundleDigest must match expected-result.json" });
  }

  const declaredArtifactTypes = new Set(manifest.artifacts.map((artifact) => artifact.type));

  for (const verifiedArtifact of expectedResult.verifiedArtifacts) {
    if (!declaredArtifactTypes.has(verifiedArtifact)) {
      issues.push({ caseName, message: `expected-result.json verifiedArtifacts references unknown manifest artifact type ${verifiedArtifact}` });
    }
  }

  const manifestArtifactPaths = new Set(manifest.artifacts.map((artifact) => path.basename(artifact.path)));

  for (const fileName of artifactFiles) {
    if (!manifestArtifactPaths.has(fileName)) {
      issues.push({ caseName, message: `artifacts/${fileName} is not referenced by manifest.json` });
    }
  }
}

function main() {
  if (!fs.existsSync(corpusRoot)) {
    console.error("ERROR: tests/protocol-conformance directory does not exist.");
    process.exit(1);
  }

  const caseDirectories = listCaseDirectories(corpusRoot);

  if (caseDirectories.length === 0) {
    console.error("ERROR: No protocol conformance case directories found.");
    process.exit(1);
  }

  const issues: ValidationIssue[] = [];

  for (const caseName of caseDirectories) {
    validateCase(caseName, issues);
  }

  if (issues.length === 0) {
    console.log(`Protocol corpus validation passed for ${caseDirectories.length} case(s).`);
    process.exit(0);
  }

  for (const issue of issues) {
    console.log(`ERROR [${issue.caseName}]: ${issue.message}`);
  }

  process.exit(1);
}

main();
