// Single source of truth for "who is the current user".
//
// Only identities established by the real authentication flow are accepted.
// Anonymous browser-generated users must never be treated as signed-in users.

// The signed-in identity is the user's DogeOS wallet address (EVM, lowercased).
const WALLET_KEY = "dogegame_wallet";
const WALLET_NAME_KEY = "dogegame_wallet_name";
const USERNAME_KEY = "dogegame_username";
const CUSTOM_NAME_KEY = "dogegame_custom_username";

function readStorage(key: string): string | null {
  try {
    const value = localStorage.getItem(key);
    return value?.trim() || null;
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string | null | undefined) {
  try {
    if (value?.trim()) {
      localStorage.setItem(key, value.trim());
    } else {
      localStorage.removeItem(key);
    }
  } catch {
    // localStorage unavailable — ignore
  }
}

export const IDENTITY_CHANGED_EVENT = "dogegame-identity-changed";

function notifyIdentityChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(IDENTITY_CHANGED_EVENT));
}

export function setWalletIdentity(identity: {
  walletAddress: string;
  walletName?: string | null;
  username?: string | null;
}) {
  const address = identity.walletAddress.trim().toLowerCase();
  const changed = readStorage(WALLET_KEY) !== address;
  writeStorage(WALLET_KEY, address);
  writeStorage(WALLET_NAME_KEY, identity.walletName);
  if (!readStorage(CUSTOM_NAME_KEY)) writeStorage(USERNAME_KEY, identity.username);
  if (changed) notifyIdentityChanged();
}

export function clearWalletIdentity() {
  writeStorage(WALLET_KEY, null);
  writeStorage(WALLET_NAME_KEY, null);
  writeStorage(USERNAME_KEY, null);
  writeStorage(CUSTOM_NAME_KEY, null);
  notifyIdentityChanged();
}

/** Name of the connected wallet (e.g. "MyDoge", "DogeOS Wallet"), if known. */
export function getWalletName(): string | null {
  return readStorage(WALLET_NAME_KEY);
}

/** Remove identities created by the retired anonymous-user flow. */
export function clearLegacyAnonymousIdentity() {
  try {
    localStorage.removeItem("dogegame_anon_uid");
    localStorage.removeItem("dogegame_anon_username");
  } catch {
    // localStorage unavailable — ignore
  }
}

export function getWalletAddress(): string | null {
  const value = readStorage(WALLET_KEY);
  return value && /^0x[a-fA-F0-9]{40}$/.test(value) ? value.toLowerCase() : null;
}

/** Returns the authenticated user's id, or an empty value for public visitors. */
export function getCurrentUserId(): string {
  return getWalletAddress() ?? "";
}

/**
 * True once a proper display name exists (custom name, wallet name, or a wallet
 * to derive one from) — i.e. the identity is "ready". False when we only have a
 * raw user id and must fall back to a temporary id-derived label.
 */
export function hasDisplayName(): boolean {
  return Boolean(
    readStorage(CUSTOM_NAME_KEY) || readStorage(USERNAME_KEY) || getWalletAddress(),
  );
}

// A short, readable stand-in derived from the raw user id. Used only until a
// real name is available, so scores are never labelled with an empty string.
function shortenUserId(id: string): string {
  const bare = id.replace(/^0x/, "");
  if (!bare) return "Player";
  return `Player-${bare.slice(-4)}`;
}

/** Display name for the authenticated identity. */
export function getCurrentUsername(): string {
  const customName = readStorage(CUSTOM_NAME_KEY);
  if (customName) return customName;
  const username = readStorage(USERNAME_KEY);
  if (username) return username;

  const wallet = getWalletAddress();
  if (wallet) return `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;

  // Identity not fully ready yet — use a shortened user id as a temporary label.
  // getCurrentUsername() is re-read on every submit, and useLeaderboard also
  // re-labels the stored entry once a real name arrives (IDENTITY_CHANGED_EVENT).
  const userId = getCurrentUserId();
  if (userId) return shortenUserId(userId);

  return "Player";
}

export function setCurrentUsername(name: string): string {
  const cleanName = name.trim().slice(0, 32);
  if (!cleanName) return getCurrentUsername();
  writeStorage(CUSTOM_NAME_KEY, cleanName);
  writeStorage(USERNAME_KEY, cleanName);
  return cleanName;
}

function normalizeIdentity(value: string | null | undefined): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  return /^0x[a-fA-F0-9]{40}$/.test(raw) ? raw.toLowerCase() : raw;
}

/** All ids that should resolve to the current signed-in creator. */
export function getIdentityAliases(): string[] {
  return [
    ...new Set(
      [
        getCurrentUserId(),
      ]
        .map(normalizeIdentity)
        .filter(Boolean),
    ),
  ] as string[];
}

/** True when `creatorId` belongs to the current user (or is unset/legacy). */
export function ownsGame(creatorId: string | null | undefined): boolean {
  if (!creatorId || creatorId === "anonymous") return true;
  const normalized = normalizeIdentity(creatorId);
  if (!normalized) return true;
  return getIdentityAliases().includes(normalized);
}
