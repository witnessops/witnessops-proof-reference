import { parseProofBundle, type ProofBundleManifest } from "./proof-bundle";

export interface ManifestEntry {
  id: string;
  hash: string;
  type: string;
}

export type Manifest = ProofBundleManifest;

export function parseManifest(raw: string): Manifest {
  return parseProofBundle(raw).manifest;
}

export { parseProofBundle };
