import { useEffect, useState } from "react";

import { getCurrentUserId, getCurrentUsername, IDENTITY_CHANGED_EVENT } from "@/lib/identity";

/** Reactive identity for social APIs — updates after DogeOS login without remounting. */
export function useCurrentUserId() {
  const [userId, setUserId] = useState(() => getCurrentUserId());

  useEffect(() => {
    const sync = () => setUserId(getCurrentUserId());
    window.addEventListener(IDENTITY_CHANGED_EVENT, sync);
    window.addEventListener("storage", sync);
    window.addEventListener("focus", sync);
    return () => {
      window.removeEventListener(IDENTITY_CHANGED_EVENT, sync);
      window.removeEventListener("storage", sync);
      window.removeEventListener("focus", sync);
    };
  }, []);

  return userId;
}

export function useCurrentUsername() {
  const [username, setUsername] = useState(() => getCurrentUsername());

  useEffect(() => {
    const sync = () => setUsername(getCurrentUsername());
    window.addEventListener(IDENTITY_CHANGED_EVENT, sync);
    window.addEventListener("storage", sync);
    window.addEventListener("focus", sync);
    return () => {
      window.removeEventListener(IDENTITY_CHANGED_EVENT, sync);
      window.removeEventListener("storage", sync);
      window.removeEventListener("focus", sync);
    };
  }, []);

  return username;
}
