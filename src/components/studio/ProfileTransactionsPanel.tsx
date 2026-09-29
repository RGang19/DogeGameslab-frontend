import { ExternalLink } from "lucide-react";
import { PixelIcon } from "@/components/term/PixelIcon";
import { Notice, Panel, TermLoader } from "@/components/term/Term";
import { useCallback, useEffect, useState } from "react";

import { fetchMyPaymentTransactions, type PaymentTransaction } from "@/lib/api/creatorSubscription";
import { getWalletAddress } from "@/lib/identity";

function formatAmount(amount0G: string) {
  const value = Number(amount0G);
  if (!Number.isFinite(value)) return `${amount0G} 0G`;
  const formatted = value >= 1 ? value.toFixed(value % 1 === 0 ? 0 : 2) : value.toFixed(4);
  return `${formatted} 0G`;
}

function formatWhen(createdAt: string | null) {
  if (!createdAt) return "—";
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function shortHash(txHash: string) {
  if (txHash.length < 12) return txHash;
  return `${txHash.slice(0, 6)}…${txHash.slice(-4)}`;
}

export function ProfileTransactionsPanel() {
  const walletAddress = getWalletAddress() ?? "";
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadTransactions = useCallback(async () => {
    if (!walletAddress) {
      setTransactions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const items = await fetchMyPaymentTransactions();
      setTransactions(items);
    } catch (loadError) {
      setTransactions([]);
      setError(
        loadError instanceof Error ? loadError.message : "Could not load your transactions.",
      );
    } finally {
      setLoading(false);
    }
  }, [walletAddress]);

  useEffect(() => {
    void loadTransactions();
  }, [loadTransactions]);

  return (
    <Panel
      tone="amber"
      title="ledger — 0G transactions"
      bodyClassName="p-0"
      actions={
        !loading && transactions.length > 0 ? (
          <span className="text-amber">{transactions.length} on-chain</span>
        ) : null
      }
    >
      {!walletAddress ? (
        <p className="p-4 font-mono text-[12px] text-text-3">
          Link a 0G wallet to see subscription and generation payments.
        </p>
      ) : loading ? (
        <div className="p-4">
          <TermLoader label="Reading ledger" />
        </div>
      ) : error ? (
        <div className="p-3">
          <Notice kind="error">{error}</Notice>
        </div>
      ) : transactions.length === 0 ? (
        <p className="p-4 font-mono text-[12px] text-text-3">
          No 0G payments yet. Creator Plus / Pro subscriptions and generation payments will show
          here.
        </p>
      ) : (
        <ul className="max-h-64 divide-y-2 divide-line overflow-y-auto">
          {transactions.map((transaction) => (
            <li key={transaction.id} className="flex items-center gap-3 px-3 py-2.5">
              <PixelIcon
                name={transaction.kind === "subscription" ? "crown" : "bolt"}
                size={14}
                className="shrink-0 text-amber"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-[12px] font-bold text-text">
                  {transaction.label}
                </p>
                <p className="font-mono text-[10px] text-text-3">
                  {formatWhen(transaction.createdAt)}
                  {transaction.kind === "subscription" && transaction.periods
                    ? ` · ${transaction.periods} period${transaction.periods === 1 ? "" : "s"}`
                    : ""}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-term text-[22px] leading-none text-amber">
                  {formatAmount(transaction.amount0G)}
                </p>
                <a
                  href={transaction.explorerUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-mono text-[10px] text-cyan hover:underline"
                >
                  {shortHash(transaction.txHash)}
                  <ExternalLink className="size-3" />
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
