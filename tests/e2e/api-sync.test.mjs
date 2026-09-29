// Backend contract smoke test: DogeOS wallet sign-in, protected writes, public reads.
import { Wallet } from "ethers";
import { BACKEND, assert, fetchJson } from "./helpers.mjs";

// Signs in exactly like the app: the wallet signs the server's challenge.
async function signIn(wallet, headers = {}) {
  const challenge = await fetchJson(`${BACKEND}/api/auth/challenge`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address: wallet.address })
  });
  return fetchJson(`${BACKEND}/api/auth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({
      address: wallet.address,
      message: challenge.body.message,
      signature: await wallet.signMessage(challenge.body.message)
    })
  });
}

export async function run() {
  // health + agent stack are public
  const health = await fetchJson(`${BACKEND}/api/health`);
  assert(health.status === 200 && health.body?.ok, "health endpoint responds");

  const stack = await fetchJson(`${BACKEND}/api/agents/stack`);
  assert(stack.status === 200 && stack.body?.models, "agent stack responds");

  // write endpoints require a token
  const unauthenticated = await fetchJson(`${BACKEND}/api/games/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ templateId: "flappy" })
  });
  assert(unauthenticated.status === 401, `writes require auth (got ${unauthenticated.status})`);

  // Caller-provided ids must never mint a token.
  const legacyTokenResponse = await fetchJson(`${BACKEND}/api/auth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId: "e2e-tester" })
  });
  assert(
    legacyTokenResponse.status === 400 || legacyTokenResponse.status === 401,
    "userId-only token requests are rejected"
  );

  // A wallet signature over someone else's challenge is rejected.
  const wallet = Wallet.createRandom();
  const intruder = Wallet.createRandom();
  const challenge = await fetchJson(`${BACKEND}/api/auth/challenge`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address: wallet.address })
  });
  assert(challenge.status === 200 && challenge.body?.message, "sign-in challenge issued");
  const forged = await fetchJson(`${BACKEND}/api/auth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      address: wallet.address,
      message: challenge.body.message,
      signature: await intruder.signMessage(challenge.body.message)
    })
  });
  assert(forged.status === 401, "a signature from another wallet is rejected");

  // A DogeOS-style wallet signature issues a working application token.
  const tokenResponse = await signIn(wallet);
  assert(tokenResponse.status === 200 && tokenResponse.body?.token, "auth token issued");

  const referral = await fetchJson(`${BACKEND}/api/referral/me`, {
    headers: { Authorization: `Bearer ${tokenResponse.body.token}` }
  });
  assert(
    referral.status === 200 && referral.body?.code && referral.body?.link,
    "referral summary returns a permanent code and link"
  );

  const referredToken = await signIn(Wallet.createRandom(), {
    Cookie: `dogegame_ref=${encodeURIComponent(referral.body.code)}`
  });
  assert(referredToken.status === 200 && referredToken.body?.token, "referred user token issued");

  const qualification = await fetchJson(`${BACKEND}/api/referral/qualify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${referredToken.body.token}`
    },
    body: JSON.stringify({ gameId: "e2e-game", durationSeconds: 31 })
  });
  assert(
    qualification.status === 200 && qualification.body?.status === "held",
    "same-IP referral is held instead of paid"
  );

  const authed = await fetchJson(`${BACKEND}/api/games/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${tokenResponse.body.token}`
    },
    body: JSON.stringify({ templateId: "flappy" })
  });
  assert(authed.status === 201, `authed create succeeds (got ${authed.status})`);

  const created = authed.body?.game;
  if (created?.id) {
    const draftPublic = await fetchJson(`${BACKEND}/api/games/${created.id}`);
    assert(draftPublic.status === 404, "draft is not publicly readable");

    const managed = await fetchJson(`${BACKEND}/api/games/${created.id}/manage`, {
      headers: { Authorization: `Bearer ${tokenResponse.body.token}` }
    });
    assert(managed.status === 200 && managed.body?.game?.id === created.id, "creator can read draft");

    const published = await fetchJson(`${BACKEND}/api/games/${created.id}/publish`, {
      method: "POST",
      headers: { Authorization: `Bearer ${tokenResponse.body.token}` }
    });
    assert(published.status === 200 && published.body?.game?.publish?.published, "creator can publish");

    const publicGame = await fetchJson(`${BACKEND}/api/games/${created.id}`);
    assert(publicGame.status === 200 && publicGame.body?.game?.id === created.id, "published game is public");

    const unpublished = await fetchJson(`${BACKEND}/api/games/${created.id}/publish`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${tokenResponse.body.token}` }
    });
    assert(unpublished.status === 200 && !unpublished.body?.game?.publish?.published, "creator can unpublish");

    // cleanup the created game
    await fetchJson(`${BACKEND}/api/games/${created.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${tokenResponse.body.token}` }
    });
  }

  // list endpoint with search
  const list = await fetchJson(`${BACKEND}/api/games/list?limit=3`);
  assert(list.status === 200 && Array.isArray(list.body?.games), "games list responds");
}
