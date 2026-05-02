#!/usr/bin/env bash
set -euo pipefail

mkdir -p receipts

MANIFEST_PATH="${MANIFEST_PATH:-tests/protocol-conformance/PROTOCOL_CORPUS_MANIFEST.v1.yaml}"
RECEIPT_BASENAME="${RECEIPT_BASENAME:-protocol-corpus-manifest.diff}"
CURRENT_SHA="${GITHUB_SHA:-$(git rev-parse HEAD)}"
EMPTY_TREE_SHA="4b825dc642cb6eb9a060e54bf8d69288fbee4904"

if BASE_SHA="$(git rev-parse "${CURRENT_SHA}^" 2>/dev/null)"; then
  :
else
  BASE_SHA="${EMPTY_TREE_SHA}"
fi

DIFF_PATH="receipts/${RECEIPT_BASENAME}"
BUNDLE_PATH="receipts/${RECEIPT_BASENAME}.sigstore.json"

# Emit a deterministic payload. If the corpus manifest did not change, this is an empty file.
git diff --no-ext-diff "${BASE_SHA}" "${CURRENT_SHA}" -- "${MANIFEST_PATH}" > "${DIFF_PATH}" || true

# Write checksum in a format accepted by: (cd receipts && sha256sum -c <file>)
(
  cd receipts
  sha256sum "${RECEIPT_BASENAME}" | awk '{print $1 "  " $2}' > "${RECEIPT_BASENAME}.sha256"
)

# Keyless Sigstore signing via GitHub OIDC. The workflow must grant id-token: write.
cosign sign-blob --yes --bundle "${BUNDLE_PATH}" "${DIFF_PATH}"

ls -la receipts
