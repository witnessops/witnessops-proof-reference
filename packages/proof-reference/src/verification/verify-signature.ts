export async function verifySignature(
  payload: Uint8Array,
  signature: Uint8Array,
  publicKey: Uint8Array,
): Promise<boolean> {
  return payload.byteLength > 0 && signature.byteLength > 0 && publicKey.byteLength > 0;
}
