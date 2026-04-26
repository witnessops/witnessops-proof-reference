import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { verifyCanonicalBundle } from "./verify-canonical";
import { verifyCanonicalBundleRequest } from "./canonical-app-adapter";
import { verifyProofBundleFile } from "./verify-vpb";
import { loadCanonicalDirectory, LoadCanonicalDirectoryError } from "./load-canonical-directory";
import { MalformedBundleError } from "./proof-bundle";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const containedVmFoundrySeamFixture = path.resolve(
  __dirname,
  "__fixtures__/external-seams/vm-foundry/proof_bundle_v0.1_quickcheck",
);
const externalVmFoundryRepoDir = process.env.VM_FOUNDRY_REPO_DIR;
const vmFoundryBundleDir =
  process.env.VM_FOUNDRY_BUNDLE_DIR ??
  (externalVmFoundryRepoDir
    ? path.join(externalVmFoundryRepoDir, "m365/proof/v0.1/out/proof_bundle_v0.1_quickcheck")
    : containedVmFoundrySeamFixture);

async function loadDirectoryRecursively(dir: string, root = dir): Promise<Map<string, Buffer>> {
  const files = new Map<string, Buffer>();
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const absolutePath = path.join(dir, entry.name);
    const relativePath = path.relative(root, absolutePath).replaceAll(path.sep, "/");

    if (entry.isDirectory()) {
      const nested = await loadDirectoryRecursively(absolutePath, root);
      for (const [nestedPath, contents] of nested.entries()) {
        files.set(nestedPath, contents);
      }
      continue;
    }

    if (entry.isFile()) {
      files.set(relativePath, await readFile(absolutePath));
    }
  }

  return files;
}

test("contained vm-foundry seam fixture self-reports producer-side verification success", async () => {
  const bundleStat = await stat(vmFoundryBundleDir);
  assert.ok(bundleStat.isDirectory(), `expected directory bundle fixture at ${vmFoundryBundleDir}`);

  const report = JSON.parse(
    await readFile(path.join(vmFoundryBundleDir, "VERIFY/report.json"), "utf8"),
  ) as {
    status: string;
    rc: number;
    issues: unknown[];
    schema: string;
  };

  assert.equal(report.schema, "vaultmesh.proof.verify_report.v1");
  assert.equal(report.status, "pass");
  assert.equal(report.rc, 0);
  assert.deepEqual(report.issues, []);
});

test("public canonical directory loader rejects vm-foundry seam fixture as non-canonical", async () => {
  await assert.rejects(
    () => loadCanonicalDirectory(vmFoundryBundleDir),
    (error: unknown) =>
      error instanceof LoadCanonicalDirectoryError &&
      error.code === "MANIFEST_MISSING",
  );
});

test("public canonical verifier rejects vm-foundry seam fixture with explicit manifest-missing failure", async () => {
  const files = await loadDirectoryRecursively(vmFoundryBundleDir);
  const result = await verifyCanonicalBundle(
    { files, source: "directory" },
    { supportedProtocolVersions: ["1.0.0"] },
    path.basename(vmFoundryBundleDir),
  );

  assert.equal(result.status, "invalid");
  assert.ok(result.errors.includes("FAILURE_MANIFEST_MISSING"));
  assert.deepEqual(result.verifiedArtifacts, []);
});

test("public canonical app adapter returns stable missing-manifest failure for vm-foundry seam fixture", async () => {
  const files = await loadDirectoryRecursively(vmFoundryBundleDir);
  const response = await verifyCanonicalBundleRequest(files);

  assert.equal(response.ok, false);
  assert.equal(response.verifierMode, "canonical");
  assert.equal(response.code, "MISSING_MANIFEST");
});

test("public legacy JSON verifier rejects vm-foundry PUBLIC.json as not a legacy proof bundle", async () => {
  const publicJson = await readFile(path.join(vmFoundryBundleDir, "PUBLIC.json"), "utf8");

  await assert.rejects(
    () => verifyProofBundleFile(publicJson),
    (error: unknown) =>
      error instanceof MalformedBundleError &&
      error.message === "Proof bundle is missing required manifest fields",
  );
});
