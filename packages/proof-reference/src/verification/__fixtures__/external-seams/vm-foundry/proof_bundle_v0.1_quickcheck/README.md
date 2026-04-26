# Contained vm-foundry Seam Fixture

This fixture is a minimal, repo-contained negative seam fixture.

It is not producer evidence.
It is not a canonical proof bundle.
It is not a vm-foundry receipt.

It exists only to prove that `proof-reference` rejects a known non-canonical producer-side bundle shape with `MANIFEST_MISSING`.

External live seam testing may override this path with `VM_FOUNDRY_BUNDLE_DIR`, but the default repository health path must remain self-contained.
