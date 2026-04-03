/**
 * Protocol conformance test loader and runner.
 *
 * This module loads proof bundle test cases from disk and delegates
 * verification to the canonical verifier ({@link verifyCanonicalBundle}).
 *
 * It is structured as three responsibilities:
 * 1. **Disk loader** — reads a conformance case directory into a file map
 * 2. **Expected-result loader** — parses `expected-result.json` for assertions
 * 3. **Thin wrapper** — calls the canonical verifier with loaded files
 *
 * @see ADR-001-canonical-bundle-contract.md
 */

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import {
  verifyCanonicalBundle,
  type CanonicalBundleInput,
  type CanonicalVerifierOptions,
  type CanonicalVerificationResult,
} from "./verify-canonical";

// ── Public types ──
// Preserved for backwards compatibility with existing test code.

export interface ProtocolCorpusTextFile {
  relativePath: string;
  raw: string;
}

export interface LoadedProtocolConformanceCase {
  caseName: string;
  caseDir: string;
  manifestFile?: ProtocolCorpusTextFile;
  expectedResultFile: ProtocolCorpusTextFile;
  artifactFiles: ProtocolCorpusTextFile[];
  witnessFiles: ProtocolCorpusTextFile[];
}

export type ProtocolVerificationResult = CanonicalVerificationResult;

export type ProtocolVerifierOptions = CanonicalVerifierOptions;

// ── Disk loader ──

export async function loadProtocolConformanceCase(
  caseDir: string,
): Promise<LoadedProtocolConformanceCase> {
  const caseName = path.basename(caseDir);
  const manifestPath = path.join(caseDir, "manifest.json");
  const expectedResultPath = path.join(caseDir, "expected-result.json");
  const artifactsDir = path.join(caseDir, "artifacts");
  const witnessDir = path.join(caseDir, "witness");

  const artifactEntries = await readdir(artifactsDir, { withFileTypes: true });
  const artifactFiles = await Promise.all(
    artifactEntries
      .filter((entry) => entry.isFile())
      .sort((left, right) => left.name.localeCompare(right.name))
      .map(async (entry) => ({
        relativePath: `artifacts/${entry.name}`,
        raw: await readFile(path.join(artifactsDir, entry.name), "utf-8"),
      })),
  );

  let witnessFiles: ProtocolCorpusTextFile[] = [];
  try {
    const witnessEntries = await readdir(witnessDir, { withFileTypes: true });
    witnessFiles = await Promise.all(
      witnessEntries
        .filter((entry) => entry.isFile())
        .sort((left, right) => left.name.localeCompare(right.name))
        .map(async (entry) => ({
          relativePath: `witness/${entry.name}`,
          raw: await readFile(path.join(witnessDir, entry.name), "utf-8"),
        })),
    );
  } catch {
    witnessFiles = [];
  }

  let manifestFile: ProtocolCorpusTextFile | undefined;
  try {
    manifestFile = {
      relativePath: "manifest.json",
      raw: await readFile(manifestPath, "utf-8"),
    };
  } catch {
    manifestFile = undefined;
  }

  return {
    caseName,
    caseDir,
    manifestFile,
    expectedResultFile: {
      relativePath: "expected-result.json",
      raw: await readFile(expectedResultPath, "utf-8"),
    },
    artifactFiles,
    witnessFiles,
  };
}

// ── Expected-result parser ──

export function parseExpectedProtocolResult(raw: string): ProtocolVerificationResult {
  return JSON.parse(raw) as ProtocolVerificationResult;
}

// ── Thin verification wrapper ──

/**
 * Converts a loaded conformance case into a canonical file map and
 * delegates to {@link verifyCanonicalBundle}.
 */
export async function verifyProtocolConformanceCase(
  input: LoadedProtocolConformanceCase,
  options: ProtocolVerifierOptions = {},
): Promise<ProtocolVerificationResult> {
  const files = new Map<string, Buffer>();

  // Add manifest (if present)
  if (input.manifestFile) {
    files.set("manifest.json", Buffer.from(input.manifestFile.raw, "utf-8"));
  }

  // Add artifact files
  for (const artifact of input.artifactFiles) {
    files.set(artifact.relativePath, Buffer.from(artifact.raw, "utf-8"));
  }

  // Add witness files
  for (const witness of input.witnessFiles) {
    files.set(witness.relativePath, Buffer.from(witness.raw, "utf-8"));
  }

  const canonicalInput: CanonicalBundleInput = {
    files,
    source: "directory",
  };

  return verifyCanonicalBundle(canonicalInput, options, input.caseName);
}
