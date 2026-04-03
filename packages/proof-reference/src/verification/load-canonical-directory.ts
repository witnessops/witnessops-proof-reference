// ──────────────────────────────────────────────────────────────────
// CANONICAL — load a canonical proof bundle from a filesystem directory
//
// Reads manifest.json, artifacts/*, and optional witness/* from a
// directory path and returns a CanonicalBundleInput suitable for
// verifyCanonicalBundle.
//
// Byte-oriented: files are read as raw Buffers without text normalization.
//
// @see ADR-001-canonical-bundle-contract.md
// ──────────────────────────────────────────────────────────────────

import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import type { CanonicalBundleInput } from "./verify-canonical";

export type LoadCanonicalDirectoryErrorCode =
  | "BUNDLE_DIRECTORY_NOT_FOUND"
  | "BUNDLE_DIRECTORY_NOT_READABLE"
  | "MANIFEST_MISSING"
  | "MANIFEST_NOT_READABLE";

export class LoadCanonicalDirectoryError extends Error {
  readonly code: LoadCanonicalDirectoryErrorCode;

  constructor(message: string, code: LoadCanonicalDirectoryErrorCode) {
    super(message);
    this.name = "LoadCanonicalDirectoryError";
    this.code = code;
  }
}

/**
 * Load a canonical proof bundle from a filesystem directory.
 *
 * The directory must contain:
 * - `manifest.json` (required)
 * - `artifacts/` (files loaded as `artifacts/<filename>`)
 * - `witness/` (optional, files loaded as `witness/<filename>`)
 *
 * Files are read as raw Buffers — no text normalization is applied.
 *
 * @throws {LoadCanonicalDirectoryError} if the directory or manifest cannot be read
 */
export async function loadCanonicalDirectory(
  dirPath: string,
): Promise<CanonicalBundleInput> {
  const resolved = path.resolve(dirPath);

  // Verify directory exists
  let dirStat;
  try {
    dirStat = await stat(resolved);
  } catch {
    throw new LoadCanonicalDirectoryError(
      `Bundle directory not found: ${resolved}`,
      "BUNDLE_DIRECTORY_NOT_FOUND",
    );
  }

  if (!dirStat.isDirectory()) {
    throw new LoadCanonicalDirectoryError(
      `Path is not a directory: ${resolved}`,
      "BUNDLE_DIRECTORY_NOT_FOUND",
    );
  }

  const files = new Map<string, Buffer>();

  // manifest.json (required)
  try {
    files.set("manifest.json", await readFile(path.join(resolved, "manifest.json")));
  } catch {
    throw new LoadCanonicalDirectoryError(
      `Missing or unreadable manifest.json in ${resolved}`,
      "MANIFEST_MISSING",
    );
  }

  // artifacts/
  try {
    const entries = await readdir(path.join(resolved, "artifacts"), { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile()) {
        files.set(
          `artifacts/${entry.name}`,
          await readFile(path.join(resolved, "artifacts", entry.name)),
        );
      }
    }
  } catch {
    // No artifacts directory — verifier will handle this
  }

  // witness/ (optional)
  try {
    const entries = await readdir(path.join(resolved, "witness"), { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile()) {
        files.set(
          `witness/${entry.name}`,
          await readFile(path.join(resolved, "witness", entry.name)),
        );
      }
    }
  } catch {
    // No witness directory — optional per ADR-001
  }

  return {
    files,
    source: "directory",
  };
}
