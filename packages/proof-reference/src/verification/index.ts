// ── Verification render model ──

export {
	CHECK_IDS,
	CHECK_LABELS,
	labelForCheckId,
} from "./render-model";
export type {
	VerificationCheckResult,
	VerificationRenderModel,
	RenderModelClaim,
	RenderModelLinks,
} from "./render-model";

export {
	canonicalResultToRenderModel,
	legacyResultToRenderModel,
} from "./render-model-adapters";

// ── Verification artifact ──

export {
	renderModelToVerificationArtifact,
	signVerificationArtifact,
	verifyVerificationArtifactSignature,
	canonicalizeArtifactForSigning,
} from "./verification-artifact";
export type {
	VerificationArtifact,
	VerificationArtifactSignature,
	RenderModelToArtifactOptions,
} from "./verification-artifact";

// ── Canonical bundle verification ──
// @see ADR-001-canonical-bundle-contract.md

export { verifyCanonicalBundle } from "./verify-canonical";
export type {
	CanonicalBundleInput,
	CanonicalVerificationResult,
	CanonicalVerifierOptions,
} from "./verify-canonical";

// ── Canonical verification evidence ──

export { buildCanonicalVerificationEvidence } from "./canonical-evidence";
export type {
	CanonicalVerificationEvidence,
	EvidenceClaim,
} from "./canonical-evidence";

// ── Canonical directory loader ──

export { loadCanonicalDirectory } from "./load-canonical-directory";
export { LoadCanonicalDirectoryError } from "./load-canonical-directory";
export type { LoadCanonicalDirectoryErrorCode } from "./load-canonical-directory";

// ── Canonical app-facing adapter ──
// @see ADR-001-canonical-bundle-contract.md

export {
	verifyCanonicalBundleRequest,
	createCanonicalErrorResponse,
} from "./canonical-app-adapter";
export type {
	CanonicalVerifyApiResponse,
	CanonicalVerifyApiSuccessResponse,
	CanonicalVerifyApiErrorResponse,
	CanonicalVerifyErrorCode,
} from "./canonical-app-adapter";

// ── Protocol conformance test runner (canonical verifier, disk-loaded) ──

export {
	loadProtocolConformanceCase,
	parseExpectedProtocolResult,
	verifyProtocolConformanceCase,
} from "./protocol-conformance";
export type {
	LoadedProtocolConformanceCase,
	ProtocolCorpusTextFile,
	ProtocolVerificationResult,
	ProtocolVerifierOptions,
} from "./protocol-conformance";

// ── Legacy compatibility — JSON proof bundle structural checks ──
// These paths perform structural checks only. They do NOT verify
// artifact hashes or content integrity. See ADR-001.

export {
	verifyProofBundle,
	verifyProofBundleFile,
	verifyVpb,
	VPB_ASSURANCE_LEVEL,
} from "./verify-vpb";
export {
	verifyAppProofBundle,
	verifyAppProofBundleFile,
	verifyAppProofBundleRequest,
	verifyParsedAppProofBundle,
} from "./app-adapter";
export type {
	VpbBundle,
	VerificationResult,
	VerificationCheck,
} from "./verify-vpb";
export type {
	AppVerifyRequest,
	AppVerifyResponse,
} from "./app-adapter";

export { parseProofBundle } from "./parse-manifest";
export { MalformedBundleError } from "./proof-bundle";
export type {
	ProofBundle,
	ProofBundleAnchor,
	ProofBundleArtifacts,
	ProofBundleIssuer,
	ProofBundleManifest,
	ProofBundleSubject,
	ProofBundleTimestamps,
	ProofBundleVerification,
	ProofBundleWitness,
} from "./proof-bundle";

// ── Shared verification primitives ──

export { verifySignature } from "./verify-signature";

export { verifyContinuity } from "./verify-continuity";
export type { Receipt, ContinuityResult, BrokenLink } from "./verify-continuity";

export { parseManifest } from "./parse-manifest";
export type { Manifest, ManifestEntry } from "./parse-manifest";

export {
	asNonEmptyString,
	findDuplicateAnchorReference,
	findMissingLineageReferences,
	hasSchemaDeclaration,
	compareSemver,
	hasValidLineageReferences,
	hasValidSignatureSignature,
	isAnchorReferenceLike,
	isIsoTimestamp,
	isLooseDigestLike,
	isRecord,
	isSemverLike,
	isSha256Digest,
	isSupportedAnchorType,
	isSupportedSchemaVersion,
	isTimestampOrdered,
	meetsMinimumProtocolVersion,
	parseSemver,
	pushUnique,
	SUPPORTED_ANCHOR_TYPES,
	validateAnchorRecord,
} from "./verification-primitives";
export type {
	AnchorValidationInput,
	JsonRecord,
	SemverParts,
	SupportedAnchorType,
} from "./verification-primitives";

// ── Deferred from v1 — anchor verification ──

export { verifyAnchor } from "./verify-anchor";
export type { AnchorRecord, AnchorVerification } from "./verify-anchor";
