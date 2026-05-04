# Security Validators Adoption Boundary

```yaml
repo: witnessops-proof-reference
repo_role: library_corpus
package_path: tools/witnessops-security-validators
adoption_status: structure_only_guardrail
live_testing_allowed: false
security_posture_claim_allowed: false
verifier_semantics_changed: false
corpus_truth_changed: false
```

## Purpose

`tools/witnessops-security-validators/` is a promoted copy of the WitnessOps security validators package. In this repo it is a review-only guardrail for committed fixtures, schemas, and source-refresh records inside the promoted package directory.

It is structure-only; no live testing; no security posture claim.

## Repo Boundary

This adoption does not change proof-reference verification semantics, corpus truth (`expected-result.json`), conformance comparisons, case naming stability, or the repo's health-chain expectations.

The package's schemas and fixtures are validator-local materials. They are not promoted as WitnessOps contract schemas, do not replace `witnessops-contracts`, and do not become verifier-of-record outputs by being present in this repo.

## CI Boundary

`.github/workflows/security-validators.yml` runs the five validator scripts from the package path:

```bash
python3 scripts/validate-dfir-fixtures.py
python3 scripts/validate-api-authz-fixtures.py
python3 scripts/validate-sbom-supply-chain-fixtures.py
python3 scripts/validate-purple-detection-fixtures.py
python3 scripts/validate-source-refresh-records.py
```

Successful CI means only that the committed validator examples satisfied their structure-only checks. It does not prove protocol corpus correctness, proof verification correctness, security posture, live endpoint behavior, dependency health, detection coverage, incident-response readiness, source verification, publication approval, or independent verification.

## Forbidden In This Adoption

- No live API, cloud, identity, email, network, endpoint, or telemetry testing.
- No adversary emulation, dependency scanning, vulnerability scanning, or runtime proof generation.
- No production secrets, customer evidence, private evidence bundles, signing keys, or credentials.
- No claim that `witnessops-proof-reference` is secure, verified, production-ready, customer-ready, or covered by security proof because these validators run.
- No changes to verification semantics or corpus truth without the repo's full health chain and explicit negative-test updates.

## Future Gate

Any future move from structure-only examples into repo-native verification behavior or corpus material must name the authority repo, schema source, fixtures, CI gate, and closure language before execution.
