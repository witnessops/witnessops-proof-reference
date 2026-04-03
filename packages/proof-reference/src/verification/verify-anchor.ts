import {
  isSupportedAnchorType,
  validateAnchorRecord,
} from "./verification-primitives";

export interface AnchorRecord {
  type: "rfc3161" | "eth" | "btc";
  reference: string;
  timestamp: string;
}

export interface AnchorVerification {
  valid: boolean;
  anchorType: AnchorRecord["type"];
  details: string;
}

export async function verifyAnchor(
  rootHash: string,
  anchor: AnchorRecord,
): Promise<AnchorVerification> {
  const result = validateAnchorRecord(rootHash, anchor);

  return {
    valid: result.valid,
    anchorType: isSupportedAnchorType(anchor.type) ? anchor.type : "rfc3161",
    details: result.details,
  };
}
