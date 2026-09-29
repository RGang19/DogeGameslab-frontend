import { getAddress } from "ethers";

import { getTokenEvmWallet } from "./api";

// Sign-in is already a DogeOS wallet signature, so the studio JWT proves which
// wallet the user owns. A wallet is "linked" when the JWT belongs to it.

export function isWalletLinkedOnSession(address: string | null | undefined): boolean {
  if (!address) return false;
  try {
    const tokenWallet = getTokenEvmWallet();
    return Boolean(tokenWallet) && getAddress(tokenWallet!) === getAddress(address);
  } catch {
    return false;
  }
}
