# Security Policy

We take security issues in this repository seriously. This document describes what is in scope, how to report a suspected vulnerability, and what to expect from us in return.

## Scope

This repository contains the public reference implementation and frozen conformance corpus for the WitnessOps proof-bundle verification protocol:

- verifier core under `packages/proof-reference/src/verification/`
- protocol conformance corpus under `tests/protocol-conformance/`
- corpus validation and execution scripts under `scripts/`
- package exports for reference-verification and protocol-conformance consumers
- contained external-seam fixtures used to prove bounded rejection behavior

This repository does **not** contain a live web app, production service, proof-engine package generation, signing-key custody, key-registry authority, customer evidence custody, deployment authority, or production workflow evidence.

Reports against systems outside this repository are out of scope here and should be directed to the appropriate project or vendor.

## Supported surface

Only the current `main` branch of this repository is supported and receives security fixes. Older branches, tags, and historical releases are not patched.

## Reporting a vulnerability

Please report suspected vulnerabilities privately through one of the following channels:

- **Preferred:** GitHub Private Vulnerability Reporting —
  <https://github.com/witnessops/witnessops-proof-reference/security/advisories/new>
- **Alternative:** email <security@witnessops.com>

When reporting, please include:

- a description of the issue and its potential impact
- steps to reproduce, or a proof of concept
- the affected verifier file, corpus case, expected result, loader, script, fixture, or export if known
- any relevant commit SHA or environment details

> **Do not use public GitHub issues, discussions, or pull requests to report suspected vulnerabilities.** Public reports can put users at risk before a fix is available.

## Acknowledgment window

We will acknowledge receipt of your report within **5 business days**. That acknowledgment confirms the report reached us; a full triage and impact assessment will follow.

## Disclosure handling

We prefer coordinated disclosure:

- We will work with you to validate the issue, assess impact, and prepare a fix.
- We ask for a reasonable embargo period while a fix is being prepared and rolled out. The exact length depends on severity and complexity, and we will agree it with you.
- Once a fix is available, we will publish an advisory describing the issue and its resolution.
- Reporters will be credited in the advisory unless they ask to remain anonymous.

## Examples of in-scope issues

The following are examples of issues that may be security-relevant in this repository:

- verifier accepts malformed, incomplete, non-canonical, or path-escaping bundle content as valid
- conformance runner accepts output that does not exactly match `expected-result.json`
- public API or render model turns a rejected, inferred, or not-proven fact into a verified claim
- artifact path handling allows traversal, absolute-path escape, or unintended host-file reads
- environment override behavior makes CI depend on private sibling repos or untrusted external bundle paths by default
- corpus drift changes expected verification truth without clear case-level authority
- fixtures contain real secrets, customer evidence, signing keys, tokens, or production data
- package exports widen verifier behavior without tests and conformance updates
- error-code semantics are weakened or collapsed in a way that hides why verification failed

## Generally out of scope

The following are generally not considered reportable vulnerabilities for this repository unless a concrete security impact is demonstrated:

- missing generic web-app security headers, because this repo is not a web app
- social-engineering attacks targeting maintainers or operators
- denial-of-service via volumetric traffic flooding
- third-party dependency advisories already tracked by an automated advisory feed
- claims that a production workflow did or did not happen without a concrete supplied proof bundle, manifest, artifacts, receipt, signer or key reference, and verifier result

If you believe one of the above has a concrete, demonstrable security impact in this repository, please still report it through the private channels above and explain the impact.
