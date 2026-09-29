import { parseEther } from "ethers";

import { formatZeroGBalance } from "@/lib/zeroGChain";

export function parseZeroGPriceToWei(price0G: string | number | undefined): bigint {
  const raw = String(price0G ?? "0").trim();
  if (!raw || raw === "0") return 0n;
  try {
    return parseEther(raw);
  } catch {
    return 0n;
  }
}

export function hasSufficientZeroGBalance(balanceWei: bigint, price0G: string | number | undefined) {
  const priceWei = parseZeroGPriceToWei(price0G);
  if (priceWei <= 0n) return true;
  return balanceWei >= priceWei;
}

export function formatZeroGShortfall(balanceWei: bigint, price0G: string | number | undefined) {
  const priceWei = parseZeroGPriceToWei(price0G);
  const shortfall = priceWei > balanceWei ? priceWei - balanceWei : 0n;
  return {
    balanceLabel: formatZeroGBalance(balanceWei),
    priceLabel: formatZeroGBalance(priceWei),
    shortfallLabel: formatZeroGBalance(shortfall),
    sufficient: shortfall === 0n,
  };
}
