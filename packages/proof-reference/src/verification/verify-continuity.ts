export interface Receipt {
  id: string;
  prevHash?: string;
  hash?: string;
}

export interface BrokenLink {
  fromId: string;
  toId: string;
  expectedHash: string;
  actualHash: string;
}

export interface ContinuityResult {
  valid: boolean;
  brokenLinks: BrokenLink[];
}

export function verifyContinuity(receipts: Receipt[]): ContinuityResult {
  const brokenLinks: BrokenLink[] = [];
  const seenIds = new Set<string>();

  receipts.forEach((receipt, index) => {
    if (seenIds.has(receipt.id)) {
      brokenLinks.push({
        fromId: receipt.id,
        toId: receipt.id,
        expectedHash: "unique receipt id",
        actualHash: "duplicate receipt id",
      });
      return;
    }

    seenIds.add(receipt.id);

    if (index === 0 || !receipt.prevHash) {
      return;
    }

    const previous = receipts[index - 1];
    if (previous.hash && receipt.prevHash !== previous.hash) {
      brokenLinks.push({
        fromId: previous.id,
        toId: receipt.id,
        expectedHash: previous.hash,
        actualHash: receipt.prevHash,
      });
    }
  });

  return {
    valid: brokenLinks.length === 0,
    brokenLinks,
  };
}
