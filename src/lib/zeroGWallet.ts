import { ZERO_G_RPC_URL } from "@/lib/zeroGChain";

export async function fetchZeroGBalance(address: string): Promise<bigint> {
  const response = await fetch(ZERO_G_RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_getBalance",
      params: [address, "latest"],
    }),
  });
  const payload = (await response.json()) as { result?: string };
  if (!payload.result) return 0n;
  return BigInt(payload.result);
}
