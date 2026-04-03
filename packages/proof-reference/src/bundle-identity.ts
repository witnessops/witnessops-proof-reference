export type ProofBundleUri = `vm://bundle/${string}`;

export function getProofBundleUri(bundleId: string): ProofBundleUri {
  return `vm://bundle/${bundleId}`;
}

export function normalizeProofBundleUri(
  bundleId: string,
  // candidate is accepted for call-site compatibility but the canonical URI
  // is always derived from bundleId to prevent URI spoofing via bundle data.
  _candidate?: string,
): ProofBundleUri {
  return getProofBundleUri(bundleId);
}