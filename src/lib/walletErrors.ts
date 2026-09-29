type WalletErrorContext = {
  /** Plain-language action, e.g. "subscribe with 0G" */
  action?: string;
};

function collectErrorText(error: unknown): string {
  const chunks: string[] = [];

  const visit = (value: unknown, depth = 0) => {
    if (depth > 4 || value == null) return;
    if (typeof value === "string") {
      if (value.trim()) chunks.push(value.trim());
      return;
    }
    if (value instanceof Error) {
      visit(value.message, depth + 1);
      const cause = (value as Error & { cause?: unknown }).cause;
      if (cause) visit(cause, depth + 1);
      return;
    }
    if (typeof value !== "object") return;

    const record = value as Record<string, unknown>;
    for (const key of ["shortMessage", "reason", "message", "details", "data"]) {
      if (key in record) visit(record[key], depth + 1);
    }
    if ("error" in record) visit(record.error, depth + 1);
    if ("info" in record) visit(record.info, depth + 1);
  };

  visit(error);
  return chunks.join(" ");
}

function includesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

/** True when the user closed the wallet, rejected, or the prompt timed out. */
export function isWalletUserAbort(error: unknown): boolean {
  const text = collectErrorText(error).toLowerCase();
  return includesAny(text, [
    /user rejected/,
    /user denied/,
    /action_rejected/,
    /request rejected/,
    /transaction was rejected/,
    /wallet timeout/,
    /\b4001\b/,
    /\bcancel(l)?ed\b/,
    /\breject(ed)?\b/,
  ]);
}

/** Turn ethers / DogeOS / injected wallet errors into user-facing copy. */
export function formatWalletError(error: unknown, context: WalletErrorContext = {}): string {
  const action = context.action ?? "complete the wallet request";
  const text = collectErrorText(error);
  const lower = text.toLowerCase();

  if (!text.trim()) {
    return `Could not ${action}. Check that your wallet is unlocked on 0G Mainnet, then try again.`;
  }

  if (includesAny(lower, [/wallet timeout/])) {
    return `Your wallet did not respond in time. Open your wallet extension, approve the subscription transaction, then try again. If the popup is hidden, click the wallet icon in your browser toolbar.`;
  }

  if (isWalletUserAbort(error)) {
    return `Transaction cancelled in your wallet. When you're ready, click Subscribe again to confirm the payment.`;
  }

  if (includesAny(lower, [/insufficient funds/, /insufficient balance/, /exceeds balance/])) {
    return `Not enough 0G for this subscription and the network fee. Top up your wallet, leave a little extra for gas, then try again.`;
  }

  if (includesAny(lower, [/network changed/, /chain mismatch/, /wrong network/])) {
    return `Switch your wallet to 0G Mainnet, then try again.`;
  }

  if (includesAny(lower, [/nonce too low/, /replacement transaction underpriced/])) {
    return `A previous wallet transaction is still pending. Wait for it to finish or reset activity in your wallet, then try again.`;
  }

  if (includesAny(lower, [/could not coalesce error/, /unknown_error/, /eth_sendtransaction/])) {
    return `Your wallet could not send the subscription transaction. Unlock the wallet, stay on 0G Mainnet, approve the 10 0G payment, then try again.`;
  }

  const responseError = (error as { response?: { data?: { error?: string } } })?.response?.data
    ?.error;
  if (typeof responseError === "string" && responseError.trim()) {
    return responseError.trim();
  }

  if (text.length <= 180 && !includesAny(lower, [/0x[a-f0-9]{8,}/, /jsonrpc/, /payload=/])) {
    return text;
  }

  return `Could not ${action}. Check that your wallet is unlocked on 0G Mainnet, then try again.`;
}

export function getWalletErrorPresentation(
  error: unknown,
  context: WalletErrorContext = {},
): { message: string; kind: "payment" | "error" } {
  const message =
    error instanceof Error && error.message && !/could not coalesce error/i.test(error.message)
      ? error.message
      : formatWalletError(error, context);
  return {
    message,
    kind: isWalletUserAbort(error) ? "payment" : "error",
  };
}
